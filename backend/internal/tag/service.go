package tag

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/slugutil"
)

// Service implements tag CRUD, merge and the popular/detail queries.
type Service struct {
	pool    *pgxpool.Pool
	auditor *audit.Logger
	reval   revalidate.Client
}

// NewService returns a tag Service.
func NewService(pool *pgxpool.Pool, auditor *audit.Logger, reval revalidate.Client) *Service {
	return &Service{pool: pool, auditor: auditor, reval: reval}
}

// List returns a page of tags (optionally filtered by name), each with its
// published article count.
func (s *Service) List(ctx context.Context, q string, page httpx.Pagination) ([]Item, int64, error) {
	query := dbgen.New(s.pool)
	var qp *string
	if q != "" {
		qp = &q
	}
	rows, err := query.ListTags(ctx, dbgen.ListTagsParams{Q: qp, Offset: int32(page.Offset), Limit: int32(page.PerPage)})
	if err != nil {
		return nil, 0, fmt.Errorf("tag: list: %w", err)
	}
	total, err := query.CountTags(ctx, qp)
	if err != nil {
		return nil, 0, fmt.Errorf("tag: count: %w", err)
	}
	items := make([]Item, 0, len(rows))
	for _, r := range rows {
		items = append(items, Item{ID: r.ID, Name: r.Name, Slug: r.Slug, ArticleCount: r.ArticleCount, CreatedAt: httpx.FormatTime(r.CreatedAt)})
	}
	return items, total, nil
}

// ListPopular returns the top tags by published article count.
func (s *Service) ListPopular(ctx context.Context, limit int) ([]Item, error) {
	query := dbgen.New(s.pool)
	rows, err := query.ListPopularTags(ctx, int32(limit))
	if err != nil {
		return nil, fmt.Errorf("tag: list popular: %w", err)
	}
	items := make([]Item, 0, len(rows))
	for _, r := range rows {
		items = append(items, Item{ID: r.ID, Name: r.Name, Slug: r.Slug, ArticleCount: r.ArticleCount})
	}
	return items, nil
}

// Get returns one tag by id, with its published article count.
func (s *Service) Get(ctx context.Context, id int64) (*Item, error) {
	q := dbgen.New(s.pool)
	t, err := q.GetTag(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("tag: get: %w", err)
	}
	return s.GetBySlug(ctx, t.Slug)
}

// GetBySlug returns one tag by slug, with its published article count.
func (s *Service) GetBySlug(ctx context.Context, slug string) (*Item, error) {
	q := dbgen.New(s.pool)
	row, err := q.GetTagBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("tag: get by slug: %w", err)
	}
	return &Item{ID: row.ID, Name: row.Name, Slug: row.Slug, ArticleCount: row.ArticleCount, CreatedAt: httpx.FormatTime(row.CreatedAt)}, nil
}

// Create inserts a new tag; slug defaults from name (with a numeric suffix
// on conflict) when omitted.
func (s *Service) Create(ctx context.Context, meta audit.Meta, in CreateInput) (*Item, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, apperr.Validation(map[string]string{"name": "Wajib diisi."})
	}
	slug, err := s.resolveSlug(ctx, name, strings.TrimSpace(in.Slug), 0)
	if err != nil {
		return nil, err
	}

	var out *Item
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		created, err := q.CreateTag(ctx, dbgen.CreateTagParams{Name: name, Slug: slug})
		if err != nil {
			return mapTagWriteErr(err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionCreate, EntityType: audit.EntityTag,
			EntityID: &created.ID, Summary: "Tag dibuat: " + created.Name, IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("tag: audit: %w", err)
		}
		out = &Item{ID: created.ID, Name: created.Name, Slug: created.Slug, CreatedAt: httpx.FormatTime(created.CreatedAt)}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

// Update renames a tag and/or changes its slug.
func (s *Service) Update(ctx context.Context, meta audit.Meta, id int64, in UpdateInput) (*Item, error) {
	q := dbgen.New(s.pool)
	existing, err := q.GetTag(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("tag: get for update: %w", err)
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, apperr.Validation(map[string]string{"name": "Wajib diisi."})
	}
	slug, err := s.resolveSlug(ctx, name, strings.TrimSpace(in.Slug), id)
	if err != nil {
		return nil, err
	}

	var updated dbgen.Tag
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		var err error
		updated, err = q.UpdateTag(ctx, dbgen.UpdateTagParams{Name: name, Slug: slug, ID: id})
		if err != nil {
			return mapTagWriteErr(err)
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionUpdate, EntityType: audit.EntityTag,
			EntityID: &id, Summary: "Tag diperbarui: " + updated.Name, IP: meta.IP,
		})
	})
	if err != nil {
		return nil, err
	}
	tags := []string{revalidate.Tag(updated.Slug), revalidate.TagHomepage}
	if existing.Slug != updated.Slug {
		tags = append(tags, revalidate.Tag(existing.Slug))
	}
	s.reval.Enqueue(tags...)
	return s.Get(ctx, id)
}

