package middleware

import (
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRealIP(t *testing.T) {
	withTen := append([]netip.Prefix{netip.MustParsePrefix("10.0.0.0/8")}, DefaultTrustedProxies...)
	cases := []struct {
		name    string
		trusted []netip.Prefix
		remote  string
		xff     []string
		realIP  string
		want    string
	}{
		{name: "untrusted peer ignores headers", trusted: DefaultTrustedProxies,
			remote: "198.51.100.7:5555", xff: []string{"1.1.1.1"}, realIP: "2.2.2.2", want: "198.51.100.7"},
		{name: "trusted peer single xff", trusted: DefaultTrustedProxies,
			remote: "127.0.0.1:40000", xff: []string{"203.0.113.9"}, want: "203.0.113.9"},
		{name: "rightmost untrusted wins", trusted: withTen,
			remote: "127.0.0.1:40000", xff: []string{"1.1.1.1, 10.0.0.5"}, want: "1.1.1.1"},
		{name: "spoofed left entry is ignored", trusted: DefaultTrustedProxies,
			remote: "127.0.0.1:40000", xff: []string{"6.6.6.6, 203.0.113.9"}, want: "203.0.113.9"},
		{name: "multiple xff headers are joined", trusted: withTen,
			remote: "127.0.0.1:1", xff: []string{"6.6.6.6", "203.0.113.9, 10.1.1.1"}, want: "203.0.113.9"},
		{name: "all trusted falls back to x-real-ip", trusted: withTen,
			remote: "127.0.0.1:1", xff: []string{"10.0.0.2, 127.0.0.1"}, realIP: "192.0.2.4", want: "192.0.2.4"},
		{name: "all trusted without x-real-ip keeps peer", trusted: withTen,
			remote: "127.0.0.1:1", xff: []string{"10.0.0.2"}, want: "127.0.0.1"},
		{name: "garbage headers keep peer", trusted: DefaultTrustedProxies,
			remote: "127.0.0.1:1", xff: []string{"not-an-ip, , <script>"}, realIP: "nope", want: "127.0.0.1"},
		{name: "garbage entry skipped", trusted: DefaultTrustedProxies,
			remote: "127.0.0.1:1", xff: []string{"203.0.113.9, junk"}, want: "203.0.113.9"},
		{name: "ipv6 peer and client", trusted: DefaultTrustedProxies,
			remote: "[::1]:8080", xff: []string{"2001:db8::1"}, want: "2001:db8::1"},
		{name: "ipv6 bracketed with port in xff", trusted: DefaultTrustedProxies,
			remote: "[::1]:8080", xff: []string{"[2001:db8::2]:443"}, want: "2001:db8::2"},
		{name: "ipv4-mapped peer is unmapped", trusted: DefaultTrustedProxies,
			remote: "[::ffff:127.0.0.1]:1", xff: []string{"203.0.113.9"}, want: "203.0.113.9"},
		{name: "empty trust list trusts nobody", trusted: nil,
			remote: "127.0.0.1:1", xff: []string{"203.0.113.9"}, want: "127.0.0.1"},
		{name: "no headers strips port", trusted: DefaultTrustedProxies,
			remote: "198.51.100.7:5555", want: "198.51.100.7"},
		{name: "unparsable remote untouched", trusted: DefaultTrustedProxies,
			remote: "pipe", xff: []string{"203.0.113.9"}, want: "pipe"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var got string
			h := RealIP(c.trusted)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
				got = r.RemoteAddr
			}))
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.RemoteAddr = c.remote
			for _, v := range c.xff {
				req.Header.Add("X-Forwarded-For", v)
			}
			if c.realIP != "" {
				req.Header.Set("X-Real-IP", c.realIP)
			}
			h.ServeHTTP(httptest.NewRecorder(), req)
			assert.Equal(t, c.want, got)
		})
	}
}
