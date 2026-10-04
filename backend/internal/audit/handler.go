package audit

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
)

// Handler serves GET /admin/audit-logs.
type Handler struct {
	svc *ListService
}

// NewHandler returns an audit-log Handler.
func NewHandler(svc *ListService) *Handler { return &Handler{svc: svc} }

// Register mounts the route on r (r is the /api/v1/admin sub-router),
// guarded by audit.view.
func (h *Handler) Register(r chi.Router, guard rbac.Guard) {
	r.With(guard(rbac.PermAuditView)).Get("/audit-logs", h.list)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	f, err := parseFilter(r)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items, total, err := h.svc.List(r.Context(), f)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.List(w, items, f.Page.Meta(total))
}

// parseFilter reads entity_type, action, user_id, from, to, page and
// per_page from the query string. from/to accept RFC3339 or a bare
// YYYY-MM-DD date (interpreted in httpx.Jakarta, "to" made exclusive of the
// next day so a date-only value covers the whole day).
func parseFilter(r *http.Request) (ListFilter, error) {
	q := r.URL.Query()
	f := ListFilter{
		EntityType: q.Get("entity_type"),
		Action:     q.Get("action"),
		Page:       httpx.ParsePagination(r, 20, 100),
	}
	if raw := q.Get("user_id"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return ListFilter{}, apperr.BadRequest("Parameter user_id harus berupa angka.")
		}
		f.UserID = &id
	}
	from, err := parseFilterTime(q.Get("from"), false)
	if err != nil {
		return ListFilter{}, err
	}
	f.From = from
	to, err := parseFilterTime(q.Get("to"), true)
	if err != nil {
		return ListFilter{}, err
	}
	f.To = to
	return f, nil
}

func parseFilterTime(raw string, exclusiveEndOfDay bool) (*time.Time, error) {
	if raw == "" {
		return nil, nil
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return &t, nil
	}
	if d, err := time.ParseInLocation("2006-01-02", raw, httpx.Jakarta); err == nil {
		if exclusiveEndOfDay {
			d = d.AddDate(0, 0, 1)
		}
		return &d, nil
	}
	return nil, apperr.BadRequest("Parameter tanggal harus RFC3339 atau YYYY-MM-DD.")
}
