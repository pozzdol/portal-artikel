//go:build integration

package page_test

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

	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/page"
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

func TestPageCRUDAndPublic(t *testing.T) {
	pool := testdb.New(t)
	testdb.SeedBase(t, pool)
	rec := &revalidate.Recorder{}
	svc := page.NewService(pool, audit.New(pool), rec)
	h := page.NewHandler(svc)

	admin := chi.NewRouter()
	h.Register(admin, fakeGuard)
	pub := chi.NewRouter()
	h.RegisterPublic(pub)
	adminSrv := httptest.NewServer(admin)
	defer adminSrv.Close()
	pubSrv := httptest.NewServer(pub)
	defer pubSrv.Close()

	resp := doJSON(t, http.MethodPost, adminSrv.URL+"/pages", page.Input{
		Title: "Kebijakan Privasi Uji", Status: "published",
		ContentHTML: `<p>Isi</p><script>alert(1)</script>`,
	})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var created struct {
		Data page.Item `json:"data"`
	}
	decodeBody(t, resp, &created)
	assert.Equal(t, "kebijakan-privasi-uji", created.Data.Slug)
	assert.NotContains(t, created.Data.ContentHTML, "<script>")
	assert.Contains(t, rec.Tags(), "page:kebijakan-privasi-uji")
	rec.Reset()

	resp = doJSON(t, http.MethodPost, adminSrv.URL+"/pages", page.Input{Title: "Draft Halaman"})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var draft struct {
		Data page.Item `json:"data"`
	}
	decodeBody(t, resp, &draft)
	assert.Equal(t, "draft", draft.Data.Status)

	// List includes both.
	resp = doJSON(t, http.MethodGet, adminSrv.URL+"/pages", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var list struct {
		Data []page.Item `json:"data"`
	}
	decodeBody(t, resp, &list)
	assert.GreaterOrEqual(t, len(list.Data), 2)

	// Public: draft 404, published 200.
	resp = doJSON(t, http.MethodGet, pubSrv.URL+"/pages/draft-halaman", nil)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	resp.Body.Close()

	resp = doJSON(t, http.MethodGet, pubSrv.URL+"/pages/kebijakan-privasi-uji", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var detail struct {
		Data page.PublicDetail `json:"data"`
	}
	decodeBody(t, resp, &detail)
	assert.Equal(t, "Kebijakan Privasi Uji", detail.Data.Title)

	// Slug conflict -> 422.
	resp = doJSON(t, http.MethodPut, fmt.Sprintf("%s/pages/%d", adminSrv.URL, draft.Data.ID), page.Input{
		Title: "Draft Halaman", Slug: "kebijakan-privasi-uji",
	})
	assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	resp.Body.Close()

	// Delete.
	resp = doJSON(t, http.MethodDelete, fmt.Sprintf("%s/pages/%d", adminSrv.URL, draft.Data.ID), nil)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	resp.Body.Close()
}
