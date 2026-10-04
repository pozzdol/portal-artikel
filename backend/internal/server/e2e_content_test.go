//go:build integration

package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/article"
	"portal-berita/backend/internal/auth"
	"portal-berita/backend/internal/config"
	"portal-berita/backend/internal/jobs"
	"portal-berita/backend/internal/rbac"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/testdb"
)

// contentServer starts the full app (router + jobs) with a revalidate
// Recorder instead of the HTTP worker.
func contentServer(t *testing.T, pool *pgxpool.Pool, opts ...func(*config.Config)) (*httptest.Server, *App, *revalidate.Recorder) {
	t.Helper()
	cfg := &config.Config{
		AppEnv:                  config.EnvDevelopment,
		JWTSecret:               e2eSecret,
		AccessTokenTTL:          15 * time.Minute,
		RefreshTokenTTL:         7 * 24 * time.Hour,
		RefreshTokenTTLRemember: 30 * 24 * time.Hour,
		UploadDir:               t.TempDir(),
		UploadMaxMB:             5,
		PublicSiteURL:           "http://localhost:3000",
		ViewHashSalt:            "e2e-salt",
	}
	for _, o := range opts {
		o(cfg)
	}
	rec := &revalidate.Recorder{}
	app := NewApp(Deps{Cfg: cfg, Pool: pool, Reval: rec})
	srv := httptest.NewServer(app.Handler)
	t.Cleanup(srv.Close)
	return srv, app, rec
}

// raw sends a request with explicit headers and returns status, headers and
// the raw body (for non-JSON checks and User-Agent control).
func (c *client) raw(method, path string, body io.Reader, headers map[string]string) (int, http.Header, []byte) {
	c.t.Helper()
	req, err := http.NewRequest(method, c.base+path, body)
	require.NoError(c.t, err)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := c.http.Do(req)
	require.NoError(c.t, err)
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	require.NoError(c.t, err)
	return resp.StatusCode, resp.Header, b
}

func (c *client) upload(filename string, content []byte) result {
	c.t.Helper()
	buf := &bytes.Buffer{}
	mw := multipart.NewWriter(buf)
	part, err := mw.CreateFormFile("file", filename)
	require.NoError(c.t, err)
	_, err = part.Write(content)
	require.NoError(c.t, err)
	require.NoError(c.t, mw.WriteField("alt_text", "uji unggah"))
	require.NoError(c.t, mw.Close())
	status, hdr, b := c.raw(http.MethodPost, "/api/v1/admin/media", buf, map[string]string{
		"Content-Type":  mw.FormDataContentType(),
		auth.HeaderCSRF: c.cookie("/", auth.CookieCSRF),
	})
	out := result{Status: status, Header: hdr}
	if len(b) > 0 {
		require.NoError(c.t, json.Unmarshal(b, &out.Body), string(b))
	}
	return out
}

func (r result) list() []map[string]any {
	raw, _ := r.Body["data"].([]any)
	out := make([]map[string]any, 0, len(raw))
	for _, it := range raw {
		m, _ := it.(map[string]any)
		out = append(out, m)
	}
	return out
}

func (r result) total() int {
	m, _ := r.Body["meta"].(map[string]any)
	f, _ := m["total"].(float64)
	return int(f)
}

func asMaps(v any) []map[string]any {
	raw, _ := v.([]any)
	out := make([]map[string]any, 0, len(raw))
	for _, it := range raw {
		m, _ := it.(map[string]any)
		out = append(out, m)
	}
	return out
}

func slugs(items []map[string]any) []string {
	out := make([]string, 0, len(items))
	for _, it := range items {
		s, _ := it["slug"].(string)
		out = append(out, s)
	}
	return out
}

func idOf(m map[string]any) int64 {
	f, _ := m["id"].(float64)
	return int64(f)
}

func tinyPNG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 12, 8))
	img.Set(0, 0, color.RGBA{G: 255, A: 255})
	var b bytes.Buffer
	require.NoError(t, png.Encode(&b, img))
	return b.Bytes()
}

