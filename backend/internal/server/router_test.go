package server

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/config"
)

func newTestRouter(t *testing.T) (http.Handler, string) {
	t.Helper()
	dir := t.TempDir()
	cfg := &config.Config{AppEnv: "development", UploadDir: dir}
	return NewRouter(Deps{Cfg: cfg, Pool: nil}), dir
}

func serve(h http.Handler, method, path string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(method, path, nil))
	return rec
}

func TestHealthz(t *testing.T) {
	h, _ := newTestRouter(t)
	rec := serve(h, http.MethodGet, "/healthz")
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"status":"ok"}`, rec.Body.String())
	assert.Equal(t, "nosniff", rec.Header().Get("X-Content-Type-Options"))
	assert.Equal(t, "strict-origin-when-cross-origin", rec.Header().Get("Referrer-Policy"))
	assert.Equal(t, "DENY", rec.Header().Get("X-Frame-Options"))
}

func TestReadyzNilPool(t *testing.T) {
	h, _ := newTestRouter(t)
	rec := serve(h, http.MethodGet, "/readyz")
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)
	assert.JSONEq(t, `{"status":"unavailable","database":"error"}`, rec.Body.String())
}

func TestAPINotFoundJSON(t *testing.T) {
	h, _ := newTestRouter(t)
	for _, p := range []string{"/api/v1/nope", "/nope"} {
		rec := serve(h, http.MethodGet, p)
		assert.Equal(t, http.StatusNotFound, rec.Code, p)
		assert.Contains(t, rec.Header().Get("Content-Type"), "application/json")
		var body struct {
			Error struct{ Code, Message string } `json:"error"`
		}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
		assert.Equal(t, "not_found", body.Error.Code)
	}
}

func TestMethodNotAllowedJSON(t *testing.T) {
	h, _ := newTestRouter(t)
	rec := serve(h, http.MethodPost, "/healthz")
	assert.Equal(t, http.StatusMethodNotAllowed, rec.Code)
	assert.Contains(t, rec.Body.String(), "method_not_allowed")
}

func TestUploadsStatic(t *testing.T) {
	h, dir := newTestRouter(t)
	require.NoError(t, os.MkdirAll(filepath.Join(dir, "brand"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "brand", "a.txt"), []byte("hi"), 0o644))

	rec := serve(h, http.MethodGet, "/uploads/brand/a.txt")
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "hi", rec.Body.String())
	assert.Equal(t, "public, max-age=31536000, immutable", rec.Header().Get("Cache-Control"))

	rec = serve(h, http.MethodGet, "/uploads/brand/")
	assert.Equal(t, http.StatusNotFound, rec.Code, "directory listing must be disabled")
	assert.Equal(t, "no-store", rec.Header().Get("Cache-Control"))

	rec = serve(h, http.MethodGet, "/uploads/brand/missing.png")
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.Equal(t, "no-store", rec.Header().Get("Cache-Control"), "a missing file must not be cached")
}

func TestContentRoutesMounted(t *testing.T) {
	h, _ := newTestRouter(t)
	mux, ok := h.(chi.Routes)
	require.True(t, ok)
	cases := []struct{ method, path, pattern string }{
		{http.MethodGet, "/api/v1/public/articles/trending", "/api/v1/public/articles/trending"},
		{http.MethodGet, "/api/v1/public/articles/popular", "/api/v1/public/articles/popular"},
		{http.MethodGet, "/api/v1/public/articles/some-slug", "/api/v1/public/articles/{slug}"},
		{http.MethodPost, "/api/v1/public/articles/7/view", "/api/v1/public/articles/{id}/view"},
		{http.MethodGet, "/api/v1/public/homepage", "/api/v1/public/homepage"},
		{http.MethodGet, "/api/v1/public/site", "/api/v1/public/site"},
		{http.MethodGet, "/api/v1/public/sitemap", "/api/v1/public/sitemap"},
		{http.MethodPost, "/api/v1/admin/media", "/api/v1/admin/media"},
		{http.MethodPut, "/api/v1/admin/homepage/sections/reorder", "/api/v1/admin/homepage/sections/reorder"},
		{http.MethodGet, "/api/v1/admin/dashboard", "/api/v1/admin/dashboard"},
	}
	for _, c := range cases {
		rctx := chi.NewRouteContext()
		require.True(t, mux.Match(rctx, c.method, c.path), "%s %s", c.method, c.path)
		assert.Equal(t, c.pattern, rctx.RoutePattern(), "%s %s", c.method, c.path)
	}
}

func TestNewAppJobs(t *testing.T) {
	app := NewApp(Deps{Cfg: &config.Config{AppEnv: "development", UploadDir: t.TempDir()}})
	names := make([]string, 0, len(app.Jobs))
	for _, j := range app.Jobs {
		assert.Positive(t, j.Every, j.Name)
		assert.NotNil(t, j.Fn, j.Name)
		names = append(names, j.Name)
	}
	assert.Len(t, names, 3)
	assert.Contains(t, names, snippetJobName)
}

func TestAdminContentRequiresAuth(t *testing.T) {
	h, _ := newTestRouter(t)
	rec := serve(h, http.MethodGet, "/api/v1/admin/articles")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// TestAdminRoutesRequireAuth enumerates every mounted route and asserts that
// all admin routes and the authenticated /auth routes answer 401
// unauthenticated without cookies. Authentication runs before CSRF, so
// unsafe methods are rejected with 401 as well (not 403 csrf).
func TestAdminRoutesRequireAuth(t *testing.T) {
	h, _ := newTestRouter(t)
	mux, ok := h.(chi.Routes)
	require.True(t, ok)

	authOnly := map[string]bool{
		"GET /api/v1/auth/me":                      true,
		"PUT /api/v1/auth/me":                      true,
		"PUT /api/v1/auth/me/password":             true,
		"GET /api/v1/auth/sessions":                true,
		"DELETE /api/v1/auth/sessions/{family_id}": true,
	}
	param := regexp.MustCompile(`\{[^}]+\}`)
	checked, authSeen := 0, 0
	err := chi.Walk(mux, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		key := method + " " + route
		isAdmin := strings.HasPrefix(route, "/api/v1/admin/")
		if !isAdmin && !authOnly[key] {
			return nil
		}
		if authOnly[key] {
			authSeen++
		}
		checked++
		path := strings.ReplaceAll(param.ReplaceAllString(route, "1"), "*", "x")
		var body io.Reader
		if method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch {
			body = strings.NewReader("{}")
		}
		req := httptest.NewRequest(method, path, body)
		if body != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if !assert.Equal(t, http.StatusUnauthorized, rec.Code, key) {
			return nil
		}
		var resp struct {
			Error struct{ Code string } `json:"error"`
		}
		if assert.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp), key) {
			assert.Equal(t, "unauthenticated", resp.Error.Code, key)
		}
		return nil
	})
	require.NoError(t, err)
	assert.Equal(t, len(authOnly), authSeen, "every authenticated /auth route was walked")
	assert.GreaterOrEqual(t, checked, 40, "route walk matched too few routes")
	t.Logf("admin/auth routes asserted 401: %d", checked)

	// /auth/logout is CSRF-protected but deliberately not authenticated
	// (an expired session must still be able to log out): without the CSRF
	// pair it is rejected before doing anything.
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil))
	assert.Equal(t, http.StatusForbidden, rec.Code)
}
