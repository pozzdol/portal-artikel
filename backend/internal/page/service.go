package page

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

// defaultContentJSON is stored when a create/update omits content_json (the
// pages.content_json column is NOT NULL).
var defaultContentJSON = json.RawMessage(`{"type":"doc","content":[]}`)

// Service implements static-page CRUD and public lookup.
type Service struct {
	pool    *pgxpool.Pool
	auditor *audit.Logger
	reval   revalidate.Client
}

// NewService returns a page Service.
func NewService(pool *pgxpool.Pool, auditor *audit.Logger, reval revalidate.Client) *Service {
	return &Service{pool: pool, auditor: auditor, reval: reval}
}

// List returns every page (admin; the table is small, no pagination).
func (s *Service) List(ctx context.Context) ([]Item, error) {
	rows, err := dbgen.New(s.pool).ListPages(ctx)
	if err != nil {
		return nil, fmt.Errorf("page: list: %w", err)
	}
	items := make([]Item, len(rows))
	for i, r := range rows {
		items[i] = itemFromRow(r)
	}
	return items, nil
}

// Get returns one page by id, or apperr.NotFound.
func (s *Service) Get(ctx context.Context, id int64) (*Item, error) {
	row, err := dbgen.New(s.pool).GetPage(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("page: get: %w", err)
	}
	item := itemFromRow(row)
	return &item, nil
}

// Create inserts a new static page.
func (s *Service) Create(ctx context.Context, meta audit.Meta, in Input) (*Item, error) {
	status := in.Status
	if status == "" {
		status = content.StatusDraft
	}
	html := richtext.Sanitize(in.ContentHTML)
	body := in.ContentJSON
	if len(body) == 0 {
		body = defaultContentJSON
	}

	var out *Item
	var slug string
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		var err error
		slug, err = uniqueSlug(ctx, q, in.Title, in.Slug, 0)
		if err != nil {
			return err
		}
		created, err := q.CreatePage(ctx, dbgen.CreatePageParams{
			Title: in.Title, Slug: slug, ContentJson: body, ContentHtml: html, Status: status,
			SeoTitle: in.SEOTitle, SeoDescription: in.SEODescription, OgMediaID: in.OgMediaID,
			CreatedBy: meta.UserID, UpdatedBy: meta.UserID,
		})
		if err != nil {
			return mapWriteError(err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionCreate, EntityType: audit.EntityPage,
			EntityID: &created.ID, Summary: "Halaman dibuat: " + created.Title, IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("page: audit: %w", err)
		}
		item := itemFromRow(created)
		out = &item
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.reval.Enqueue(revalidate.Page(slug), revalidate.TagSitemap)
	return out, nil
}

// Update replaces a static page.
func (s *Service) Update(ctx context.Context, meta audit.Meta, id int64, in Input) (*Item, error) {
	html := richtext.Sanitize(in.ContentHTML)
	body := in.ContentJSON
	if len(body) == 0 {
		body = defaultContentJSON
	}

	var out *Item
	var oldSlug, newSlug string
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		existing, err := q.GetPage(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("page: get for update: %w", err)
		}
		oldSlug = existing.Slug
		status := in.Status
		if status == "" {
			status = existing.Status
		}
		newSlug, err = uniqueSlug(ctx, q, in.Title, in.Slug, id)
		if err != nil {
			return err
		}
		updated, err := q.UpdatePage(ctx, dbgen.UpdatePageParams{
			ID: id, Title: in.Title, Slug: newSlug, ContentJson: body, ContentHtml: html, Status: status,
			SeoTitle: in.SEOTitle, SeoDescription: in.SEODescription, OgMediaID: in.OgMediaID, UpdatedBy: meta.UserID,
		})
		if err != nil {
			return mapWriteError(err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionUpdate, EntityType: audit.EntityPage,
			EntityID: &id, Summary: "Halaman diperbarui: " + updated.Title, IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("page: audit: %w", err)
		}
		item := itemFromRow(updated)
		out = &item
		return nil
	})
	if err != nil {
		return nil, err
	}
	tags := []string{revalidate.Page(newSlug), revalidate.TagSitemap}
	if oldSlug != newSlug {
		tags = append(tags, revalidate.Page(oldSlug))
	}
	s.reval.Enqueue(tags...)
	return out, nil
}

