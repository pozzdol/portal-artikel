//go:build integration

package homepage_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/authctx"
	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/homepage"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/testdb"
)

const heroSlug = "menjaga-keikhlasan-di-tengah-derasnya-arus-informasi"

func fakeGuard(_ ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler { return next }
}

type rawSection struct {
	ID     int64           `json:"id"`
	Type   string          `json:"type"`
	Config json.RawMessage `json:"config"`
	Data   json.RawMessage `json:"data"`
}

type errBody struct {
	Error struct {
		Code   string            `json:"code"`
		Fields map[string]string `json:"fields"`
	} `json:"error"`
}

func do(t *testing.T, method, url string, body any) (int, []byte) {
	t.Helper()
	var rd *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		require.NoError(t, err)
		rd = bytes.NewReader(b)
	} else {
		rd = bytes.NewReader(nil)
	}
	req, err := http.NewRequest(method, url, rd)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	var buf bytes.Buffer
	_, err = buf.ReadFrom(resp.Body)
	require.NoError(t, err)
	return resp.StatusCode, buf.Bytes()
}

func decodeData(t *testing.T, b []byte, v any) {
	t.Helper()
	var env struct {
		Data json.RawMessage `json:"data"`
	}
	require.NoError(t, json.Unmarshal(b, &env), string(b))
	require.NoError(t, json.Unmarshal(env.Data, v), string(env.Data))
}

func publicSections(t *testing.T, base string) []rawSection {
	t.Helper()
	code, b := do(t, http.MethodGet, base+"/public/homepage", nil)
	require.Equal(t, http.StatusOK, code, string(b))
	var hp struct {
		Sections []rawSection `json:"sections"`
	}
	decodeData(t, b, &hp)
	return hp.Sections
}

func level1(c content.CategoryRef) string {
	if c.Parent != nil {
		return c.Parent.Slug
	}
	return c.Slug
}

