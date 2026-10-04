package sitemap

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/httpx"
)

// Handler serves GET /public/sitemap.
type Handler struct {
	svc *Service
}

// NewHandler returns a sitemap Handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// RegisterPublic mounts the route on r (r is the /api/v1/public sub-router).
func (h *Handler) RegisterPublic(r chi.Router) {
	r.Get("/sitemap", h.list)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	entries, err := h.svc.List(r.Context())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, map[string]any{"entries": entries})
}
