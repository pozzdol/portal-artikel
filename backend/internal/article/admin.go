package article

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
	"portal-berita/backend/internal/richtext"
	"portal-berita/backend/internal/slugutil"
)

// maxExcerptRunes is the auto-excerpt length (articles.excerpt CHECK ≤ 300).
const maxExcerptRunes = 300

// prepared is an Input after pure (DB-free) validation and derivation.
type prepared struct {
	ContentJSON    []byte
	ContentHTML    string
	ContentText    string
	ReadingMinutes int16
	Excerpt        *string
	CoverCaption   *string
	EventDate      *time.Time
	EventLocation  *string
	SeoTitle       *string
	SeoDescription *string
	CanonicalURL   *string
	NewTags        []dbgen.GetOrCreateTagParams
}

// trimPtr trims s and maps "" to nil.
func trimPtr(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return &t
}

// prepareInput validates the parts of in that need no database and derives
// the stored content fields. Field errors are returned as one 422.
func prepareInput(in Input) (prepared, error) {
	fields := map[string]string{}
	var p prepared

	if strings.TrimSpace(in.Title) == "" {
		fields["title"] = "Wajib diisi."
	}
	if in.Slug != nil && *in.Slug != "" && !slugutil.Valid(*in.Slug) {
		fields["slug"] = msgSlugInvalid
	}

	// content_json must be a Tiptap document object: {"type":"doc", ...}.
	var doc map[string]json.RawMessage
	if err := json.Unmarshal(in.ContentJSON, &doc); err != nil || doc == nil {
		fields["content_json"] = "Konten harus berupa dokumen editor (objek dengan type \"doc\")."
	} else {
		var typ string
		if err := json.Unmarshal(doc["type"], &typ); err != nil || typ != "doc" {
			fields["content_json"] = "Konten harus berupa dokumen editor (objek dengan type \"doc\")."
		} else {
			var buf bytes.Buffer
			if err := json.Compact(&buf, in.ContentJSON); err != nil {
				fields["content_json"] = "Format konten tidak valid."
			}
			p.ContentJSON = buf.Bytes()
		}
	}

	if in.ContentHTML != nil {
		if len(*in.ContentHTML) > MaxContentHTMLBytes {
			fields["content_html"] = "Konten terlalu panjang."
		}
		p.ContentHTML = richtext.Sanitize(*in.ContentHTML)
	}
	p.ContentText = richtext.Text(p.ContentHTML)
	p.ReadingMinutes = richtext.ReadingMinutes(p.ContentText)

	if ex := trimPtr(in.Excerpt); ex != nil {
		p.Excerpt = ex
	} else if auto := richtext.Excerpt(p.ContentText, maxExcerptRunes); auto != "" {
		p.Excerpt = &auto
	}

	if in.EventDate != nil && *in.EventDate != "" {
		d, err := httpx.ParseDate(*in.EventDate)
		if err != nil {
			fields["event_date"] = "Format tanggal harus YYYY-MM-DD."
		} else {
			wd := httpx.WIBDate(d)
			p.EventDate = &wd
		}
	}

	if cu := trimPtr(in.CanonicalURL); cu != nil {
		u, err := url.Parse(*cu)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			fields["canonical_url"] = "URL kanonis harus diawali http:// atau https://."
		}
		p.CanonicalURL = cu
	}

	seen := map[string]bool{}
	for i, name := range in.NewTags {
		name = strings.TrimSpace(name)
		slug := slugutil.Make(name)
		if name == "" || slug == "" {
			fields[fmt.Sprintf("new_tags[%d]", i)] = "Nama tag tidak valid."
			continue
		}
		if seen[slug] {
			continue
		}
		seen[slug] = true
		p.NewTags = append(p.NewTags, dbgen.GetOrCreateTagParams{Name: name, Slug: slug})
	}

	p.CoverCaption = trimPtr(in.CoverCaption)
	p.EventLocation = trimPtr(in.EventLocation)
	p.SeoTitle = trimPtr(in.SeoTitle)
	p.SeoDescription = trimPtr(in.SeoDescription)

	if len(fields) > 0 {
		return prepared{}, apperr.Validation(fields)
	}
	return p, nil
}

