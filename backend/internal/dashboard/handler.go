package dashboard

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
)

// Handler serves GET /admin/dashboard.
type Handler struct {
	svc *Service
}

// NewHandler returns a dashboard Handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register mounts the route on r (r is the /api/v1/admin sub-router).
func (h *Handler) Register(r chi.Router, guard rbac.Guard) {
	r.With(guard(rbac.PermDashboardView)).Get("/dashboard", h.get)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	payload, err := h.svc.Get(r.Context())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, payload)
}
