//go:build integration

package tag_test

import (
	"bytes"
	"context"
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
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/tag"
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
	svc := tag.NewService(pool, audit.New(pool), reval)
	h := tag.NewHandler(svc)
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

func TestTagIntegration(t *testing.T) {
	pool := testdb.New(t)
	testdb.SeedBase(t, pool)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	reval := &revalidate.Recorder{}
	srv := newTestServer(pool, adminID, reval)
	defer srv.Close()

	// Create two tags.
	resp := doJSON(t, http.MethodPost, srv.URL+"/tags", tag.CreateInput{Name: "Reuni Uji"})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var a struct {
		Data tag.Item `json:"data"`
	}
	decodeBody(t, resp, &a)
	assert.Equal(t, "reuni-uji", a.Data.Slug)

	resp = doJSON(t, http.MethodPost, srv.URL+"/tags", tag.CreateInput{Name: "Beasiswa Uji"})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var b struct {
		Data tag.Item `json:"data"`
	}
	decodeBody(t, resp, &b)

	// Duplicate name -> 422.
	resp = doJSON(t, http.MethodPost, srv.URL+"/tags", tag.CreateInput{Name: "Reuni Uji"})
	require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	resp.Body.Close()

	// Attach tag a to a real article so ListPopular/GetBySlug see a count.
	var categoryID int64
	require.NoError(t, pool.QueryRow(context.Background(), "SELECT id FROM categories LIMIT 1").Scan(&categoryID))
	authorID := testdb.CreateUser(t, pool, testdb.UserOpts{DisplayName: "Penulis Tag Uji", IsActive: true})
	var articleID int64
	require.NoError(t, pool.QueryRow(context.Background(),
		`INSERT INTO articles (title, slug, category_id, author_id, status, published_at)
		 VALUES ($1,$2,$3,$4,'published', now()) RETURNING id`,
		"Artikel Tag Uji", "artikel-tag-uji", categoryID, authorID).Scan(&articleID))
	testdb.Exec(t, pool, "INSERT INTO article_tags (article_id, tag_id) VALUES ($1,$2)", articleID, a.Data.ID)

	// Update: rename + slug change enqueues both old and new tags.
	resp = doJSON(t, http.MethodPut, fmt.Sprintf("%s/tags/%d", srv.URL, a.Data.ID), tag.UpdateInput{
		Name: "Reuni Uji Baru", Slug: "reuni-uji-baru",
	})
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var updated struct {
		Data tag.Item `json:"data"`
	}
	decodeBody(t, resp, &updated)
	assert.Equal(t, "reuni-uji-baru", updated.Data.Slug)
	assert.Equal(t, int64(1), updated.Data.ArticleCount)
	assert.Contains(t, reval.Tags(), "tag:reuni-uji-baru")
	assert.Contains(t, reval.Tags(), "tag:reuni-uji")

	// Public detail by slug.
	resp, err := http.Get(srv.URL + "/tags/reuni-uji-baru")
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var pubDetail struct {
		Data tag.Item `json:"data"`
	}
	decodeBody(t, resp, &pubDetail)
	assert.Equal(t, int64(1), pubDetail.Data.ArticleCount)

	// Popular order: the tagged one first.
	resp, err = http.Get(srv.URL + "/tags?popular=true&limit=5")
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var popular struct {
		Data []tag.Item `json:"data"`
	}
	decodeBody(t, resp, &popular)
	require.NotEmpty(t, popular.Data)
	assert.Equal(t, "reuni-uji-baru", popular.Data[0].Slug)

	// Merge b (empty) into a (has the article): 204-ish 200 with updated count,
	// and b is gone (subsequent operations on it 404).
	resp = doJSON(t, http.MethodPost, fmt.Sprintf("%s/tags/%d/merge", srv.URL, b.Data.ID), tag.MergeInput{IntoID: a.Data.ID})
	require.Equal(t, http.StatusOK, resp.StatusCode)
	resp.Body.Close()

	resp = doJSON(t, http.MethodPut, fmt.Sprintf("%s/tags/%d", srv.URL, b.Data.ID), tag.UpdateInput{Name: "Tidak Ada"})
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	resp.Body.Close()

	// Merging into itself -> 409.
	resp = doJSON(t, http.MethodPost, fmt.Sprintf("%s/tags/%d/merge", srv.URL, a.Data.ID), tag.MergeInput{IntoID: a.Data.ID})
	assert.Equal(t, http.StatusConflict, resp.StatusCode)
	resp.Body.Close()

	// Delete.
	resp = doJSON(t, http.MethodDelete, fmt.Sprintf("%s/tags/%d", srv.URL, a.Data.ID), nil)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	resp.Body.Close()
}
