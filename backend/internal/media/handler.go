package media

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
)

// multipartOverhead bounds the extra bytes (boundaries, other fields) allowed
// on top of the file itself when reading a multipart upload.
const multipartOverhead = 1 << 20 // 1 MiB

// maxListByIDs bounds how many ids GET /media?ids=… may request at once.
const maxListByIDs = 100

// Handler serves the media library endpoints.
type Handler struct {
	svc *Service
}

// NewHandler returns a media Handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register mounts the admin media routes (r = /api/v1/admin sub-router),
// all guarded by media.manage.
func (h *Handler) Register(r chi.Router, guard rbac.Guard) {
	r.With(guard(rbac.PermMediaManage)).Get("/media", h.list)
	r.With(guard(rbac.PermMediaManage)).Post("/media", h.upload)
	r.With(guard(rbac.PermMediaManage)).Get("/media/{id}", h.get)
	r.With(guard(rbac.PermMediaManage)).Put("/media/{id}", h.update)
	r.With(guard(rbac.PermMediaManage)).Delete("/media/{id}", h.delete)
}

// list serves GET /media. With an `ids` query param it instead resolves that
// specific set of ids (for the admin media picker) and returns a plain
// {"data": [...]} array, skipping unknown ids and preserving request order;
// without it, it is the paged/filterable library listing.
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	if raw := httpx.QueryString(r, "ids"); raw != "" {
		h.listByIDs(w, r, raw)
		return
	}
	mimePrefix := httpx.QueryString(r, "type")
	if mimePrefix == "image" {
		mimePrefix = "image/"
	}
	page := httpx.ParsePagination(r, 20, 100)
	items, total, err := h.svc.List(r.Context(), ListFilter{
		Q: httpx.QueryString(r, "q"), MimePrefix: mimePrefix, Page: page,
	})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.List(w, items, page.Meta(total))
}

func (h *Handler) listByIDs(w http.ResponseWriter, r *http.Request, raw string) {
	ids, err := parseIDs(raw)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items, err := h.svc.ListByIDs(r.Context(), ids)
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

// parseIDs parses the comma-separated `ids` query value into positive int64
// ids, rejecting empty entries, non-numeric entries and lists longer than
// maxListByIDs.
func parseIDs(raw string) ([]int64, error) {
	parts := strings.Split(raw, ",")
	if len(parts) > maxListByIDs {
		return nil, apperr.BadRequest(fmt.Sprintf("Parameter ids maksimal %d nilai.", maxListByIDs))
	}
	ids := make([]int64, 0, len(parts))
	for _, p := range parts {
		id, err := strconv.ParseInt(strings.TrimSpace(p), 10, 64)
		if err != nil || id <= 0 {
			return nil, apperr.BadRequest("Parameter ids harus berupa daftar ID angka dipisah koma.")
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func (h *Handler) upload(w http.ResponseWriter, r *http.Request) {
	limit := h.svc.MaxUploadBytes() + multipartOverhead
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		httpx.WriteError(w, r, multipartError(err))
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		httpx.WriteError(w, r, apperr.BadRequest(`Berkas wajib diunggah pada field "file".`))
		return
	}
	defer file.Close()

	item, err := h.svc.Upload(r.Context(), audit.RequestMeta(r), UploadInput{
		Reader:   file,
		Filename: header.Filename,
		AltText:  formValuePtr(r, "alt_text"),
		Caption:  formValuePtr(r, "caption"),
	})
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
	var in UpdateMetaInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	item, err := h.svc.UpdateMeta(r.Context(), audit.RequestMeta(r), id, in)
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

// formValuePtr returns a trimmed multipart form value, or nil when absent/empty.
func formValuePtr(r *http.Request, name string) *string {
	v := strings.TrimSpace(r.FormValue(name))
	if v == "" {
		return nil
	}
	return &v
}

// multipartError maps a ParseMultipartForm failure to a domain error: the
// body-size guard (http.MaxBytesReader) surfaces as 413, anything else as a
// generic 400.
func multipartError(err error) error {
	var maxErr *http.MaxBytesError
	if errors.As(err, &maxErr) {
		return apperr.PayloadTooLarge()
	}
	return apperr.BadRequest("Formulir unggah tidak valid.")
}
