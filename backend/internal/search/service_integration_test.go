//go:build integration

package search_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/search"
	"portal-berita/backend/internal/testdb"
)

const heroSlug = "menjaga-keikhlasan-di-tengah-derasnya-arus-informasi"

func TestSearchIntegration(t *testing.T) {
	pool := testdb.New(t)
	testdb.SeedBase(t, pool)
	testdb.SeedDemo(t, pool, time.Now())
	ctx := context.Background()
	svc := search.NewService(pool)
	page := httpx.Pagination{Page: 1, PerPage: 12}

	// FTS
	res, err := svc.Search(ctx, "  keikhlasan ", page)
	require.NoError(t, err)
	require.NotEmpty(t, res.Items)
	assert.False(t, res.Fallback)
	assert.EqualValues(t, len(res.Items), res.Total)
	assert.Equal(t, heroSlug, res.Items[0].Slug)
	assert.Contains(t, res.Items[0].Highlight, "<mark>")
	assert.NotEmpty(t, res.Items[0].URL)

	// Accent-insensitive
	accent, err := svc.Search(ctx, "kéikhlasan", page)
	require.NoError(t, err)
	require.NotEmpty(t, accent.Items)
	assert.Equal(t, heroSlug, accent.Items[0].Slug)

	// Fuzzy fallback on a typo
	res, err = svc.Search(ctx, "keiklasan", page)
	require.NoError(t, err)
	require.NotEmpty(t, res.Items)
	assert.True(t, res.Fallback)
	assert.Equal(t, heroSlug, res.Items[0].Slug)
	assert.NotContains(t, res.Items[0].Highlight, "<mark>")
	assert.NotEmpty(t, res.Items[0].Highlight)

	// Phrase and negation (websearch syntax)
	phrase, err := svc.Search(ctx, `"adab menuntut"`, page)
	require.NoError(t, err)
	require.NotEmpty(t, phrase.Items, "phrase matches")
	assert.False(t, phrase.Fallback)
	for _, h := range phrase.Items {
		assert.Contains(t, strings.ToLower(h.Highlight+" "+h.Title), "adab")
	}
	adab, err := svc.Search(ctx, "adab", page)
	require.NoError(t, err)
	neg, err := svc.Search(ctx, "adab -ilmu", page)
	require.NoError(t, err)
	assert.Less(t, neg.Total, adab.Total, "negation removes matches")

	// Pagination
	p2, err := svc.Search(ctx, "adab", httpx.Pagination{Page: 2, PerPage: 1, Offset: 1})
	require.NoError(t, err)
	assert.Equal(t, adab.Total, p2.Total)
	if adab.Total > 1 {
		require.Len(t, p2.Items, 1)
		assert.Equal(t, adab.Items[1].ID, p2.Items[0].ID)
	}

	// Empty / nothing
	empty, err := svc.Search(ctx, "   ", page)
	require.NoError(t, err)
	assert.Empty(t, empty.Items)
	assert.NotNil(t, empty.Items)
	none, err := svc.Search(ctx, "zzqxwv", page)
	require.NoError(t, err)
	assert.Empty(t, none.Items)
	assert.Zero(t, none.Total)
	long, err := svc.Search(ctx, strings.Repeat("keikhlasan ", 50), page)
	require.NoError(t, err, "long queries are truncated, not rejected")
	_ = long

	// Drafts never match
	testdb.Exec(t, pool, `UPDATE articles SET status = 'draft' WHERE slug = $1`, heroSlug)
	res, err = svc.Search(ctx, "keikhlasan", page)
	require.NoError(t, err)
	for _, h := range res.Items {
		assert.NotEqual(t, heroSlug, h.Slug)
	}
	testdb.Exec(t, pool, `UPDATE articles SET status = 'published' WHERE slug = $1`, heroSlug)

	// HTTP
	h := search.NewHandler(svc)
	r := chi.NewRouter()
	h.RegisterPublic(r)
	srv := httptest.NewServer(r)
	defer srv.Close()
	type body struct {
		Data []search.Hit `json:"data"`
		Meta httpx.Meta   `json:"meta"`
	}
	get := func(q string) (*http.Response, body) {
		resp, err := http.Get(srv.URL + "/search?q=" + url.QueryEscape(q))
		require.NoError(t, err)
		defer resp.Body.Close()
		var b body
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&b))
		return resp, b
	}
	resp, b := get("keikhlasan")
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Empty(t, resp.Header.Get(search.FallbackHeader))
	require.NotEmpty(t, b.Data)
	assert.Equal(t, heroSlug, b.Data[0].Slug)
	assert.Contains(t, b.Data[0].Highlight, "<mark>")
	assert.Equal(t, 1, b.Meta.Page)
	assert.Equal(t, 12, b.Meta.PerPage)
	resp, b = get("keiklasan")
	assert.Equal(t, "true", resp.Header.Get(search.FallbackHeader))
	require.NotEmpty(t, b.Data)
	assert.Equal(t, heroSlug, b.Data[0].Slug)
	resp, b = get("")
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.NotNil(t, b.Data)
	assert.Empty(t, b.Data)
	assert.Zero(t, b.Meta.Total)
}