// checkRefs verifies the category (exists, active) and author (exists,
// active) of an article.
func checkRefs(ctx context.Context, q *dbgen.Queries, categoryID, authorID int64) error {
	cat, err := q.GetCategory(ctx, categoryID)
	if errors.Is(err, pgx.ErrNoRows) {
		return apperr.Validation(map[string]string{"category_id": "Kategori tidak ditemukan."})
	}
	if err != nil {
		return fmt.Errorf("article: get category: %w", err)
	}
	if !cat.IsActive {
		return apperr.Validation(map[string]string{"category_id": "Kategori tidak aktif."})
	}
	u, err := q.GetUserByID(ctx, authorID)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !u.IsActive) {
		return apperr.Validation(map[string]string{"author_id": "Penulis tidak ditemukan atau tidak aktif."})
	}
	if err != nil {
		return fmt.Errorf("article: get author: %w", err)
	}
	return nil
}

// resolveTagIDs validates tag_ids and creates new_tags, returning the union.
func resolveTagIDs(ctx context.Context, q *dbgen.Queries, ids []int64, newTags []dbgen.GetOrCreateTagParams) ([]int64, error) {
	out := make([]int64, 0, len(ids)+len(newTags))
	for _, id := range ids {
		if !slices.Contains(out, id) {
			out = append(out, id)
		}
	}
	if len(out) > 0 {
		rows, err := q.ListTagsByIDs(ctx, out)
		if err != nil {
			return nil, fmt.Errorf("article: list tags by ids: %w", err)
		}
		if len(rows) != len(out) {
			return nil, apperr.Validation(map[string]string{"tag_ids": "Sebagian tag tidak ditemukan."})
		}
	}
	for _, nt := range newTags {
		t, err := q.GetOrCreateTag(ctx, nt)
		if err != nil {
			return nil, fmt.Errorf("article: get or create tag: %w", err)
		}
		if !slices.Contains(out, t.ID) {
			out = append(out, t.ID)
		}
	}
	return out, nil
}

func replaceTags(ctx context.Context, q *dbgen.Queries, articleID int64, ids []int64) error {
	if err := q.DeleteArticleTags(ctx, articleID); err != nil {
		return fmt.Errorf("article: delete tags: %w", err)
	}
	if len(ids) == 0 {
		return nil
	}
	if err := q.AddArticleTags(ctx, dbgen.AddArticleTagsParams{ArticleID: articleID, TagIds: ids}); err != nil {
		return fmt.Errorf("article: add tags: %w", err)
	}
	return nil
}

// writeErr maps constraint violations of CreateArticle/UpdateArticle to 422.
func writeErr(op string, err error) error {
	if c, ok := database.UniqueViolation(err); ok && c == "articles_slug_key" {
		return apperr.Validation(map[string]string{"slug": msgSlugTaken})
	}
	if c, ok := database.ForeignKeyViolation(err); ok {
		switch c {
		case "articles_cover_media_id_fkey":
			return apperr.Validation(map[string]string{"cover_media_id": "Media tidak ditemukan."})
		case "articles_og_media_id_fkey":
			return apperr.Validation(map[string]string{"og_media_id": "Media tidak ditemukan."})
		case "articles_category_id_fkey":
			return apperr.Validation(map[string]string{"category_id": "Kategori tidak ditemukan."})
		case "articles_author_id_fkey":
			return apperr.Validation(map[string]string{"author_id": "Penulis tidak ditemukan atau tidak aktif."})
		}
	}
	return fmt.Errorf("article: %s: %w", op, err)
}

func getArticle(ctx context.Context, q *dbgen.Queries, id int64) (dbgen.Article, error) {
	a, err := q.GetArticle(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return dbgen.Article{}, apperr.NotFound()
	}
	if err != nil {
		return dbgen.Article{}, fmt.Errorf("article: get: %w", err)
	}
	return a, nil
}

// getLive returns a non-deleted article (404 for missing or trashed).
func getLive(ctx context.Context, q *dbgen.Queries, id int64) (dbgen.Article, error) {
	a, err := getArticle(ctx, q, id)
	if err != nil {
		return a, err
	}
	if a.DeletedAt != nil {
		return dbgen.Article{}, apperr.NotFound()
	}
	return a, nil
}

func adminItem(card content.ArticleCard, a dbgen.Article) AdminItem {
	return AdminItem{
		ArticleCard: card,
		Status:      a.Status,
		CreatedBy:   a.CreatedBy,
		CreatedAt:   httpx.FormatTime(a.CreatedAt),
		UpdatedAt:   httpx.FormatTime(a.UpdatedAt),
		DeletedAt:   httpx.FormatTimePtr(a.DeletedAt),
	}
}

