//go:build integration

// Package perf holds a repo-kept, env-gated EXPLAIN ANALYZE check (Fase 6,
// Issue 12). It provisions a throwaway schema via internal/testdb, seeds
// base+demo content, adds ~1000 synthetic published articles so the planner
// sees realistic volume, and records EXPLAIN (ANALYZE, BUFFERS) plans for the
// public queries that back the homepage, listing, search and sitemap
// endpoints. It never touches the shared "public" schema.
//
// Run with:
//
//	PERF_EXPLAIN=1 TEST_DATABASE_URL=... go test -p 1 -tags integration -run TestExplain ./internal/perf/ -v
//
// Optionally set PERF_EXPLAIN_OUT to a directory to also save each plan as a
// text file (one per query) plus a summary table; otherwise a per-test
// temporary directory is used and only t.Logf carries the output.
package perf

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/testdb"
)

// syntheticArticles is the number of extra published articles inserted on
// top of the demo seed, chosen to comfortably exceed the "flag seq scans on
// articles with > 1000 rows" threshold from the plan.
const syntheticArticles = 1000

func TestExplain(t *testing.T) {
	if os.Getenv("PERF_EXPLAIN") != "1" {
		t.Skip("set PERF_EXPLAIN=1 to run the EXPLAIN ANALYZE performance check")
	}
	pool := testdb.New(t)
	ctx := context.Background()
	now := time.Now()
	testdb.SeedBase(t, pool)
	testdb.SeedDemo(t, pool, now)

	ids := seedSynthetic(t, pool, now)

	outDir := os.Getenv("PERF_EXPLAIN_OUT")
	if outDir == "" {
		outDir = t.TempDir()
	}
	require.NoError(t, os.MkdirAll(outDir, 0o755))

	cases := explainCases(ids)
	results := make([]explainResult, 0, len(cases))
	for _, c := range cases {
		res := runExplain(t, pool, ctx, c)
		results = append(results, res)
		writePlan(t, outDir, res)
	}
	writeSummary(t, outDir, results)

	t.Logf("EXPLAIN summary (see %s):", outDir)
	t.Logf("%-32s %8s %10s %8s %s", "query", "rows", "time_ms", "seq?", "index/scan")
	for _, r := range results {
		t.Logf("%-32s %8d %10.2f %8v %s", r.name, r.rows, r.execMs, r.seqScanArticles, r.scanSummary)
		if r.seqScanArticles {
			t.Logf("NOTE: %s does a seq scan on articles (%d rows) — check the index decision", r.name, r.rows)
		}
	}
}

// seedSynthetic bulk-inserts syntheticArticles published articles (spread
// over ~1000 hours of published_at, cycling through every category/author),
// tags half of them, and writes 30 days of view rows for every 5th one. A
// single INSERT ... SELECT avoids one round trip per row against the remote
// DB. Returns ids useful for parameterizing EXPLAIN queries.
func seedSynthetic(t *testing.T, pool *pgxpool.Pool, now time.Time) (ids struct {
	oneCategoryID, oneTagID, oneAuthorID, oneArticleID int64
}) {
	t.Helper()
	ctx := context.Background()

	testdb.Exec(t, pool, `
		INSERT INTO articles (
			title, slug, excerpt, content_text, category_id, author_id, status,
			published_at, is_featured, is_breaking, reading_minutes)
		SELECT
			'Artikel Uji Performa ' || gs,
			'artikel-uji-performa-' || gs,
			'Ringkasan artikel uji performa nomor ' || gs || ' untuk EXPLAIN ANALYZE.',
			repeat('Konten uji performa kajian dan kegiatan alumni Darul Hikmah Sumedang nomor ' || gs || '. ', 40),
			cat.ids[1 + (gs % array_length(cat.ids, 1))],
			usr.ids[1 + (gs % array_length(usr.ids, 1))],
			'published',
			$1::timestamptz - (gs || ' hours')::interval,
			(gs % 50 = 0),
			(gs % 200 = 0),
			3
		FROM generate_series(1, $2) AS gs,
		     (SELECT array_agg(id ORDER BY id) AS ids FROM categories) cat,
		     (SELECT array_agg(id ORDER BY id) AS ids FROM users) usr
		ON CONFLICT (slug) DO NOTHING`,
		now, syntheticArticles)

	testdb.Exec(t, pool, `
		INSERT INTO article_tags (article_id, tag_id)
		SELECT a.id, t.ids[1 + (a.id % array_length(t.ids, 1))]
		FROM articles a, (SELECT array_agg(id ORDER BY id) AS ids FROM tags) t
		WHERE a.slug LIKE 'artikel-uji-performa-%' AND a.id % 2 = 0
		ON CONFLICT DO NOTHING`)

	testdb.Exec(t, pool, `
		INSERT INTO article_views_daily (article_id, day, views)
		SELECT a.id, (current_date - (d || ' days')::interval)::date, 1 + ((a.id + d) % 50)
		FROM articles a, generate_series(0, 29) AS d
		WHERE a.slug LIKE 'artikel-uji-performa-%' AND a.id % 5 = 0
		ON CONFLICT (article_id, day) DO UPDATE SET views = EXCLUDED.views`)

	row := pool.QueryRow(ctx, `
		SELECT a.category_id, at.tag_id, a.author_id, a.id
		FROM articles a JOIN article_tags at ON at.article_id = a.id
		WHERE a.slug LIKE 'artikel-uji-performa-%'
		ORDER BY a.id
		LIMIT 1`)
	require.NoError(t, row.Scan(&ids.oneCategoryID, &ids.oneTagID, &ids.oneAuthorID, &ids.oneArticleID))
	return ids
}