func TestHomepageIntegration(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	now := time.Now()
	testdb.SeedBase(t, pool)
	testdb.SeedDemo(t, pool, now)
	adminID, _, _ := testdb.SuperAdmin(t, pool)

	rec := &revalidate.Recorder{}
	svc := homepage.NewService(pool, audit.New(pool), rec, homepage.NewRegistry(), nil)
	h := homepage.NewHandler(svc)
	r := chi.NewRouter()
	r.Route("/admin", func(ad chi.Router) {
		ad.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				c := authctx.WithPrincipal(req.Context(), authctx.Principal{UserID: adminID})
				next.ServeHTTP(w, req.WithContext(c))
			})
		})
		h.Register(ad, fakeGuard)
	})
	r.Route("/public", func(p chi.Router) { h.RegisterPublic(p) })
	srv := httptest.NewServer(r)
	defer srv.Close()
	base := srv.URL

	// --- public homepage: 12 active seeded sections, all with data ---
	secs := publicSections(t, base)
	wantTypes := []string{"hero_trending", "breaking_ticker", "article_grid", "article_grid", "latest_with_sidebar",
		"quote_rotator", "timeline", "feature_split", "people_grid", "agenda_calendar", "video_gallery", "faq"}
	gotTypes := make([]string, len(secs))
	for i, s := range secs {
		gotTypes[i] = s.Type
	}
	require.Equal(t, wantTypes, gotTypes)

	var hero homepage.HeroTrendingData
	require.NoError(t, json.Unmarshal(secs[0].Data, &hero))
	require.NotNil(t, hero.Hero)
	assert.Equal(t, heroSlug, hero.Hero.Slug)
	assert.True(t, hero.Hero.IsFeatured)
	assert.Equal(t, "/kajian/"+heroSlug, hero.Hero.URL)
	assert.Len(t, hero.Trending, 5)
	for _, c := range hero.Trending {
		assert.NotEqual(t, hero.Hero.ID, c.ID, "hero not repeated in trending")
	}
	var heroCfg homepage.HeroTrendingConfig
	require.NoError(t, json.Unmarshal(secs[0].Config, &heroCfg))
	assert.Equal(t, "Trending Hari Ini", heroCfg.TrendingTitle)

	var ticker homepage.BreakingTickerData
	require.NoError(t, json.Unmarshal(secs[1].Data, &ticker))
	assert.GreaterOrEqual(t, len(ticker.Items), 3)
	assert.LessOrEqual(t, len(ticker.Items), 6)

	var kajian homepage.ArticleListData
	require.NoError(t, json.Unmarshal(secs[2].Data, &kajian))
	require.Len(t, kajian.Items, 3)
	for _, c := range kajian.Items {
		assert.Equal(t, "kajian", level1(c.Category), c.Slug)
		assert.NotEqual(t, hero.Hero.ID, c.ID, "exclude_hero")
	}

	var berita homepage.ArticleListData
	require.NoError(t, json.Unmarshal(secs[3].Data, &berita))
	require.Len(t, berita.Items, 4)
	for _, c := range berita.Items {
		assert.Equal(t, "berita", level1(c.Category), c.Slug)
	}

	var latest struct {
		Items   []content.ArticleCard      `json:"items"`
		Widgets map[string]json.RawMessage `json:"widgets"`
	}
	require.NoError(t, json.Unmarshal(secs[4].Data, &latest))
	assert.Len(t, latest.Items, 4)
	require.Len(t, latest.Widgets, 4)
	var popular []content.ArticleCard
	require.NoError(t, json.Unmarshal(latest.Widgets["popular"], &popular))
	assert.Len(t, popular, 3)
	var catsW []homepage.CategoryWidgetItem
	require.NoError(t, json.Unmarshal(latest.Widgets["categories"], &catsW))
	require.Len(t, catsW, 5)
	assert.Equal(t, "kajian", catsW[0].Slug)
	assert.Len(t, catsW[0].Children, 4)
	assert.Positive(t, catsW[0].ArticleCount)
	var tagsW []homepage.TagWidgetItem
	require.NoError(t, json.Unmarshal(latest.Widgets["tags"], &tagsW))
	assert.NotEmpty(t, tagsW)
	var next *content.EventCard
	require.NoError(t, json.Unmarshal(latest.Widgets["next_event"], &next))
	require.NotNil(t, next)

	var quotes homepage.QuoteRotatorData
	require.NoError(t, json.Unmarshal(secs[5].Data, &quotes))
	assert.Len(t, quotes.Quotes, 3)

	var timeline homepage.ArticleListData
	require.NoError(t, json.Unmarshal(secs[6].Data, &timeline))
	require.Len(t, timeline.Items, 3)
	for _, c := range timeline.Items {
		assert.Equal(t, "yayasan", c.Category.Slug)
		assert.NotNil(t, c.EventDate, c.Slug)
	}

	var split homepage.FeatureSplitData
	require.NoError(t, json.Unmarshal(secs[7].Data, &split))
	require.NotNil(t, split.Featured)
	assert.Equal(t, "opini", split.Featured.Category.Slug)
	assert.NotEmpty(t, split.Items)
	for _, c := range split.Items {
		assert.NotEqual(t, split.Featured.ID, c.ID)
	}

	var people homepage.PeopleGridData
	require.NoError(t, json.Unmarshal(secs[8].Data, &people))
	assert.Len(t, people.Items, 4)

	var agenda homepage.AgendaCalendarData
	require.NoError(t, json.Unmarshal(secs[9].Data, &agenda))
	assert.Len(t, agenda.Items, 3)
	require.NotNil(t, agenda.Calendar)
	// calendar_month "current" falls back to the next upcoming event's month
	// when the real current month has none (Issue 8): the grid must never be
	// empty while agenda items exist. Exact month depends on wall-clock date
	// (demo event offsets), so this checks the fallback invariant instead of a
	// specific "2006-01" value (see TestAgendaCalendarCurrentMonthFallback for
	// the deterministic, per-scenario version).
	assert.NotEmpty(t, agenda.Calendar.DaysWithEvents, "current month or fallback month must have events")

	var videos homepage.VideoGalleryData
	require.NoError(t, json.Unmarshal(secs[10].Data, &videos))
	require.Len(t, videos.Items, 3)
	assert.True(t, videos.Items[0].IsFeatured, "featured video first")

	var faq homepage.FAQData
	require.NoError(t, json.Unmarshal(secs[11].Data, &faq))
	require.Len(t, faq.Items, 3)
	assert.NotEmpty(t, faq.Items[0].Question)

	// Service-level Resolve matches the HTTP output.
	resolved, err := svc.Resolve(ctx, homepage.PageKeyHome)
	require.NoError(t, err)
	assert.Len(t, resolved, 12)

	// --- admin: section types and list ---
	code, b := do(t, http.MethodGet, base+"/admin/homepage/section-types", nil)
	require.Equal(t, http.StatusOK, code)
	var types []homepage.TypeInfo
	decodeData(t, b, &types)
	assert.Len(t, types, 13)

	code, b = do(t, http.MethodGet, base+"/admin/homepage/sections", nil)
	require.Equal(t, http.StatusOK, code)
	var list []homepage.Section
	decodeData(t, b, &list)
	require.Len(t, list, 13)
	for _, s := range list {
		assert.True(t, s.ConfigValid, "seed config valid: %s", s.Label)
	}
	assert.False(t, list[12].IsActive, "newsletter inactive")

	// --- admin: create ---
	rec.Reset()
	code, b = do(t, http.MethodPost, base+"/admin/homepage/sections", map[string]any{
		"type": "article_grid", "label": "Prestasi",
		"config": map[string]any{"title": "Prestasi", "category_slug": "prestasi", "columns": 2, "limit": 2},
	})
	require.Equal(t, http.StatusCreated, code, string(b))
	var created homepage.Section
	decodeData(t, b, &created)
	assert.EqualValues(t, 140, created.Position)
	assert.True(t, created.IsActive)
	assert.Contains(t, string(created.Config), `"show_excerpt":true`, "defaults filled")
	assert.Equal(t, []string{revalidate.TagHomepage}, rec.Tags())

	secs = publicSections(t, base)
	require.Len(t, secs, 13)
	last := secs[12]
	assert.Equal(t, created.ID, last.ID)
	var prestasi homepage.ArticleListData
	require.NoError(t, json.Unmarshal(last.Data, &prestasi))
	require.NotEmpty(t, prestasi.Items)
	for _, c := range prestasi.Items {
		assert.Equal(t, "prestasi", c.Category.Slug)
	}

	// Invalid configs → 422 with field errors.
	for _, tc := range []struct {
		body  map[string]any
		field string
	}{
		{map[string]any{"type": "article_grid", "label": "X", "config": map[string]any{"columns": 5}}, "config.columns"},
		{map[string]any{"type": "article_grid", "label": "X", "config": map[string]any{"category_slug": "tidak-ada"}}, "config.category_slug"},
		{map[string]any{"type": "article_grid", "label": "X", "config": map[string]any{"tag_slug": "tidak-ada"}}, "config.tag_slug"},
		{map[string]any{"type": "hero_trending", "label": "X", "config": map[string]any{"hero_source": "manual", "hero_article_id": 999999}}, "config.hero_article_id"},
		{map[string]any{"type": "carousel", "label": "X"}, "type"},
		{map[string]any{"type": "faq", "label": "   "}, "label"},
	} {
		code, b = do(t, http.MethodPost, base+"/admin/homepage/sections", tc.body)
		require.Equal(t, http.StatusUnprocessableEntity, code, string(b))
		var eb errBody
		require.NoError(t, json.Unmarshal(b, &eb))
		assert.Contains(t, eb.Error.Fields, tc.field, string(b))
	}

	// --- admin: update ---
	code, b = do(t, http.MethodPut, fmt.Sprintf("%s/admin/homepage/sections/%d", base, created.ID), map[string]any{"is_active": false})
	require.Equal(t, http.StatusOK, code, string(b))
	var updated homepage.Section
	decodeData(t, b, &updated)
	assert.False(t, updated.IsActive)
	assert.Equal(t, "Prestasi", updated.Label)
	assert.Len(t, publicSections(t, base), 12)

	code, b = do(t, http.MethodPut, fmt.Sprintf("%s/admin/homepage/sections/%d", base, created.ID),
		map[string]any{"is_active": true, "label": "Prestasi Santri", "config": map[string]any{"category_slug": "prestasi", "limit": 13}})
	require.Equal(t, http.StatusUnprocessableEntity, code, string(b))
	code, _ = do(t, http.MethodPut, base+"/admin/homepage/sections/999999", map[string]any{"is_active": true})
	assert.Equal(t, http.StatusNotFound, code)

	code, b = do(t, http.MethodPut, fmt.Sprintf("%s/admin/homepage/sections/%d", base, created.ID),
		map[string]any{"is_active": true, "config": map[string]any{"category_slug": "prestasi", "limit": 1, "dedupe": true}})
	require.Equal(t, http.StatusOK, code, string(b))

	// --- admin: reorder (two-pass with the DEFERRABLE unique key) ---
	code, b = do(t, http.MethodGet, base+"/admin/homepage/sections", nil)
	require.Equal(t, http.StatusOK, code)
	decodeData(t, b, &list)
	require.Len(t, list, 14)
	ids := make([]int64, len(list))
	for i, s := range list {
		ids[len(list)-1-i] = s.ID // reversed
	}
	rec.Reset()
	code, b = do(t, http.MethodPut, base+"/admin/homepage/sections/reorder", map[string]any{"ids": ids})
	require.Equal(t, http.StatusOK, code, string(b))
	var reordered []homepage.Section
	decodeData(t, b, &reordered)
	for i, s := range reordered {
		assert.Equal(t, ids[i], s.ID)
		assert.EqualValues(t, (i+1)*10, s.Position)
	}
	assert.Equal(t, []string{revalidate.TagHomepage}, rec.Tags())
	secs = publicSections(t, base)
	require.Len(t, secs, 13)
	assert.Equal(t, created.ID, secs[0].ID, "new section first after reversal")
	assert.Equal(t, "faq", secs[1].Type)
	assert.Equal(t, "hero_trending", secs[12].Type)
	// The hero is still resolved first so exclude_hero holds even when the
	// hero section comes last.
	require.NoError(t, json.Unmarshal(secs[12].Data, &hero))
	require.NotNil(t, hero.Hero)
	for _, s := range secs {
		if s.Type == "article_grid" && s.ID != created.ID {
			var g homepage.ArticleListData
			require.NoError(t, json.Unmarshal(s.Data, &g))
			for _, c := range g.Items {
				assert.NotEqual(t, hero.Hero.ID, c.ID)
			}
		}
	}

	code, b = do(t, http.MethodPut, base+"/admin/homepage/sections/reorder", map[string]any{"ids": ids[1:]})
	require.Equal(t, http.StatusUnprocessableEntity, code, string(b))
	dup := append([]int64{ids[0]}, ids[:len(ids)-1]...)
	code, _ = do(t, http.MethodPut, base+"/admin/homepage/sections/reorder", map[string]any{"ids": dup})
	require.Equal(t, http.StatusUnprocessableEntity, code)

	// --- invalid stored config is skipped publicly, flagged in admin ---
	testdb.Exec(t, pool, `UPDATE homepage_sections SET config = '{"columns":9}'::jsonb WHERE id = $1`, created.ID)
	secs = publicSections(t, base)
	assert.Len(t, secs, 12)
	code, b = do(t, http.MethodGet, base+"/admin/homepage/sections", nil)
	require.Equal(t, http.StatusOK, code)
	decodeData(t, b, &list)
	for _, s := range list {
		if s.ID == created.ID {
			assert.False(t, s.ConfigValid)
			assert.JSONEq(t, `{"columns":9}`, string(s.Config))
		}
	}

	// --- admin: delete ---
	code, _ = do(t, http.MethodDelete, fmt.Sprintf("%s/admin/homepage/sections/%d", base, created.ID), nil)
	require.Equal(t, http.StatusNoContent, code)
	code, _ = do(t, http.MethodDelete, fmt.Sprintf("%s/admin/homepage/sections/%d", base, created.ID), nil)
	require.Equal(t, http.StatusNotFound, code)

	var n int
	require.NoError(t, pool.QueryRow(ctx,
		`SELECT count(*) FROM audit_logs WHERE entity_type = 'homepage_section' AND user_id = $1`, adminID).Scan(&n))
	assert.GreaterOrEqual(t, n, 5, "create, 2 updates, reorder, delete")

	// rich_text content is sanitized on save.
	code, b = do(t, http.MethodPost, base+"/admin/homepage/sections", map[string]any{
		"type": "rich_text", "label": "Sambutan",
		"config": map[string]any{"content_html": `<p>Halo</p><script>alert(1)</script><img src="x" onerror="y">`},
	})
	require.Equal(t, http.StatusCreated, code, string(b))
	assert.False(t, strings.Contains(string(b), "script"), string(b))
	assert.False(t, strings.Contains(string(b), "onerror"), string(b))
}