// Delete removes a tag (article_tags rows cascade).
func (s *Service) Delete(ctx context.Context, meta audit.Meta, id int64) error {
	var slug, name string
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		t, err := q.GetTag(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("tag: get for delete: %w", err)
		}
		slug, name = t.Slug, t.Name
		rows, err := q.DeleteTag(ctx, id)
		if err != nil {
			return fmt.Errorf("tag: delete: %w", err)
		}
		if rows == 0 {
			return apperr.NotFound()
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionDelete, EntityType: audit.EntityTag,
			EntityID: &id, Summary: "Tag dihapus: " + name, IP: meta.IP,
		})
	})
	if err != nil {
		return err
	}
	s.reval.Enqueue(revalidate.Tag(slug), revalidate.TagHomepage)
	return nil
}

// Merge moves every article link from fromID to in.IntoID and deletes
// fromID. 409 when the two ids are equal or the target does not exist.
func (s *Service) Merge(ctx context.Context, meta audit.Meta, fromID int64, in MergeInput) (*Item, error) {
	if in.IntoID == fromID {
		return nil, apperr.Conflict("Tag tujuan tidak boleh sama dengan tag asal.")
	}
	q := dbgen.New(s.pool)
	from, err := q.GetTag(ctx, fromID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("tag: get merge source: %w", err)
	}
	into, err := q.GetTag(ctx, in.IntoID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.Conflict("Tag tujuan tidak ditemukan.")
		}
		return nil, fmt.Errorf("tag: get merge target: %w", err)
	}

	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		if err := q.MergeTagArticles(ctx, dbgen.MergeTagArticlesParams{IntoID: into.ID, FromID: from.ID}); err != nil {
			return fmt.Errorf("tag: merge articles: %w", err)
		}
		if _, err := q.DeleteTag(ctx, from.ID); err != nil {
			return fmt.Errorf("tag: delete merged: %w", err)
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionMerge, EntityType: audit.EntityTag,
			EntityID: &into.ID, Summary: fmt.Sprintf("Tag %q digabung ke %q", from.Name, into.Name),
			Changes: map[string]any{"from_id": from.ID, "from_slug": from.Slug, "into_id": into.ID, "into_slug": into.Slug},
			IP:      meta.IP,
		})
	})
	if err != nil {
		return nil, err
	}
	s.reval.Enqueue(revalidate.Tag(from.Slug), revalidate.Tag(into.Slug), revalidate.TagHomepage)
	return s.Get(ctx, into.ID)
}

// resolveSlug returns requested (validated) when non-empty, else derives one
// from name via slugutil.Make with a numeric suffix on conflict. excludeID
// (0 for create) lets a tag keep its own slug on update.
func (s *Service) resolveSlug(ctx context.Context, name, requested string, excludeID int64) (string, error) {
	q := dbgen.New(s.pool)
	if requested != "" {
		if !slugutil.Valid(requested) {
			return "", apperr.Validation(map[string]string{"slug": "Format slug tidak valid."})
		}
		return requested, nil
	}
	base := slugutil.Make(name)
	if base == "" {
		base = "tag"
	}
	slug := base
	for attempt := 1; attempt <= 500; attempt++ {
		row, err := q.GetTagBySlug(ctx, slug)
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return slug, nil
		case err != nil:
			return "", fmt.Errorf("tag: check slug: %w", err)
		case row.ID == excludeID:
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, attempt+1)
	}
	return "", fmt.Errorf("tag: exhausted slug suffixes for %q", base)
}

func mapTagWriteErr(err error) error {
	if constraint, ok := database.UniqueViolation(err); ok {
		switch constraint {
		case "tags_slug_key":
			return apperr.Validation(map[string]string{"slug": "Slug sudah dipakai."})
		case "tags_name_key":
			return apperr.Validation(map[string]string{"name": "Nama tag sudah dipakai."})
		}
	}
	return fmt.Errorf("tag: write: %w", err)
}
