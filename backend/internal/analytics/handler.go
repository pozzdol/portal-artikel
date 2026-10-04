package analytics

import (
	"log/slog"
	"net"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/ratelimit"
)

// Query parameter bounds for the ranking endpoints.
const (
	defaultLimit = 5
	maxLimit     = 10
	defaultDays  = 30
	maxDays      = 365
)

// Handler serves the public view beacon and ranking endpoints.
type Handler struct {
	svc     *Service
	limiter *ratelimit.FixedWindow
}

// NewHandler returns a Handler. limiter bounds the view beacon per client IP
// (production: ratelimit.New(60, time.Minute)); nil disables limiting.
func NewHandler(svc *Service, limiter *ratelimit.FixedWindow) *Handler {
	return &Handler{svc: svc, limiter: limiter}
}

// RegisterPublic mounts the routes on r (the /api/v1/public sub-router):
// POST /articles/{id}/view, GET /articles/trending, GET /articles/popular.
func (h *Handler) RegisterPublic(r chi.Router) {
	r.Post("/articles/{id}/view", h.view)
	r.Get("/articles/trending", h.trending)
	r.Get("/articles/popular", h.popular)
}

// view always answers 204 (also for bots, duplicates and unknown articles)
// except 429 when the per-IP limit is exceeded.
func (h *Handler) view(w http.ResponseWriter, r *http.Request) {
	httpx.NoStore(w)
	ip := clientIP(r)
	if h.limiter != nil {
		if ok, retry := h.limiter.Allow(ip); !ok {
			httpx.WriteError(w, r, apperr.RateLimited(retry))
			return
		}
	}
	id, ok := httpx.PathInt64(r, "id")
	if !ok {
		httpx.NoContent(w)
		return
	}
	if _, err := h.svc.RecordView(r.Context(), id, ip, r.UserAgent()); err != nil {
		// The beacon is fire-and-forget: log and still answer 204.
		slog.ErrorContext(r.Context(), "analytics: record view", "article_id", id, "error", err)
	}
	httpx.NoContent(w)
}

func (h *Handler) trending(w http.ResponseWriter, r *http.Request) {
	window := httpx.QueryString(r, "window")
	switch window {
	case "":
		window = WindowDay
	case WindowDay, WindowWeek:
	default:
		httpx.WriteError(w, r, apperr.BadRequest("Parameter window harus day atau week."))
		return
	}
	limit, err := boundedInt(r, "limit", defaultLimit, maxLimit)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	cards, err := h.svc.Trending(r.Context(), window, limit)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, cards)
}

func (h *Handler) popular(w http.ResponseWriter, r *http.Request) {
	days, err := boundedInt(r, "days", defaultDays, maxDays)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	limit, err := boundedInt(r, "limit", defaultLimit, maxLimit)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	cards, err := h.svc.Popular(r.Context(), days, limit)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, cards)
}

// boundedInt parses an integer query param clamped to [1, max].
func boundedInt(r *http.Request, name string, def, max int) (int, error) {
	n, err := httpx.QueryInt(r, name, def)
	if err != nil {
		return 0, err
	}
	if n < 1 {
		n = 1
	}
	if n > max {
		n = max
	}
	return n, nil
}

// clientIP returns the host part of r.RemoteAddr (resolved upstream by
// middleware.RealIP from trusted proxies only). It is only hashed and used as
// a rate-limit key, never stored.
func clientIP(r *http.Request) string {
	host := strings.TrimSpace(r.RemoteAddr)
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	return strings.TrimSuffix(strings.TrimPrefix(host, "["), "]")
}
