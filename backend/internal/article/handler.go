package article

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/ratelimit"
	"portal-berita/backend/internal/rbac"
)

// Handler exposes the article HTTP endpoints (docs/05-api.md §2, §4).
type Handler struct {
	svc *Service
	// previewLimiter, when set, bounds GET /public/articles/{slug}?preview=
	// requests per client IP (they bypass every cache).
	previewLimiter *ratelimit.FixedWindow
}

// NewHandler returns a Handler backed by svc.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// WithPreviewLimiter rate-limits preview requests per client IP with l and
// returns h. A nil l disables the limit.
func (h *Handler) WithPreviewLimiter(l *ratelimit.FixedWindow) *Handler {
	h.previewLimiter = l
	return h
}

// Register mounts the admin routes on r, the /api/v1/admin sub-router
// (already behind authentication and CSRF).
func (h *Handler) Register(r chi.Router, guard rbac.Guard) {
	read := guard(rbac.PermArticlesRead)
	r.With(read).Get("/articles", h.list)
	r.With(guard(rbac.PermArticlesCreate)).Post("/articles", h.create)
	// Static segment before {id}: chi prefers it anyway, keep it explicit.
	r.With(read).Get("/articles/slug-check", h.slugCheck)
	r.With(read).Get("/articles/{id}", h.get)
	// Ownership (articles.update_any for someone else's article) is enforced
	// in Service.Update.
	r.With(guard(rbac.PermArticlesUpdate, rbac.PermArticlesUpdateAny)).Put("/articles/{id}", h.update)
	r.With(guard(rbac.PermArticlesDelete)).Delete("/articles/{id}", h.delete)
	r.With(guard(rbac.PermArticlesPublish)).Post("/articles/{id}/publish", h.publish)
	r.With(guard(rbac.PermArticlesPublish)).Post("/articles/{id}/unpublish", h.unpublish)
	r.With(guard(rbac.PermArticlesDelete)).Post("/articles/{id}/restore", h.restore)
	r.With(read).Get("/articles/{id}/preview-token", h.previewToken)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	trashed, err := httpx.QueryBool(r, "trashed")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	f := ListFilter{
		Q:        httpx.QueryString(r, "q"),
		Status:   httpx.QueryString(r, "status"),
		Category: httpx.QueryString(r, "category"),
		Sort:     httpx.QueryString(r, "sort"),
		Page:     httpx.ParsePagination(r, 20, 100),
	}
	if trashed != nil {
		f.Trashed = *trashed
	}
	if v := httpx.QueryString(r, "author"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil || id <= 0 {
			httpx.WriteError(w, r, httpx.BadRequest("Parameter author harus berupa ID penulis."))
			return
		}
		f.AuthorID = id
	}
	items, total, err := h.svc.List(r.Context(), ActorFromRequest(r), f)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.List(w, items, f.Page.Meta(total))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathInt64(r, "id")
	if !ok {
		httpx.WriteError(w, r, httpx.NotFound())
		return
	}
	d, err := h.svc.Get(r.Context(), ActorFromRequest(r), id)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, d)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in Input
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	d, err := h.svc.Create(r.Context(), ActorFromRequest(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusCreated, d)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathInt64(r, "id")
	if !ok {
		httpx.WriteError(w, r, httpx.NotFound())
		return
	}
	var in Input
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	d, err := h.svc.Update(r.Context(), ActorFromRequest(r), id, in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, d)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathInt64(r, "id")
	if !ok {
		httpx.WriteError(w, r, httpx.NotFound())
		return
	}
	if err := h.svc.Delete(r.Context(), ActorFromRequest(r), id); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.NoContent(w)
}

func (h *Handler) restore(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathInt64(r, "id")
	if !ok {
		httpx.WriteError(w, r, httpx.NotFound())
		return
	}
	if err := h.svc.Restore(r.Context(), ActorFromRequest(r), id); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.NoContent(w)
}

// decodeOptional decodes an optional JSON body into v: an empty body leaves
// v untouched; otherwise the body must be one valid JSON object without
// unknown fields.
func decodeOptional(r *http.Request, v any) error {
	body, err := io.ReadAll(http.MaxBytesReader(nil, r.Body, 16<<10))
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return httpx.PayloadTooLarge()
		}
		return httpx.BadRequest("Body tidak dapat dibaca.")
	}
	if len(bytes.TrimSpace(body)) == 0 {
		return nil
	}
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return httpx.BadRequest("Format JSON tidak valid (published_at harus RFC 3339).")
	}
	if dec.More() {
		return httpx.BadRequest("Body JSON harus berisi satu objek.")
	}
	return nil
}

func (h *Handler) publish(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathInt64(r, "id")
	if !ok {
		httpx.WriteError(w, r, httpx.NotFound())
		return
	}
	var in PublishInput
	if err := decodeOptional(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	d, err := h.svc.Publish(r.Context(), ActorFromRequest(r), id, in.PublishedAt)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, d)
}

func (h *Handler) unpublish(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathInt64(r, "id")
	if !ok {
		httpx.WriteError(w, r, httpx.NotFound())
		return
	}
	d, err := h.svc.Unpublish(r.Context(), ActorFromRequest(r), id)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, d)
}

func (h *Handler) slugCheck(w http.ResponseWriter, r *http.Request) {
	slug := httpx.QueryString(r, "slug")
	if slug == "" {
		httpx.WriteError(w, r, httpx.BadRequest("Parameter slug wajib diisi."))
		return
	}
	var exclude int64
	if v := httpx.QueryString(r, "exclude_id"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil || id < 0 {
			httpx.WriteError(w, r, httpx.BadRequest("Parameter exclude_id harus berupa angka."))
			return
		}
		exclude = id
	}
	res, err := h.svc.SlugCheck(r.Context(), slug, exclude)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, res)
}

func (h *Handler) previewToken(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathInt64(r, "id")
	if !ok {
		httpx.WriteError(w, r, httpx.NotFound())
		return
	}
	tok, err := h.svc.PreviewToken(r.Context(), ActorFromRequest(r), id)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.NoStore(w)
	httpx.Data(w, http.StatusOK, tok)
}
