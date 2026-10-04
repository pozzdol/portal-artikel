package httpx

import (
	"net/http"
	"strconv"
)

// CacheControl sets "Cache-Control: public, max-age=N" before calling next.
// Handlers may override it (e.g. NoStore for previews); WriteError always
// switches error responses to no-store.
func CacheControl(maxAge int) func(http.Handler) http.Handler {
	value := "public, max-age=" + strconv.Itoa(maxAge)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", value)
			next.ServeHTTP(w, r)
		})
	}
}

// NoStore marks the response as uncacheable. Call before writing the body.
func NoStore(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-store")
}