// Delete removes a static page.
func (s *Service) Delete(ctx context.Context, meta audit.Meta, id int64) error {
	var slug string
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		existing, err := q.GetPage(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("page: get for delete: %w", err)
		}
		slug = existing.Slug
		rows, err := q.DeletePage(ctx, id)
		if err != nil {
			return fmt.Errorf("page: delete: %w", err)
		}
		if rows == 0 {
			return apperr.NotFound()
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionDelete, EntityType: audit.EntityPage,
			EntityID: &id, Summary: "Halaman dihapus: " + existing.Title, IP: meta.IP,
		})
	})
	if err != nil {
		return err
	}
	s.reval.Enqueue(revalidate.Page(slug), revalidate.TagSitemap)
	return nil
}

// GetPublic returns the public detail of a published page.
func (s *Service) GetPublic(ctx context.Context, slug string) (*PublicDetail, error) {
	row, err := dbgen.New(s.pool).GetPublishedPageBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("page: get public: %w", err)
	}
	return &PublicDetail{
		Title: row.Title, Slug: row.Slug, ContentHTML: row.ContentHtml,
		SEO:       SEO{Title: row.SeoTitle, Description: row.SeoDescription},
		UpdatedAt: httpx.FormatTime(row.UpdatedAt),
	}, nil
}

func itemFromRow(r dbgen.Page) Item {
	return Item{
		ID: r.ID, Title: r.Title, Slug: r.Slug, ContentJSON: json.RawMessage(r.ContentJson),
		ContentHTML: r.ContentHtml, Status: r.Status, OgMediaID: r.OgMediaID,
		SEO:       SEO{Title: r.SeoTitle, Description: r.SeoDescription},
		CreatedAt: httpx.FormatTime(r.CreatedAt), UpdatedAt: httpx.FormatTime(r.UpdatedAt),
	}
}

// uniqueSlug derives a slug from title/want, appending a numeric suffix on
// conflict. excludeID = 0 on create.
func uniqueSlug(ctx context.Context, q *dbgen.Queries, title, want string, excludeID int64) (string, error) {
	if want != "" {
		if !slugutil.Valid(want) {
			return "", apperr.Validation(map[string]string{"slug": "Format slug tidak valid."})
		}
		exists, err := q.PageSlugExists(ctx, dbgen.PageSlugExistsParams{Slug: want, ExcludeID: excludeID})
		if err != nil {
			return "", fmt.Errorf("page: slug exists: %w", err)
		}
		if exists {
			return "", apperr.Validation(map[string]string{"slug": "Slug sudah dipakai."})
		}
		return want, nil
	}
	base := slugutil.Make(title)
	if base == "" {
		base = "halaman"
	}
	slug := base
	for i := 2; ; i++ {
		exists, err := q.PageSlugExists(ctx, dbgen.PageSlugExistsParams{Slug: slug, ExcludeID: excludeID})
		if err != nil {
			return "", fmt.Errorf("page: slug exists: %w", err)
		}
		if !exists {
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
}

func mapWriteError(err error) error {
	if constraint, ok := database.UniqueViolation(err); ok && constraint == "pages_slug_key" {
		return apperr.Validation(map[string]string{"slug": "Slug sudah dipakai."})
	}
	if constraint, ok := database.ForeignKeyViolation(err); ok && constraint == "pages_og_media_id_fkey" {
		return apperr.Validation(map[string]string{"og_media_id": "Media tidak ditemukan."})
	}
	return fmt.Errorf("page: write: %w", err)
}
