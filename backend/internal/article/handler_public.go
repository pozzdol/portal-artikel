package article

import (
	"net"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/httpx"
)

// RegisterPublic mounts the public routes on r, the /api/v1/public
// sub-router: GET /articles, GET /articles/{slug} (?preview=<token>) and
// GET /authors/{slug}.
//
// GET /articles/trending, GET /articles/popular and POST /articles/{id}/view
// belong to package analytics, not here. chi matches static segments before
// {slug}, but the wiring stage mounts analytics.RegisterPublic first anyway.
func (h *Handler) RegisterPublic(r chi.Router) {
	r.Get("/articles", h.listPublic)
	r.Get("/articles/{slug}", h.getPublic)
	r.Get("/authors/{slug}", h.getAuthor)
}

func (h *Handler) listPublic(w http.ResponseWriter, r *http.Request) {
	featured, err := httpx.QueryBool(r, "featured")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	f := PublicFilter{
		Category: httpx.QueryString(r, "category"),
		Tag:      httpx.QueryString(r, "tag"),
		Author:   httpx.QueryString(r, "author"),
		Featured: featured,
		Page:     httpx.ParsePagination(r, 12, 50),
	}
	items, total, err := h.svc.ListPublic(r.Context(), f)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.List(w, items, f.Page.Meta(total))
}

func (h *Handler) getPublic(w http.ResponseWriter, r *http.Request) {
	preview := httpx.QueryString(r, "preview")
	if preview != "" {
		// A preview URL must never be cached, whatever the outcome.
		httpx.NoStore(w)
		if h.previewLimiter != nil {
			if ok, retry := h.previewLimiter.Allow(clientIP(r)); !ok {
				httpx.WriteError(w, r, apperr.RateLimited(retry))
				return
			}
		}
	}
	d, red, err := h.svc.GetPublic(r.Context(), chi.URLParam(r, "slug"), preview)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if red != nil {
		httpx.Data(w, http.StatusOK, red)
		return
	}
	httpx.Data(w, http.StatusOK, d)
}

func (h *Handler) getAuthor(w http.ResponseWriter, r *http.Request) {
	p, err := h.svc.GetAuthorPublic(r.Context(), chi.URLParam(r, "slug"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, p)
}

// clientIP returns the request's client address without port. RemoteAddr is
// already the real client IP (server's trusted-proxy RealIP middleware).
func clientIP(r *http.Request) string {
	host := strings.TrimSpace(r.RemoteAddr)
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	return strings.TrimSuffix(strings.TrimPrefix(host, "["), "]")
}
