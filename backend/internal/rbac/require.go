package rbac

import (
	"net/http"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/authctx"
	"portal-berita/backend/internal/httpx"
)

// RequirePermission returns a middleware that lets the request through when
// the authenticated principal holds ANY of codes. It responds 401 when there
// is no principal or the user is inactive/cannot log in, 401 token_expired
// when the token's perm version is outdated, and 403 when none of codes is
// granted. The effective permission set is stored via WithPermissions.
// It panics if codes is empty.
func RequirePermission(c *Checker, codes ...string) func(http.Handler) http.Handler {
	if len(codes) == 0 {
		panic("rbac: RequirePermission needs at least one permission code")
	}
	codes = append([]string(nil), codes...)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			p, ok := authctx.FromContext(r.Context())
			if !ok {
				httpx.WriteError(w, r, apperr.Unauthenticated(""))
				return
			}
			a, err := c.Access(r.Context(), p)
			if err != nil {
				httpx.WriteError(w, r, err)
				return
			}
			if !a.Perms.HasAny(codes...) {
				httpx.WriteError(w, r, apperr.Forbidden(""))
				return
			}
			next.ServeHTTP(w, r.WithContext(WithPermissions(r.Context(), a.Perms)))
		})
	}
}