// adminDetail hydrates a full admin article over db (pool or tx).
func adminDetail(ctx context.Context, db dbgen.DBTX, a dbgen.Article) (*AdminDetail, error) {
	h := content.NewHydrator(db)
	card, err := h.Card(ctx, a)
	if err != nil {
		return nil, err
	}
	tags, err := articleTagRefs(ctx, dbgen.New(db), a.ID)
	if err != nil {
		return nil, err
	}
	var og *content.Media
	if a.OgMediaID != nil {
		m, err := h.Media(ctx, []int64{*a.OgMediaID})
		if err != nil {
			return nil, err
		}
		if v, ok := m[*a.OgMediaID]; ok {
			og = &v
		}
	}
	cj := json.RawMessage(a.ContentJson)
	if len(cj) == 0 {
		cj = json.RawMessage(`{"type":"doc","content":[]}`)
	}
	return &AdminDetail{
		AdminItem:    adminItem(card, a),
		CategoryID:   a.CategoryID,
		AuthorID:     a.AuthorID,
		CoverMediaID: a.CoverMediaID,
		CoverCaption: a.CoverCaption,
		ContentJSON:  cj,
		ContentHTML:  a.ContentHtml,
		Tags:         tags,
		SEO: AdminSEO{
			Title: a.SeoTitle, Description: a.SeoDescription,
			OgMediaID: a.OgMediaID, Og: og, CanonicalURL: a.CanonicalUrl,
		},
	}, nil
}

// List returns a filtered, paginated page of admin articles.
func (s *Service) List(ctx context.Context, _ Actor, f ListFilter) ([]AdminItem, int64, error) {
	q := dbgen.New(s.pool)
	p := dbgen.ListArticlesAdminParams{
		Trashed: f.Trashed,
		Sort:    "-updated_at",
		Offset:  int32(f.Page.Offset),
		Limit:   int32(f.Page.PerPage),
	}
	if slices.Contains(adminSorts, f.Sort) {
		p.Sort = f.Sort
	}
	if f.Q != "" {
		p.Q = strPtr(f.Q)
	}
	if f.Status != "" {
		if !validStatus(f.Status) {
			return nil, 0, apperr.BadRequest("Parameter status tidak valid.")
		}
		p.Status = strPtr(f.Status)
	}
	if f.AuthorID > 0 {
		id := f.AuthorID
		p.AuthorID = &id
	}
	if f.Category != "" {
		cats, err := q.ListCategories(ctx)
		if err != nil {
			return nil, 0, fmt.Errorf("article: list categories: %w", err)
		}
		ids, ok := categoryTreeIDs(cats, f.Category, false)
		if !ok {
			return []AdminItem{}, 0, nil
		}
		p.CategoryIds = ids
	}
	rows, err := q.ListArticlesAdmin(ctx, p)
	if err != nil {
		return nil, 0, fmt.Errorf("article: list admin: %w", err)
	}
	total, err := q.CountArticlesAdmin(ctx, dbgen.CountArticlesAdminParams{
		Q: p.Q, Status: p.Status, CategoryIds: p.CategoryIds, AuthorID: p.AuthorID, Trashed: p.Trashed,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("article: count admin: %w", err)
	}
	cards, err := content.NewHydrator(s.pool).Cards(ctx, rows)
	if err != nil {
		return nil, 0, err
	}
	items := make([]AdminItem, len(rows))
	for i, a := range rows {
		items[i] = adminItem(cards[i], a)
	}
	return items, total, nil
}

func validStatus(s string) bool {
	switch s {
	case content.StatusDraft, content.StatusScheduled, content.StatusPublished, content.StatusArchived:
		return true
	}
	return false
}

// Get returns one article (any status, including trashed).
func (s *Service) Get(ctx context.Context, _ Actor, id int64) (*AdminDetail, error) {
	a, err := getArticle(ctx, dbgen.New(s.pool), id)
	if err != nil {
		return nil, err
	}
	return adminDetail(ctx, s.pool, a)
}

// Create inserts a draft article.
func (s *Service) Create(ctx context.Context, a Actor, in Input) (*AdminDetail, error) {
	p, err := prepareInput(in)
	if err != nil {
		return nil, err
	}
	authorID := a.UserID
	if in.AuthorID != nil {
		authorID = *in.AuthorID
	}
	var row dbgen.Article
	var tags []string
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		if err := checkRefs(ctx, q, in.CategoryID, authorID); err != nil {
			return err
		}
		slug, err := resolveSlug(ctx, q, in.Slug, in.Title, "", 0)
		if err != nil {
			return err
		}
		tagIDs, err := resolveTagIDs(ctx, q, in.TagIDs, p.NewTags)
		if err != nil {
			return err
		}
		actor := actorID(a)
		row, err = q.CreateArticle(ctx, dbgen.CreateArticleParams{
			Title: strings.TrimSpace(in.Title), Slug: slug, Excerpt: p.Excerpt,
			ContentJson: p.ContentJSON, ContentHtml: p.ContentHTML, ContentText: p.ContentText,
			CoverMediaID: in.CoverMediaID, CoverCaption: p.CoverCaption,
			CategoryID: in.CategoryID, AuthorID: authorID, Status: content.StatusDraft,
			IsFeatured: in.IsFeatured, IsBreaking: in.IsBreaking, ReadingMinutes: p.ReadingMinutes,
			EventDate: p.EventDate, EventLocation: p.EventLocation,
			SeoTitle: p.SeoTitle, SeoDescription: p.SeoDescription, OgMediaID: in.OgMediaID,
			CanonicalUrl: p.CanonicalURL, CreatedBy: actor, UpdatedBy: actor,
		})
		if err != nil {
			return writeErr("create", err)
		}
		if err := replaceTags(ctx, q, row.ID, tagIDs); err != nil {
			return err
		}
		refs, err := articleTagRefs(ctx, q, row.ID)
		if err != nil {
			return err
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: a.Meta.UserID, Action: audit.ActionCreate, EntityType: audit.EntityArticle,
			EntityID: &row.ID, Summary: fmt.Sprintf("Membuat artikel %q.", row.Title),
			Changes: map[string]any{"title": row.Title, "slug": row.Slug, "status": row.Status},
			IP:      a.Meta.IP,
		}); err != nil {
			return err
		}
		tags, err = collectRevalTags(ctx, q, []revalRef{refOf(row)}, tagSlugs(refs))
		return err
	})
	if err != nil {
		return nil, err
	}
	s.reval.Enqueue(tags...)
	return adminDetail(ctx, s.pool, row)
}

