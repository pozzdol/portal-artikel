package category

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
)

// Handler serves the category tree endpoints.
type Handler struct {
	svc *Service
}

// NewHandler returns a category Handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register mounts the admin routes (r = /api/v1/admin sub-router), all
// guarded by categories.manage. The reorder route is registered before
// {id} so it is never shadowed.
func (h *Handler) Register(r chi.Router, guard rbac.Guard) {
	r.With(guard(rbac.PermCategoriesManage)).Get("/categories", h.list)
	r.With(guard(rbac.PermCategoriesManage)).Post("/categories", h.create)
	r.With(guard(rbac.PermCategoriesManage)).Put("/categories/reorder", h.reorder)
	r.With(guard(rbac.PermCategoriesManage)).Put("/categories/{id}", h.update)
	r.With(guard(rbac.PermCategoriesManage)).Delete("/categories/{id}", h.delete)
}

// RegisterPublic mounts GET /categories and GET /categories/{slug}
// (r = /api/v1/public sub-router).
func (h *Handler) RegisterPublic(r chi.Router) {
	r.Get("/categories", h.publicTree)
	r.Get("/categories/{slug}", h.publicDetail)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	nodes, err := h.svc.ListTree(r.Context(), false)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, nodes)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in CreateInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	node, err := h.svc.Create(r.Context(), audit.RequestMeta(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusCreated, node)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathInt64(r, "id")
	if !ok {
		httpx.WriteError(w, r, apperr.NotFound())
		return
	}
	var in UpdateInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	node, err := h.svc.Update(r.Context(), audit.RequestMeta(r), id, in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, node)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathInt64(r, "id")
	if !ok {
		httpx.WriteError(w, r, apperr.NotFound())
		return
	}
	if err := h.svc.Delete(r.Context(), audit.RequestMeta(r), id); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.NoContent(w)
}

func (h *Handler) reorder(w http.ResponseWriter, r *http.Request) {
	var in ReorderInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	nodes, err := h.svc.Reorder(r.Context(), audit.RequestMeta(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, nodes)
}

func (h *Handler) publicTree(w http.ResponseWriter, r *http.Request) {
	nodes, err := h.svc.ListTree(r.Context(), true)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, nodes)
}

func (h *Handler) publicDetail(w http.ResponseWriter, r *http.Request) {
	detail, err := h.svc.GetBySlugPublic(r.Context(), chi.URLParam(r, "slug"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, detail)
}
