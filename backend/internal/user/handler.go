package user

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
)

// Handler exposes the users & authors HTTP endpoints (docs/05-api.md §4).
type Handler struct {
	svc *Service
}

// NewHandler returns a Handler backed by svc.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register mounts the routes on r, which is the /api/v1/admin sub-router.
func (h *Handler) Register(r chi.Router, guard rbac.Guard) {
	r.With(guard(rbac.PermArticlesCreate)).Get("/authors", h.listAuthors)

	r.Group(func(gr chi.Router) {
		gr.Use(guard(rbac.PermUsersManage, rbac.PermAuthorsManage))
		gr.Get("/users", h.list)
		gr.Post("/users", h.create)
		gr.Get("/users/{id}", h.get)
		gr.Put("/users/{id}", h.update)
	})

	r.Group(func(gr chi.Router) {
		gr.Use(guard(rbac.PermUsersManage))
		gr.Post("/users/{id}/reset-password", h.resetPassword)
		gr.Post("/users/{id}/activate", h.activate)
		gr.Post("/users/{id}/deactivate", h.deactivate)
	})
}

// pathID parses the {id} path param; ok is false for a missing/invalid id,
// which callers surface as 404 (never leaking whether an id looks valid).
func pathID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	return id, err == nil && id > 0
}

func (h *Handler) listAuthors(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListAuthors(r.Context())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, items)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	f := ListFilter{
		Q:        strings.TrimSpace(r.URL.Query().Get("q")),
		RoleCode: strings.TrimSpace(r.URL.Query().Get("role_code")),
		Page:     httpx.ParsePagination(r, 20, 100),
	}
	if v := strings.TrimSpace(r.URL.Query().Get("can_login")); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			httpx.WriteError(w, r, httpx.BadRequest("Parameter can_login tidak valid."))
			return
		}
		f.CanLogin = &b
	}
	if v := strings.TrimSpace(r.URL.Query().Get("is_active")); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			httpx.WriteError(w, r, httpx.BadRequest("Parameter is_active tidak valid."))
			return
		}
		f.IsActive = &b
	}
	items, total, err := h.svc.List(r.Context(), ActorFromRequest(r), f)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.List(w, items, f.Page.Meta(total))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.WriteError(w, r, httpx.NotFound())
		return
	}
	detail, err := h.svc.Get(r.Context(), ActorFromRequest(r), id)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, detail)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in CreateInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	detail, err := h.svc.Create(r.Context(), ActorFromRequest(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusCreated, detail)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.WriteError(w, r, httpx.NotFound())
		return
	}
	var in UpdateInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := httpx.Validate(&struct {
		Email *string `json:"email" validate:"omitempty,email,max=254"`
		Phone *string `json:"phone" validate:"omitempty,max=40"`
	}{in.Email.Value, in.Phone.Value}); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	detail, err := h.svc.Update(r.Context(), ActorFromRequest(r), id, in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, detail)
}

func (h *Handler) resetPassword(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.WriteError(w, r, httpx.NotFound())
		return
	}
	var in ResetPasswordInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := h.svc.ResetPassword(r.Context(), ActorFromRequest(r), id, in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.NoContent(w)
}

func (h *Handler) activate(w http.ResponseWriter, r *http.Request) {
	h.setActive(w, r, true)
}

func (h *Handler) deactivate(w http.ResponseWriter, r *http.Request) {
	h.setActive(w, r, false)
}

func (h *Handler) setActive(w http.ResponseWriter, r *http.Request, active bool) {
	id, ok := pathID(r)
	if !ok {
		httpx.WriteError(w, r, httpx.NotFound())
		return
	}
	if err := h.svc.SetActive(r.Context(), ActorFromRequest(r), id, active); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.NoContent(w)
}
