//go:build integration

package snippet_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/snippet"
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

func strPtr(s string) *string { return &s }

func TestSnippetCRUDReorderPublicAndWindowJob(t *testing.T) {
	pool := testdb.New(t)
	testdb.SeedBase(t, pool)
	rec := &revalidate.Recorder{}
	svc := snippet.NewService(pool, audit.New(pool), rec)
	h := snippet.NewHandler(svc)

	admin := chi.NewRouter()
	h.Register(admin, fakeGuard)
	pub := chi.NewRouter()
	h.RegisterPublic(pub)
	adminSrv := httptest.NewServer(admin)
	defer adminSrv.Close()
	pubSrv := httptest.NewServer(pub)
	defer pubSrv.Close()

	// FAQ without title -> 422.
	resp := doJSON(t, http.MethodPost, adminSrv.URL+"/snippets", snippet.Input{
		Type: snippet.TypeFAQ, Body: "Jawaban.", IsActive: true,
	})
	assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	resp.Body.Close()

	// Create FAQ with script injection in body.
	resp = doJSON(t, http.MethodPost, adminSrv.URL+"/snippets", snippet.Input{
		Type: snippet.TypeFAQ, Title: strPtr("Apa itu ALMAIDAH?"),
		Body: `Portal alumni. <script>alert(1)</script>`, IsActive: true,
	})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var faq struct {
		Data snippet.Item `json:"data"`
	}
	decodeBody(t, resp, &faq)
	assert.NotContains(t, faq.Data.Body, "<script>")
	assert.Contains(t, rec.Tags(), revalidate.TagSnippets)
	rec.Reset()

	// Inactive announcement (not visible publicly).
	resp = doJSON(t, http.MethodPost, adminSrv.URL+"/snippets", snippet.Input{
		Type: snippet.TypeAnnouncement, Body: "Pengumuman nonaktif.", IsActive: false,
	})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var inactive struct {
		Data snippet.Item `json:"data"`
	}
	decodeBody(t, resp, &inactive)

	// Public listing filtered by type.
	resp = doJSON(t, http.MethodGet, pubSrv.URL+"/snippets?type=faq", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var list struct {
		Data []snippet.PublicItem `json:"data"`
	}
	decodeBody(t, resp, &list)
	found := false
	for _, it := range list.Data {
		if it.ID == faq.Data.ID {
			found = true
		}
	}
	assert.True(t, found)

	resp = doJSON(t, http.MethodGet, pubSrv.URL+"/snippets?type=announcement", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var announcements struct {
		Data []snippet.PublicItem `json:"data"`
	}
	decodeBody(t, resp, &announcements)
	for _, it := range announcements.Data {
		assert.NotEqual(t, inactive.Data.ID, it.ID)
	}

	// Invalid window: ends before starts -> 422.
	now := time.Now()
	resp = doJSON(t, http.MethodPost, adminSrv.URL+"/snippets", snippet.Input{
		Type: snippet.TypeBreaking, Body: "Berita.", IsActive: true,
		StartsAt: strPtr(now.Format(time.RFC3339)), EndsAt: strPtr(now.Add(-time.Hour).Format(time.RFC3339)),
	})
	assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	resp.Body.Close()

	// Reorder.
	resp = doJSON(t, http.MethodPut, adminSrv.URL+"/snippets/reorder", snippet.ReorderInput{
		Items: []snippet.ReorderItem{{ID: faq.Data.ID, SortOrder: 5}},
	})
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	resp.Body.Close()

	// Window-transition job runs without error and reports a count.
	n, err := svc.WindowTransitions(context.Background())
	require.NoError(t, err)
	assert.GreaterOrEqual(t, n, int64(0))

	// Delete.
	resp = doJSON(t, http.MethodDelete, fmt.Sprintf("%s/snippets/%d", adminSrv.URL, inactive.Data.ID), nil)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	resp.Body.Close()
}
