//go:build integration

package media_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/authctx"
	"portal-berita/backend/internal/media"
	"portal-berita/backend/internal/media/storage"
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

func newTestServer(t *testing.T, pool *pgxpool.Pool, actorID int64) (*httptest.Server, *media.Service) {
	t.Helper()
	st := storage.NewLocal(t.TempDir(), "/uploads")
	svc := media.NewService(pool, st, audit.New(pool), 2<<20) // 2 MiB limit
	h := media.NewHandler(svc)
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler { return withActor(actorID, next) })
	h.Register(r, fakeGuard)
	return httptest.NewServer(r), svc
}

func pngUploadBody(t *testing.T, field, filename string, w, h int) (*bytes.Buffer, string) {
	t.Helper()
	return pngUploadBodyCompressed(t, field, filename, w, h, png.DefaultCompression)
}

// pngUploadBodyCompressed lets the "oversized upload" test force
// png.NoCompression, since a uniform image compresses far below the size
// limit otherwise.
func pngUploadBodyCompressed(t *testing.T, field, filename string, w, h int, level png.CompressionLevel) (*bytes.Buffer, string) {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	img.Set(0, 0, color.RGBA{G: 255, A: 255})
	var pngBuf bytes.Buffer
	enc := png.Encoder{CompressionLevel: level}
	require.NoError(t, enc.Encode(&pngBuf, img))

	body := &bytes.Buffer{}
	mw := multipart.NewWriter(body)
	part, err := mw.CreateFormFile(field, filename)
	require.NoError(t, err)
	_, err = part.Write(pngBuf.Bytes())
	require.NoError(t, err)
	require.NoError(t, mw.WriteField("alt_text", "uji unggah"))
	require.NoError(t, mw.Close())
	return body, mw.FormDataContentType()
}

func doUpload(t *testing.T, url string, body io.Reader, contentType string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, url, body)
	require.NoError(t, err)
	req.Header.Set("Content-Type", contentType)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	return resp
}

func decodeBody(t *testing.T, resp *http.Response, v any) {
	t.Helper()
	defer resp.Body.Close()
	require.NoError(t, json.NewDecoder(resp.Body).Decode(v))
}

