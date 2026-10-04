package snippet

import (
	"net/http"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"

	"github.com/go-chi/chi/v5"
)

// Handler serves the admin and public snippet endpoints.
type Handler struct {
	svc *Service
}

// NewHandler returns a snippet Handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register mounts the admin routes on r (the /api/v1/admin sub-router), all
// requiring snippets.manage. reorder is registered before {id} so it is
// never shadowed.
func (h *Handler) Register(r chi.Router, guard rbac.Guard) {
	r.With(guard(rbac.PermSnippetsManage)).Get("/snippets", h.list)
	r.With(guard(rbac.PermSnippetsManage)).Post("/snippets", h.create)
	r.With(guard(rbac.PermSnippetsManage)).Put("/snippets/reorder", h.reorder)
	r.With(guard(rbac.PermSnippetsManage)).Get("/snippets/{id}", h.get)
	r.With(guard(rbac.PermSnippetsManage)).Put("/snippets/{id}", h.update)
	r.With(guard(rbac.PermSnippetsManage)).Delete("/snippets/{id}", h.delete)
}

// RegisterPublic mounts GET /snippets on r (the /api/v1/public sub-router).
func (h *Handler) RegisterPublic(r chi.Router) {
	r.Get("/snippets", h.listPublic)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.List(r.Context(), httpx.QueryString(r, "type"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, items)
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
	items, err := h.svc.ListPublic(r.Context(), httpx.QueryString(r, "type"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, items)
}
