package middleware

import (
	"net"
	"net/http"
	"net/netip"
	"strings"
)

// DefaultTrustedProxies is loopback only: Next.js and the Go API run on the
// same host, so the only legitimate forwarder is 127.0.0.1 / ::1.
var DefaultTrustedProxies = []netip.Prefix{
	netip.MustParsePrefix("127.0.0.0/8"),
	netip.MustParsePrefix("::1/128"),
}

// RealIP replaces r.RemoteAddr with the client IP (bare address, no port).
//
// Forwarding headers are consulted only when the direct peer is inside
// trusted; otherwise they are ignored, so a client cannot spoof its address.
// For a trusted peer, X-Forwarded-For is walked from the right, skipping
// trusted addresses, and the first untrusted entry wins (the reverse proxy
// must overwrite or append to X-Forwarded-For, never pass a client value
// through untouched at the right end). If every entry is trusted or
// unparsable, X-Real-IP is used, then the peer itself.
//
// An empty trusted list trusts nobody. A RemoteAddr that cannot be parsed is
// left unchanged.
func RealIP(trusted []netip.Prefix) func(http.Handler) http.Handler {
	isTrusted := func(a netip.Addr) bool {
		for _, p := range trusted {
			if p.Contains(a) {
				return true
			}
		}
		return false
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if peer, ok := parseHostIP(r.RemoteAddr); ok {
				r.RemoteAddr = clientAddr(r, peer, isTrusted).String()
			}
			next.ServeHTTP(w, r)
		})
	}
}

func clientAddr(r *http.Request, peer netip.Addr, isTrusted func(netip.Addr) bool) netip.Addr {
	if !isTrusted(peer) {
		return peer
	}
	var xff []string
	for _, v := range r.Header.Values("X-Forwarded-For") {
		xff = append(xff, strings.Split(v, ",")...)
	}
	for i := len(xff) - 1; i >= 0; i-- {
		a, ok := parseHostIP(xff[i])
		if !ok {
			continue
		}
		if !isTrusted(a) {
			return a
		}
	}
	if a, ok := parseHostIP(r.Header.Get("X-Real-IP")); ok {
		return a
	}
	return peer
}

// parseHostIP parses "ip", "ip:port", "[ipv6]" or "[ipv6]:port". IPv4-mapped
// IPv6 is unmapped and zones are dropped.
func parseHostIP(s string) (netip.Addr, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return netip.Addr{}, false
	}
	if h, _, err := net.SplitHostPort(s); err == nil {
		s = h
	}
	s = strings.TrimSuffix(strings.TrimPrefix(s, "["), "]")
	a, err := netip.ParseAddr(s)
	if err != nil {
		return netip.Addr{}, false
	}
	return a.Unmap().WithZone(""), true
}
