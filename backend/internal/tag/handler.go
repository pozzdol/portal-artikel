package tag

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
)

// Handler serves the tag endpoints.
type Handler struct {
	svc *Service
}

// NewHandler returns a tag Handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register mounts the admin routes (r = /api/v1/admin sub-router), all
// guarded by tags.manage.
func (h *Handler) Register(r chi.Router, guard rbac.Guard) {
	r.With(guard(rbac.PermTagsManage)).Get("/tags", h.list)
	r.With(guard(rbac.PermTagsManage)).Post("/tags", h.create)
	r.With(guard(rbac.PermTagsManage)).Put("/tags/{id}", h.update)
	r.With(guard(rbac.PermTagsManage)).Delete("/tags/{id}", h.delete)
	r.With(guard(rbac.PermTagsManage)).Post("/tags/{id}/merge", h.merge)
}

// RegisterPublic mounts GET /tags (?popular=true&limit=) and GET
// /tags/{slug} (r = /api/v1/public sub-router).
func (h *Handler) RegisterPublic(r chi.Router) {
	r.Get("/tags", h.publicList)
	r.Get("/tags/{slug}", h.publicGet)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	page := httpx.ParsePagination(r, 20, 100)
	items, total, err := h.svc.List(r.Context(), httpx.QueryString(r, "q"), page)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.List(w, items, page.Meta(total))
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in CreateInput
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
	var in UpdateInput
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

func (h *Handler) merge(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathInt64(r, "id")
	if !ok {
		httpx.WriteError(w, r, apperr.NotFound())
		return
	}
	var in MergeInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	item, err := h.svc.Merge(r.Context(), audit.RequestMeta(r), id, in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, item)
}

func (h *Handler) publicList(w http.ResponseWriter, r *http.Request) {
	popular, err := httpx.QueryBool(r, "popular")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if popular != nil && *popular {
		limit, err := httpx.QueryInt(r, "limit", 10)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		if limit < 1 {
			limit = 1
		}
		if limit > 50 {
			limit = 50
		}
		items, err := h.svc.ListPopular(r.Context(), limit)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		httpx.Data(w, http.StatusOK, items)
		return
	}
	page := httpx.ParsePagination(r, 20, 50)
	items, total, err := h.svc.List(r.Context(), httpx.QueryString(r, "q"), page)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.List(w, items, page.Meta(total))
}

func (h *Handler) publicGet(w http.ResponseWriter, r *http.Request) {
	item, err := h.svc.GetBySlug(r.Context(), chi.URLParam(r, "slug"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, item)
}
