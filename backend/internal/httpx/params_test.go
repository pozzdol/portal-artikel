package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/apperr"
)

func TestPathInt64(t *testing.T) {
	var got int64
	var ok bool
	r := chi.NewRouter()
	r.Get("/x/{id}", func(w http.ResponseWriter, r *http.Request) { got, ok = PathInt64(r, "id") })
	for path, want := range map[string]int64{"/x/42": 42, "/x/0": 0, "/x/-1": 0, "/x/abc": 0} {
		r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, path, nil))
		assert.Equal(t, want, got, path)
		assert.Equal(t, want > 0, ok, path)
	}
}

func TestQueryParams(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?n=7&bad=x&b=true&f=0&s=%20hi%20", nil)
	n, err := QueryInt(r, "n", 1)
	require.NoError(t, err)
	assert.Equal(t, 7, n)
	n, err = QueryInt(r, "missing", 5)
	require.NoError(t, err)
	assert.Equal(t, 5, n)
	_, err = QueryInt(r, "bad", 1)
	assert.ErrorIs(t, err, apperr.ErrBadRequest)

	b, err := QueryBool(r, "b")
	require.NoError(t, err)
	require.NotNil(t, b)
	assert.True(t, *b)
	b, err = QueryBool(r, "f")
	require.NoError(t, err)
	assert.False(t, *b)
	b, err = QueryBool(r, "missing")
	require.NoError(t, err)
	assert.Nil(t, b)
	_, err = QueryBool(r, "bad")
	assert.ErrorIs(t, err, apperr.ErrBadRequest)

	assert.Equal(t, "hi", QueryString(r, "s"))
}

func TestCacheControl(t *testing.T) {
	h := CacheControl(60)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { Data(w, 200, 1) }))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	assert.Equal(t, "public, max-age=60", rec.Header().Get("Cache-Control"))

	h = CacheControl(60)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { NoStore(w); Data(w, 200, 1) }))
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	assert.Equal(t, "no-store", rec.Header().Get("Cache-Control"))

	h = CacheControl(60)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { WriteError(w, r, NotFound()) }))
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	assert.Equal(t, 404, rec.Code)
	assert.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
}

func TestDates(t *testing.T) {
	// 2026-09-26 20:00 UTC is 2026-09-27 03:00 WIB.
	ts := time.Date(2026, 9, 26, 20, 0, 0, 0, time.UTC)
	assert.Equal(t, "2026-09-27", FormatDate(ts))
	assert.Equal(t, time.Date(2026, 9, 27, 0, 0, 0, 0, time.UTC), WIBDate(ts))
	dbDate := time.Date(2026, 8, 17, 0, 0, 0, 0, time.UTC)
	assert.Equal(t, "2026-08-17", FormatDate(dbDate))
	assert.Nil(t, FormatDatePtr(nil))
	assert.Equal(t, "2026-08-17", *FormatDatePtr(&dbDate))

	d, err := ParseDate("2026-09-01")
	require.NoError(t, err)
	assert.Equal(t, "2026-08-31T17:00:00Z", d.UTC().Format(time.RFC3339))
	_, err = ParseDate("2026-13-01")
	assert.Error(t, err)
}

func TestWriteErrorMediaKinds(t *testing.T) {
	rec, body := doWriteError(t, apperr.UnsupportedMedia(""))
	assert.Equal(t, http.StatusUnsupportedMediaType, rec.Code)
	assert.Equal(t, "unsupported_media_type", body.Error.Code)
	assert.Equal(t, "Tipe file tidak didukung.", body.Error.Message)

	rec, body = doWriteError(t, apperr.UnsupportedMedia("Hanya gambar JPEG, PNG, GIF, atau WebP."))
	assert.Equal(t, "Hanya gambar JPEG, PNG, GIF, atau WebP.", body.Error.Message)
	assert.Equal(t, http.StatusUnsupportedMediaType, rec.Code)

	rec, body = doWriteError(t, apperr.PayloadTooLarge())
	assert.Equal(t, http.StatusRequestEntityTooLarge, rec.Code)
	assert.Equal(t, "payload_too_large", body.Error.Code)
}
