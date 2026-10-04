package audit

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/authctx"
)

func TestRequestMeta(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "203.0.113.7:54321"
	r.Header.Set("User-Agent", "Mozilla/5.0")
	m := RequestMeta(r)
	assert.Nil(t, m.UserID)
	require.NotNil(t, m.IP)
	assert.Equal(t, "203.0.113.7", m.IP.String())
	assert.Equal(t, "Mozilla/5.0", m.UserAgent)

	r = r.WithContext(authctx.WithPrincipal(r.Context(), authctx.Principal{UserID: 42}))
	m = RequestMeta(r)
	require.NotNil(t, m.UserID)
	assert.EqualValues(t, 42, *m.UserID)
}

func TestRequestMetaIPForms(t *testing.T) {
	cases := map[string]string{
		"198.51.100.1":         "198.51.100.1", // chi RealIP sets RemoteAddr without port
		"[2001:db8::1]:443":    "2001:db8::1",
		"2001:db8::2":          "2001:db8::2",
		"[::ffff:10.0.0.1]:80": "10.0.0.1",
	}
	for in, want := range cases {
		r := httptest.NewRequest("GET", "/", nil)
		r.RemoteAddr = in
		m := RequestMeta(r)
		require.NotNil(t, m.IP, in)
		assert.Equal(t, want, m.IP.String(), in)
	}
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "not-an-ip"
	assert.Nil(t, RequestMeta(r).IP)
}

func TestRequestMetaTruncatesUA(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("User-Agent", strings.Repeat("a", 511)+"é")
	ua := RequestMeta(r).UserAgent
	assert.LessOrEqual(t, len(ua), 512)
	assert.Equal(t, strings.Repeat("a", 511), ua)
}
