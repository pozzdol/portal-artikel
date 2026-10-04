package auth

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/httpx"
)

// Handler serves /api/v1/auth/*.
type Handler struct {
	svc     *Service
	cookies CookieConfig
	authn   func(http.Handler) http.Handler
	csrf    func(http.Handler) http.Handler
}

// NewHandler returns the auth HTTP handler. authn verifies the access token
// and injects the principal; csrf enforces the double-submit token.
func NewHandler(svc *Service, cookies CookieConfig, authn, csrf func(http.Handler) http.Handler) *Handler {
	return &Handler{svc: svc, cookies: cookies, authn: authn, csrf: csrf}
}

// Register mounts the routes on r, which must be the /api/v1/auth sub-router
// (the refresh cookie is scoped to that path).
func (h *Handler) Register(r chi.Router) {
	r.Post("/login", h.login)
	r.Post("/refresh", h.refresh)
	r.With(h.csrf).Post("/logout", h.logout)
	r.With(h.authn).Get("/me", h.me)
	r.With(h.authn, h.csrf).Put("/me", h.updateMe)
	r.With(h.authn, h.csrf).Put("/me/password", h.changePassword)
	r.With(h.authn).Get("/sessions", h.listSessions)
	r.With(h.authn, h.csrf).Delete("/sessions/{family_id}", h.revokeSession)
}

func client(r *http.Request) Client {
	m := audit.RequestMeta(r)
	return Client{IP: m.IP, UserAgent: m.UserAgent}
}

func refreshCookie(r *http.Request) string {
	c, err := r.Cookie(CookieRefresh)
	if err != nil {
		return ""
	}
	return c.Value
}

func principal(r *http.Request) (Principal, bool) {
	return FromContext(r.Context())
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	// Decode without tags first so the email can be normalized before
	// validation (leading/trailing spaces, upper case).
	var raw struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Remember bool   `json:"remember"`
	}
	if err := httpx.Decode(r, &raw); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	req := loginRequest{Email: normalizeEmail(raw.Email), Password: raw.Password, Remember: raw.Remember}
	if err := httpx.Validate(req); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	sess, err := h.svc.Login(r.Context(), req.Email, req.Password, req.Remember, client(r))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	h.cookies.Set(w, sess)
	httpx.Data(w, http.StatusOK, loginResponse{User: sess.User})
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	sess, err := h.svc.Refresh(r.Context(), refreshCookie(r), client(r))
	if err != nil {
		if errors.Is(err, apperr.ErrUnauthenticated) {
			h.cookies.Clear(w)
		}
		httpx.WriteError(w, r, err)
		return
	}
	h.cookies.Set(w, sess)
	httpx.Data(w, http.StatusOK, loginResponse{User: sess.User})
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Logout(r.Context(), refreshCookie(r), client(r)); err != nil {
		slog.ErrorContext(r.Context(), "auth: logout failed", "error", err)
	}
	h.cookies.Clear(w)
	httpx.NoContent(w)
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	p, ok := principal(r)
	if !ok {
		httpx.WriteError(w, r, apperr.Unauthenticated(""))
		return
	}
	me, err := h.svc.Me(r.Context(), p.UserID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, me)
}

func (h *Handler) updateMe(w http.ResponseWriter, r *http.Request) {
	p, ok := principal(r)
	if !ok {
		httpx.WriteError(w, r, apperr.Unauthenticated(""))
		return
	}
	var in UpdateMeInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	me, err := h.svc.UpdateMe(r.Context(), p.UserID, in, client(r))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, me)
}

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	p, ok := principal(r)
	if !ok {
		httpx.WriteError(w, r, apperr.Unauthenticated(""))
		return
	}
	var in changePasswordRequest
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := h.svc.ChangePassword(r.Context(), p, in.CurrentPassword, in.NewPassword, client(r)); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.NoContent(w)
}

func (h *Handler) listSessions(w http.ResponseWriter, r *http.Request) {
	p, ok := principal(r)
	if !ok {
		httpx.WriteError(w, r, apperr.Unauthenticated(""))
		return
	}
	sessions, err := h.svc.ListSessions(r.Context(), p)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Data(w, http.StatusOK, sessions)
}

func (h *Handler) revokeSession(w http.ResponseWriter, r *http.Request) {
	p, ok := principal(r)
	if !ok {
		httpx.WriteError(w, r, apperr.Unauthenticated(""))
		return
	}
	current, err := h.svc.RevokeSession(r.Context(), p, chi.URLParam(r, "family_id"), client(r))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if current {
		h.cookies.Clear(w)
	}
	httpx.NoContent(w)
}
