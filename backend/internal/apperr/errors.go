// Package apperr defines transport-agnostic domain errors. Services return
// these; internal/httpx maps them to HTTP responses.
package apperr

import (
	"errors"
	"time"
)

// Sentinel kinds. Match with errors.Is.
var (
	ErrBadRequest         = errors.New("bad request")
	ErrUnauthenticated    = errors.New("unauthenticated")
	ErrTokenExpired       = errors.New("token expired")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrForbidden          = errors.New("forbidden")
	ErrCSRF               = errors.New("csrf failed")
	ErrNotFound           = errors.New("not found")
	ErrConflict           = errors.New("conflict")
	ErrValidation         = errors.New("validation failed")
	ErrRateLimited        = errors.New("rate limited")
	ErrUnsupportedMedia   = errors.New("unsupported media type")
	ErrPayloadTooLarge    = errors.New("payload too large")
)

// Error is a domain error with an optional user-facing (Indonesian) message,
// field errors (validation) and a retry hint (rate limiting).
type Error struct {
	Kind       error
	Message    string
	Fields     map[string]string
	RetryAfter time.Duration
}

func (e *Error) Error() string {
	if e.Message == "" {
		return e.Kind.Error()
	}
	return e.Kind.Error() + ": " + e.Message
}

// Unwrap returns Kind so errors.Is(err, apperr.ErrX) works.
func (e *Error) Unwrap() error { return e.Kind }

// BadRequest: malformed input (400). Empty msg uses the HTTP default.
func BadRequest(msg string) *Error { return &Error{Kind: ErrBadRequest, Message: msg} }

// Unauthenticated: no/invalid session (401). Empty msg uses the HTTP default.
func Unauthenticated(msg string) *Error { return &Error{Kind: ErrUnauthenticated, Message: msg} }

// TokenExpired: access token expired or stale; client should refresh (401).
func TokenExpired() *Error { return &Error{Kind: ErrTokenExpired} }

// InvalidCredentials: wrong email/password at login (401).
func InvalidCredentials() *Error { return &Error{Kind: ErrInvalidCredentials} }

// Forbidden: missing permission or disallowed action (403). Empty msg uses the HTTP default.
func Forbidden(msg string) *Error { return &Error{Kind: ErrForbidden, Message: msg} }

// CSRF: CSRF token missing or mismatched (403).
func CSRF() *Error { return &Error{Kind: ErrCSRF} }

// NotFound: resource does not exist (404).
func NotFound() *Error { return &Error{Kind: ErrNotFound} }

// Conflict: business-rule or uniqueness conflict (409). Empty msg uses the HTTP default.
func Conflict(msg string) *Error { return &Error{Kind: ErrConflict, Message: msg} }

// Validation: field-level errors (422).
func Validation(fields map[string]string) *Error {
	return &Error{Kind: ErrValidation, Fields: fields}
}

// RateLimited: too many attempts (429) with a Retry-After hint.
func RateLimited(retryAfter time.Duration) *Error {
	return &Error{Kind: ErrRateLimited, RetryAfter: retryAfter}
}

// UnsupportedMedia: rejected file/content type (415). Empty msg uses the HTTP default.
func UnsupportedMedia(msg string) *Error { return &Error{Kind: ErrUnsupportedMedia, Message: msg} }

// PayloadTooLarge: request body or upload exceeds the limit (413).
func PayloadTooLarge() *Error { return &Error{Kind: ErrPayloadTooLarge} }
