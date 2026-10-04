package httpx

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/apperr"
)

// PathInt64 parses the chi URL param name as a positive int64.
func PathInt64(r *http.Request, name string) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, name), 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

// QueryString returns the trimmed query parameter (empty when absent).
func QueryString(r *http.Request, name string) string {
	return strings.TrimSpace(r.URL.Query().Get(name))
}

// QueryInt parses an integer query parameter; absent/empty returns def.
// A malformed value returns apperr.BadRequest.
func QueryInt(r *http.Request, name string, def int) (int, error) {
	s := QueryString(r, name)
	if s == "" {
		return def, nil
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0, apperr.BadRequest(fmt.Sprintf("Parameter %s harus berupa angka.", name))
	}
	return n, nil
}

// QueryBool parses a boolean query parameter ("true/false/1/0"); absent/empty
// returns nil. A malformed value returns apperr.BadRequest.
func QueryBool(r *http.Request, name string) (*bool, error) {
	s := QueryString(r, name)
	if s == "" {
		return nil, nil
	}
	b, err := strconv.ParseBool(s)
	if err != nil {
		return nil, apperr.BadRequest(fmt.Sprintf("Parameter %s harus true atau false.", name))
	}
	return &b, nil
}
