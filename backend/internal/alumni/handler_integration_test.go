//go:build integration

package alumni_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/alumni"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/testdb"
)

func fakeGuard(_ ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler { return next }
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

func TestAlumniCRUDReorderAndPublic(t *testing.T) {
	pool := testdb.New(t)
	testdb.SeedBase(t, pool)
	rec := &revalidate.Recorder{}
	svc := alumni.NewService(pool, audit.New(pool), rec)
	h := alumni.NewHandler(svc)

	admin := chi.NewRouter()
	h.Register(admin, fakeGuard)
	pub := chi.NewRouter()
	h.RegisterPublic(pub)
	adminSrv := httptest.NewServer(admin)
	defer adminSrv.Close()
	pubSrv := httptest.NewServer(pub)
	defer pubSrv.Close()

	year := int16(1998)
	resp := doJSON(t, http.MethodPost, adminSrv.URL+"/alumni", alumni.Input{
		Name: "Dr. H. Asep Suryana", RoleTitle: "Dosen & Peneliti", ClassYear: &year,
		ShortBio: "Alumni berprestasi.", Status: "published", IsFeatured: true,
		StoryHTML: `<p>Kisah</p><script>alert(1)</script>`,
	})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var a1 struct {
		Data alumni.Item `json:"data"`
	}
	decodeBody(t, resp, &a1)
	assert.Equal(t, "dr-h-asep-suryana", a1.Data.Slug)
	assert.NotContains(t, a1.Data.StoryHTML, "<script>")
	assert.Contains(t, rec.Tags(), "alumni:dr-h-asep-suryana")
	rec.Reset()

	resp = doJSON(t, http.MethodPost, adminSrv.URL+"/alumni", alumni.Input{
		Name: "Ustadzah Fulanah", RoleTitle: "Pendidik", ShortBio: "Alumni.", Status: "draft",
	})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var a2 struct {
		Data alumni.Item `json:"data"`
	}
	decodeBody(t, resp, &a2)

	// Public: only published + featured filter.
	resp = doJSON(t, http.MethodGet, pubSrv.URL+"/alumni?featured=true", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var list struct {
		Data []map[string]any      `json:"data"`
		Meta struct{ Total int64 } `json:"meta"`
	}
	decodeBody(t, resp, &list)
	assert.Equal(t, int64(1), list.Meta.Total)

	resp = doJSON(t, http.MethodGet, pubSrv.URL+"/alumni/ustadzah-fulanah", nil)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	resp.Body.Close()

	resp = doJSON(t, http.MethodGet, pubSrv.URL+"/alumni/dr-h-asep-suryana", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var detail struct {
		Data alumni.PublicDetail `json:"data"`
	}
	decodeBody(t, resp, &detail)
	assert.Equal(t, "/tokoh/dr-h-asep-suryana", detail.Data.URL)

	// Reorder.
	resp = doJSON(t, http.MethodPut, adminSrv.URL+"/alumni/reorder", alumni.ReorderInput{
		Items: []alumni.ReorderItem{{ID: a2.Data.ID, SortOrder: 1}, {ID: a1.Data.ID, SortOrder: 2}},
	})
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	resp.Body.Close()
	assert.Contains(t, rec.Tags(), revalidate.TagAlumni)

	// Reorder unknown id -> 404.
	resp = doJSON(t, http.MethodPut, adminSrv.URL+"/alumni/reorder", alumni.ReorderInput{
		Items: []alumni.ReorderItem{{ID: 999999, SortOrder: 1}},
	})
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	resp.Body.Close()

	// Delete.
	resp = doJSON(t, http.MethodDelete, fmt.Sprintf("%s/alumni/%d", adminSrv.URL, a2.Data.ID), nil)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	resp.Body.Close()
}
