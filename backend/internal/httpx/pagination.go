package httpx

import (
	"net/http"
	"slices"
	"strconv"
	"strings"
)

// Meta is the pagination block of a list response.
type Meta struct {
	Page       int   `json:"page"`
	PerPage    int   `json:"per_page"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

// Pagination is the parsed page/per_page query.
type Pagination struct {
	Page    int
	PerPage int
	Offset  int
}

// Meta builds the response meta for the given total row count.
func (p Pagination) Meta(total int64) Meta {
	pages := 0
	if p.PerPage > 0 {
		pages = int((total + int64(p.PerPage) - 1) / int64(p.PerPage))
	}
	return Meta{Page: p.Page, PerPage: p.PerPage, Total: total, TotalPages: pages}
}

// ParsePagination reads ?page and ?per_page. Invalid or missing values fall
// back to page 1 / defaultPerPage; per_page is clamped to [1, maxPerPage].
func ParsePagination(r *http.Request, defaultPerPage, maxPerPage int) Pagination {
	q := r.URL.Query()
	page := atoiOr(q.Get("page"), 1)
	if page < 1 {
		page = 1
	}
	per := atoiOr(q.Get("per_page"), defaultPerPage)
	if per < 1 {
		per = defaultPerPage
	}
	if maxPerPage > 0 && per > maxPerPage {
		per = maxPerPage
	}
	return Pagination{Page: page, PerPage: per, Offset: (page - 1) * per}
}

// SortParam parses ?sort=col or ?sort=-col (desc). ok is false when sort is
// absent or not in the whitelist.
func SortParam(r *http.Request, whitelist []string) (col string, desc bool, ok bool) {
	s := strings.TrimSpace(r.URL.Query().Get("sort"))
	if s == "" {
		return "", false, false
	}
	if strings.HasPrefix(s, "-") {
		desc = true
		s = s[1:]
	}
	if !slices.Contains(whitelist, s) {
		return "", false, false
	}
	return s, desc, true
}

func atoiOr(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}
