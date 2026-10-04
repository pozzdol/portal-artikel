package httpx

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-playground/validator/v10"

	"portal-berita/backend/internal/apperr"
)

// Error is an API error rendered as {"error": {"code","message","fields"}}.
type Error struct {
	Status     int
	Code       string
	Message    string
	Fields     map[string]string
	RetryAfter time.Duration
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

type errorBody struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

type errorEnvelope struct {
	Error errorBody `json:"error"`
}

func newError(status int, code, msg string) *Error {
	return &Error{Status: status, Code: code, Message: msg}
}

// BadRequest: malformed JSON or bad parameters. Empty msg uses the default.
func BadRequest(msg string) *Error {
	if msg == "" {
		msg = "Permintaan tidak valid."
	}
	return newError(http.StatusBadRequest, "bad_request", msg)
}

// Unauthenticated: missing or invalid token.
func Unauthenticated() *Error {
	return newError(http.StatusUnauthorized, "unauthenticated", "Silakan masuk terlebih dahulu.")
}

// TokenExpired: access token expired; the client should refresh.
func TokenExpired() *Error {
	return newError(http.StatusUnauthorized, "token_expired", "Sesi telah kedaluwarsa.")
}

// InvalidCredentials: wrong email or password at login.
func InvalidCredentials() *Error {
	return newError(http.StatusUnauthorized, "invalid_credentials", "Email atau kata sandi salah.")
}

// Forbidden: missing permission.
func Forbidden() *Error {
	return newError(http.StatusForbidden, "forbidden", "Anda tidak memiliki izin untuk tindakan ini.")
}

// CSRFFailed: CSRF header mismatch.
func CSRFFailed() *Error {
	return newError(http.StatusForbidden, "csrf_failed", "Token CSRF tidak valid.")
}

// NotFound: resource does not exist.
func NotFound() *Error {
	return newError(http.StatusNotFound, "not_found", "Data tidak ditemukan.")
}

// Conflict: duplicate slug, entity still referenced, etc.
func Conflict(msg string) *Error {
	if msg == "" {
		msg = "Data bentrok dengan data yang sudah ada."
	}
	return newError(http.StatusConflict, "conflict", msg)
}

// PayloadTooLarge: request body/upload exceeds the limit.
func PayloadTooLarge() *Error {
	return newError(http.StatusRequestEntityTooLarge, "payload_too_large", "Ukuran data melebihi batas.")
}

// UnsupportedMediaType: rejected file/content type.
func UnsupportedMediaType() *Error {
	return newError(http.StatusUnsupportedMediaType, "unsupported_media_type", "Tipe file tidak didukung.")
}

// Validation: field-level validation errors (422).
func Validation(fields map[string]string) *Error {
	e := newError(http.StatusUnprocessableEntity, "validation_failed", "Data yang dikirim tidak valid.")
	e.Fields = fields
	return e
}

// RateLimited: too many requests; sets Retry-After when retryAfter > 0.
func RateLimited(retryAfter time.Duration) *Error {
	e := newError(http.StatusTooManyRequests, "rate_limited", "Terlalu banyak permintaan. Coba lagi nanti.")
	e.RetryAfter = retryAfter
	return e
}

// Internal: generic server error; never carries details.
func Internal() *Error {
	return newError(http.StatusInternalServerError, "internal_error", "Terjadi kesalahan pada server.")
}

// fromDomain maps an apperr kind to its HTTP error. A non-empty domain
// message overrides the default for kinds that carry one. ok is false for
// errors that are not domain errors.
func fromDomain(err error) (e *Error, ok bool) {
	var de *apperr.Error
	var msg string
	var fields map[string]string
	var retry time.Duration
	if errors.As(err, &de) {
		msg, fields, retry = de.Message, de.Fields, de.RetryAfter
	}
	withMsg := func(e *Error) *Error {
		if msg != "" {
			e.Message = msg
		}
		return e
	}
	switch {
	case errors.Is(err, apperr.ErrBadRequest):
		return BadRequest(msg), true
	case errors.Is(err, apperr.ErrUnauthenticated):
		return withMsg(Unauthenticated()), true
	case errors.Is(err, apperr.ErrTokenExpired):
		return withMsg(TokenExpired()), true
	case errors.Is(err, apperr.ErrInvalidCredentials):
		return withMsg(InvalidCredentials()), true
	case errors.Is(err, apperr.ErrForbidden):
		return withMsg(Forbidden()), true
	case errors.Is(err, apperr.ErrCSRF):
		return withMsg(CSRFFailed()), true
	case errors.Is(err, apperr.ErrNotFound):
		return withMsg(NotFound()), true
	case errors.Is(err, apperr.ErrConflict):
		return Conflict(msg), true
	case errors.Is(err, apperr.ErrValidation):
		return withMsg(Validation(fields)), true
	case errors.Is(err, apperr.ErrRateLimited):
		return withMsg(RateLimited(retry)), true
	case errors.Is(err, apperr.ErrUnsupportedMedia):
		return withMsg(UnsupportedMediaType()), true
	case errors.Is(err, apperr.ErrPayloadTooLarge):
		return withMsg(PayloadTooLarge()), true
	}
	return nil, false
}

// WriteError maps err to an API error response. *Error is rendered as-is,
// apperr domain errors are mapped to their HTTP status/code,
// validator.ValidationErrors become 422 with a field map, and anything else is
// logged and rendered as a generic 500. Error responses always carry
// Cache-Control: no-store.
func WriteError(w http.ResponseWriter, r *http.Request, err error) {
	var apiErr *Error
	var verrs validator.ValidationErrors
	domainErr, isDomain := fromDomain(err)
	switch {
	case errors.As(err, &apiErr):
	case isDomain:
		apiErr = domainErr
	case errors.As(err, &verrs):
		apiErr = Validation(validationFields(verrs))
	default:
		slog.Error("unhandled error",
			"request_id", middleware.GetReqID(r.Context()),
			"method", r.Method,
			"path", r.URL.Path,
			"error", err,
		)
		apiErr = Internal()
	}
	// Errors are never cacheable, even under the public CacheControl middleware.
	NoStore(w)
	if apiErr.RetryAfter > 0 {
		secs := int(apiErr.RetryAfter.Round(time.Second) / time.Second)
		if secs < 1 {
			secs = 1
		}
		w.Header().Set("Retry-After", strconv.Itoa(secs))
	}
	JSON(w, apiErr.Status, errorEnvelope{Error: errorBody{
		Code:    apiErr.Code,
		Message: apiErr.Message,
		Fields:  apiErr.Fields,
	}})
}
