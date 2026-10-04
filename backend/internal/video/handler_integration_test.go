//go:build integration

package video_test

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
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/testdb"
	"portal-berita/backend/internal/video"
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

func TestVideoCRUDParseURLAndPublic(t *testing.T) {
	pool := testdb.New(t)
	testdb.SeedBase(t, pool)
	rec := &revalidate.Recorder{}
	svc := video.NewService(pool, audit.New(pool), rec)
	h := video.NewHandler(svc)

	admin := chi.NewRouter()
	h.Register(admin, fakeGuard)
	pub := chi.NewRouter()
	h.RegisterPublic(pub)
	adminSrv := httptest.NewServer(admin)
	defer adminSrv.Close()
	pubSrv := httptest.NewServer(pub)
	defer pubSrv.Close()

	// parse-url.
	resp := doJSON(t, http.MethodPost, adminSrv.URL+"/videos/parse-url", video.ParseURLInput{
		URL: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	})
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var parsed struct {
		Data video.ParseURLResult `json:"data"`
	}
	decodeBody(t, resp, &parsed)
	assert.Equal(t, "dQw4w9WgXcQ", parsed.Data.YoutubeID)

	resp = doJSON(t, http.MethodPost, adminSrv.URL+"/videos/parse-url", video.ParseURLInput{URL: "https://vimeo.com/1"})
	assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	resp.Body.Close()

	// Create published + draft.
	resp = doJSON(t, http.MethodPost, adminSrv.URL+"/videos", video.Input{
		Title: "Kajian Subuh", YoutubeID: parsed.Data.YoutubeID, Status: "published", IsFeatured: true,
	})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var v1 struct {
		Data video.Item `json:"data"`
	}
	decodeBody(t, resp, &v1)
	assert.Equal(t, "kajian-subuh", v1.Data.Slug)
	assert.Contains(t, rec.Tags(), "video:kajian-subuh")
	rec.Reset()

	resp = doJSON(t, http.MethodPost, adminSrv.URL+"/videos", video.Input{
		Title: "Draft Video", YoutubeID: "dQw4w9WgXcQ", Status: "draft",
	})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var v2 struct {
		Data video.Item `json:"data"`
	}
	decodeBody(t, resp, &v2)

	// Public list only shows published.
	resp = doJSON(t, http.MethodGet, pubSrv.URL+"/videos", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var list struct {
		Data []map[string]any      `json:"data"`
		Meta struct{ Total int64 } `json:"meta"`
	}
	decodeBody(t, resp, &list)
	assert.Equal(t, int64(1), list.Meta.Total)

	// Draft detail 404.
	resp = doJSON(t, http.MethodGet, pubSrv.URL+"/videos/draft-video", nil)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	resp.Body.Close()

	// Published detail has embed_url.
	resp = doJSON(t, http.MethodGet, pubSrv.URL+"/videos/kajian-subuh", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var detail struct {
		Data video.PublicDetail `json:"data"`
	}
	decodeBody(t, resp, &detail)
	assert.Equal(t, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", detail.Data.EmbedURL)
	assert.Equal(t, "/video/kajian-subuh", detail.Data.URL)

	// Invalid youtube_id on update -> 422.
	resp = doJSON(t, http.MethodPut, fmt.Sprintf("%s/videos/%d", adminSrv.URL, v2.Data.ID), video.Input{
		Title: "Draft Video", YoutubeID: "short",
	})
	assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	resp.Body.Close()

	// Delete.
	resp = doJSON(t, http.MethodDelete, fmt.Sprintf("%s/videos/%d", adminSrv.URL, v2.Data.ID), nil)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	resp.Body.Close()
}
