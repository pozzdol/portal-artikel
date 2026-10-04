// Package middleware holds the HTTP middlewares for authentication and CSRF
// protection.
package middleware

import (
	"errors"
	"net/http"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/auth"
	"portal-berita/backend/internal/httpx"
)

// Authenticate verifies the access_token cookie and stores the principal in
// the request context. A missing or invalid token yields 401 unauthenticated;
// an expired token yields 401 token_expired.
func Authenticate(v auth.TokenVerifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c, err := r.Cookie(auth.CookieAccess)
			if err != nil || c.Value == "" {
				httpx.WriteError(w, r, apperr.Unauthenticated(""))
				return
			}
			p, err := v.Verify(c.Value)
			if err != nil {
				if errors.Is(err, auth.ErrTokenExpired) {
					httpx.WriteError(w, r, apperr.TokenExpired())
					return
				}
				httpx.WriteError(w, r, apperr.Unauthenticated(""))
				return
			}
			next.ServeHTTP(w, r.WithContext(auth.WithPrincipal(r.Context(), p)))
		})
	}
}
