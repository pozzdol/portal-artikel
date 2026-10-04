package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func cookieMap(rec *httptest.ResponseRecorder) map[string]*http.Cookie {
	out := map[string]*http.Cookie{}
	for _, c := range rec.Result().Cookies() {
		out[c.Name] = c
	}
	return out
}

func TestCookiesSetDev(t *testing.T) {
	rec := httptest.NewRecorder()
	CookieConfig{}.Set(rec, &Session{
		AccessToken: "acc", RefreshToken: "ref", CSRFToken: "csrf",
		RefreshExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	})
	cs := cookieMap(rec)
	require.Len(t, cs, 3)

	a := cs[CookieAccess]
	assert.Equal(t, "acc", a.Value)
	assert.Equal(t, "/", a.Path)
	assert.True(t, a.HttpOnly)
	assert.False(t, a.Secure)
	assert.Equal(t, http.SameSiteLaxMode, a.SameSite)
	assert.Empty(t, a.Domain)
	assert.InDelta(t, 7*24*3600, a.MaxAge, 2)

	r := cs[CookieRefresh]
	assert.Equal(t, "ref", r.Value)
	assert.Equal(t, RefreshCookiePath, r.Path)
	assert.True(t, r.HttpOnly)
	assert.InDelta(t, 7*24*3600, r.MaxAge, 2)

	c := cs[CookieCSRF]
	assert.Equal(t, "csrf", c.Value)
	assert.Equal(t, "/", c.Path)
	assert.False(t, c.HttpOnly)
	assert.Equal(t, http.SameSiteLaxMode, c.SameSite)
}

func TestCookiesSetProd(t *testing.T) {
	rec := httptest.NewRecorder()
	CookieConfig{Secure: true, Domain: "almaidah.example"}.Set(rec, &Session{
		AccessToken: "a", RefreshToken: "r", CSRFToken: "c",
		RefreshExpiresAt: time.Now().Add(30 * 24 * time.Hour),
	})
	for _, c := range cookieMap(rec) {
		assert.True(t, c.Secure, c.Name)
		assert.Equal(t, "almaidah.example", c.Domain, c.Name)
		assert.Equal(t, http.SameSiteLaxMode, c.SameSite, c.Name)
		assert.InDelta(t, 30*24*3600, c.MaxAge, 2, c.Name)
	}
	// Raw header check for the Secure attribute.
	for _, h := range rec.Result().Header.Values("Set-Cookie") {
		assert.Contains(t, h, "Secure")
		assert.Contains(t, h, "SameSite=Lax")
	}
}

func TestCookiesClear(t *testing.T) {
	rec := httptest.NewRecorder()
	CookieConfig{Secure: true}.Clear(rec)
	cs := cookieMap(rec)
	require.Len(t, cs, 3)
	for name, c := range cs {
		assert.Equal(t, -1, c.MaxAge, name)
		assert.Empty(t, c.Value, name)
		assert.True(t, c.Secure, name)
	}
	assert.Equal(t, RefreshCookiePath, cs[CookieRefresh].Path)
	assert.Equal(t, "/", cs[CookieAccess].Path)
	assert.Equal(t, "/", cs[CookieCSRF].Path)
	assert.False(t, cs[CookieCSRF].HttpOnly)
}