// actorID returns a pointer to the actor's user id, or nil for a system actor.
func actorID(a Actor) *int64 {
	if a.UserID <= 0 {
		return nil
	}
	id := a.UserID
	return &id
}

// canEdit reports whether a may edit art: its creator, or anyone holding
// articles.update_any.
func canEdit(a Actor, art dbgen.Article) bool {
	if a.Perms.Has(rbac.PermArticlesUpdateAny) {
		return true
	}
	return art.CreatedBy != nil && a.UserID > 0 && *art.CreatedBy == a.UserID
}

// Update replaces the editable fields of an article. Status and
// published_at are untouched. A slug change stores a redirect from the old
// slug (docs §1.15).
func (s *Service) Update(ctx context.Context, a Actor, id int64, in Input) (*AdminDetail, error) {
	p, err := prepareInput(in)
	if err != nil {
		return nil, err
	}
	var row dbgen.Article
	var tags []string
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		old, err := getLive(ctx, q, id)
		if err != nil {
			return err
		}
		if !canEdit(a, old) {
			return apperr.Forbidden("Anda hanya dapat mengubah artikel milik Anda sendiri.")
		}
		authorID := old.AuthorID
		if in.AuthorID != nil {
			authorID = *in.AuthorID
		}
		if err := checkRefs(ctx, q, in.CategoryID, authorID); err != nil {
			return err
		}
		oldTags, err := articleTagRefs(ctx, q, id)
		if err != nil {
			return err
		}
		slug, err := resolveSlug(ctx, q, in.Slug, in.Title, old.Slug, id)
		if err != nil {
			return err
		}
		tagIDs, err := resolveTagIDs(ctx, q, in.TagIDs, p.NewTags)
		if err != nil {
			return err
		}
		row, err = q.UpdateArticle(ctx, dbgen.UpdateArticleParams{
			ID: id, Title: strings.TrimSpace(in.Title), Slug: slug, Excerpt: p.Excerpt,
			ContentJson: p.ContentJSON, ContentHtml: p.ContentHTML, ContentText: p.ContentText,
			CoverMediaID: in.CoverMediaID, CoverCaption: p.CoverCaption,
			CategoryID: in.CategoryID, AuthorID: authorID,
			IsFeatured: in.IsFeatured, IsBreaking: in.IsBreaking, ReadingMinutes: p.ReadingMinutes,
			EventDate: p.EventDate, EventLocation: p.EventLocation,
			SeoTitle: p.SeoTitle, SeoDescription: p.SeoDescription, OgMediaID: in.OgMediaID,
			CanonicalUrl: p.CanonicalURL, UpdatedBy: actorID(a),
		})
		if err != nil {
			return writeErr("update", err)
		}
		changes := map[string]any{"title": row.Title}
		if row.Slug != old.Slug {
			if err := q.DeleteSlugRedirect(ctx, row.Slug); err != nil {
				return fmt.Errorf("article: delete slug redirect: %w", err)
			}
			if err := q.UpsertSlugRedirect(ctx, dbgen.UpsertSlugRedirectParams{OldSlug: old.Slug, ArticleID: id}); err != nil {
				return fmt.Errorf("article: upsert slug redirect: %w", err)
			}
			changes["slug"] = map[string]string{"old": old.Slug, "new": row.Slug}
		}
		if row.CategoryID != old.CategoryID {
			changes["category_id"] = map[string]int64{"old": old.CategoryID, "new": row.CategoryID}
		}
		if row.AuthorID != old.AuthorID {
			changes["author_id"] = map[string]int64{"old": old.AuthorID, "new": row.AuthorID}
		}
		if err := replaceTags(ctx, q, id, tagIDs); err != nil {
			return err
		}
		newTags, err := articleTagRefs(ctx, q, id)
		if err != nil {
			return err
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: a.Meta.UserID, Action: audit.ActionUpdate, EntityType: audit.EntityArticle,
			EntityID: &id, Summary: fmt.Sprintf("Memperbarui artikel %q.", row.Title),
			Changes: changes, IP: a.Meta.IP,
		}); err != nil {
			return err
		}
		tags, err = collectRevalTags(ctx, q,
			[]revalRef{refOf(old), refOf(row)},
			append(tagSlugs(oldTags), tagSlugs(newTags)...))
		return err
	})
	if err != nil {
		return nil, err
	}
	s.reval.Enqueue(tags...)
	return adminDetail(ctx, s.pool, row)
}

