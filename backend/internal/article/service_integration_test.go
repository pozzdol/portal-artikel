//go:build integration

package article_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/article"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/authctx"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/testdb"
)

// fakeGuard injects a fixed principal + permission set and 403s when none of
// the required codes are held (stand-in for rbac.Checker.Guard()).
func fakeGuard(userID int64, perms rbac.Set) rbac.Guard {
	return func(codes ...string) func(http.Handler) http.Handler {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if len(codes) > 0 && !perms.HasAny(codes...) {
					httpx.WriteError(w, r, apperr.Forbidden(""))
					return
				}
				ctx := authctx.WithPrincipal(r.Context(), authctx.Principal{UserID: userID})
				ctx = rbac.WithPermissions(ctx, perms)
				next.ServeHTTP(w, r.WithContext(ctx))
			})
		}
	}
}

type response struct {
	Status int
	Header http.Header
	Body   map[string]any
}

func (r response) data(t *testing.T) map[string]any {
	t.Helper()
	d, ok := r.Body["data"].(map[string]any)
	require.True(t, ok, "no data object in %v", r.Body)
	return d
}

func (r response) list(t *testing.T) []any {
	t.Helper()
	d, ok := r.Body["data"].([]any)
	require.True(t, ok, "no data array in %v", r.Body)
	return d
}

func (r response) fields(t *testing.T) map[string]any {
	t.Helper()
	e, ok := r.Body["error"].(map[string]any)
	require.True(t, ok, "no error in %v", r.Body)
	f, _ := e["fields"].(map[string]any)
	return f
}

func do(t *testing.T, method, u string, body any) response {
	t.Helper()
	var rdr *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		require.NoError(t, err)
		rdr = bytes.NewReader(b)
	} else {
		rdr = bytes.NewReader(nil)
	}
	req, err := http.NewRequestWithContext(context.Background(), method, u, rdr)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	out := response{Status: resp.StatusCode, Header: resp.Header}
	if resp.StatusCode != http.StatusNoContent {
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&out.Body))
	}
	return out
}

func scalarID(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(context.Background(), sql, args...).Scan(&id))
	return id
}

func num(v any) int64 { return int64(v.(float64)) }

func baseBody(title string, categoryID int64) map[string]any {
	return map[string]any{
		"title":        title,
		"category_id":  categoryID,
		"content_json": map[string]any{"type": "doc", "content": []any{}},
		"content_html": "<p>Keikhlasan adalah kunci. Isi artikel uji integrasi.</p><script>alert(1)</script><img src=\"/uploads/x.png\" onerror=\"alert(2)\">",
	}
}

