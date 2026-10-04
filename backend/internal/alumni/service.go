package alumni

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/richtext"
	"portal-berita/backend/internal/slugutil"
)

// Service implements alumni profile CRUD and public listing.
type Service struct {
	pool    *pgxpool.Pool
	auditor *audit.Logger
	reval   revalidate.Client
}

// NewService returns an alumni Service.
func NewService(pool *pgxpool.Pool, auditor *audit.Logger, reval revalidate.Client) *Service {
	return &Service{pool: pool, auditor: auditor, reval: reval}
}

// List returns the admin listing.
func (s *Service) List(ctx context.Context, f ListFilter) ([]Item, int64, error) {
	q := dbgen.New(s.pool)
	params := dbgen.ListAlumniAdminParams{
		Q: nullStr(f.Q), Status: nullStr(f.Status),
		Offset: int32(f.Page.Offset), Limit: int32(f.Page.PerPage),
	}
	rows, err := q.ListAlumniAdmin(ctx, params)
	if err != nil {
		return nil, 0, fmt.Errorf("alumni: list: %w", err)
	}
	total, err := q.CountAlumniAdmin(ctx, dbgen.CountAlumniAdminParams{Q: params.Q, Status: params.Status})
	if err != nil {
		return nil, 0, fmt.Errorf("alumni: count: %w", err)
	}
	items := make([]Item, len(rows))
	for i, r := range rows {
		items[i] = itemFromRow(r)
	}
	return items, total, nil
}

// Get returns one alumni profile by id, or apperr.NotFound.
func (s *Service) Get(ctx context.Context, id int64) (*Item, error) {
	row, err := dbgen.New(s.pool).GetAlumni(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("alumni: get: %w", err)
	}
	item := itemFromRow(row)
	return &item, nil
}

// Create inserts a new alumni profile.
func (s *Service) Create(ctx context.Context, meta audit.Meta, in Input) (*Item, error) {
	status := in.Status
	if status == "" {
		status = content.StatusDraft
	}
	html := richtext.Sanitize(in.StoryHTML)

	var out *Item
	var slug string
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		var err error
		slug, err = uniqueSlug(ctx, q, in.Name, in.Slug, 0)
		if err != nil {
			return err
		}
		created, err := q.CreateAlumni(ctx, dbgen.CreateAlumniParams{
			Name: in.Name, Slug: slug, RoleTitle: in.RoleTitle, ClassYear: in.ClassYear,
			ShortBio: in.ShortBio, StoryJson: nilIfEmpty(in.StoryJSON), StoryHtml: nullStr(html),
			PhotoMediaID: in.PhotoMediaID, IsFeatured: in.IsFeatured, SortOrder: in.SortOrder, Status: status,
			SeoTitle: in.SEOTitle, SeoDescription: in.SEODescription,
			CreatedBy: meta.UserID, UpdatedBy: meta.UserID,
		})
		if err != nil {
			return mapWriteError(err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionCreate, EntityType: audit.EntityAlumni,
			EntityID: &created.ID, Summary: "Tokoh alumni dibuat: " + created.Name, IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("alumni: audit: %w", err)
		}
		item := itemFromRow(created)
		out = &item
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.reval.Enqueue(revalidate.Alumni(slug), revalidate.TagAlumni, revalidate.TagHomepage, revalidate.TagSitemap)
	return out, nil
}

// Update replaces an alumni profile.
func (s *Service) Update(ctx context.Context, meta audit.Meta, id int64, in Input) (*Item, error) {
	html := richtext.Sanitize(in.StoryHTML)

	var out *Item
	var oldSlug, newSlug string
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		existing, err := q.GetAlumni(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("alumni: get for update: %w", err)
		}
		oldSlug = existing.Slug
		status := in.Status
		if status == "" {
			status = existing.Status
		}
		newSlug, err = uniqueSlug(ctx, q, in.Name, in.Slug, id)
		if err != nil {
			return err
		}
		updated, err := q.UpdateAlumni(ctx, dbgen.UpdateAlumniParams{
			ID: id, Name: in.Name, Slug: newSlug, RoleTitle: in.RoleTitle, ClassYear: in.ClassYear,
			ShortBio: in.ShortBio, StoryJson: nilIfEmpty(in.StoryJSON), StoryHtml: nullStr(html),
			PhotoMediaID: in.PhotoMediaID, IsFeatured: in.IsFeatured, SortOrder: in.SortOrder, Status: status,
			SeoTitle: in.SEOTitle, SeoDescription: in.SEODescription, UpdatedBy: meta.UserID,
		})
		if err != nil {
			return mapWriteError(err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionUpdate, EntityType: audit.EntityAlumni,
			EntityID: &id, Summary: "Tokoh alumni diperbarui: " + updated.Name, IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("alumni: audit: %w", err)
		}
		item := itemFromRow(updated)
		out = &item
		return nil
	})
	if err != nil {
		return nil, err
	}
	tags := []string{revalidate.Alumni(newSlug), revalidate.TagAlumni, revalidate.TagHomepage, revalidate.TagSitemap}
	if oldSlug != newSlug {
		tags = append(tags, revalidate.Alumni(oldSlug))
	}
	s.reval.Enqueue(tags...)
	return out, nil
}

