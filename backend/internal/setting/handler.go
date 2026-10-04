package setting

import (
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
)

// Handler serves the admin settings endpoints.
type Handler struct {
	svc *Service
}

// NewHandler returns a setting Handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register mounts the admin routes on r (r is the /api/v1/admin sub-router).
// Every route requires settings.manage.
func (h *Handler) Register(r chi.Router, guard rbac.Guard) {
	r.With(guard(rbac.PermSettingsManage)).Get("/settings", h.list)
	r.With(guard(rbac.PermSettingsManage)).Put("/settings/{key}", h.update)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	settings, err := h.svc.List(r.Context())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, settings)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, httpx.MaxBodyBytes))
	if err != nil {
		httpx.WriteError(w, r, apperr.PayloadTooLarge())
		return
	}
	item, err := h.svc.Update(r.Context(), audit.RequestMeta(r), key, body)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, item)
}
