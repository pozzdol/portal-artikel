package auth

import (
	"net/http"
	"time"
)

// CookieConfig holds the attributes shared by all auth cookies.
type CookieConfig struct {
	Secure bool
	Domain string // empty = host-only
}

// Set writes the access, refresh and CSRF cookies of s. All three live for
// the remaining refresh lifetime; the JWT inside the access cookie expires
// sooner on its own.
func (c CookieConfig) Set(w http.ResponseWriter, s *Session) {
	maxAge := int(time.Until(s.RefreshExpiresAt).Round(time.Second) / time.Second)
	if maxAge < 1 {
		maxAge = 1
	}
	http.SetCookie(w, c.cookie(CookieAccess, s.AccessToken, "/", true, maxAge))
	http.SetCookie(w, c.cookie(CookieRefresh, s.RefreshToken, RefreshCookiePath, true, maxAge))
	http.SetCookie(w, c.cookie(CookieCSRF, s.CSRFToken, "/", false, maxAge))
}

// Clear expires all auth cookies.
func (c CookieConfig) Clear(w http.ResponseWriter) {
	http.SetCookie(w, c.cookie(CookieAccess, "", "/", true, -1))
	http.SetCookie(w, c.cookie(CookieRefresh, "", RefreshCookiePath, true, -1))
	http.SetCookie(w, c.cookie(CookieCSRF, "", "/", false, -1))
}

func (c CookieConfig) cookie(name, value, path string, httpOnly bool, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     path,
		Domain:   c.Domain,
		MaxAge:   maxAge,
		Secure:   c.Secure,
		HttpOnly: httpOnly,
		SameSite: http.SameSiteLaxMode,
	}
}