type explainCase struct {
	name string
	sql  string
	args []any
}

func explainCases(ids struct {
	oneCategoryID, oneTagID, oneAuthorID, oneArticleID int64
}) []explainCase {
	var noIDs []int64
	limit20 := int32(20)
	dayFrom := time.Now().AddDate(0, 0, -30)
	dayTo := time.Now()
	monthFrom := time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.UTC)
	monthTo := monthFrom.AddDate(0, 1, 0)

	return []explainCase{
		{"ListPublishedArticles/no_filter", sqlListPublishedArticles, []any{noIDs, (*int64)(nil), (*int64)(nil), (*bool)(nil), int32(0), limit20}},
		{"ListPublishedArticles/category", sqlListPublishedArticles, []any{[]int64{ids.oneCategoryID}, (*int64)(nil), (*int64)(nil), (*bool)(nil), int32(0), limit20}},
		{"ListPublishedArticles/tag", sqlListPublishedArticles, []any{noIDs, &ids.oneTagID, (*int64)(nil), (*bool)(nil), int32(0), limit20}},
		{"ListPublishedArticles/author", sqlListPublishedArticles, []any{noIDs, (*int64)(nil), &ids.oneAuthorID, (*bool)(nil), int32(0), limit20}},
		{"CountPublishedArticles", sqlCountPublishedArticles, []any{noIDs, (*int64)(nil), (*int64)(nil), (*bool)(nil)}},
		{"ListRelatedArticles", sqlListRelatedArticles, []any{ids.oneArticleID, ids.oneCategoryID, limit20}},
		{"ListLatestPublishedExcluding", sqlListLatestPublishedExcluding, []any{[]int64{ids.oneArticleID}, limit20}},
		{"ListFeaturedPublished", sqlListFeaturedPublished, []any{noIDs, noIDs, limit20}},
		{"ListBreakingPublished", sqlListBreakingPublished, []any{limit20}},
		{"ListTopArticleViews", sqlListTopArticleViews, []any{dayFrom, dayTo, limit20}},
		{"SearchArticles", sqlSearchArticles, []any{"kajian", int32(0), limit20}},
		{"SearchArticlesFuzzy", sqlSearchArticlesFuzzy, []any{"artikle", int32(0), limit20}},
		{"ListPublishedEventsBetween", sqlListPublishedEventsBetween, []any{monthFrom, monthTo}},
		{"ListPublishedArticlesForSitemap", sqlListPublishedArticlesForSitemap, nil},
		{"ListPublishedEventsForSitemap", sqlListPublishedEventsForSitemap, nil},
	}
}