func TestArticleIntegration(t *testing.T) {
	ctx := context.Background()
	pool := testdb.New(t)
	testdb.SeedBase(t, pool)
	testdb.SeedDemo(t, pool, time.Now())

	adminID, _, _ := testdb.SuperAdmin(t, pool)
	writerID := testdb.CreateUser(t, pool, testdb.UserOpts{
		DisplayName: "Penulis Terbatas", Slug: "penulis-terbatas", CanLogin: false, IsActive: true,
	})
	fikihID := scalarID(t, pool, `SELECT id FROM categories WHERE slug = 'fikih'`)
	kajianID := scalarID(t, pool, `SELECT id FROM categories WHERE slug = 'kajian'`)
	fikihTagID := scalarID(t, pool, `SELECT id FROM tags WHERE slug = 'fikih'`)

	rec := &revalidate.Recorder{}
	svc := article.NewService(pool, audit.New(pool), rec, article.Config{
		PublicSiteURL: "https://almaidah.test/",
		JWTSecret:     []byte("integration-secret-integration-secret"),
	})
	h := article.NewHandler(svc)

	r := chi.NewRouter()
	r.Route("/admin", func(ar chi.Router) { h.Register(ar, fakeGuard(adminID, rbac.NewSet(rbac.AllPermissions...))) })
	r.Route("/limited", func(lr chi.Router) {
		h.Register(lr, fakeGuard(writerID, rbac.NewSet(rbac.PermArticlesRead, rbac.PermArticlesCreate, rbac.PermArticlesUpdate)))
	})
	r.Route("/public", func(pr chi.Router) {
		pr.Use(httpx.CacheControl(60))
		h.RegisterPublic(pr)
	})
	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	A, L, P := srv.URL+"/admin", srv.URL+"/limited", srv.URL+"/public"

	// --- create draft: sanitized, auto slug, tags, default author ---------
	body := baseBody("Uji Integrasi Keikhlasan", fikihID)
	body["tag_ids"] = []int64{fikihTagID}
	body["new_tags"] = []string{"Uji Tag Integrasi"}
	res := do(t, http.MethodPost, A+"/articles", body)
	require.Equal(t, http.StatusCreated, res.Status, res.Body)
	d := res.data(t)
	id := num(d["id"])
	slug := "uji-integrasi-keikhlasan"
	assert.Equal(t, slug, d["slug"])
	assert.Equal(t, "draft", d["status"])
	assert.Equal(t, "/kajian/"+slug, d["url"])
	assert.Equal(t, float64(adminID), d["author_id"])
	html := d["content_html"].(string)
	assert.NotContains(t, html, "<script")
	assert.NotContains(t, html, "onerror")
	assert.Contains(t, html, "Keikhlasan adalah kunci.")
	assert.NotEmpty(t, d["excerpt"])
	assert.Len(t, d["tags"], 2)
	assert.Equal(t, map[string]any{"type": "doc", "content": []any{}}, d["content_json"])
	assert.Contains(t, rec.Tags(), revalidate.Article(slug))

	// Same title again → numeric suffix.
	res = do(t, http.MethodPost, A+"/articles", baseBody("Uji Integrasi Keikhlasan", fikihID))
	require.Equal(t, http.StatusCreated, res.Status, res.Body)
	id2 := num(res.data(t)["id"])
	assert.Equal(t, slug+"-2", res.data(t)["slug"])

	// Validation errors.
	bad := baseBody("Salah", fikihID)
	bad["content_json"] = []any{}
	res = do(t, http.MethodPost, A+"/articles", bad)
	assert.Equal(t, http.StatusUnprocessableEntity, res.Status)
	assert.Contains(t, res.fields(t), "content_json")
	res = do(t, http.MethodPost, A+"/articles", baseBody("Salah", 999999))
	assert.Equal(t, http.StatusUnprocessableEntity, res.Status)
	assert.Contains(t, res.fields(t), "category_id")
	bad = baseBody("Salah", fikihID)
	bad["tag_ids"] = []int64{999999}
	res = do(t, http.MethodPost, A+"/articles", bad)
	assert.Equal(t, http.StatusUnprocessableEntity, res.Status)
	assert.Contains(t, res.fields(t), "tag_ids")
	bad = baseBody("Salah", fikihID)
	bad["slug"] = slug
	res = do(t, http.MethodPost, A+"/articles", bad)
	assert.Equal(t, http.StatusUnprocessableEntity, res.Status)
	assert.Equal(t, "Slug sudah dipakai.", res.fields(t)["slug"])
	bad = baseBody("Salah", fikihID)
	bad["cover_media_id"] = 999999
	res = do(t, http.MethodPost, A+"/articles", bad)
	assert.Equal(t, http.StatusUnprocessableEntity, res.Status)
	assert.Contains(t, res.fields(t), "cover_media_id")

	// --- slug-check ------------------------------------------------------
	res = do(t, http.MethodGet, A+"/articles/slug-check?slug="+slug, nil)
	require.Equal(t, http.StatusOK, res.Status)
	assert.Equal(t, false, res.data(t)["available"])
	assert.Equal(t, slug+"-3", res.data(t)["suggestion"])
	res = do(t, http.MethodGet, A+"/articles/slug-check?slug="+slug+"&exclude_id="+strconv.FormatInt(id, 10), nil)
	assert.Equal(t, true, res.data(t)["available"])
	res = do(t, http.MethodGet, A+"/articles/slug-check?slug="+url.QueryEscape("Judul Bebas"), nil)
	assert.Equal(t, false, res.data(t)["available"])
	assert.Equal(t, "judul-bebas", res.data(t)["suggestion"])

	// Draft is not public.
	assert.Equal(t, http.StatusNotFound, do(t, http.MethodGet, P+"/articles/"+slug, nil).Status)

	// --- publish now → public detail + revalidation tags -----------------
	rec.Reset()
	res = do(t, http.MethodPost, A+"/articles/"+strconv.FormatInt(id, 10)+"/publish", nil)
	require.Equal(t, http.StatusOK, res.Status, res.Body)
	assert.Equal(t, "published", res.data(t)["status"])
	tags := rec.Tags()
	for _, want := range []string{
		revalidate.Article(slug), revalidate.Category("kajian"), revalidate.Category("fikih"),
		revalidate.Author("super-admin-uji"), revalidate.Tag("fikih"), revalidate.Tag("uji-tag-integrasi"),
		revalidate.TagHomepage, revalidate.TagSitemap, revalidate.TagSearch, revalidate.TagTrending,
	} {
		assert.Contains(t, tags, want)
	}

	res = do(t, http.MethodGet, P+"/articles/"+slug, nil)
	require.Equal(t, http.StatusOK, res.Status, res.Body)
	assert.Equal(t, "public, max-age=60", res.Header.Get("Cache-Control"))
	d = res.data(t)
	assert.Equal(t, "/kajian/"+slug, d["url"])
	cat := d["category"].(map[string]any)
	assert.Equal(t, "fikih", cat["slug"])
	assert.Equal(t, "kajian", cat["parent"].(map[string]any)["slug"])
	assert.Len(t, d["related"], 4)
	for _, rel := range d["related"].([]any) {
		assert.NotEqual(t, float64(id), rel.(map[string]any)["id"])
	}
	seo := d["seo"].(map[string]any)
	assert.Equal(t, "https://almaidah.test/kajian/"+slug, seo["canonical_url"])
	assert.Equal(t, "Uji Integrasi Keikhlasan", seo["title"])
	assert.Len(t, d["tags"], 2)
	assert.NotContains(t, d, "preview")
	author := d["author"].(map[string]any)
	assert.NotContains(t, author, "email")

	// --- slug change → redirect; returning to the old slug is allowed ----
	upd := baseBody("Uji Integrasi Keikhlasan", fikihID)
	upd["slug"] = "uji-integrasi-slug-baru"
	upd["tag_ids"] = []int64{fikihTagID}
	rec.Reset()
	res = do(t, http.MethodPut, A+"/articles/"+strconv.FormatInt(id, 10), upd)
	require.Equal(t, http.StatusOK, res.Status, res.Body)
	assert.Equal(t, "published", res.data(t)["status"], "PUT leaves status untouched")
	assert.Len(t, res.data(t)["tags"], 1)
	tags = rec.Tags()
	assert.Contains(t, tags, revalidate.Article(slug))
	assert.Contains(t, tags, revalidate.Article("uji-integrasi-slug-baru"))
	assert.Contains(t, tags, revalidate.Tag("uji-tag-integrasi"), "old tag set revalidated")

	res = do(t, http.MethodGet, P+"/articles/"+slug, nil)
	require.Equal(t, http.StatusOK, res.Status)
	assert.Equal(t, "/kajian/uji-integrasi-slug-baru", res.data(t)["redirect"])
	res = do(t, http.MethodGet, A+"/articles/slug-check?slug="+slug, nil)
	assert.Equal(t, false, res.data(t)["available"], "redirect of another article blocks the slug")
	res = do(t, http.MethodGet, A+"/articles/slug-check?slug="+slug+"&exclude_id="+strconv.FormatInt(id, 10), nil)
	assert.Equal(t, true, res.data(t)["available"])

	upd["slug"] = slug
	res = do(t, http.MethodPut, A+"/articles/"+strconv.FormatInt(id, 10), upd)
	require.Equal(t, http.StatusOK, res.Status, res.Body)
	res = do(t, http.MethodGet, P+"/articles/uji-integrasi-slug-baru", nil)
	assert.Equal(t, "/kajian/"+slug, res.data(t)["redirect"])
	res = do(t, http.MethodGet, P+"/articles/"+slug, nil)
	require.Equal(t, http.StatusOK, res.Status)
	assert.NotContains(t, res.data(t), "redirect")

	// --- public list filters ---------------------------------------------
	res = do(t, http.MethodGet, P+"/articles?category=kajian&per_page=50", nil)
	require.Equal(t, http.StatusOK, res.Status)
	items := res.list(t)
	assert.NotEmpty(t, items)
	found := false
	for _, it := range items {
		m := it.(map[string]any)
		assert.True(t, strings.HasPrefix(m["url"].(string), "/kajian/"), m["url"])
		if num(m["id"]) == id {
			found = true
		}
	}
	assert.True(t, found, "kajian list includes the fikih sub-category article")
	assert.Equal(t, float64(len(items)), res.Body["meta"].(map[string]any)["total"])

	res = do(t, http.MethodGet, P+"/articles?tag=fikih", nil)
	assert.Len(t, res.list(t), 3) // 2 seeded + ours
	res = do(t, http.MethodGet, P+"/articles?author=super-admin-uji", nil)
	assert.Len(t, res.list(t), 1)
	res = do(t, http.MethodGet, P+"/articles?featured=true", nil)
	require.NotEmpty(t, res.list(t))
	for _, it := range res.list(t) {
		assert.Equal(t, true, it.(map[string]any)["is_featured"])
	}
	res = do(t, http.MethodGet, P+"/articles?category=tidak-ada", nil)
	assert.Empty(t, res.list(t))
	assert.Equal(t, http.StatusBadRequest, do(t, http.MethodGet, P+"/articles?featured=mungkin", nil).Status)
	res = do(t, http.MethodGet, P+"/articles?per_page=5&page=2", nil)
	meta := res.Body["meta"].(map[string]any)
	assert.Equal(t, float64(2), meta["page"])
	assert.Len(t, res.list(t), 5)

	// --- admin list ----------------------------------------------------------
	res = do(t, http.MethodGet, A+"/articles?category=kajian&q=Uji+Integrasi&sort=title", nil)
	require.Equal(t, http.StatusOK, res.Status)
	assert.Len(t, res.list(t), 2)
	res = do(t, http.MethodGet, A+"/articles?status=draft", nil)
	for _, it := range res.list(t) {
		assert.Equal(t, "draft", it.(map[string]any)["status"])
	}
	res = do(t, http.MethodGet, A+"/articles?author="+strconv.FormatInt(adminID, 10), nil)
	assert.Len(t, res.list(t), 2)
	assert.Equal(t, http.StatusBadRequest, do(t, http.MethodGet, A+"/articles?status=bogus", nil).Status)

	// --- unpublish → 404; schedule → 404; PublishDue publishes -----------
	res = do(t, http.MethodPost, A+"/articles/"+strconv.FormatInt(id, 10)+"/unpublish", nil)
	require.Equal(t, http.StatusOK, res.Status)
	assert.Equal(t, "draft", res.data(t)["status"])
	assert.Equal(t, http.StatusNotFound, do(t, http.MethodGet, P+"/articles/"+slug, nil).Status)

	future := time.Now().Add(time.Hour).Truncate(time.Second)
	res = do(t, http.MethodPost, A+"/articles/"+strconv.FormatInt(id, 10)+"/publish",
		map[string]any{"published_at": future.Format(time.RFC3339)})
	require.Equal(t, http.StatusOK, res.Status, res.Body)
	assert.Equal(t, "scheduled", res.data(t)["status"])
	assert.Equal(t, httpx.FormatTime(future), res.data(t)["published_at"])
	assert.Equal(t, http.StatusNotFound, do(t, http.MethodGet, P+"/articles/"+slug, nil).Status)
	assert.Equal(t, http.StatusBadRequest, do(t, http.MethodPost, A+"/articles/"+strconv.FormatInt(id, 10)+"/publish",
		map[string]any{"when": "now"}).Status)

	n, err := svc.PublishDue(ctx)
	require.NoError(t, err)
	assert.Equal(t, 0, n, "not due yet")

	testdb.Exec(t, pool, `UPDATE articles SET published_at = now() - interval '1 minute' WHERE id = $1`, id)
	rec.Reset()
	job := svc.PublishDueJob(nil)
	assert.Equal(t, "article.publish_due", job.Name)
	assert.Equal(t, time.Minute, job.Every)
	require.NoError(t, job.Fn(ctx))
	tags = rec.Tags()
	for _, want := range []string{revalidate.Article(slug), revalidate.TagHomepage, revalidate.TagSitemap, revalidate.Category("kajian")} {
		assert.Contains(t, tags, want)
	}
	res = do(t, http.MethodGet, P+"/articles/"+slug, nil)
	assert.Equal(t, http.StatusOK, res.Status)
	n, err = svc.PublishDue(ctx)
	require.NoError(t, err)
	assert.Equal(t, 0, n)

	// --- preview token shows a draft, with no-store ------------------------
	do(t, http.MethodPost, A+"/articles/"+strconv.FormatInt(id, 10)+"/unpublish", nil)
	res = do(t, http.MethodGet, A+"/articles/"+strconv.FormatInt(id, 10)+"/preview-token", nil)
	require.Equal(t, http.StatusOK, res.Status)
	token := res.data(t)["token"].(string)
	assert.Equal(t, "/kajian/"+slug+"?preview="+url.QueryEscape(token), res.data(t)["url"])
	assert.NotEmpty(t, res.data(t)["expires_at"])

	res = do(t, http.MethodGet, P+"/articles/"+slug+"?preview="+url.QueryEscape(token), nil)
	require.Equal(t, http.StatusOK, res.Status, res.Body)
	assert.Equal(t, "no-store", res.Header.Get("Cache-Control"))
	assert.Equal(t, true, res.data(t)["preview"])
	assert.Equal(t, http.StatusNotFound, do(t, http.MethodGet, P+"/articles/"+slug+"?preview=palsu", nil).Status)
	assert.Equal(t, http.StatusNotFound, do(t, http.MethodGet, P+"/articles/"+slug+"-2?preview="+url.QueryEscape(token), nil).Status,
		"token is bound to one article")

	// --- ownership ---------------------------------------------------------
	res = do(t, http.MethodPut, L+"/articles/"+strconv.FormatInt(id, 10), upd)
	assert.Equal(t, http.StatusForbidden, res.Status)
	res = do(t, http.MethodPost, L+"/articles", baseBody("Tulisan Penulis Terbatas", kajianID))
	require.Equal(t, http.StatusCreated, res.Status, res.Body)
	ownID := num(res.data(t)["id"])
	assert.Equal(t, float64(writerID), res.data(t)["author_id"])
	res = do(t, http.MethodPut, L+"/articles/"+strconv.FormatInt(ownID, 10), baseBody("Tulisan Penulis Terbatas (revisi)", kajianID))
	assert.Equal(t, http.StatusOK, res.Status, res.Body)
	assert.Equal(t, http.StatusForbidden, do(t, http.MethodPost, L+"/articles/"+strconv.FormatInt(ownID, 10)+"/publish", nil).Status)

	// Service-level: an actor without update_any on a seeded (created_by NULL) article.
	seededID := scalarID(t, pool, `SELECT id FROM articles WHERE slug = 'adab-menuntut-ilmu'`)
	_, err = svc.Update(ctx, article.Actor{UserID: writerID, Perms: rbac.NewSet(rbac.PermArticlesUpdate)}, seededID, article.Input{
		Title: "X", ContentJSON: json.RawMessage(`{"type":"doc"}`), ContentHTML: new(string), CategoryID: fikihID,
	})
	assert.ErrorIs(t, err, apperr.ErrForbidden)

	// --- soft delete / restore ---------------------------------------------
	idPath := A + "/articles/" + strconv.FormatInt(id2, 10)
	assert.Equal(t, http.StatusNoContent, do(t, http.MethodDelete, idPath, nil).Status)
	assert.Equal(t, http.StatusNotFound, do(t, http.MethodDelete, idPath, nil).Status)
	assert.Equal(t, http.StatusNotFound, do(t, http.MethodPut, idPath, upd).Status)
	assert.Equal(t, http.StatusOK, do(t, http.MethodGet, idPath, nil).Status, "trashed article still readable in admin")
	res = do(t, http.MethodGet, A+"/articles?trashed=true", nil)
	require.Len(t, res.list(t), 1)
	assert.Equal(t, float64(id2), res.list(t)[0].(map[string]any)["id"])
	assert.NotNil(t, res.list(t)[0].(map[string]any)["deleted_at"])
	assert.Equal(t, http.StatusNoContent, do(t, http.MethodPost, idPath+"/restore", nil).Status)
	assert.Equal(t, http.StatusNotFound, do(t, http.MethodPost, idPath+"/restore", nil).Status)
	assert.Equal(t, http.StatusNotFound, do(t, http.MethodGet, A+"/articles/999999999", nil).Status)

	// --- public author -----------------------------------------------------
	res = do(t, http.MethodGet, P+"/authors/ust-ahmad-fauzi", nil)
	require.Equal(t, http.StatusOK, res.Status)
	assert.Equal(t, "ust-ahmad-fauzi", res.data(t)["slug"])
	assert.Equal(t, "/penulis/ust-ahmad-fauzi", res.data(t)["url"])
	assert.NotContains(t, res.data(t), "email")
	assert.Equal(t, http.StatusNotFound, do(t, http.MethodGet, P+"/authors/tidak-ada", nil).Status)
	testdb.Exec(t, pool, `UPDATE users SET is_active = false WHERE slug = 'penulis-terbatas'`)
	assert.Equal(t, http.StatusNotFound, do(t, http.MethodGet, P+"/authors/penulis-terbatas", nil).Status)

	// --- audit trail -------------------------------------------------------
	var actions []string
	rows, err := pool.Query(ctx, `SELECT DISTINCT action FROM audit_logs WHERE entity_type = 'article' ORDER BY action`)
	require.NoError(t, err)
	for rows.Next() {
		var a string
		require.NoError(t, rows.Scan(&a))
		actions = append(actions, a)
	}
	require.NoError(t, rows.Err())
	assert.Equal(t, []string{"create", "delete", "publish", "restore", "schedule", "unpublish", "update"}, actions)
}