// Delete removes an alumni profile.
func (s *Service) Delete(ctx context.Context, meta audit.Meta, id int64) error {
	var slug string
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		existing, err := q.GetAlumni(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("alumni: get for delete: %w", err)
		}
		slug = existing.Slug
		rows, err := q.DeleteAlumni(ctx, id)
		if err != nil {
			return fmt.Errorf("alumni: delete: %w", err)
		}
		if rows == 0 {
			return apperr.NotFound()
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionDelete, EntityType: audit.EntityAlumni,
			EntityID: &id, Summary: "Tokoh alumni dihapus: " + existing.Name, IP: meta.IP,
		})
	})
	if err != nil {
		return err
	}
	s.reval.Enqueue(revalidate.Alumni(slug), revalidate.TagAlumni, revalidate.TagHomepage, revalidate.TagSitemap)
	return nil
}

// Reorder updates sort_order for the given ids in one transaction. Any
// unknown id is reported as apperr.NotFound before anything is written.
func (s *Service) Reorder(ctx context.Context, meta audit.Meta, items []ReorderItem) error {
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		for _, it := range items {
			if _, err := q.GetAlumni(ctx, it.ID); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return apperr.NotFound()
				}
				return fmt.Errorf("alumni: get for reorder: %w", err)
			}
		}
		for _, it := range items {
			if err := q.UpdateAlumniOrder(ctx, dbgen.UpdateAlumniOrderParams{ID: it.ID, SortOrder: it.SortOrder}); err != nil {
				return fmt.Errorf("alumni: reorder: %w", err)
			}
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionReorder, EntityType: audit.EntityAlumni,
			Summary: "Urutan tokoh alumni diubah.", IP: meta.IP,
		})
	})
	if err != nil {
		return err
	}
	s.reval.Enqueue(revalidate.TagAlumni, revalidate.TagHomepage)
	return nil
}

// ListPublic returns published alumni profiles matching f.
func (s *Service) ListPublic(ctx context.Context, f PublicFilter) ([]content.AlumniCard, int64, error) {
	q := dbgen.New(s.pool)
	params := dbgen.ListPublishedAlumniParams{
		Featured: f.Featured, Offset: int32(f.Page.Offset), Limit: int32(f.Page.PerPage),
	}
	rows, err := q.ListPublishedAlumni(ctx, params)
	if err != nil {
		return nil, 0, fmt.Errorf("alumni: list public: %w", err)
	}
	total, err := q.CountPublishedAlumni(ctx, f.Featured)
	if err != nil {
		return nil, 0, fmt.Errorf("alumni: count public: %w", err)
	}
	cards, err := content.NewHydrator(s.pool).AlumniCards(ctx, rows)
	if err != nil {
		return nil, 0, fmt.Errorf("alumni: hydrate: %w", err)
	}
	return cards, total, nil
}

