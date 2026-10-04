package menu

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
)

// Handler serves the admin menu endpoints.
type Handler struct {
	svc *Service
}

// NewHandler returns a menu Handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register mounts the admin routes on r (r is the /api/v1/admin sub-router).
// Every route requires menus.manage.
func (h *Handler) Register(r chi.Router, guard rbac.Guard) {
	r.With(guard(rbac.PermMenusManage)).Get("/menus", h.listAll)
	r.With(guard(rbac.PermMenusManage)).Get("/menus/{code}", h.get)
	r.With(guard(rbac.PermMenusManage)).Put("/menus/{code}/items", h.replaceItems)
}

func (h *Handler) listAll(w http.ResponseWriter, r *http.Request) {
	menus, err := h.svc.ListAll(r.Context())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, menus)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	m, err := h.svc.GetByCode(r.Context(), code)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, m)
}

func (h *Handler) replaceItems(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	var in ItemsInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	m, err := h.svc.ReplaceItems(r.Context(), audit.RequestMeta(r), code, in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, m)
}