// TestAgendaCalendarCurrentMonthFallback (Issue 8): calendar_month "current"
// shows the current month when it has events, but falls back to the next
// upcoming event's month rather than rendering an empty grid.
func TestAgendaCalendarCurrentMonthFallback(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	// SeedBase alone seeds the single agenda_calendar section (position 100,
	// calendar_month: "current") and zero events.
	testdb.SeedBase(t, pool)

	// ListUpcomingEvents filters on the DB's own now(), not rc.now, so event
	// times below are anchored to the wall clock (like the demo seed) rather
	// than a fixed date.
	fixedNow := time.Now()
	svc := homepage.NewService(pool, audit.New(pool), revalidate.Noop{}, homepage.NewRegistry(), func() time.Time { return fixedNow })
	wantCurrentMonth := fixedNow.In(httpx.Jakarta).Format("2006-01")

	agendaData := func(t *testing.T) *homepage.AgendaCalendarData {
		t.Helper()
		resolved, err := svc.Resolve(ctx, homepage.PageKeyHome)
		require.NoError(t, err)
		for _, r := range resolved {
			if r.Type == "agenda_calendar" {
				d, ok := r.Data.(*homepage.AgendaCalendarData)
				require.True(t, ok, "unexpected data type %T", r.Data)
				return d
			}
		}
		t.Fatal("agenda_calendar section not found")
		return nil
	}

	t.Run("no events at all: stays on current month with an empty grid", func(t *testing.T) {
		d := agendaData(t)
		require.NotNil(t, d.Calendar)
		assert.Equal(t, wantCurrentMonth, d.Calendar.Month)
		assert.Empty(t, d.Calendar.DaysWithEvents)
		assert.Empty(t, d.Items)
	})

	future := fixedNow.AddDate(0, 2, 0) // two months out: never the current month.
	testdb.Exec(t, pool, `
		INSERT INTO events (title, slug, summary, starts_at, ends_at, location_name, status)
		VALUES ('Agenda Uji Fallback', 'agenda-uji-fallback', 'Ringkasan uji.', $1, $2, 'Aula Utama', 'published')`,
		future, future.Add(2*time.Hour))

	t.Run("current month empty but a future event exists: falls back to that month", func(t *testing.T) {
		d := agendaData(t)
		require.NotNil(t, d.Calendar)
		wantMonth := future.In(httpx.Jakarta).Format("2006-01")
		assert.Equal(t, wantMonth, d.Calendar.Month)
		require.Len(t, d.Calendar.DaysWithEvents, 1)
		assert.Equal(t, future.In(httpx.Jakarta).Day(), d.Calendar.DaysWithEvents[0].Day)
		assert.Equal(t, "agenda-uji-fallback", d.Calendar.DaysWithEvents[0].Slug)
		assert.True(t, d.Calendar.DaysWithEvents[0].IsNext)
		require.Len(t, d.Items, 1)
	})

	// Last hour of the current month: always still "this month" and always in
	// the future relative to the DB's now() (bar a test run in that literal
	// last hour, an accepted, tiny window shared with other date-based fixtures
	// in this repo).
	monthStart := time.Date(fixedNow.Year(), fixedNow.Month(), 1, 0, 0, 0, 0, httpx.Jakarta)
	sameMonth := monthStart.AddDate(0, 1, 0).Add(-time.Hour)
	testdb.Exec(t, pool, `
		INSERT INTO events (title, slug, summary, starts_at, ends_at, location_name, status)
		VALUES ('Agenda Uji Bulan Ini', 'agenda-uji-bulan-ini', 'Ringkasan uji.', $1, $2, 'Aula Utama', 'published')`,
		sameMonth, sameMonth.Add(time.Minute))

	t.Run("current month gets its own event: no fallback", func(t *testing.T) {
		d := agendaData(t)
		require.NotNil(t, d.Calendar)
		assert.Equal(t, wantCurrentMonth, d.Calendar.Month)
		require.Len(t, d.Calendar.DaysWithEvents, 1)
		assert.Equal(t, "agenda-uji-bulan-ini", d.Calendar.DaysWithEvents[0].Slug)
		require.Len(t, d.Items, 2, "both events are still upcoming")
	})
}
