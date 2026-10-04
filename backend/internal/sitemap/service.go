// Package sitemap implements GET /public/sitemap: every public URL plus its
// last-updated time (used by the frontend's app/sitemap.ts).
package sitemap

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
)

// Entry is one sitemap row.
type Entry struct {
	Type      string `json:"type"`
	URL       string `json:"url"`
	UpdatedAt string `json:"updated_at"`
}

// Service builds the full sitemap entry list.
type Service struct {
	pool *pgxpool.Pool
	now  func() time.Time
}

// NewService returns a sitemap Service.
func NewService(pool *pgxpool.Pool, now func() time.Time) *Service {
	return &Service{pool: pool, now: now}
}

// List returns every public URL: home, active top-level categories,
// published articles/events/alumni/videos/pages, tags with >= 1 published
// article and authors with >= 1 published article.
func (s *Service) List(ctx context.Context) ([]Entry, error) {
	q := dbgen.New(s.pool)
	entries := []Entry{{Type: "home", URL: "/", UpdatedAt: httpx.FormatTime(s.now())}}

	cats, err := q.ListCategories(ctx)
	if err != nil {
		return nil, fmt.Errorf("sitemap: list categories: %w", err)
	}
	for _, c := range cats {
		// Sub-categories have no first-level URL of their own (docs/06).
		if c.ParentID != nil || !c.IsActive {
			continue
		}
		entries = append(entries, Entry{Type: "category", URL: "/" + c.Slug, UpdatedAt: httpx.FormatTime(c.UpdatedAt)})
	}
	catRefs := content.CategoryRefsFrom(cats)

	articles, err := q.ListPublishedArticlesForSitemap(ctx)
	if err != nil {
		return nil, fmt.Errorf("sitemap: list articles: %w", err)
	}
	for _, a := range articles {
		level1 := a.Slug
		if ref, ok := catRefs[a.CategoryID]; ok {
			level1 = ref.Level1Slug()
		}
		entries = append(entries, Entry{Type: "article", URL: content.ArticleURL(level1, a.Slug), UpdatedAt: httpx.FormatTime(a.UpdatedAt)})
	}

	tags, err := q.ListTagsWithArticles(ctx)
	if err != nil {
		return nil, fmt.Errorf("sitemap: list tags: %w", err)
	}
	for _, t := range tags {
		entries = append(entries, Entry{Type: "tag", URL: content.TagURL(t.Slug), UpdatedAt: httpx.FormatTime(t.UpdatedAt)})
	}

	authors, err := q.ListAuthorsWithPublishedArticles(ctx)
	if err != nil {
		return nil, fmt.Errorf("sitemap: list authors: %w", err)
	}
	for _, a := range authors {
		entries = append(entries, Entry{Type: "author", URL: content.AuthorURL(a.Slug), UpdatedAt: httpx.FormatTime(a.UpdatedAt)})
	}

	events, err := q.ListPublishedEventsForSitemap(ctx)
	if err != nil {
		return nil, fmt.Errorf("sitemap: list events: %w", err)
	}
	for _, e := range events {
		entries = append(entries, Entry{Type: "event", URL: content.EventURL(e.Slug), UpdatedAt: httpx.FormatTime(e.UpdatedAt)})
	}

	alumni, err := q.ListPublishedAlumniForSitemap(ctx)
	if err != nil {
		return nil, fmt.Errorf("sitemap: list alumni: %w", err)
	}
	for _, a := range alumni {
		entries = append(entries, Entry{Type: "alumni", URL: content.AlumniURL(a.Slug), UpdatedAt: httpx.FormatTime(a.UpdatedAt)})
	}

	videos, err := q.ListPublishedVideosForSitemap(ctx)
	if err != nil {
		return nil, fmt.Errorf("sitemap: list videos: %w", err)
	}
	for _, v := range videos {
		entries = append(entries, Entry{Type: "video", URL: content.VideoURL(v.Slug), UpdatedAt: httpx.FormatTime(v.UpdatedAt)})
	}

	pages, err := q.ListPublishedPages(ctx)
	if err != nil {
		return nil, fmt.Errorf("sitemap: list pages: %w", err)
	}
	for _, p := range pages {
		entries = append(entries, Entry{Type: "page", URL: content.PageURL(p.Slug), UpdatedAt: httpx.FormatTime(p.UpdatedAt)})
	}

	return entries, nil
}
