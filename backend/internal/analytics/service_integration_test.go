//go:build integration

package analytics_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/analytics"
	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/ratelimit"
	"portal-berita/backend/internal/testdb"
)

const (
	heroSlug  = "menjaga-keikhlasan-di-tengah-derasnya-arus-informasi"
	browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

func scalar[T any](t *testing.T, pool *pgxpool.Pool, sql string, args ...any) T {
	t.Helper()
	var v T
	require.NoError(t, pool.QueryRow(context.Background(), sql, args...).Scan(&v))
	return v
}

func slugs(cards []content.ArticleCard) []string {
	out := make([]string, len(cards))
	for i, c := range cards {
		out[i] = c.Slug
	}
	return out
}

func TestAnalyticsIntegration(t *testing.T) {
	pool := testdb.New(t)
	testdb.SeedBase(t, pool)
	now := time.Now()
	testdb.SeedDemo(t, pool, now)
	ctx := context.Background()
	svc := analytics.NewService(pool, "test-salt", nil)
	today := httpx.WIBDate(now)

	// --- rankings on seeded views
	trending, err := svc.Trending(ctx, analytics.WindowDay, 5)
	require.NoError(t, err)
	require.Len(t, trending, 5)
	assert.Equal(t, heroSlug, trending[0].Slug)
	assert.NotEmpty(t, trending[0].URL)
	assert.NotEmpty(t, trending[0].Category.Slug)
	popular, err := svc.Popular(ctx, 30, 5)
	require.NoError(t, err)
	require.Len(t, popular, 5)
	assert.NotEqual(t, slugs(trending), slugs(popular), "popular (30d) ranks differently from trending (day)")
	week, err := svc.Trending(ctx, analytics.WindowWeek, 3)
	require.NoError(t, err)
	assert.Len(t, week, 3)

	top, err := svc.TopThisWeek(ctx, 3)
	require.NoError(t, err)
	require.Len(t, top, 3)
	assert.GreaterOrEqual(t, top[0].Views, top[1].Views)
	assert.Positive(t, top[2].Views)

	total, series, err := svc.DashboardViews(ctx, 7)
	require.NoError(t, err)
	require.Len(t, series, 7)
	assert.Equal(t, today.Format("2006-01-02"), series[6].Day)
	var sum int64
	for _, d := range series {
		sum += d.Views
	}
	assert.Equal(t, sum, total)
	assert.Positive(t, total)

	// --- RecordView dedup
	heroID := scalar[int64](t, pool, `SELECT id FROM articles WHERE slug = $1`, heroSlug)
	baseCount := scalar[int64](t, pool, `SELECT view_count FROM articles WHERE id = $1`, heroID)
	baseDaily := scalar[int64](t, pool, `SELECT COALESCE(sum(views),0)::bigint FROM article_views_daily WHERE article_id = $1 AND day = $2`, heroID, today)

	for i, want := range []bool{true, false, false} {
		counted, err := svc.RecordView(ctx, heroID, "203.0.113.7", browserUA)
		require.NoError(t, err)
		assert.Equal(t, want, counted, "call %d", i)
	}
	assert.Equal(t, baseCount+1, scalar[int64](t, pool, `SELECT view_count FROM articles WHERE id = $1`, heroID))
	assert.EqualValues(t, 1, scalar[int64](t, pool, `SELECT count(*) FROM article_view_dedup WHERE article_id = $1`, heroID))

	counted, err := svc.RecordView(ctx, heroID, "203.0.113.7", browserUA+" Edg/126.0")
	require.NoError(t, err)
	assert.True(t, counted, "different UA is a different visitor")
	counted, err = svc.RecordView(ctx, heroID, "203.0.113.7", "Googlebot/2.1")
	require.NoError(t, err)
	assert.False(t, counted, "bot ignored")
	counted, err = svc.RecordView(ctx, heroID, "203.0.113.7", "")
	require.NoError(t, err)
	assert.False(t, counted, "empty UA ignored")
	assert.Equal(t, baseCount+2, scalar[int64](t, pool, `SELECT view_count FROM articles WHERE id = $1`, heroID))
	assert.Equal(t, baseDaily+2, scalar[int64](t, pool, `SELECT views FROM article_views_daily WHERE article_id = $1 AND day = $2`, heroID, today))
	// Raw IPs are never persisted: the hash is 32 bytes and no text column holds the IP.
	assert.EqualValues(t, 32, scalar[int32](t, pool, `SELECT min(octet_length(visitor_hash)) FROM article_view_dedup`))

	draftID := scalar[int64](t, pool, `SELECT id FROM articles WHERE slug <> $1 ORDER BY id DESC LIMIT 1`, heroSlug)
	for _, fixture := range []string{
		`UPDATE articles SET status = 'draft' WHERE id = $1`,
		`UPDATE articles SET status = 'published', deleted_at = now() WHERE id = $1`,
		`UPDATE articles SET deleted_at = NULL, published_at = now() + interval '1 day' WHERE id = $1`,
	} {
		testdb.Exec(t, pool, fixture, draftID)
		counted, err = svc.RecordView(ctx, draftID, "203.0.113.9", browserUA)
		require.NoError(t, err)
		assert.False(t, counted, "non-public article ignored: %s", fixture)
	}
	testdb.Exec(t, pool, `UPDATE articles SET published_at = now() - interval '1 day' WHERE id = $1`, draftID)
	counted, err = svc.RecordView(ctx, 999999999, "203.0.113.9", browserUA)
	require.NoError(t, err)
	assert.False(t, counted, "unknown article ignored")

	// --- cleanup: rows with day < today-2 go, today-2 stays
	testdb.Exec(t, pool, `INSERT INTO article_view_dedup (article_id, visitor_hash, day) VALUES ($1, '\x01', $2), ($1, '\x02', $3)`,
		heroID, today.AddDate(0, 0, -5), today.AddDate(0, 0, -2))
	deleted, err := svc.CleanupDedup(ctx)
	require.NoError(t, err)
	assert.EqualValues(t, 1, deleted)
	job := svc.CleanupJob(nil)
	assert.Equal(t, analytics.CleanupJobName, job.Name)
	assert.True(t, job.RunAtStart)
	assert.Equal(t, 24*time.Hour, job.Every)
	require.NoError(t, job.Fn(ctx))
	assert.EqualValues(t, 3, scalar[int64](t, pool, `SELECT count(*) FROM article_view_dedup`))

	// --- fallback: only one article has views → topped up with latest
	testdb.Exec(t, pool, `TRUNCATE article_views_daily`)
	testdb.Exec(t, pool, `TRUNCATE article_view_dedup`)
	secondID := scalar[int64](t, pool, `SELECT id FROM articles WHERE status='published' AND slug <> $1 ORDER BY published_at ASC LIMIT 1`, heroSlug)
	counted, err = svc.RecordView(ctx, secondID, "198.51.100.1", browserUA)
	require.NoError(t, err)
	require.True(t, counted)
	trending, err = svc.Trending(ctx, analytics.WindowDay, 5)
	require.NoError(t, err)
	require.Len(t, trending, 5)
	assert.Equal(t, secondID, trending[0].ID, "viewed article ranks first")
	seen := map[int64]bool{}
	for _, c := range trending {
		assert.False(t, seen[c.ID], "no duplicates")
		seen[c.ID] = true
	}

	// --- HTTP: beacon + rate limit + params
	h := analytics.NewHandler(svc, ratelimit.New(2, time.Minute))
	r := chi.NewRouter()
	h.RegisterPublic(r)
	srv := httptest.NewServer(r)
	defer srv.Close()

	post := func(path, ua string) *http.Response {
		req, err := http.NewRequest(http.MethodPost, srv.URL+path, nil)
		require.NoError(t, err)
		req.Header.Set("User-Agent", ua)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		resp.Body.Close()
		return resp
	}
	before := scalar[int64](t, pool, `SELECT view_count FROM articles WHERE id = $1`, heroID)
	resp := post("/articles/"+itoa(heroID)+"/view", browserUA)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	assert.Equal(t, "no-store", resp.Header.Get("Cache-Control"))
	assert.Equal(t, before+1, scalar[int64](t, pool, `SELECT view_count FROM articles WHERE id = $1`, heroID))
	resp = post("/articles/abc/view", browserUA)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode, "bad id still 204")
	resp = post("/articles/"+itoa(heroID)+"/view", browserUA)
	assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode)
	assert.NotEmpty(t, resp.Header.Get("Retry-After"))

	get := func(path string, v any) int {
		resp, err := http.Get(srv.URL + path)
		require.NoError(t, err)
		defer resp.Body.Close()
		if v != nil && resp.StatusCode == http.StatusOK {
			require.NoError(t, json.NewDecoder(resp.Body).Decode(v))
		}
		return resp.StatusCode
	}
	var body struct {
		Data []content.ArticleCard `json:"data"`
	}
	assert.Equal(t, http.StatusOK, get("/articles/trending", &body))
	assert.Len(t, body.Data, 5)
	assert.Equal(t, http.StatusOK, get("/articles/trending?window=week&limit=3", &body))
	assert.Len(t, body.Data, 3)
	assert.Equal(t, http.StatusOK, get("/articles/trending?limit=50", &body))
	assert.Len(t, body.Data, 10, "limit clamped to 10")
	assert.Equal(t, http.StatusBadRequest, get("/articles/trending?window=month", nil))
	assert.Equal(t, http.StatusBadRequest, get("/articles/popular?days=x", nil))
	assert.Equal(t, http.StatusOK, get("/articles/popular?days=7&limit=2", &body))
	assert.Len(t, body.Data, 2)
}

func itoa(n int64) string { return strconv.FormatInt(n, 10) }
