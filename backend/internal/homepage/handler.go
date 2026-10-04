package homepage

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
)

// Handler serves the homepage builder (admin) and GET /public/homepage.
type Handler struct {
	svc *Service
}

// NewHandler returns a homepage Handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register mounts the admin routes on r (the /api/v1/admin sub-router); all
// require homepage.manage.
func (h *Handler) Register(r chi.Router, guard rbac.Guard) {
	g := guard(rbac.PermHomepageManage)
	r.With(g).Get("/homepage/section-types", h.sectionTypes)
	r.With(g).Get("/homepage/sections", h.list)
	r.With(g).Post("/homepage/sections", h.create)
	r.With(g).Put("/homepage/sections/reorder", h.reorder)
	r.With(g).Put("/homepage/sections/{id}", h.update)
	r.With(g).Delete("/homepage/sections/{id}", h.delete)
}

// RegisterPublic mounts GET /homepage on r (the /api/v1/public sub-router).
func (h *Handler) RegisterPublic(r chi.Router) {
	r.Get("/homepage", h.public)
}

func (h *Handler) public(w http.ResponseWriter, r *http.Request) {
	sections, err := h.svc.Resolve(r.Context(), PageKeyHome)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, PublicHomepage{Sections: sections})
}

func (h *Handler) sectionTypes(w http.ResponseWriter, _ *http.Request) {
	httpx.Data(w, http.StatusOK, h.svc.SectionTypes())
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	out, err := h.svc.ListAdmin(r.Context())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, out)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in CreateInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	out, err := h.svc.Create(r.Context(), audit.RequestMeta(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusCreated, out)
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
	out, err := h.svc.Update(r.Context(), audit.RequestMeta(r), id, in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, out)
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
	out, err := h.svc.Reorder(r.Context(), audit.RequestMeta(r), in.IDs)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, out)
}