// statusChange runs fn (which returns the new row) on a live article inside
// a transaction with an audit entry and enqueues revalidation after commit.
func (s *Service) statusChange(ctx context.Context, a Actor, id int64,
	fn func(q *dbgen.Queries, old dbgen.Article) (dbgen.Article, string, string, error),
) (dbgen.Article, error) {
	var row dbgen.Article
	var tags []string
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		old, err := getLive(ctx, q, id)
		if err != nil {
			return err
		}
		var action, summary string
		row, action, summary, err = fn(q, old)
		if err != nil {
			return err
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: a.Meta.UserID, Action: action, EntityType: audit.EntityArticle,
			EntityID: &id, Summary: summary,
			Changes: map[string]any{
				"status":       map[string]string{"old": old.Status, "new": row.Status},
				"published_at": httpx.FormatTimePtr(row.PublishedAt),
			},
			IP: a.Meta.IP,
		}); err != nil {
			return err
		}
		refs, err := articleTagRefs(ctx, q, id)
		if err != nil {
			return err
		}
		tags, err = collectRevalTags(ctx, q, []revalRef{refOf(row)}, tagSlugs(refs))
		return err
	})
	if err != nil {
		return dbgen.Article{}, err
	}
	s.reval.Enqueue(tags...)
	return row, nil
}

