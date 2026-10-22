package middleware

import (
	"crypto/subtle"
	"net"
	"net/http"
	"net/netip"
	"strings"
)

// Headers a frontend on another host uses to hand over the visitor's IP.
// X-Client-IP is believed only when X-Proxy-Secret matches the shared secret.
const (
	ProxySecretHeader = "X-Proxy-Secret"
	ClientIPHeader    = "X-Client-IP"
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
//
// Split hosting (frontend and API on different hosts): when proxySecret is
// non-empty and the request carries a matching X-Proxy-Secret, a valid
// X-Client-IP wins regardless of the peer, because the peer is then the
// frontend platform (or a tunnel), not the visitor. Both headers are removed
// before the request reaches the handlers.
func RealIP(trusted []netip.Prefix, proxySecret string) func(http.Handler) http.Handler {
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
			if a, ok := proxiedClient(r, proxySecret); ok {
				r.RemoteAddr = a.String()
			} else if peer, ok := parseHostIP(r.RemoteAddr); ok {
				r.RemoteAddr = clientAddr(r, peer, isTrusted).String()
			}
			r.Header.Del(ProxySecretHeader)
			r.Header.Del(ClientIPHeader)
			next.ServeHTTP(w, r)
		})
	}
}

// proxiedClient returns X-Client-IP when proxySecret is set and X-Proxy-Secret
// matches it (constant time).
func proxiedClient(r *http.Request, proxySecret string) (netip.Addr, bool) {
	if proxySecret == "" {
		return netip.Addr{}, false
	}
	got := r.Header.Get(ProxySecretHeader)
	if subtle.ConstantTimeCompare([]byte(got), []byte(proxySecret)) != 1 {
		return netip.Addr{}, false
	}
	return parseHostIP(r.Header.Get(ClientIPHeader))
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
