package auth

import (
	"context"
	"errors"

	"portal-berita/backend/internal/authctx"
)

// Cookie, header and token identifiers shared by the auth service, the
// middleware and the router.
const (
	CookieAccess      = "access_token"
	CookieRefresh     = "refresh_token"
	CookieCSRF        = "csrf_token"
	HeaderCSRF        = "X-CSRF-Token"
	RefreshCookiePath = "/api/v1/auth"
	Issuer            = "almaidah"
)

// Principal is the authenticated identity carried by a verified access token.
// It is an alias of authctx.Principal so leaf packages (audit) can read it
// without importing auth.
type Principal = authctx.Principal

// WithPrincipal stores p in ctx.
func WithPrincipal(ctx context.Context, p Principal) context.Context {
	return authctx.WithPrincipal(ctx, p)
}

// FromContext returns the principal stored by WithPrincipal.
func FromContext(ctx context.Context) (Principal, bool) {
	return authctx.FromContext(ctx)
}

// Token verification errors.
var (
	ErrTokenExpired = errors.New("auth: token expired")
	ErrTokenInvalid = errors.New("auth: token invalid")
)

// TokenVerifier verifies an access token. Implementations return
// ErrTokenExpired or ErrTokenInvalid on failure.
type TokenVerifier interface {
	Verify(token string) (Principal, error)
}