// SQL text below is copied verbatim from the sqlc-generated
// backend/internal/dbgen/*.sql.go (the same statements the services run), so
// the plans reflect production queries exactly.
const (
	sqlListPublishedArticles = `SELECT a.id, a.title, a.slug, a.excerpt, a.content_json, a.content_html, a.content_text, a.cover_media_id, a.cover_caption, a.category_id, a.author_id, a.status, a.published_at, a.is_featured, a.is_breaking, a.reading_minutes, a.event_date, a.event_location, a.view_count, a.seo_title, a.seo_description, a.og_media_id, a.canonical_url, a.search_vector, a.created_by, a.updated_by, a.created_at, a.updated_at, a.deleted_at FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND ($1::bigint[] IS NULL OR a.category_id = ANY($1::bigint[]))
  AND ($2::bigint IS NULL OR EXISTS (
        SELECT 1 FROM article_tags at WHERE at.article_id = a.id AND at.tag_id = $2::bigint))
  AND ($3::bigint IS NULL OR a.author_id = $3::bigint)
  AND ($4::bool IS NULL OR a.is_featured = $4::bool)
ORDER BY a.published_at DESC, a.id DESC
LIMIT $6 OFFSET $5`

	sqlCountPublishedArticles = `SELECT count(*) FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND ($1::bigint[] IS NULL OR a.category_id = ANY($1::bigint[]))
  AND ($2::bigint IS NULL OR EXISTS (
        SELECT 1 FROM article_tags at WHERE at.article_id = a.id AND at.tag_id = $2::bigint))
  AND ($3::bigint IS NULL OR a.author_id = $3::bigint)
  AND ($4::bool IS NULL OR a.is_featured = $4::bool)`

	sqlListLatestPublishedExcluding = `SELECT a.id, a.title, a.slug, a.excerpt, a.content_json, a.content_html, a.content_text, a.cover_media_id, a.cover_caption, a.category_id, a.author_id, a.status, a.published_at, a.is_featured, a.is_breaking, a.reading_minutes, a.event_date, a.event_location, a.view_count, a.seo_title, a.seo_description, a.og_media_id, a.canonical_url, a.search_vector, a.created_by, a.updated_by, a.created_at, a.updated_at, a.deleted_at FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND NOT (a.id = ANY(COALESCE($1::bigint[], '{}'::bigint[])))
ORDER BY a.published_at DESC, a.id DESC
LIMIT $2`

	sqlListFeaturedPublished = `SELECT a.id, a.title, a.slug, a.excerpt, a.content_json, a.content_html, a.content_text, a.cover_media_id, a.cover_caption, a.category_id, a.author_id, a.status, a.published_at, a.is_featured, a.is_breaking, a.reading_minutes, a.event_date, a.event_location, a.view_count, a.seo_title, a.seo_description, a.og_media_id, a.canonical_url, a.search_vector, a.created_by, a.updated_by, a.created_at, a.updated_at, a.deleted_at FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND a.is_featured
  AND ($1::bigint[] IS NULL OR a.category_id = ANY($1::bigint[]))
  AND NOT (a.id = ANY(COALESCE($2::bigint[], '{}'::bigint[])))
ORDER BY a.published_at DESC, a.id DESC
LIMIT $3`

	sqlListBreakingPublished = `SELECT a.id, a.title, a.slug, a.excerpt, a.content_json, a.content_html, a.content_text, a.cover_media_id, a.cover_caption, a.category_id, a.author_id, a.status, a.published_at, a.is_featured, a.is_breaking, a.reading_minutes, a.event_date, a.event_location, a.view_count, a.seo_title, a.seo_description, a.og_media_id, a.canonical_url, a.search_vector, a.created_by, a.updated_by, a.created_at, a.updated_at, a.deleted_at FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND a.is_breaking
ORDER BY a.published_at DESC, a.id DESC
LIMIT $1`

	sqlListRelatedArticles = `SELECT a.id, a.title, a.slug, a.excerpt, a.content_json, a.content_html, a.content_text, a.cover_media_id, a.cover_caption, a.category_id, a.author_id, a.status, a.published_at, a.is_featured, a.is_breaking, a.reading_minutes, a.event_date, a.event_location, a.view_count, a.seo_title, a.seo_description, a.og_media_id, a.canonical_url, a.search_vector, a.created_by, a.updated_by, a.created_at, a.updated_at, a.deleted_at FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND a.id <> $1::bigint
  AND (a.category_id = $2::bigint OR EXISTS (
        SELECT 1 FROM article_tags t1 JOIN article_tags t2 ON t2.tag_id = t1.tag_id
        WHERE t1.article_id = a.id AND t2.article_id = $1::bigint))
ORDER BY
  (a.category_id = $2::bigint)::int DESC,
  (SELECT count(*) FROM article_tags t1 JOIN article_tags t2 ON t2.tag_id = t1.tag_id
   WHERE t1.article_id = a.id AND t2.article_id = $1::bigint) DESC,
  a.published_at DESC, a.id DESC
LIMIT $3`

	sqlListTopArticleViews = `SELECT v.article_id, sum(v.views)::bigint AS views
FROM article_views_daily v
JOIN articles a ON a.id = v.article_id
WHERE v.day BETWEEN $1::date AND $2::date
  AND a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
GROUP BY v.article_id, a.published_at
ORDER BY sum(v.views) DESC, a.published_at DESC, v.article_id DESC
LIMIT $3`

	sqlSearchArticles = `SELECT a.id,
       ts_rank_cd(a.search_vector, q.query)::float8 AS rank,
       ts_headline('simple', a.content_text, q.query,
                   'MaxWords=35, MinWords=15, MaxFragments=1, StartSel=<mark>, StopSel=</mark>')::text AS headline
FROM articles a,
     (SELECT websearch_to_tsquery('simple', immutable_unaccent($1::text)) AS query) q
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND a.search_vector @@ q.query
ORDER BY rank DESC, a.published_at DESC, a.id DESC
LIMIT $3 OFFSET $2`

	sqlSearchArticlesFuzzy = `SELECT a.id,
       word_similarity(immutable_unaccent($1::text), immutable_unaccent(a.title))::float8 AS sim
FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND word_similarity(immutable_unaccent($1::text), immutable_unaccent(a.title)) > 0.3
ORDER BY sim DESC, a.published_at DESC, a.id DESC
LIMIT $3 OFFSET $2`

	sqlListPublishedEventsBetween = `SELECT id, title, slug, summary, description_json, description_html, starts_at, ends_at, is_all_day, location_name, location_address, maps_url, cover_media_id, registration_url, status, seo_title, seo_description, created_by, updated_by, created_at, updated_at FROM events
WHERE status = 'published'
  AND starts_at >= $1::timestamptz AND starts_at < $2::timestamptz
ORDER BY starts_at ASC, id ASC`

	sqlListPublishedArticlesForSitemap = `SELECT a.id, a.slug, a.category_id, a.updated_at
FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
ORDER BY a.published_at DESC, a.id DESC`

	sqlListPublishedEventsForSitemap = `SELECT slug, updated_at FROM events
WHERE status = 'published'
ORDER BY starts_at DESC, id DESC`
)