// Publish publishes an article now (at nil or not in the future; a past at
// back-dates published_at) or schedules it (at in the future). Re-publishing
// an already published article without at keeps its published_at.
func (s *Service) Publish(ctx context.Context, a Actor, id int64, at *time.Time) (*AdminDetail, error) {
	now := s.now()
	row, err := s.statusChange(ctx, a, id, func(q *dbgen.Queries, old dbgen.Article) (dbgen.Article, string, string, error) {
		status, action := content.StatusPublished, audit.ActionPublish
		var when *time.Time
		switch {
		case at != nil && at.After(now):
			status, action = content.StatusScheduled, audit.ActionSchedule
			t := at.UTC()
			when = &t
		case at != nil:
			t := at.UTC()
			when = &t
		case old.Status == content.StatusPublished && old.PublishedAt != nil:
			// keep the original publication time
		default:
			// Whole seconds: tolerates a small app/DB clock skew for the
			// public "published_at <= now()" predicate.
			t := now.UTC().Truncate(time.Second)
			when = &t
		}
		row, err := q.SetArticleStatus(ctx, dbgen.SetArticleStatusParams{
			ID: id, Status: status, PublishedAt: when, UpdatedBy: actorID(a),
		})
		if err != nil {
			return dbgen.Article{}, "", "", fmt.Errorf("article: set status: %w", err)
		}
		summary := fmt.Sprintf("Menerbitkan artikel %q.", row.Title)
		if status == content.StatusScheduled {
			summary = fmt.Sprintf("Menjadwalkan artikel %q pada %s.", row.Title, httpx.FormatTime(*when))
		}
		return row, action, summary, nil
	})
	if err != nil {
		return nil, err
	}
	return adminDetail(ctx, s.pool, row)
}

// Unpublish moves an article back to draft (published_at is kept).
func (s *Service) Unpublish(ctx context.Context, a Actor, id int64) (*AdminDetail, error) {
	row, err := s.statusChange(ctx, a, id, func(q *dbgen.Queries, _ dbgen.Article) (dbgen.Article, string, string, error) {
		row, err := q.SetArticleStatus(ctx, dbgen.SetArticleStatusParams{
			ID: id, Status: content.StatusDraft, UpdatedBy: actorID(a),
		})
		if err != nil {
			return dbgen.Article{}, "", "", fmt.Errorf("article: set status: %w", err)
		}
		return row, audit.ActionUnpublish, fmt.Sprintf("Membatalkan terbit artikel %q.", row.Title), nil
	})
	if err != nil {
		return nil, err
	}
	return adminDetail(ctx, s.pool, row)
}

// Delete soft-deletes an article (404 when missing or already trashed).
func (s *Service) Delete(ctx context.Context, a Actor, id int64) error {
	return s.trash(ctx, a, id, true)
}

// Restore restores a trashed article (404 when missing or not trashed).
func (s *Service) Restore(ctx context.Context, a Actor, id int64) error {
	return s.trash(ctx, a, id, false)
}

func (s *Service) trash(ctx context.Context, a Actor, id int64, del bool) error {
	var tags []string
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		art, err := getArticle(ctx, q, id)
		if err != nil {
			return err
		}
		var n int64
		action, summary := audit.ActionDelete, fmt.Sprintf("Memindahkan artikel %q ke tempat sampah.", art.Title)
		if del {
			n, err = q.SoftDeleteArticle(ctx, id)
		} else {
			action, summary = audit.ActionRestore, fmt.Sprintf("Memulihkan artikel %q.", art.Title)
			n, err = q.RestoreArticle(ctx, id)
		}
		if err != nil {
			return fmt.Errorf("article: %s: %w", action, err)
		}
		if n == 0 {
			return apperr.NotFound()
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: a.Meta.UserID, Action: action, EntityType: audit.EntityArticle,
			EntityID: &id, Summary: summary, IP: a.Meta.IP,
		}); err != nil {
			return err
		}
		refs, err := articleTagRefs(ctx, q, id)
		if err != nil {
			return err
		}
		tags, err = collectRevalTags(ctx, q, []revalRef{refOf(art)}, tagSlugs(refs))
		return err
	})
	if err != nil {
		return err
	}
	s.reval.Enqueue(tags...)
	return nil
}

// PreviewToken issues a preview token for a live (non-trashed) article.
func (s *Service) PreviewToken(ctx context.Context, _ Actor, id int64) (PreviewToken, error) {
	art, err := getLive(ctx, dbgen.New(s.pool), id)
	if err != nil {
		return PreviewToken{}, err
	}
	card, err := content.NewHydrator(s.pool).Card(ctx, art)
	if err != nil {
		return PreviewToken{}, err
	}
	token, exp, err := s.preview.Issue(art.ID)
	if err != nil {
		return PreviewToken{}, err
	}
	return PreviewToken{
		Token:     token,
		ExpiresAt: httpx.FormatTime(exp),
		URL:       card.URL + "?preview=" + url.QueryEscape(token),
	}, nil
}
