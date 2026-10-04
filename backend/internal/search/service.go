// Package search implements public article search: PostgreSQL full-text
// search ('simple' + unaccent) with a pg_trgm title fallback for typos
// (docs/03 §4.6).
package search

import (
	"context"
	"fmt"
	"html"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/richtext"
)

// MaxQueryRunes caps the search query; longer input is truncated.
const MaxQueryRunes = 100

// excerptRunes bounds the fallback highlight.
const excerptRunes = 200

// Hit is one search result: an article card plus an HTML highlight snippet.
// Highlight is HTML-escaped text where only <mark>…</mark> is markup.
type Hit struct {
	content.ArticleCard
	Highlight string `json:"highlight"`
}

// Result is one page of search hits. Fallback is true when the FTS query had
// no match and the fuzzy title search produced the hits.
type Result struct {
	Items    []Hit
	Total    int64
	Fallback bool
}

// Service runs searches.
type Service struct {
	q   *dbgen.Queries
	hyd *content.Hydrator
}

// NewService builds a Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{q: dbgen.New(pool), hyd: content.NewHydrator(pool)}
}

// NormalizeQuery trims q and truncates it to MaxQueryRunes.
func NormalizeQuery(q string) string {
	q = strings.TrimSpace(q)
	if utf8.RuneCountInString(q) > MaxQueryRunes {
		q = strings.TrimSpace(string([]rune(q)[:MaxQueryRunes]))
	}
	return q
}

// Search runs FTS (websearch syntax: "frasa", -kata, OR) and, when it has no
// match at all, a fuzzy title search. An empty query yields an empty result.
func (s *Service) Search(ctx context.Context, q string, page httpx.Pagination) (Result, error) {
	q = NormalizeQuery(q)
	res := Result{Items: []Hit{}}
	if q == "" {
		return res, nil
	}
	total, err := s.q.CountSearchArticles(ctx, q)
	if err != nil {
		return res, fmt.Errorf("count search: %w", err)
	}
	limit, offset := int32(page.PerPage), int32(page.Offset)
	var ids []int64
	highlights := map[int64]string{}
	if total > 0 {
		rows, err := s.q.SearchArticles(ctx, dbgen.SearchArticlesParams{Query: q, Limit: limit, Offset: offset})
		if err != nil {
			return res, fmt.Errorf("search: %w", err)
		}
		for _, r := range rows {
			ids = append(ids, r.ID)
			highlights[r.ID] = safeHeadline(r.Headline)
		}
	} else {
		total, err = s.q.CountSearchArticlesFuzzy(ctx, q)
		if err != nil {
			return res, fmt.Errorf("count fuzzy search: %w", err)
		}
		if total == 0 {
			return res, nil
		}
		res.Fallback = true
		rows, err := s.q.SearchArticlesFuzzy(ctx, dbgen.SearchArticlesFuzzyParams{Query: q, Limit: limit, Offset: offset})
		if err != nil {
			return res, fmt.Errorf("fuzzy search: %w", err)
		}
		for _, r := range rows {
			ids = append(ids, r.ID)
		}
	}
	res.Total = total
	if len(ids) == 0 {
		return res, nil
	}

	articles, err := s.q.ListPublishedArticlesByIDs(ctx, ids)
	if err != nil {
		return res, fmt.Errorf("list articles by ids: %w", err)
	}
	byID := make(map[int64]dbgen.Article, len(articles))
	for _, a := range articles {
		byID[a.ID] = a
	}
	ordered := make([]dbgen.Article, 0, len(ids))
	for _, id := range ids {
		if a, ok := byID[id]; ok {
			ordered = append(ordered, a)
		}
	}
	cards, err := s.hyd.Cards(ctx, ordered)
	if err != nil {
		return res, err
	}
	for i, c := range cards {
		hl, ok := highlights[c.ID]
		if !ok {
			hl = excerptHighlight(ordered[i])
		}
		res.Items = append(res.Items, Hit{ArticleCard: c, Highlight: hl})
	}
	return res, nil
}

// safeHeadline escapes the ts_headline output (content_text is plain text
// that may contain '<') and then re-enables only the <mark> delimiters.
func safeHeadline(s string) string {
	s = html.EscapeString(s)
	s = strings.ReplaceAll(s, "&lt;mark&gt;", "<mark>")
	return strings.ReplaceAll(s, "&lt;/mark&gt;", "</mark>")
}

// excerptHighlight is the fallback snippet: the article excerpt or the start
// of its text, HTML-escaped.
func excerptHighlight(a dbgen.Article) string {
	text := a.ContentText
	if a.Excerpt != nil && strings.TrimSpace(*a.Excerpt) != "" {
		text = *a.Excerpt
	}
	return html.EscapeString(richtext.Excerpt(text, excerptRunes))
}
