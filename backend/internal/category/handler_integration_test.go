//go:build integration

package category_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/authctx"
	"portal-berita/backend/internal/category"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/testdb"
)

func fakeGuard(_ ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler { return next }
}

func withActor(actorID int64, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := authctx.WithPrincipal(r.Context(), authctx.Principal{UserID: actorID})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func newTestServer(pool *pgxpool.Pool, actorID int64, reval revalidate.Client) *httptest.Server {
	svc := category.NewService(pool, audit.New(pool), reval)
	h := category.NewHandler(svc)
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler { return withActor(actorID, next) })
	h.Register(r, fakeGuard)
	h.RegisterPublic(r)
	return httptest.NewServer(r)
}

func doJSON(t *testing.T, method, url string, body any) *http.Response {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		require.NoError(t, err)
		reader = bytes.NewReader(b)
	} else {
		reader = bytes.NewReader(nil)
	}
	req, err := http.NewRequest(method, url, reader)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	return resp
}

func decodeBody(t *testing.T, resp *http.Response, v any) {
	t.Helper()
	defer resp.Body.Close()
	require.NoError(t, json.NewDecoder(resp.Body).Decode(v))
}

func TestCategoryIntegration(t *testing.T) {
	pool := testdb.New(t)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	reval := &revalidate.Recorder{}
	srv := newTestServer(pool, adminID, reval)
	defer srv.Close()

	// Create a root category.
	resp := doJSON(t, http.MethodPost, srv.URL+"/categories", category.CreateInput{Name: "Kabar Uji"})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var root struct {
		Data category.TreeNode `json:"data"`
	}
	decodeBody(t, resp, &root)
	assert.Equal(t, "kabar-uji", root.Data.Slug)
	assert.Contains(t, reval.Tags(), "category:kabar-uji")

	// Create a child category under it.
	resp = doJSON(t, http.MethodPost, srv.URL+"/categories", category.CreateInput{
		Name: "Sub Uji", ParentID: &root.Data.ID,
	})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var child struct {
		Data category.TreeNode `json:"data"`
	}
	decodeBody(t, resp, &child)
	require.NotNil(t, child.Data.ParentID)
	assert.Equal(t, root.Data.ID, *child.Data.ParentID)

	// A 3rd level is rejected (422).
	resp = doJSON(t, http.MethodPost, srv.URL+"/categories", category.CreateInput{
		Name: "Cucu Uji", ParentID: &child.Data.ID,
	})
	require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	var verr struct {
		Error struct {
			Fields map[string]string `json:"fields"`
		} `json:"error"`
	}
	decodeBody(t, resp, &verr)
	assert.Contains(t, verr.Error.Fields, "parent_id")

	// A reserved level-1 slug is rejected (422).
	resp = doJSON(t, http.MethodPost, srv.URL+"/categories", category.CreateInput{Name: "Agenda", Slug: "agenda"})
	require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	decodeBody(t, resp, &verr)
	assert.Contains(t, verr.Error.Fields, "slug")

	// A category with children cannot become a child.
	otherRoot := createRoot(t, srv.URL, "Root Lain")
	resp = doJSON(t, http.MethodPut, fmt.Sprintf("%s/categories/%d", srv.URL, root.Data.ID), category.UpdateInput{
		Name: root.Data.Name, ParentID: &otherRoot.ID,
	})
	require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	decodeBody(t, resp, &verr)
	assert.Contains(t, verr.Error.Fields, "parent_id")

	// Reorder moves the child before the root among the top-level set is
	// invalid (child stays a child) but a same-level reorder works.
	resp = doJSON(t, http.MethodPut, srv.URL+"/categories/reorder", category.ReorderInput{
		Items: []category.ReorderItem{
			{ID: otherRoot.ID, SortOrder: 0},
			{ID: root.Data.ID, SortOrder: 10},
		},
	})
	require.Equal(t, http.StatusOK, resp.StatusCode)
	resp.Body.Close()

	// Delete rejected while it has an article -> 409.
	// (Attach an article directly via SQL to avoid depending on the article package.)
	authorID := testdb.CreateUser(t, pool, testdb.UserOpts{DisplayName: "Penulis Kategori Uji", IsActive: true})
	testdb.Exec(t, pool, `INSERT INTO articles (title, slug, category_id, author_id) VALUES ($1,$2,$3,$4)`,
		"Artikel Kategori Uji", "artikel-kategori-uji", child.Data.ID, authorID)

	resp = doJSON(t, http.MethodDelete, fmt.Sprintf("%s/categories/%d", srv.URL, child.Data.ID), nil)
	assert.Equal(t, http.StatusConflict, resp.StatusCode)
	resp.Body.Close()

	// Delete rejected while it still has children -> 409.
	resp = doJSON(t, http.MethodDelete, fmt.Sprintf("%s/categories/%d", srv.URL, root.Data.ID), nil)
	assert.Equal(t, http.StatusConflict, resp.StatusCode)
	resp.Body.Close()

	// Public tree includes article_count (draft articles do not count) and
	// is active-only.
	resp, err := http.Get(srv.URL + "/categories")
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var tree struct {
		Data []category.TreeNode `json:"data"`
	}
	decodeBody(t, resp, &tree)
	found := false
	for _, n := range tree.Data {
		if n.Slug == "kabar-uji" {
			found = true
			require.Len(t, n.Children, 1)
			assert.Equal(t, int64(0), n.ArticleCount)
		}
	}
	assert.True(t, found)
}

func createRoot(t *testing.T, baseURL, name string) category.TreeNode {
	t.Helper()
	resp := doJSON(t, http.MethodPost, baseURL+"/categories", category.CreateInput{Name: name})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var out struct {
		Data category.TreeNode `json:"data"`
	}
	decodeBody(t, resp, &out)
	return out.Data
}
