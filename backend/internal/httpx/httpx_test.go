package httpx

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/apperr"
)

type errResp struct {
	Error struct {
		Code    string            `json:"code"`
		Message string            `json:"message"`
		Fields  map[string]string `json:"fields"`
	} `json:"error"`
}

func doWriteError(t *testing.T, err error) (*httptest.ResponseRecorder, errResp) {
	t.Helper()
	rec := httptest.NewRecorder()
	WriteError(rec, httptest.NewRequest(http.MethodGet, "/x", nil), err)
	var body errResp
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	return rec, body
}

func TestWriteErrorShape(t *testing.T) {
	rec, body := doWriteError(t, NotFound())
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.Equal(t, "application/json; charset=utf-8", rec.Header().Get("Content-Type"))
	assert.Equal(t, "not_found", body.Error.Code)
	assert.NotEmpty(t, body.Error.Message)
	assert.NotContains(t, rec.Body.String(), `"fields"`)
}

func TestWriteErrorUnknownIsInternal(t *testing.T) {
	rec, body := doWriteError(t, errors.New("secret db detail"))
	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.Equal(t, "internal_error", body.Error.Code)
	assert.NotContains(t, rec.Body.String(), "secret")
}

func TestWriteErrorRateLimited(t *testing.T) {
	rec, body := doWriteError(t, RateLimited(30*time.Second))
	assert.Equal(t, http.StatusTooManyRequests, rec.Code)
	assert.Equal(t, "30", rec.Header().Get("Retry-After"))
	assert.Equal(t, "rate_limited", body.Error.Code)
}

type sample struct {
	Title string `json:"title" validate:"required,max=10"`
	Email string `json:"email" validate:"omitempty,email"`
}

func newJSONRequest(body string) *http.Request {
	return httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
}

func TestDecodeUnknownField(t *testing.T) {
	var v sample
	err := Decode(newJSONRequest(`{"title":"a","nope":1}`), &v)
	rec, body := doWriteError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Equal(t, "bad_request", body.Error.Code)
}

func TestDecodeMalformed(t *testing.T) {
	var v sample
	rec, body := doWriteError(t, Decode(newJSONRequest(`{"title":`), &v))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Equal(t, "bad_request", body.Error.Code)
}

func TestDecodeTooLarge(t *testing.T) {
	var v sample
	big := `{"title":"` + strings.Repeat("a", MaxBodyBytes+10) + `"}`
	rec, body := doWriteError(t, Decode(newJSONRequest(big), &v))
	assert.Equal(t, http.StatusRequestEntityTooLarge, rec.Code)
	assert.Equal(t, "payload_too_large", body.Error.Code)
}

func TestDecodeValidation(t *testing.T) {
	var v sample
	err := Decode(newJSONRequest(`{"title":"","email":"bad"}`), &v)
	rec, body := doWriteError(t, err)
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	assert.Equal(t, "validation_failed", body.Error.Code)
	assert.Equal(t, "Wajib diisi.", body.Error.Fields["title"])
	assert.Contains(t, body.Error.Fields, "email")
}

func TestDecodeOK(t *testing.T) {
	var v sample
	require.NoError(t, Decode(newJSONRequest(`{"title":"halo"}`), &v))
	assert.Equal(t, "halo", v.Title)
}

func TestListEnvelope(t *testing.T) {
	rec := httptest.NewRecorder()
	p := Pagination{Page: 2, PerPage: 12, Offset: 12}
	List(rec, []int{1, 2}, p.Meta(25))
	assert.JSONEq(t, `{"data":[1,2],"meta":{"page":2,"per_page":12,"total":25,"total_pages":3}}`, rec.Body.String())
}

func TestParsePagination(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?page=3&per_page=500", nil)
	p := ParsePagination(r, 12, 50)
	assert.Equal(t, Pagination{Page: 3, PerPage: 50, Offset: 100}, p)

	r = httptest.NewRequest(http.MethodGet, "/?page=-1&per_page=abc", nil)
	assert.Equal(t, Pagination{Page: 1, PerPage: 12, Offset: 0}, ParsePagination(r, 12, 50))
}

func TestSortParam(t *testing.T) {
	wl := []string{"published_at", "title"}
	col, desc, ok := SortParam(httptest.NewRequest(http.MethodGet, "/?sort=-published_at", nil), wl)
	assert.True(t, ok)
	assert.True(t, desc)
	assert.Equal(t, "published_at", col)

	_, _, ok = SortParam(httptest.NewRequest(http.MethodGet, "/?sort=id;drop", nil), wl)
	assert.False(t, ok)
}

func TestWriteErrorDomainMapping(t *testing.T) {
	cases := []struct {
		name   string
		err    error
		status int
		code   string
		msg    string
	}{
		{"bad request", apperr.BadRequest(""), 400, "bad_request", "Permintaan tidak valid."},
		{"bad request msg", apperr.BadRequest("ID tidak valid."), 400, "bad_request", "ID tidak valid."},
		{"unauthenticated", apperr.Unauthenticated(""), 401, "unauthenticated", "Silakan masuk terlebih dahulu."},
		{"unauthenticated msg", apperr.Unauthenticated("Sesi tidak valid."), 401, "unauthenticated", "Sesi tidak valid."},
		{"token expired", apperr.TokenExpired(), 401, "token_expired", "Sesi telah kedaluwarsa."},
		{"invalid credentials", apperr.InvalidCredentials(), 401, "invalid_credentials", "Email atau kata sandi salah."},
		{"forbidden", apperr.Forbidden(""), 403, "forbidden", "Anda tidak memiliki izin untuk tindakan ini."},
		{"csrf", apperr.CSRF(), 403, "csrf_failed", "Token CSRF tidak valid."},
		{"not found", apperr.NotFound(), 404, "not_found", "Data tidak ditemukan."},
		{"conflict", apperr.Conflict("Minimal satu super admin aktif harus tetap ada."), 409, "conflict", "Minimal satu super admin aktif harus tetap ada."},
		{"sentinel only", apperr.ErrNotFound, 404, "not_found", "Data tidak ditemukan."},
		{"wrapped", fmt.Errorf("user service: %w", apperr.Forbidden("Tidak boleh.")), 403, "forbidden", "Tidak boleh."},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec, body := doWriteError(t, tc.err)
			assert.Equal(t, tc.status, rec.Code)
			assert.Equal(t, tc.code, body.Error.Code)
			assert.Equal(t, tc.msg, body.Error.Message)
		})
	}
}

func TestWriteErrorDomainValidationAndRateLimit(t *testing.T) {
	rec, body := doWriteError(t, apperr.Validation(map[string]string{"email": "Email sudah terdaftar."}))
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	assert.Equal(t, "validation_failed", body.Error.Code)
	assert.Equal(t, "Email sudah terdaftar.", body.Error.Fields["email"])

	rec, body = doWriteError(t, apperr.RateLimited(42*time.Second))
	assert.Equal(t, http.StatusTooManyRequests, rec.Code)
	assert.Equal(t, "rate_limited", body.Error.Code)
	assert.Equal(t, "42", rec.Header().Get("Retry-After"))
}

func TestFormatTime(t *testing.T) {
	ts := time.Date(2026, 1, 2, 17, 30, 0, 0, time.UTC)
	assert.Equal(t, "2026-01-03T00:30:00+07:00", FormatTime(ts))
	assert.Nil(t, FormatTimePtr(nil))
	got := FormatTimePtr(&ts)
	require.NotNil(t, got)
	assert.Equal(t, "2026-01-03T00:30:00+07:00", *got)
}