type explainResult struct {
	name            string
	sql             string
	plan            string
	rows            int64
	execMs          float64
	seqScanArticles bool
	scanSummary     string
}

var (
	execTimeRe  = regexp.MustCompile(`Execution Time: ([\d.]+) ms`)
	actualRowRe = regexp.MustCompile(`actual time=[\d.]+\.\.[\d.]+ rows=(\d+) loops=(\d+)`)
	scanNameRe  = regexp.MustCompile(`(Seq Scan|Index Scan|Index Only Scan|Bitmap Index Scan|Bitmap Heap Scan)(?: using (\S+))? on (\S+)`)
)

func runExplain(t *testing.T, pool *pgxpool.Pool, ctx context.Context, c explainCase) explainResult {
	t.Helper()
	rows, err := pool.Query(ctx, "EXPLAIN (ANALYZE, BUFFERS) "+c.sql, c.args...)
	require.NoError(t, err, c.name)
	defer rows.Close()
	var lines []string
	for rows.Next() {
		var line string
		require.NoError(t, rows.Scan(&line))
		lines = append(lines, line)
	}
	require.NoError(t, rows.Err(), c.name)
	plan := strings.Join(lines, "\n")

	res := explainResult{name: c.name, sql: c.sql, plan: plan}
	if m := execTimeRe.FindStringSubmatch(plan); m != nil {
		res.execMs, _ = strconv.ParseFloat(m[1], 64)
	}
	// Top row's actual rows= is the plan's own row estimate at the outermost node.
	if m := actualRowRe.FindStringSubmatch(plan); m != nil {
		n, _ := strconv.ParseInt(m[1], 10, 64)
		res.rows = n
	}
	var scans []string
	for _, m := range scanNameRe.FindAllStringSubmatch(plan, -1) {
		scanType, idx, table := m[1], m[2], m[3]
		if idx != "" {
			scans = append(scans, fmt.Sprintf("%s(%s on %s)", scanType, idx, table))
		} else {
			scans = append(scans, fmt.Sprintf("%s(%s)", scanType, table))
		}
		if scanType == "Seq Scan" && table == "a" {
			res.seqScanArticles = true
		}
	}
	res.scanSummary = strings.Join(scans, ", ")
	return res
}

func writePlan(t *testing.T, dir string, r explainResult) {
	t.Helper()
	name := strings.NewReplacer("/", "_").Replace(r.name)
	path := filepath.Join(dir, name+".txt")
	content := fmt.Sprintf("query: %s\nexecution_time_ms: %.3f\nrows: %d\nscan: %s\nsql: %s\n\n%s\n",
		r.name, r.execMs, r.rows, r.scanSummary, r.sql, r.plan)
	require.NoError(t, os.WriteFile(path, []byte(content), 0o644))
}

func writeSummary(t *testing.T, dir string, results []explainResult) {
	t.Helper()
	var b strings.Builder
	fmt.Fprintf(&b, "%-32s %8s %10s %8s %s\n", "query", "rows", "time_ms", "seq?", "index/scan")
	for _, r := range results {
		fmt.Fprintf(&b, "%-32s %8d %10.2f %8v %s\n", r.name, r.rows, r.execMs, r.seqScanArticles, r.scanSummary)
	}
	require.NoError(t, os.WriteFile(filepath.Join(dir, "SUMMARY.txt"), []byte(b.String()), 0o644))
}
