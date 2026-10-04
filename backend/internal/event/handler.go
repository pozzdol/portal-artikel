package event

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
)

// Handler serves the admin and public event (agenda) endpoints.
type Handler struct {
	svc *Service
}

// NewHandler returns an event Handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register mounts the admin routes on r (the /api/v1/admin sub-router), all
// requiring events.manage.
func (h *Handler) Register(r chi.Router, guard rbac.Guard) {
	r.With(guard(rbac.PermEventsManage)).Get("/events", h.list)
	r.With(guard(rbac.PermEventsManage)).Post("/events", h.create)
	r.With(guard(rbac.PermEventsManage)).Get("/events/{id}", h.get)
	r.With(guard(rbac.PermEventsManage)).Put("/events/{id}", h.update)
	r.With(guard(rbac.PermEventsManage)).Delete("/events/{id}", h.delete)
}

// RegisterPublic mounts GET /events and GET /events/{slug} on r (the
// /api/v1/public sub-router).
func (h *Handler) RegisterPublic(r chi.Router) {
	r.Get("/events", h.listPublic)
	r.Get("/events/{slug}", h.getPublic)
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

func (h *Handler) listPublic(w http.ResponseWriter, r *http.Request) {
	page := httpx.ParsePagination(r, 12, 50)
	when := httpx.QueryString(r, "when")
	var monthFrom, monthTo *time.Time
	if month := httpx.QueryString(r, "month"); month != "" {
		from, err := time.ParseInLocation("2006-01", month, httpx.Jakarta)
		if err != nil {
			httpx.WriteError(w, r, apperr.BadRequest("Parameter month harus berformat YYYY-MM."))
			return
		}
		to := from.AddDate(0, 1, 0)
		monthFrom, monthTo = &from, &to
	}
	items, total, err := h.svc.ListPublic(r.Context(), PublicFilter{
		When: when, MonthFrom: monthFrom, MonthTo: monthTo, Page: page,
	})
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
