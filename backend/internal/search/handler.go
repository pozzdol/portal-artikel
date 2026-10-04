package search

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/httpx"
)

// FallbackHeader is set to "true" when the results come from the fuzzy
// (typo-tolerant) title search instead of full-text search.
const FallbackHeader = "X-Search-Fallback"

// Handler serves GET /search.
type Handler struct {
	svc *Service
}

// NewHandler returns a Handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// RegisterPublic mounts GET /search on r (the /api/v1/public sub-router).
func (h *Handler) RegisterPublic(r chi.Router) {
	r.Get("/search", h.search)
}

// search: ?q=&page=&per_page= → {data: Hit[], meta}. Results depend on the
// free-form query, so the response is not cached.
func (h *Handler) search(w http.ResponseWriter, r *http.Request) {
	httpx.NoStore(w)
	page := httpx.ParsePagination(r, 12, 50)
	res, err := h.svc.Search(r.Context(), r.URL.Query().Get("q"), page)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if res.Fallback {
		w.Header().Set(FallbackHeader, "true")
	}
	httpx.List(w, res.Items, page.Meta(res.Total))
}