// GetPublic returns the public detail of a published alumni profile.
func (s *Service) GetPublic(ctx context.Context, slug string) (*PublicDetail, error) {
	row, err := dbgen.New(s.pool).GetPublishedAlumniBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("alumni: get public: %w", err)
	}
	var photo *content.Media
	if row.PhotoMediaID != nil {
		media, err := content.NewHydrator(s.pool).Media(ctx, []int64{*row.PhotoMediaID})
		if err != nil {
			return nil, fmt.Errorf("alumni: hydrate photo: %w", err)
		}
		if m, ok := media[*row.PhotoMediaID]; ok {
			photo = &m
		}
	}
	story := ""
	if row.StoryHtml != nil {
		story = *row.StoryHtml
	}
	return &PublicDetail{
		ID: row.ID, Slug: row.Slug, Name: row.Name, RoleTitle: row.RoleTitle, ClassYear: row.ClassYear,
		ShortBio: row.ShortBio, URL: content.AlumniURL(row.Slug), Photo: photo, StoryHTML: story,
		SEO: SEO{Title: row.SeoTitle, Description: row.SeoDescription},
	}, nil
}

func itemFromRow(r dbgen.AlumniProfile) Item {
	return Item{
		ID: r.ID, Name: r.Name, Slug: r.Slug, RoleTitle: r.RoleTitle, ClassYear: r.ClassYear,
		ShortBio: r.ShortBio, StoryJSON: rawOrNil(r.StoryJson), StoryHTML: strOrEmpty(r.StoryHtml),
		PhotoMediaID: r.PhotoMediaID, IsFeatured: r.IsFeatured, SortOrder: r.SortOrder, Status: r.Status,
		SEO:       SEO{Title: r.SeoTitle, Description: r.SeoDescription},
		CreatedAt: httpx.FormatTime(r.CreatedAt), UpdatedAt: httpx.FormatTime(r.UpdatedAt),
	}
}

// uniqueSlug derives a slug from name/want, appending a numeric suffix on
// conflict. excludeID = 0 on create.
func uniqueSlug(ctx context.Context, q *dbgen.Queries, name, want string, excludeID int64) (string, error) {
	if want != "" {
		if !slugutil.Valid(want) {
			return "", apperr.Validation(map[string]string{"slug": "Format slug tidak valid."})
		}
		exists, err := q.AlumniSlugExists(ctx, dbgen.AlumniSlugExistsParams{Slug: want, ExcludeID: excludeID})
		if err != nil {
			return "", fmt.Errorf("alumni: slug exists: %w", err)
		}
		if exists {
			return "", apperr.Validation(map[string]string{"slug": "Slug sudah dipakai."})
		}
		return want, nil
	}
	base := slugutil.Make(name)
	if base == "" {
		base = "tokoh"
	}
	slug := base
	for i := 2; ; i++ {
		exists, err := q.AlumniSlugExists(ctx, dbgen.AlumniSlugExistsParams{Slug: slug, ExcludeID: excludeID})
		if err != nil {
			return "", fmt.Errorf("alumni: slug exists: %w", err)
		}
		if !exists {
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
}

func mapWriteError(err error) error {
	if constraint, ok := database.UniqueViolation(err); ok && constraint == "alumni_profiles_slug_key" {
		return apperr.Validation(map[string]string{"slug": "Slug sudah dipakai."})
	}
	if constraint, ok := database.ForeignKeyViolation(err); ok && constraint == "alumni_profiles_photo_media_id_fkey" {
		return apperr.Validation(map[string]string{"photo_media_id": "Media tidak ditemukan."})
	}
	return fmt.Errorf("alumni: write: %w", err)
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func strOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func rawOrNil(b []byte) json.RawMessage {
	if len(b) == 0 {
		return nil
	}
	return json.RawMessage(b)
}

func nilIfEmpty(b json.RawMessage) []byte {
	if len(b) == 0 {
		return nil
	}
	return []byte(b)
}
