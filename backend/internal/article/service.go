package article

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/revalidate"
)

// Config configures the article Service.
type Config struct {
	// PublicSiteURL is the frontend origin used for default canonical URLs.
	PublicSiteURL string
	// JWTSecret signs preview tokens (issuer PreviewIssuer).
	JWTSecret []byte
	// PreviewTTL is the preview token lifetime (0 = DefaultPreviewTTL).
	PreviewTTL time.Duration
	// Now is the clock (nil = time.Now).
	Now func() time.Time
}

// Service implements the article domain.
type Service struct {
	pool    *pgxpool.Pool
	auditor *audit.Logger
	reval   revalidate.Client
	preview *PreviewTokens
	siteURL string
	now     func() time.Time
}

// NewService returns an article Service. A nil reval discards revalidation
// tags.
func NewService(pool *pgxpool.Pool, auditor *audit.Logger, reval revalidate.Client, cfg Config) *Service {
	if reval == nil {
		reval = revalidate.Noop{}
	}
	now := cfg.Now
	if now == nil {
		now = time.Now
	}
	return &Service{
		pool:    pool,
		auditor: auditor,
		reval:   reval,
		preview: NewPreviewTokens(cfg.JWTSecret, cfg.PreviewTTL, now),
		siteURL: strings.TrimRight(cfg.PublicSiteURL, "/"),
		now:     now,
	}
}

// revalRef is the minimal article state needed to compute revalidation tags.
type revalRef struct {
	Slug       string
	CategoryID int64
	AuthorID   int64
}

func refOf(a dbgen.Article) revalRef {
	return revalRef{Slug: a.Slug, CategoryID: a.CategoryID, AuthorID: a.AuthorID}
}

// revalTags computes the docs/03 §4.2 tag set for the given article states
// (pass the old and the new state on change) plus the given tag slugs.
func revalTags(cats map[int64]content.CategoryRef, authorSlugs map[int64]string, refs []revalRef, tagSlugs []string) []string {
	tags := []string{
		revalidate.TagHomepage, revalidate.TagSitemap, revalidate.TagSearch, revalidate.TagTrending,
	}
	for _, r := range refs {
		tags = append(tags, revalidate.Article(r.Slug))
		if c, ok := cats[r.CategoryID]; ok {
			tags = append(tags, revalidate.Category(c.Slug))
			if c.Parent != nil {
				tags = append(tags, revalidate.Category(c.Parent.Slug))
			}
		}
		if s, ok := authorSlugs[r.AuthorID]; ok && s != "" {
			tags = append(tags, revalidate.Author(s))
		}
	}
	for _, t := range tagSlugs {
		tags = append(tags, revalidate.Tag(t))
	}
	return revalidate.Unique(tags)
}

// collectRevalTags loads the categories and author slugs needed by revalTags.
// It may run inside a transaction; the caller enqueues the result only after
// commit.
func collectRevalTags(ctx context.Context, q *dbgen.Queries, refs []revalRef, tagSlugs []string) ([]string, error) {
	catRows, err := q.ListCategories(ctx)
	if err != nil {
		return nil, fmt.Errorf("article: reval categories: %w", err)
	}
	ids := make([]int64, 0, len(refs))
	for _, r := range refs {
		ids = append(ids, r.AuthorID)
	}
	authorSlugs := map[int64]string{}
	if len(ids) > 0 {
		users, err := q.ListUsersByIDs(ctx, ids)
		if err != nil {
			return nil, fmt.Errorf("article: reval authors: %w", err)
		}
		for _, u := range users {
			authorSlugs[u.ID] = u.Slug
		}
	}
	return revalTags(content.CategoryRefsFrom(catRows), authorSlugs, refs, tagSlugs), nil
}

// articleTagRefs returns the tags of one article (never nil).
func articleTagRefs(ctx context.Context, q *dbgen.Queries, articleID int64) ([]TagRef, error) {
	rows, err := q.ListArticleTags(ctx, articleID)
	if err != nil {
		return nil, fmt.Errorf("article: list tags: %w", err)
	}
	out := make([]TagRef, len(rows))
	for i, t := range rows {
		out[i] = TagRef{ID: t.ID, Name: t.Name, Slug: t.Slug, URL: content.TagURL(t.Slug)}
	}
	return out, nil
}

func tagSlugs(refs []TagRef) []string {
	out := make([]string, len(refs))
	for i, t := range refs {
		out[i] = t.Slug
	}
	return out
}

// categoryTreeIDs returns the id of the category with slug plus its children
// (only active ones when activeOnly). ok is false for an unknown (or, with
// activeOnly, inactive) slug.
func categoryTreeIDs(rows []dbgen.Category, slug string, activeOnly bool) (ids []int64, ok bool) {
	var root *dbgen.Category
	for i := range rows {
		if rows[i].Slug == slug {
			root = &rows[i]
			break
		}
	}
	if root == nil || (activeOnly && !root.IsActive) {
		return nil, false
	}
	ids = []int64{root.ID}
	for _, c := range rows {
		if c.ParentID != nil && *c.ParentID == root.ID && (!activeOnly || c.IsActive) {
			ids = append(ids, c.ID)
		}
	}
	return ids, true
}

func strPtr(s string) *string { return &s }
