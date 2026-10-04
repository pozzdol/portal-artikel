package site

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/httpx"
)

// Handler serves GET /public/site.
type Handler struct {
	svc *Service
}

// NewHandler returns a site Handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// RegisterPublic mounts the route on r (r is the /api/v1/public sub-router).
func (h *Handler) RegisterPublic(r chi.Router) {
	r.Get("/site", h.get)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	payload, err := h.svc.Get(r.Context())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, payload)
}