func jobNamed(t *testing.T, app *App, name string) jobs.Job {
	t.Helper()
	for _, j := range app.Jobs {
		if j.Name == name {
			return j
		}
	}
	t.Fatalf("job %q not wired", name)
	return jobs.Job{}
}

const (
	heroSlug   = "menjaga-keikhlasan-di-tengah-derasnya-arus-informasi"
	detailSlug = "adab-menuntut-ilmu"
	browserUA  = "Mozilla/5.0 (X11; Linux x86_64) uji-e2e"
)

func TestE2EContent(t *testing.T) {
	pool := testdb.New(t)
	testdb.SeedBase(t, pool)
	testdb.SeedDemo(t, pool, time.Now())
	_, superEmail, superPW := testdb.SuperAdmin(t, pool)
	srv, app, rec := contentServer(t, pool)
	pub := newClient(t, srv)

	t.Run("public site", func(t *testing.T) {
		res := pub.do(http.MethodGet, "/api/v1/public/site", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Equal(t, "public, max-age=60", res.Header.Get("Cache-Control"))
		d := res.data()
		assert.NotEmpty(t, d["settings"])
		menus, _ := d["menus"].(map[string]any)
		assert.NotEmpty(t, menus["header"], menus)
		assert.Len(t, asMaps(d["announcements"]), 2)
	})

	t.Run("public homepage has 12 sections", func(t *testing.T) {
		res := pub.do(http.MethodGet, "/api/v1/public/homepage", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		secs := asMaps(res.data()["sections"])
		require.Len(t, secs, 12)
		hero, _ := secs[0]["data"].(map[string]any)
		heroCard, _ := hero["hero"].(map[string]any)
		assert.Equal(t, heroSlug, heroCard["slug"], secs[0])
	})

	t.Run("public articles list, filter and detail", func(t *testing.T) {
		res := pub.do(http.MethodGet, "/api/v1/public/articles", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Len(t, res.list(), 12)
		assert.Equal(t, 21, res.total())

		res = pub.do(http.MethodGet, "/api/v1/public/articles?category=kajian", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		require.NotEmpty(t, res.list())
		for _, a := range res.list() {
			assert.True(t, strings.HasPrefix(a["url"].(string), "/kajian/"), a["url"])
		}

		res = pub.do(http.MethodGet, "/api/v1/public/articles/"+detailSlug, nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		d := res.data()
		assert.Equal(t, "/kajian/"+detailSlug, d["url"])
		assert.NotEmpty(t, d["content_html"])
		assert.NotEmpty(t, asMaps(d["related"]), "related")
		assert.NotEmpty(t, asMaps(d["tags"]), "tags")

		res = pub.do(http.MethodGet, "/api/v1/public/articles/tidak-ada-artikel-ini", nil, false)
		assert.Equal(t, http.StatusNotFound, res.Status)
		assert.Equal(t, "no-store", res.Header.Get("Cache-Control"))
	})

	t.Run("public trending and popular", func(t *testing.T) {
		res := pub.do(http.MethodGet, "/api/v1/public/articles/trending", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		items := res.list()
		require.NotEmpty(t, items)
		assert.Equal(t, heroSlug, items[0]["slug"])

		res = pub.do(http.MethodGet, "/api/v1/public/articles/popular?days=30", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.NotEmpty(t, res.list())
	})

	t.Run("public search fts and fuzzy", func(t *testing.T) {
		res := pub.do(http.MethodGet, "/api/v1/public/search?q=keikhlasan", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Contains(t, slugs(res.list()), heroSlug)
		assert.NotEqual(t, "true", res.Header.Get("X-Search-Fallback"))

		res = pub.do(http.MethodGet, "/api/v1/public/search?q=keiklasan", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Contains(t, slugs(res.list()), heroSlug)
		assert.Equal(t, "true", res.Header.Get("X-Search-Fallback"))
	})

	t.Run("public taxonomy and authors", func(t *testing.T) {
		res := pub.do(http.MethodGet, "/api/v1/public/categories", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		roots := res.list()
		assert.Len(t, roots, 5)
		assert.Contains(t, slugs(roots), "kabar-agenda")

		res = pub.do(http.MethodGet, "/api/v1/public/categories/kajian", nil, false)
		assert.Equal(t, http.StatusOK, res.Status, res.Body)

		res = pub.do(http.MethodGet, "/api/v1/public/tags?popular=true", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		tags := res.list()
		require.NotEmpty(t, tags)
		res = pub.do(http.MethodGet, "/api/v1/public/tags/"+tags[0]["slug"].(string), nil, false)
		assert.Equal(t, http.StatusOK, res.Status, res.Body)

		res = pub.do(http.MethodGet, "/api/v1/public/authors/ust-ahmad-fauzi", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		_, hasEmail := res.data()["email"]
		assert.False(t, hasEmail, "author must not expose email")
	})

	t.Run("public events alumni videos pages snippets", func(t *testing.T) {
		res := pub.do(http.MethodGet, "/api/v1/public/events?when=upcoming", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Len(t, res.list(), 3)
		res = pub.do(http.MethodGet, "/api/v1/public/events/"+res.list()[0]["slug"].(string), nil, false)
		assert.Equal(t, http.StatusOK, res.Status, res.Body)

		res = pub.do(http.MethodGet, "/api/v1/public/alumni?featured=true", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Len(t, res.list(), 4)
		res = pub.do(http.MethodGet, "/api/v1/public/alumni/"+res.list()[0]["slug"].(string), nil, false)
		assert.Equal(t, http.StatusOK, res.Status, res.Body)

		res = pub.do(http.MethodGet, "/api/v1/public/videos", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Len(t, res.list(), 3)
		res = pub.do(http.MethodGet, "/api/v1/public/videos/"+res.list()[0]["slug"].(string), nil, false)
		assert.Equal(t, http.StatusOK, res.Status, res.Body)

		res = pub.do(http.MethodGet, "/api/v1/public/pages/profil-yayasan", nil, false)
		assert.Equal(t, http.StatusOK, res.Status, res.Body)

		res = pub.do(http.MethodGet, "/api/v1/public/snippets?type=faq", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Len(t, res.list(), 3)
	})

	t.Run("public sitemap", func(t *testing.T) {
		status, _, body := pub.raw(http.MethodGet, "/api/v1/public/sitemap", nil, nil)
		require.Equal(t, http.StatusOK, status, string(body))
		assert.Contains(t, string(body), detailSlug)
		assert.Contains(t, string(body), "/tag/")
	})

	t.Run("admin without cookie is 401", func(t *testing.T) {
		res := pub.do(http.MethodGet, "/api/v1/admin/articles", nil, false)
		assert.Equal(t, http.StatusUnauthorized, res.Status)
	})

	adm := newClient(t, srv)
	adm.mustLogin(superEmail, superPW)

	// Fikih is a child of kajian; articles in it live under /kajian/.
	var fikihID int64
	{
		res := pub.do(http.MethodGet, "/api/v1/public/categories", nil, false)
		require.Equal(t, http.StatusOK, res.Status)
		for _, root := range res.list() {
			for _, ch := range asMaps(root["children"]) {
				if ch["slug"] == "fikih" {
					fikihID = idOf(ch)
				}
			}
		}
		require.NotZero(t, fikihID, "fikih category id")
	}

	var mediaID int64
	t.Run("media upload png 201 and renamed exe 415", func(t *testing.T) {
		res := adm.upload("foto.png", tinyPNG(t))
		require.Equal(t, http.StatusCreated, res.Status, res.Body)
		mediaID = idOf(res.data())
		assert.EqualValues(t, 12, res.data()["width"])
		assert.Contains(t, res.data()["url"], "/uploads/")

		res = adm.upload("trojan.jpg", append([]byte("MZ\x90\x00\x03\x00\x00\x00"), bytes.Repeat([]byte{0}, 64)...))
		assert.Equal(t, http.StatusUnsupportedMediaType, res.Status, res.Body)
	})

	const newSlug = "uji-e2e-keikhlasan-verifikasi"
	articleInput := map[string]any{
		"title":        "Uji E2E Keikhlasan Verifikasi",
		"content_json": map[string]any{"type": "doc", "content": []any{}},
		"content_html": "<p>Uji isi artikel.</p><script>alert(1)</script>",
		"category_id":  fikihID,
		"new_tags":     []string{"Uji E2E"},
	}
	var articleID int64

	t.Run("create, publish, visible publicly with revalidate tags", func(t *testing.T) {
		if mediaID > 0 {
			articleInput["cover_media_id"] = mediaID
		}
		res := adm.do(http.MethodPost, "/api/v1/admin/articles", articleInput, true)
		require.Equal(t, http.StatusCreated, res.Status, res.Body)
		articleID = idOf(res.data())
		assert.Equal(t, newSlug, res.data()["slug"])
		assert.NotContains(t, res.data()["content_html"], "<script")

		res = pub.do(http.MethodGet, "/api/v1/public/articles/"+newSlug, nil, false)
		assert.Equal(t, http.StatusNotFound, res.Status, "draft must not be public")

		rec.Reset()
		res = adm.do(http.MethodPost, fmt.Sprintf("/api/v1/admin/articles/%d/publish", articleID), map[string]any{}, true)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Equal(t, "published", res.data()["status"])

		res = pub.do(http.MethodGet, "/api/v1/public/articles/"+newSlug, nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Equal(t, "/kajian/"+newSlug, res.data()["url"])

		tags := rec.Tags()
		for _, want := range []string{
			revalidate.Article(newSlug), revalidate.Category("fikih"), revalidate.Category("kajian"),
			revalidate.TagHomepage, revalidate.TagSitemap,
		} {
			assert.Contains(t, tags, want)
		}
	})

	t.Run("view beacon dedup and bot filter", func(t *testing.T) {
		path := fmt.Sprintf("/api/v1/public/articles/%d/view", articleID)
		for i := 0; i < 3; i++ {
			status, hdr, _ := pub.raw(http.MethodPost, path, nil, map[string]string{"User-Agent": browserUA})
			require.Equal(t, http.StatusNoContent, status)
			assert.Equal(t, "no-store", hdr.Get("Cache-Control"))
		}
		status, _, _ := pub.raw(http.MethodPost, path, nil, map[string]string{"User-Agent": "Googlebot/2.1"})
		require.Equal(t, http.StatusNoContent, status)

		var views int64
		require.NoError(t, pool.QueryRow(context.Background(),
			"SELECT view_count FROM articles WHERE id = $1", articleID).Scan(&views))
		assert.EqualValues(t, 1, views)
	})

	t.Run("x-forwarded-for from a trusted peer is the client ip", func(t *testing.T) {
		path := fmt.Sprintf("/api/v1/public/articles/%d/view", articleID)
		viewCount := func() int64 {
			var n int64
			require.NoError(t, pool.QueryRow(context.Background(),
				"SELECT view_count FROM articles WHERE id = $1", articleID).Scan(&n))
			return n
		}
		beacon := func(c *client, ua, xff string) {
			status, _, _ := c.raw(http.MethodPost, path, nil, map[string]string{
				"User-Agent": ua, "X-Forwarded-For": xff,
			})
			require.Equal(t, http.StatusNoContent, status)
		}
		// The httptest peer is 127.0.0.1, inside the default TRUSTED_PROXIES.
		before := viewCount()
		beacon(pub, browserUA+" xff", "203.0.113.9")
		beacon(pub, browserUA+" xff", "203.0.113.9")
		beacon(pub, browserUA+" xff", "203.0.113.10")
		assert.Equal(t, before+2, viewCount(), "distinct forwarded IPs are distinct visitors")

		// TRUSTED_PROXIES=none: forwarding headers are ignored, so different
		// XFF values from the same peer are one visitor.
		srvNone, _, _ := contentServer(t, pool, func(c *config.Config) { c.TrustedProxies = []string{"none"} })
		none := newClient(t, srvNone)
		before = viewCount()
		beacon(none, browserUA+" none", "203.0.113.21")
		beacon(none, browserUA+" none", "203.0.113.22")
		assert.Equal(t, before+1, viewCount(), "untrusted XFF must not create visitors")
	})

	t.Run("slug change leaves a redirect", func(t *testing.T) {
		in := map[string]any{}
		for k, v := range articleInput {
			in[k] = v
		}
		in["slug"] = "uji-e2e-slug-baru"
		res := adm.do(http.MethodPut, fmt.Sprintf("/api/v1/admin/articles/%d", articleID), in, true)
		require.Equal(t, http.StatusOK, res.Status, res.Body)

		res = pub.do(http.MethodGet, "/api/v1/public/articles/"+newSlug, nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Equal(t, "/kajian/uji-e2e-slug-baru", res.data()["redirect"])

		res = pub.do(http.MethodGet, "/api/v1/public/articles/uji-e2e-slug-baru", nil, false)
		assert.Equal(t, http.StatusOK, res.Status, res.Body)
	})

	t.Run("schedule then publish_due job publishes", func(t *testing.T) {
		in := map[string]any{}
		for k, v := range articleInput {
			in[k] = v
		}
		in["title"] = "Uji E2E Terjadwal"
		delete(in, "new_tags")
		delete(in, "cover_media_id")
		res := adm.do(http.MethodPost, "/api/v1/admin/articles", in, true)
		require.Equal(t, http.StatusCreated, res.Status, res.Body)
		id := idOf(res.data())
		slug := res.data()["slug"].(string)

		at := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
		res = adm.do(http.MethodPost, fmt.Sprintf("/api/v1/admin/articles/%d/publish", id), map[string]any{"published_at": at}, true)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Equal(t, "scheduled", res.data()["status"])

		res = pub.do(http.MethodGet, "/api/v1/public/articles/"+slug, nil, false)
		assert.Equal(t, http.StatusNotFound, res.Status)

		// Time travel: the schedule is now past due.
		testdb.Exec(t, pool, "UPDATE articles SET published_at = now() - interval '1 minute' WHERE id = $1", id)
		rec.Reset()
		job := jobNamed(t, app, article.PublishDueJobName)
		require.NoError(t, job.Fn(context.Background()))

		res = pub.do(http.MethodGet, "/api/v1/public/articles/"+slug, nil, false)
		assert.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Contains(t, rec.Tags(), revalidate.Article(slug))
	})

	t.Run("homepage section create and reorder", func(t *testing.T) {
		res := adm.do(http.MethodPost, "/api/v1/admin/homepage/sections", map[string]any{
			"type": "article_grid", "label": "Uji Prestasi",
			"config": map[string]any{"title": "Prestasi", "category_slug": "prestasi", "limit": 3},
		}, true)
		require.Equal(t, http.StatusCreated, res.Status, res.Body)
		newID := idOf(res.data())

		res = adm.do(http.MethodGet, "/api/v1/admin/homepage/sections", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		ids := []int64{newID}
		for _, s := range res.list() {
			if idOf(s) != newID {
				ids = append(ids, idOf(s))
			}
		}
		rec.Reset()
		res = adm.do(http.MethodPut, "/api/v1/admin/homepage/sections/reorder", map[string]any{"ids": ids}, true)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Contains(t, rec.Tags(), revalidate.TagHomepage)

		res = pub.do(http.MethodGet, "/api/v1/public/homepage", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		secs := asMaps(res.data()["sections"])
		require.NotEmpty(t, secs)
		assert.Equal(t, newID, idOf(secs[0]))
		assert.Equal(t, "article_grid", secs[0]["type"])

		res = adm.do(http.MethodPut, fmt.Sprintf("/api/v1/admin/homepage/sections/%d", newID),
			map[string]any{"config": map[string]any{"columns": 5}}, true)
		assert.Equal(t, http.StatusUnprocessableEntity, res.Status, res.Body)
	})

	t.Run("menu replace", func(t *testing.T) {
		res := adm.do(http.MethodGet, "/api/v1/admin/menus/header", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		var toInput func(items []map[string]any) []map[string]any
		toInput = func(items []map[string]any) []map[string]any {
			out := make([]map[string]any, 0, len(items))
			for _, it := range items {
				n := map[string]any{
					"label": it["label"], "link_type": it["link_type"], "link_target": it["link_target"],
					"open_new_tab": it["open_new_tab"], "is_active": it["is_active"],
				}
				if ch := asMaps(it["children"]); len(ch) > 0 {
					n["children"] = toInput(ch)
				}
				out = append(out, n)
			}
			return out
		}
		items := toInput(asMaps(res.data()["items"]))
		items = append(items, map[string]any{
			"label": "Beasiswa", "link_type": "url", "link_target": "/tag/beasiswa", "is_active": true,
		})
		rec.Reset()
		res = adm.do(http.MethodPut, "/api/v1/admin/menus/header/items", map[string]any{"items": items}, true)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Contains(t, rec.Tags(), revalidate.TagMenus)

		res = pub.do(http.MethodGet, "/api/v1/public/site", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		menus, _ := res.data()["menus"].(map[string]any)
		var labels []string
		for _, it := range asMaps(menus["header"]) {
			labels = append(labels, it["label"].(string))
		}
		assert.Contains(t, labels, "Beasiswa")
	})

	t.Run("settings update", func(t *testing.T) {
		rec.Reset()
		res := adm.do(http.MethodPut, "/api/v1/admin/settings/site.contact", map[string]any{
			"address": "Jl. Uji No. 1, Sumedang", "email": "redaksi@almaidah.id", "phone": "(0261) 123-999",
		}, true)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Contains(t, rec.Tags(), revalidate.TagSettings)

		res = pub.do(http.MethodGet, "/api/v1/public/site", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		settings, _ := res.data()["settings"].(map[string]any)
		contact, _ := settings["site.contact"].(map[string]any)
		assert.Equal(t, "(0261) 123-999", contact["phone"], settings)

		res = adm.do(http.MethodPut, "/api/v1/admin/settings/unknown.key", map[string]any{"x": 1}, true)
		assert.Equal(t, http.StatusNotFound, res.Status, res.Body)
	})

	t.Run("dashboard", func(t *testing.T) {
		res := adm.do(http.MethodGet, "/api/v1/admin/dashboard", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.NotEmpty(t, res.data())
	})

	t.Run("admin role without settings.manage gets 403", func(t *testing.T) {
		const email, pw = "admin-konten@test.local", "Password-Konten-123"
		testdb.CreateUser(t, pool, testdb.UserOpts{
			Email: email, Password: pw, DisplayName: "Admin Konten",
			CanLogin: true, IsActive: true, Roles: []string{rbac.RoleAdmin},
		})
		c := newClient(t, srv)
		c.mustLogin(email, pw)
		res := c.do(http.MethodPut, "/api/v1/admin/settings/site.contact", map[string]any{
			"address": "x", "email": "a@b.id", "phone": "1",
		}, true)
		assert.Equal(t, http.StatusForbidden, res.Status, res.Body)
		assert.Equal(t, "forbidden", res.errCode())

		// But content management is allowed for the admin role.
		res = c.do(http.MethodGet, "/api/v1/admin/articles", nil, false)
		assert.Equal(t, http.StatusOK, res.Status, res.Body)
	})

	t.Run("preview token bypasses status with no-store", func(t *testing.T) {
		res := adm.do(http.MethodGet, fmt.Sprintf("/api/v1/admin/articles/%d/preview-token", articleID), nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		token := res.data()["token"].(string)
		res = adm.do(http.MethodPost, fmt.Sprintf("/api/v1/admin/articles/%d/unpublish", articleID), map[string]any{}, true)
		require.Equal(t, http.StatusOK, res.Status, res.Body)

		res = pub.do(http.MethodGet, "/api/v1/public/articles/uji-e2e-slug-baru", nil, false)
		assert.Equal(t, http.StatusNotFound, res.Status)
		res = pub.do(http.MethodGet, "/api/v1/public/articles/uji-e2e-slug-baru?preview="+token, nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Equal(t, "no-store", res.Header.Get("Cache-Control"))
		assert.Equal(t, true, res.data()["preview"])
	})

	t.Run("invalid preview tokens are 404 and never fall through", func(t *testing.T) {
		// A published article: a bad token must not return it (cache bypass).
		base := "/api/v1/public/articles/" + detailSlug
		res := pub.do(http.MethodGet, base, nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		detailID := idOf(res.data())
		require.NotZero(t, detailID)

		expired, _, err := article.NewPreviewTokens([]byte(e2eSecret), 30*time.Minute,
			func() time.Time { return time.Now().Add(-2 * time.Hour) }).Issue(detailID)
		require.NoError(t, err)
		other, _, err := article.NewPreviewTokens([]byte(e2eSecret), 30*time.Minute, time.Now).Issue(articleID)
		require.NoError(t, err)
		forged, _, err := article.NewPreviewTokens([]byte("another-secret-0123456789abcdef0123"), 30*time.Minute, time.Now).Issue(detailID)
		require.NoError(t, err)
		own, _, err := article.NewPreviewTokens([]byte(e2eSecret), 30*time.Minute, time.Now).Issue(detailID)
		require.NoError(t, err)

		for name, tok := range map[string]string{
			"junk":          "abc.def.ghi",
			"expired":       expired,
			"other article": other,
			"forged":        forged,
		} {
			res := pub.do(http.MethodGet, base+"?preview="+tok, nil, false)
			assert.Equal(t, http.StatusNotFound, res.Status, name)
			assert.Equal(t, "no-store", res.Header.Get("Cache-Control"), name)
			assert.Equal(t, "not_found", res.errCode(), name)
		}
		res = pub.do(http.MethodGet, base+"?preview="+own, nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Equal(t, true, res.data()["preview"])
	})

	t.Run("preview requests are rate limited per client ip", func(t *testing.T) {
		// A dedicated forwarded IP keeps this bucket independent of the
		// preview requests made above (all from 127.0.0.1).
		hdr := map[string]string{"X-Forwarded-For": "198.51.100.77"}
		path := "/api/v1/public/articles/" + detailSlug + "?preview=abc.def.ghi"
		for i := 0; i < 60; i++ {
			status, _, body := pub.raw(http.MethodGet, path, nil, hdr)
			require.Equal(t, http.StatusNotFound, status, "request %d: %s", i+1, body)
		}
		status, h, body := pub.raw(http.MethodGet, path, nil, hdr)
		assert.Equal(t, http.StatusTooManyRequests, status, string(body))
		assert.NotEmpty(t, h.Get("Retry-After"))
		assert.Equal(t, "no-store", h.Get("Cache-Control"))

		// Another client IP is unaffected, and so are non-preview requests.
		status, _, _ = pub.raw(http.MethodGet, path, nil, map[string]string{"X-Forwarded-For": "198.51.100.78"})
		assert.Equal(t, http.StatusNotFound, status)
		status, _, _ = pub.raw(http.MethodGet, "/api/v1/public/articles/"+detailSlug, nil, hdr)
		assert.Equal(t, http.StatusOK, status)
	})
}
