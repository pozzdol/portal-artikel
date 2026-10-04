package role

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
)

// Handler serves the role and permission-catalog endpoints.
type Handler struct {
	svc *Service
}

// NewHandler returns a role Handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register mounts the routes on r (r is the /api/v1/admin sub-router).
// GET/POST /roles, GET/PUT/DELETE /roles/{id} and GET /permissions all
// require the roles.manage permission.
func (h *Handler) Register(r chi.Router, guard rbac.Guard) {
	r.With(guard(rbac.PermRolesManage)).Get("/roles", h.list)
	r.With(guard(rbac.PermRolesManage)).Post("/roles", h.create)
	r.With(guard(rbac.PermRolesManage)).Get("/roles/{id}", h.get)
	r.With(guard(rbac.PermRolesManage)).Put("/roles/{id}", h.update)
	r.With(guard(rbac.PermRolesManage)).Delete("/roles/{id}", h.delete)
	r.With(guard(rbac.PermRolesManage)).Get("/permissions", h.listPermissions)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	roles, err := h.svc.List(r.Context())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, roles)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	role, err := h.svc.Get(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, role)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in CreateInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	role, err := h.svc.Create(r.Context(), audit.RequestMeta(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusCreated, role)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	var in UpdateInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	role, err := h.svc.Update(r.Context(), audit.RequestMeta(r), id, in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, role)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := h.svc.Delete(r.Context(), audit.RequestMeta(r), id); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.NoContent(w)
}

func (h *Handler) listPermissions(w http.ResponseWriter, r *http.Request) {
	perms, err := h.svc.ListPermissions(r.Context())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, perms)
}

// parseID reads the {id} path param; an unparsable id is reported as 404
// rather than 400, matching the pgtype.UUID convention used elsewhere.
func parseID(r *http.Request) (int64, error) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		return 0, apperr.NotFound()
	}
	return id, nil
}
