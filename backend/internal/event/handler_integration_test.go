//go:build integration

package event_test

import (
	"bytes"
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
	"portal-berita/backend/internal/event"
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

func TestEventCRUDAndPublic(t *testing.T) {
	pool := testdb.New(t)
	testdb.SeedBase(t, pool)
	rec := &revalidate.Recorder{}
	svc := event.NewService(pool, audit.New(pool), rec)
	h := event.NewHandler(svc)

	admin := chi.NewRouter()
	h.Register(admin, fakeGuard)
	pub := chi.NewRouter()
	h.RegisterPublic(pub)
	adminSrv := httptest.NewServer(admin)
	defer adminSrv.Close()
	pubSrv := httptest.NewServer(pub)
	defer pubSrv.Close()

	starts := time.Now().Add(48 * time.Hour).Format(time.RFC3339)
	resp := doJSON(t, http.MethodPost, adminSrv.URL+"/events", event.Input{
		Title: "Reuni Akbar Alumni 2026", LocationName: "Kampus Pusat",
		StartsAt: starts, Status: "published",
		DescriptionHTML: `<p>Info</p><script>alert(1)</script>`,
	})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var created struct {
		Data event.Item `json:"data"`
	}
	decodeBody(t, resp, &created)
	assert.Equal(t, "reuni-akbar-alumni-2026", created.Data.Slug)
	assert.NotContains(t, created.Data.DescriptionHTML, "<script>")
	assert.Contains(t, rec.Tags(), "event:reuni-akbar-alumni-2026")
	assert.Contains(t, rec.Tags(), revalidate.TagEvents)
	rec.Reset()

	// Public detail visible (published).
	resp = doJSON(t, http.MethodGet, pubSrv.URL+"/events/reuni-akbar-alumni-2026", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var pubDetail struct {
		Data event.PublicDetail `json:"data"`
	}
	decodeBody(t, resp, &pubDetail)
	assert.Equal(t, "/agenda/reuni-akbar-alumni-2026", pubDetail.Data.URL)

	// Public listing with when=upcoming includes it.
	resp = doJSON(t, http.MethodGet, pubSrv.URL+"/events?when=upcoming", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var list struct {
		Data []map[string]any      `json:"data"`
		Meta struct{ Total int64 } `json:"meta"`
	}
	decodeBody(t, resp, &list)
	assert.GreaterOrEqual(t, list.Meta.Total, int64(1))

	// Draft event: not visible publicly.
	resp = doJSON(t, http.MethodPost, adminSrv.URL+"/events", event.Input{
		Title: "Draft Saja", LocationName: "TBD", StartsAt: starts,
	})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	decodeBody(t, resp, &created)
	assert.Equal(t, "draft", created.Data.Status)
	resp = doJSON(t, http.MethodGet, pubSrv.URL+"/events/draft-saja", nil)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	resp.Body.Close()

	// Update: slug change + invalid window.
	resp = doJSON(t, http.MethodPut, fmt.Sprintf("%s/events/%d", adminSrv.URL, created.Data.ID), event.Input{
		Title: "Draft Saja Diperbarui", Slug: "draft-baru", LocationName: "TBD", StartsAt: starts,
		EndsAt: strPtr(time.Now().Format(time.RFC3339)), Status: "published",
	})
	require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	resp.Body.Close()

	// Valid update.
	end := time.Now().Add(50 * time.Hour).Format(time.RFC3339)
	resp = doJSON(t, http.MethodPut, fmt.Sprintf("%s/events/%d", adminSrv.URL, created.Data.ID), event.Input{
		Title: "Draft Saja Diperbarui", Slug: "draft-baru", LocationName: "TBD", StartsAt: starts,
		EndsAt: &end, Status: "published",
	})
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var updated struct {
		Data event.Item `json:"data"`
	}
	decodeBody(t, resp, &updated)
	assert.Equal(t, "draft-baru", updated.Data.Slug)

	// Delete.
	resp = doJSON(t, http.MethodDelete, fmt.Sprintf("%s/events/%d", adminSrv.URL, updated.Data.ID), nil)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	resp.Body.Close()
	resp = doJSON(t, http.MethodGet, fmt.Sprintf("%s/events/%d", adminSrv.URL, updated.Data.ID), nil)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	resp.Body.Close()
}

func strPtr(s string) *string { return &s }
