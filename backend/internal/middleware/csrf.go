package middleware

import (
	"crypto/subtle"
	"net/http"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/auth"
	"portal-berita/backend/internal/httpx"
)

// CSRF enforces the double-submit cookie pattern for unsafe methods: the
// X-CSRF-Token header must be non-empty and equal to the csrf_token cookie.
// GET, HEAD and OPTIONS pass through. Failures yield 403 csrf_failed.
func CSRF(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			next.ServeHTTP(w, r)
			return
		}
		header := r.Header.Get(auth.HeaderCSRF)
		c, err := r.Cookie(auth.CookieCSRF)
		if header == "" || err != nil || c.Value == "" ||
			subtle.ConstantTimeCompare([]byte(header), []byte(c.Value)) != 1 {
			httpx.WriteError(w, r, apperr.CSRF())
			return
		}
		next.ServeHTTP(w, r)
	})
}