func TestMediaIntegration(t *testing.T) {
	pool := testdb.New(t)
	testdb.SeedBase(t, pool)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	srv, _ := newTestServer(t, pool, adminID)
	defer srv.Close()

	// Upload a valid PNG -> 201 with dimensions.
	body, ct := pngUploadBody(t, "file", "foto.png", 12, 8)
	resp := doUpload(t, srv.URL+"/media", body, ct)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var created struct {
		Data media.Item `json:"data"`
	}
	decodeBody(t, resp, &created)
	require.NotNil(t, created.Data.Width)
	require.NotNil(t, created.Data.Height)
	assert.Equal(t, int32(12), *created.Data.Width)
	assert.Equal(t, int32(8), *created.Data.Height)
	assert.Equal(t, "foto.png", created.Data.OriginalName)
	assert.Contains(t, created.Data.URL, "/uploads/")

	// A renamed executable is rejected as unsupported media (415).
	fake := &bytes.Buffer{}
	mw := multipart.NewWriter(fake)
	part, err := mw.CreateFormFile("file", "trojan.jpg")
	require.NoError(t, err)
	_, err = part.Write(append([]byte("MZ\x90\x00\x03\x00\x00\x00"), bytes.Repeat([]byte{0}, 64)...))
	require.NoError(t, err)
	require.NoError(t, mw.Close())
	resp = doUpload(t, srv.URL+"/media", fake, mw.FormDataContentType())
	assert.Equal(t, http.StatusUnsupportedMediaType, resp.StatusCode)
	resp.Body.Close()

	// Oversized upload -> 413. NoCompression guarantees the encoded size
	// exceeds the 2 MiB test limit despite the image content being mostly
	// uniform (which the default compressor would otherwise shrink well
	// below it).
	bigBody, bigCT := pngUploadBodyCompressed(t, "file", "besar.png", 1200, 1200, png.NoCompression)
	resp = doUpload(t, srv.URL+"/media", bigBody, bigCT)
	assert.Equal(t, http.StatusRequestEntityTooLarge, resp.StatusCode)
	resp.Body.Close()

	// List includes the created item.
	resp, err2 := http.Get(srv.URL + "/media")
	require.NoError(t, err2)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var list struct {
		Data []media.Item  `json:"data"`
		Meta httpxMetaStub `json:"meta"`
	}
	decodeBody(t, resp, &list)
	assert.GreaterOrEqual(t, len(list.Data), 1)

	// Update alt/caption.
	updateReq, err := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/media/%d", srv.URL, created.Data.ID),
		bytes.NewReader([]byte(`{"alt_text":"Baru","caption":"Keterangan"}`)))
	require.NoError(t, err)
	updateReq.Header.Set("Content-Type", "application/json")
	resp, err = http.DefaultClient.Do(updateReq)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var updated struct {
		Data media.Item `json:"data"`
	}
	decodeBody(t, resp, &updated)
	require.NotNil(t, updated.Data.AltText)
	assert.Equal(t, "Baru", *updated.Data.AltText)

	// Delete an unreferenced media -> 204.
	delReq, err := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/media/%d", srv.URL, created.Data.ID), nil)
	require.NoError(t, err)
	resp, err = http.DefaultClient.Do(delReq)
	require.NoError(t, err)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	resp.Body.Close()

	// GET /media/{id} on the deleted item -> 404.
	resp, err = http.Get(fmt.Sprintf("%s/media/%d", srv.URL, created.Data.ID))
	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	resp.Body.Close()

	// A media still referenced by an article cannot be deleted (409).
	body2, ct2 := pngUploadBody(t, "file", "cover.png", 20, 10)
	resp = doUpload(t, srv.URL+"/media", body2, ct2)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var cover struct {
		Data media.Item `json:"data"`
	}
	decodeBody(t, resp, &cover)

	// GET /media/{id} returns the item.
	resp, err = http.Get(fmt.Sprintf("%s/media/%d", srv.URL, cover.Data.ID))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var single struct {
		Data media.Item `json:"data"`
	}
	decodeBody(t, resp, &single)
	assert.Equal(t, cover.Data.ID, single.Data.ID)
	assert.Equal(t, "cover.png", single.Data.OriginalName)

	// A second item, so GET /media?ids= has something to reorder/skip around.
	body3, ct3 := pngUploadBody(t, "file", "kedua.png", 5, 5)
	resp = doUpload(t, srv.URL+"/media", body3, ct3)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var second struct {
		Data media.Item `json:"data"`
	}
	decodeBody(t, resp, &second)

	// GET /media?ids=… returns items in the requested order, skips unknown
	// ids and carries no "meta".
	missingID := second.Data.ID + 1_000_000
	resp, err = http.Get(fmt.Sprintf("%s/media?ids=%d,%d,%d", srv.URL, second.Data.ID, missingID, cover.Data.ID))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var byIDs struct {
		Data []media.Item    `json:"data"`
		Meta json.RawMessage `json:"meta"`
	}
	decodeBody(t, resp, &byIDs)
	require.Len(t, byIDs.Data, 2)
	assert.Equal(t, second.Data.ID, byIDs.Data[0].ID)
	assert.Equal(t, cover.Data.ID, byIDs.Data[1].ID)
	assert.Nil(t, byIDs.Meta)

	// Non-numeric id in the list -> 400.
	resp, err = http.Get(srv.URL + "/media?ids=abc")
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()

	// More than 100 ids -> 400.
	manyIDs := make([]string, 101)
	for i := range manyIDs {
		manyIDs[i] = strconv.Itoa(i + 1)
	}
	resp, err = http.Get(srv.URL + "/media?ids=" + strings.Join(manyIDs, ","))
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()

	var categoryID, authorID int64
	require.NoError(t, pool.QueryRow(context.Background(), "SELECT id FROM categories LIMIT 1").Scan(&categoryID))
	authorID = testdb.CreateUser(t, pool, testdb.UserOpts{DisplayName: "Penulis Uji", IsActive: true})
	testdb.Exec(t, pool,
		`INSERT INTO articles (title, slug, category_id, author_id, cover_media_id) VALUES ($1,$2,$3,$4,$5)`,
		"Artikel Uji Media", "artikel-uji-media", categoryID, authorID, cover.Data.ID,
	)

	delReq2, err := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/media/%d", srv.URL, cover.Data.ID), nil)
	require.NoError(t, err)
	resp, err = http.DefaultClient.Do(delReq2)
	require.NoError(t, err)
	assert.Equal(t, http.StatusConflict, resp.StatusCode)
	resp.Body.Close()
}

type httpxMetaStub struct {
	Page       int   `json:"page"`
	PerPage    int   `json:"per_page"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}
