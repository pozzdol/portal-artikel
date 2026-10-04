package article

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
)

// relatedLimit is the number of related articles on a detail page.
const relatedLimit = 4

// ListPublic returns published article cards, newest first. Unknown or
// inactive category/tag/author slugs yield an empty page.
func (s *Service) ListPublic(ctx context.Context, f PublicFilter) ([]content.ArticleCard, int64, error) {
	q := dbgen.New(s.pool)
	p := dbgen.ListPublishedArticlesParams{
		Featured: f.Featured,
		Offset:   int32(f.Page.Offset),
		Limit:    int32(f.Page.PerPage),
	}
	empty := []content.ArticleCard{}
	if f.Category != "" {
		cats, err := q.ListCategories(ctx)
		if err != nil {
			return nil, 0, fmt.Errorf("article: list categories: %w", err)
		}
		ids, ok := categoryTreeIDs(cats, f.Category, true)
		if !ok {
			return empty, 0, nil
		}
		p.CategoryIds = ids
	}
	if f.Tag != "" {
		t, err := q.GetTagBySlug(ctx, f.Tag)
		if errors.Is(err, pgx.ErrNoRows) {
			return empty, 0, nil
		}
		if err != nil {
			return nil, 0, fmt.Errorf("article: get tag: %w", err)
		}
		p.TagID = &t.ID
	}
	if f.Author != "" {
		u, err := q.GetUserBySlug(ctx, f.Author)
		if errors.Is(err, pgx.ErrNoRows) || (err == nil && !u.IsActive) {
			return empty, 0, nil
		}
		if err != nil {
			return nil, 0, fmt.Errorf("article: get author: %w", err)
		}
		p.AuthorID = &u.ID
	}
	rows, err := q.ListPublishedArticles(ctx, p)
	if err != nil {
		return nil, 0, fmt.Errorf("article: list published: %w", err)
	}
	total, err := q.CountPublishedArticles(ctx, dbgen.CountPublishedArticlesParams{
		CategoryIds: p.CategoryIds, TagID: p.TagID, AuthorID: p.AuthorID, Featured: p.Featured,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("article: count published: %w", err)
	}
	cards, err := content.NewHydrator(s.pool).Cards(ctx, rows)
	if err != nil {
		return nil, 0, err
	}
	return cards, total, nil
}

// GetPublic returns a published article by slug. With a valid preview token
// whose subject is the article's id, the article is returned regardless of
// status (still not trashed) and Preview is set. A non-empty token that is
// invalid, expired or issued for another article is 404: it never falls
// through to the published lookup, so ?preview=<junk> cannot be used to
// bypass caches. A slug that moved returns a Redirect to the current URL.
// Anything else is 404.
func (s *Service) GetPublic(ctx context.Context, slug, previewToken string) (*PublicDetail, *Redirect, error) {
	q := dbgen.New(s.pool)
	if previewToken != "" {
		// Signature/expiry check is pure CPU: reject before touching the DB.
		id, err := s.preview.Verify(previewToken)
		if err != nil {
			return nil, nil, apperr.NotFound()
		}
		art, err := q.GetArticleBySlugAny(ctx, slug)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, apperr.NotFound()
		}
		if err != nil {
			return nil, nil, fmt.Errorf("article: get by slug (preview): %w", err)
		}
		if art.ID != id {
			return nil, nil, apperr.NotFound()
		}
		d, err := s.publicDetail(ctx, q, art)
		if err != nil {
			return nil, nil, err
		}
		d.Preview = true
		return d, nil, nil
	}

	art, err := q.GetPublishedArticleBySlug(ctx, slug)
	if err == nil {
		if !content.IsPublic(art.Status, art.PublishedAt, s.now()) {
			return nil, nil, apperr.NotFound()
		}
		d, err := s.publicDetail(ctx, q, art)
		return d, nil, err
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, fmt.Errorf("article: get published: %w", err)
	}

	red, err := q.GetSlugRedirect(ctx, slug)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, apperr.NotFound()
	}
	if err != nil {
		return nil, nil, fmt.Errorf("article: get redirect: %w", err)
	}
	target, err := q.GetArticle(ctx, red.ArticleID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, apperr.NotFound()
	}
	if err != nil {
		return nil, nil, fmt.Errorf("article: get redirect target: %w", err)
	}
	if target.DeletedAt != nil || !content.IsPublic(target.Status, target.PublishedAt, s.now()) {
		return nil, nil, apperr.NotFound()
	}
	card, err := content.NewHydrator(s.pool).Card(ctx, target)
	if err != nil {
		return nil, nil, err
	}
	return nil, &Redirect{To: card.URL}, nil
}

