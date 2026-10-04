package alumni

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
)

// Handler serves the admin and public alumni ("Tokoh") endpoints.
type Handler struct {
	svc *Service
}

// NewHandler returns an alumni Handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register mounts the admin routes on r (the /api/v1/admin sub-router), all
// requiring alumni.manage. The reorder route is registered before {id} so it
// is never shadowed.
func (h *Handler) Register(r chi.Router, guard rbac.Guard) {
	r.With(guard(rbac.PermAlumniManage)).Get("/alumni", h.list)
	r.With(guard(rbac.PermAlumniManage)).Post("/alumni", h.create)
	r.With(guard(rbac.PermAlumniManage)).Put("/alumni/reorder", h.reorder)
	r.With(guard(rbac.PermAlumniManage)).Get("/alumni/{id}", h.get)
	r.With(guard(rbac.PermAlumniManage)).Put("/alumni/{id}", h.update)
	r.With(guard(rbac.PermAlumniManage)).Delete("/alumni/{id}", h.delete)
}

// RegisterPublic mounts GET /alumni and GET /alumni/{slug} on r (the
// /api/v1/public sub-router).
func (h *Handler) RegisterPublic(r chi.Router) {
	r.Get("/alumni", h.listPublic)
	r.Get("/alumni/{slug}", h.getPublic)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	page := httpx.ParsePagination(r, 20, 100)
	items, total, err := h.svc.List(r.Context(), ListFilter{
		Q: httpx.QueryString(r, "q"), Status: httpx.QueryString(r, "status"), Page: page,
	})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.List(w, items, page.Meta(total))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathInt64(r, "id")
	if !ok {
		httpx.WriteError(w, r, apperr.NotFound())
		return
	}
	item, err := h.svc.Get(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, item)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in Input
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	item, err := h.svc.Create(r.Context(), audit.RequestMeta(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusCreated, item)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathInt64(r, "id")
	if !ok {
		httpx.WriteError(w, r, apperr.NotFound())
		return
	}
	var in Input
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	item, err := h.svc.Update(r.Context(), audit.RequestMeta(r), id, in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, item)
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
	if err := h.svc.Reorder(r.Context(), audit.RequestMeta(r), in.Items); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.NoContent(w)
}

func (h *Handler) listPublic(w http.ResponseWriter, r *http.Request) {
	page := httpx.ParsePagination(r, 12, 50)
	featured, err := httpx.QueryBool(r, "featured")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items, total, err := h.svc.ListPublic(r.Context(), PublicFilter{Featured: featured, Page: page})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.List(w, items, page.Meta(total))
}

func (h *Handler) getPublic(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	item, err := h.svc.GetPublic(r.Context(), slug)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, item)
}