func (s *Service) publicDetail(ctx context.Context, q *dbgen.Queries, a dbgen.Article) (*PublicDetail, error) {
	h := content.NewHydrator(s.pool)
	card, err := h.Card(ctx, a)
	if err != nil {
		return nil, err
	}
	tags, err := articleTagRefs(ctx, q, a.ID)
	if err != nil {
		return nil, err
	}
	related, err := s.related(ctx, q, a)
	if err != nil {
		return nil, err
	}
	relCards, err := h.Cards(ctx, related)
	if err != nil {
		return nil, err
	}

	seo := PublicSEO{Title: a.Title, Description: a.SeoDescription, Og: card.Cover}
	if a.SeoTitle != nil {
		seo.Title = *a.SeoTitle
	}
	if seo.Description == nil {
		seo.Description = a.Excerpt
	}
	if a.OgMediaID != nil {
		m, err := h.Media(ctx, []int64{*a.OgMediaID})
		if err != nil {
			return nil, err
		}
		if v, ok := m[*a.OgMediaID]; ok {
			seo.Og = &v
		}
	}
	if a.CanonicalUrl != nil {
		seo.CanonicalURL = *a.CanonicalUrl
	} else {
		seo.CanonicalURL = s.siteURL + card.URL
	}

	return &PublicDetail{
		ArticleCard:  card,
		CoverCaption: a.CoverCaption,
		ContentHTML:  a.ContentHtml,
		Tags:         tags,
		SEO:          seo,
		Related:      relCards,
		UpdatedAt:    httpx.FormatTime(a.UpdatedAt),
	}, nil
}

// related returns up to relatedLimit published articles: same category or
// shared tag first (ListRelatedArticles), then the rest of the level-1
// category tree, then the latest articles.
func (s *Service) related(ctx context.Context, q *dbgen.Queries, a dbgen.Article) ([]dbgen.Article, error) {
	primary, err := q.ListRelatedArticles(ctx, dbgen.ListRelatedArticlesParams{
		ArticleID: a.ID, CategoryID: a.CategoryID, Limit: relatedLimit,
	})
	if err != nil {
		return nil, fmt.Errorf("article: related: %w", err)
	}
	out := mergeRelated(a.ID, relatedLimit, primary)
	if len(out) >= relatedLimit {
		return out, nil
	}

	cats, err := q.ListCategories(ctx)
	if err != nil {
		return nil, fmt.Errorf("article: related categories: %w", err)
	}
	level1 := content.CategoryRefsFrom(cats)[a.CategoryID].Level1Slug()
	if ids, ok := categoryTreeIDs(cats, level1, true); ok {
		same, err := q.ListPublishedByCategoryOrdered(ctx, dbgen.ListPublishedByCategoryOrderedParams{
			CategoryIds: ids, ExcludeIds: excludeIDs(a.ID, out), OrderBy: "published_at", Limit: relatedLimit,
		})
		if err != nil {
			return nil, fmt.Errorf("article: related tree: %w", err)
		}
		out = mergeRelated(a.ID, relatedLimit, out, same)
		if len(out) >= relatedLimit {
			return out, nil
		}
	}

	latest, err := q.ListLatestPublishedExcluding(ctx, dbgen.ListLatestPublishedExcludingParams{
		ExcludeIds: excludeIDs(a.ID, out), Limit: relatedLimit,
	})
	if err != nil {
		return nil, fmt.Errorf("article: related latest: %w", err)
	}
	return mergeRelated(a.ID, relatedLimit, out, latest), nil
}

// mergeRelated concatenates the candidate lists in priority order, dropping
// selfID and duplicates, and truncates to limit.
func mergeRelated(selfID int64, limit int, lists ...[]dbgen.Article) []dbgen.Article {
	out := make([]dbgen.Article, 0, limit)
	seen := map[int64]bool{selfID: true}
	for _, l := range lists {
		for _, a := range l {
			if len(out) >= limit {
				return out
			}
			if seen[a.ID] {
				continue
			}
			seen[a.ID] = true
			out = append(out, a)
		}
	}
	return out
}

func excludeIDs(selfID int64, got []dbgen.Article) []int64 {
	ids := make([]int64, 0, len(got)+1)
	ids = append(ids, selfID)
	for _, a := range got {
		ids = append(ids, a.ID)
	}
	return ids
}

// GetAuthorPublic returns the public profile of an active user by slug.
func (s *Service) GetAuthorPublic(ctx context.Context, slug string) (*AuthorProfile, error) {
	q := dbgen.New(s.pool)
	u, err := q.GetUserBySlug(ctx, slug)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !u.IsActive) {
		return nil, apperr.NotFound()
	}
	if err != nil {
		return nil, fmt.Errorf("article: get author: %w", err)
	}
	p := &AuthorProfile{
		ID: u.ID, DisplayName: u.DisplayName, Slug: u.Slug, Title: u.Title, Bio: u.Bio,
		URL: content.AuthorURL(u.Slug),
	}
	if u.AvatarMediaID != nil {
		m, err := content.NewHydrator(s.pool).Media(ctx, []int64{*u.AvatarMediaID})
		if err != nil {
			return nil, err
		}
		if v, ok := m[*u.AvatarMediaID]; ok {
			p.Avatar = &v
		}
	}
	return p, nil
}
