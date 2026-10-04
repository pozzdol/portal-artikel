//go:build integration

package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/auth"
	"portal-berita/backend/internal/config"
	"portal-berita/backend/internal/rbac"
	"portal-berita/backend/internal/testdb"
)

const e2eSecret = "e2e-test-secret-0123456789abcdef0123456789"

// e2eServer starts the real router on a throwaway schema. accessTTL overrides
// the access token lifetime (0 = default 15m).
func e2eServer(t *testing.T, pool *pgxpool.Pool, accessTTL time.Duration) *httptest.Server {
	t.Helper()
	if accessTTL == 0 {
		accessTTL = 15 * time.Minute
	}
	cfg := &config.Config{
		AppEnv:                  config.EnvDevelopment,
		JWTSecret:               e2eSecret,
		AccessTokenTTL:          accessTTL,
		RefreshTokenTTL:         7 * 24 * time.Hour,
		RefreshTokenTTLRemember: 30 * 24 * time.Hour,
		UploadDir:               t.TempDir(),
	}
	srv := httptest.NewServer(NewRouter(Deps{Cfg: cfg, Pool: pool}))
	t.Cleanup(srv.Close)
	return srv
}

// client is a browser-like API client with its own cookie jar.
type client struct {
	t    *testing.T
	base string
	http *http.Client
	jar  *cookiejar.Jar
}

func newClient(t *testing.T, srv *httptest.Server) *client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	require.NoError(t, err)
	return &client{t: t, base: srv.URL, http: &http.Client{Jar: jar}, jar: jar}
}

type result struct {
	Status  int
	Header  http.Header
	Cookies []*http.Cookie
	Body    map[string]any
}

func (r result) errCode() string {
	e, _ := r.Body["error"].(map[string]any)
	s, _ := e["code"].(string)
	return s
}

func (r result) errMessage() string {
	e, _ := r.Body["error"].(map[string]any)
	s, _ := e["message"].(string)
	return s
}

func (r result) data() map[string]any {
	d, _ := r.Body["data"].(map[string]any)
	return d
}

// cookie returns the named jar cookie visible at path.
func (c *client) cookie(path, name string) string {
	u, err := url.Parse(c.base + path)
	require.NoError(c.t, err)
	for _, ck := range c.jar.Cookies(u) {
		if ck.Name == name {
			return ck.Value
		}
	}
	return ""
}

// do sends a request; withCSRF copies the csrf_token cookie into the header.
// extra cookies (e.g. a stale refresh token) are added verbatim and the jar is
// bypassed when extra is non-nil.
func (c *client) do(method, path string, body any, withCSRF bool, extra ...*http.Cookie) result {
	c.t.Helper()
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		require.NoError(c.t, err)
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.base+path, rdr)
	require.NoError(c.t, err)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if withCSRF {
		req.Header.Set(auth.HeaderCSRF, c.cookie("/", auth.CookieCSRF))
	}
	hc := c.http
	if extra != nil {
		hc = &http.Client{}
		for _, ck := range extra {
			req.AddCookie(ck)
		}
	}
	resp, err := hc.Do(req)
	require.NoError(c.t, err)
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	require.NoError(c.t, err)
	out := result{Status: resp.StatusCode, Header: resp.Header, Cookies: resp.Cookies()}
	if len(raw) > 0 {
		require.NoError(c.t, json.Unmarshal(raw, &out.Body), string(raw))
	}
	return out
}

func (c *client) login(email, password string) result {
	c.t.Helper()
	return c.do(http.MethodPost, "/api/v1/auth/login", map[string]any{"email": email, "password": password}, false)
}

func (c *client) mustLogin(email, password string) {
	c.t.Helper()
	res := c.login(email, password)
	require.Equal(c.t, http.StatusOK, res.Status, res.Body)
}

func permsOf(me map[string]any) []string {
	raw, _ := me["permissions"].([]any)
	out := make([]string, 0, len(raw))
	for _, p := range raw {
		out = append(out, p.(string))
	}
	return out
}

func TestE2EAuth(t *testing.T) {
	pool := testdb.New(t)
	superID, superEmail, superPW := testdb.SuperAdmin(t, pool)
	srv := e2eServer(t, pool, 0)

	t.Run("login sets three cookies with attributes", func(t *testing.T) {
		c := newClient(t, srv)
		res := c.login(superEmail, superPW)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		user, _ := res.data()["user"].(map[string]any)
		require.NotNil(t, user)
		assert.Equal(t, superEmail, user["email"])

		byName := map[string]*http.Cookie{}
		for _, ck := range res.Cookies {
			byName[ck.Name] = ck
		}
		want := []struct {
			name     string
			path     string
			httpOnly bool
		}{
			{auth.CookieAccess, "/", true},
			{auth.CookieRefresh, auth.RefreshCookiePath, true},
			{auth.CookieCSRF, "/", false},
		}
		for _, w := range want {
			ck := byName[w.name]
			require.NotNil(t, ck, w.name)
			assert.NotEmpty(t, ck.Value, w.name)
			assert.Equal(t, w.path, ck.Path, w.name)
			assert.Equal(t, w.httpOnly, ck.HttpOnly, w.name)
			assert.Equal(t, http.SameSiteLaxMode, ck.SameSite, w.name)
			assert.False(t, ck.Secure, w.name)
			// 7 days, allow a little clock slack.
			assert.InDelta(t, 7*24*3600, ck.MaxAge, 60, w.name)
		}
	})

	t.Run("wrong password is 401 invalid_credentials", func(t *testing.T) {
		c := newClient(t, srv)
		res := c.login(superEmail, "salah-sekali-123")
		assert.Equal(t, http.StatusUnauthorized, res.Status)
		assert.Equal(t, "invalid_credentials", res.errCode())
		assert.Empty(t, res.Cookies)
	})

	t.Run("me, csrf and admin users", func(t *testing.T) {
		c := newClient(t, srv)
		c.mustLogin(superEmail, superPW)

		res := c.do(http.MethodGet, "/api/v1/auth/me", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.ElementsMatch(t, rbac.AllPermissions, permsOf(res.data()))
		assert.Len(t, permsOf(res.data()), 22)

		body := map[string]any{"display_name": "Super Admin Baru"}
		res = c.do(http.MethodPut, "/api/v1/auth/me", body, false)
		assert.Equal(t, http.StatusForbidden, res.Status)
		assert.Equal(t, "csrf_failed", res.errCode())

		res = c.do(http.MethodPut, "/api/v1/auth/me", body, true)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.Equal(t, "Super Admin Baru", res.data()["display_name"])

		// Admin mutations need CSRF too.
		res = c.do(http.MethodPost, fmt.Sprintf("/api/v1/admin/users/%d/activate", superID), nil, false)
		assert.Equal(t, http.StatusForbidden, res.Status)
		assert.Equal(t, "csrf_failed", res.errCode())

		res = c.do(http.MethodGet, "/api/v1/admin/users", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		items, _ := res.Body["data"].([]any)
		assert.NotEmpty(t, items)
	})

	t.Run("unauthenticated admin request is 401", func(t *testing.T) {
		c := newClient(t, srv)
		res := c.do(http.MethodGet, "/api/v1/admin/users", nil, false)
		assert.Equal(t, http.StatusUnauthorized, res.Status)
		assert.Equal(t, "unauthenticated", res.errCode())
	})

	t.Run("refresh rotates and reuse revokes the family", func(t *testing.T) {
		c := newClient(t, srv)
		c.mustLogin(superEmail, superPW)
		oldRefresh := c.cookie(auth.RefreshCookiePath, auth.CookieRefresh)
		oldCSRF := c.cookie("/", auth.CookieCSRF)
		require.NotEmpty(t, oldRefresh)

		res := c.do(http.MethodPost, "/api/v1/auth/refresh", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.NotNil(t, res.data()["user"])
		newRefresh := c.cookie(auth.RefreshCookiePath, auth.CookieRefresh)
		assert.NotEmpty(t, newRefresh)
		assert.NotEqual(t, oldRefresh, newRefresh, "refresh token must rotate")
		assert.NotEqual(t, oldCSRF, c.cookie("/", auth.CookieCSRF), "csrf token must rotate")

		// Replaying the rotated token is reuse: 401 and the whole family dies.
		res = c.do(http.MethodPost, "/api/v1/auth/refresh", nil, false,
			&http.Cookie{Name: auth.CookieRefresh, Value: oldRefresh})
		assert.Equal(t, http.StatusUnauthorized, res.Status)
		assert.Equal(t, "unauthenticated", res.errCode())

		res = c.do(http.MethodPost, "/api/v1/auth/refresh", nil, false)
		assert.Equal(t, http.StatusUnauthorized, res.Status, "new token of a revoked family must fail")
		assert.Equal(t, "unauthenticated", res.errCode())

		var n int
		require.NoError(t, pool.QueryRow(context.Background(),
			"SELECT count(*) FROM audit_logs WHERE action = 'refresh_reuse' AND user_id = $1", superID).Scan(&n))
		assert.Equal(t, 1, n)
	})

	t.Run("logout clears cookies", func(t *testing.T) {
		c := newClient(t, srv)
		c.mustLogin(superEmail, superPW)
		res := c.do(http.MethodPost, "/api/v1/auth/logout", nil, true)
		require.Equal(t, http.StatusNoContent, res.Status)
		cleared := map[string]bool{}
		for _, ck := range res.Cookies {
			if ck.MaxAge < 0 {
				cleared[ck.Name] = true
			}
		}
		assert.True(t, cleared[auth.CookieAccess] && cleared[auth.CookieRefresh] && cleared[auth.CookieCSRF], res.Cookies)
		assert.Empty(t, c.cookie("/", auth.CookieAccess))

		res = c.do(http.MethodGet, "/api/v1/auth/me", nil, false)
		assert.Equal(t, http.StatusUnauthorized, res.Status)
		res = c.do(http.MethodPost, "/api/v1/auth/refresh", nil, false)
		assert.Equal(t, http.StatusUnauthorized, res.Status)
	})

	t.Run("admin role: no audit logs, authors only in users", func(t *testing.T) {
		testdb.CreateUser(t, pool, testdb.UserOpts{DisplayName: "Penulis Tamu", IsActive: true})
		const email, pw = "admin-biasa@test.local", "Password-Admin-123"
		testdb.CreateUser(t, pool, testdb.UserOpts{
			Email: email, Password: pw, DisplayName: "Admin Biasa",
			CanLogin: true, IsActive: true, Roles: []string{rbac.RoleAdmin},
		})
		c := newClient(t, srv)
		c.mustLogin(email, pw)

		res := c.do(http.MethodGet, "/api/v1/admin/audit-logs", nil, false)
		assert.Equal(t, http.StatusForbidden, res.Status)
		assert.Equal(t, "forbidden", res.errCode())

		res = c.do(http.MethodGet, "/api/v1/admin/roles", nil, false)
		assert.Equal(t, http.StatusForbidden, res.Status)

		res = c.do(http.MethodGet, "/api/v1/admin/users", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		items, _ := res.Body["data"].([]any)
		require.NotEmpty(t, items)
		for _, it := range items {
			u := it.(map[string]any)
			assert.Equal(t, false, u["can_login"], "admin must only see authors: %v", u)
		}
	})

	t.Run("sixth wrong login is rate limited", func(t *testing.T) {
		c := newClient(t, srv)
		const email = "tebak@test.local"
		for i := 0; i < 5; i++ {
			res := c.login(email, "salah-sekali-123")
			require.Equal(t, http.StatusUnauthorized, res.Status, "attempt %d", i+1)
		}
		res := c.login(email, "salah-sekali-123")
		assert.Equal(t, http.StatusTooManyRequests, res.Status)
		assert.Equal(t, "rate_limited", res.errCode())
		secs, err := strconv.Atoi(res.Header.Get("Retry-After"))
		require.NoError(t, err)
		assert.True(t, secs > 0 && secs <= 60, secs)
	})

	t.Run("last active super admin cannot be deactivated", func(t *testing.T) {
		sa := newClient(t, srv)
		sa.mustLogin(superEmail, superPW)

		// Self-deactivation is blocked by self-protection.
		res := sa.do(http.MethodPost, fmt.Sprintf("/api/v1/admin/users/%d/deactivate", superID), nil, true)
		assert.Equal(t, http.StatusConflict, res.Status, res.Body)

		// A non-super-admin user manager hits the last-super-admin rule.
		res = sa.do(http.MethodPost, "/api/v1/admin/roles", map[string]any{
			"code": "pengelola_user", "name": "Pengelola User", "permission_codes": []string{rbac.PermUsersManage},
		}, true)
		require.Equal(t, http.StatusCreated, res.Status, res.Body)
		const email, pw = "pengelola@test.local", "Password-Kelola-123"
		testdb.CreateUser(t, pool, testdb.UserOpts{
			Email: email, Password: pw, DisplayName: "Pengelola",
			CanLogin: true, IsActive: true, Roles: []string{"pengelola_user"},
		})
		m := newClient(t, srv)
		m.mustLogin(email, pw)
		res = m.do(http.MethodPost, fmt.Sprintf("/api/v1/admin/users/%d/deactivate", superID), nil, true)
		assert.Equal(t, http.StatusConflict, res.Status, res.Body)
		assert.Equal(t, "conflict", res.errCode())
		assert.Equal(t, "Minimal satu super admin aktif harus tetap ada.", res.errMessage())

		var active bool
		require.NoError(t, pool.QueryRow(context.Background(), "SELECT is_active FROM users WHERE id = $1", superID).Scan(&active))
		assert.True(t, active)
	})

	t.Run("role permission change forces refresh", func(t *testing.T) {
		sa := newClient(t, srv)
		sa.mustLogin(superEmail, superPW)
		res := sa.do(http.MethodPost, "/api/v1/admin/roles", map[string]any{
			"code": "editor_uji", "name": "Editor Uji", "permission_codes": []string{rbac.PermAuthorsManage},
		}, true)
		require.Equal(t, http.StatusCreated, res.Status, res.Body)
		roleID := int64(res.data()["id"].(float64))

		const email, pw = "editor@test.local", "Password-Editor-123"
		testdb.CreateUser(t, pool, testdb.UserOpts{
			Email: email, Password: pw, DisplayName: "Editor",
			CanLogin: true, IsActive: true, Roles: []string{"editor_uji"},
		})
		ed := newClient(t, srv)
		ed.mustLogin(email, pw)
		res = ed.do(http.MethodGet, "/api/v1/admin/users", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		res = ed.do(http.MethodGet, "/api/v1/admin/audit-logs", nil, false)
		require.Equal(t, http.StatusForbidden, res.Status)

		res = sa.do(http.MethodPut, fmt.Sprintf("/api/v1/admin/roles/%d", roleID), map[string]any{
			"name": "Editor Uji", "permission_codes": []string{rbac.PermAuthorsManage, rbac.PermAuditView},
		}, true)
		require.Equal(t, http.StatusOK, res.Status, res.Body)

		res = ed.do(http.MethodGet, "/api/v1/admin/audit-logs", nil, false)
		assert.Equal(t, http.StatusUnauthorized, res.Status)
		assert.Equal(t, "token_expired", res.errCode())

		res = ed.do(http.MethodPost, "/api/v1/auth/refresh", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)

		res = ed.do(http.MethodGet, "/api/v1/auth/me", nil, false)
		require.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.ElementsMatch(t, []string{rbac.PermAuditView, rbac.PermAuthorsManage}, permsOf(res.data()))

		res = ed.do(http.MethodGet, "/api/v1/admin/audit-logs", nil, false)
		assert.Equal(t, http.StatusOK, res.Status, res.Body)
	})

	t.Run("expired access token then refresh", func(t *testing.T) {
		short := e2eServer(t, pool, time.Millisecond)
		c := newClient(t, short)
		c.mustLogin(superEmail, superPW)
		// JWT exp has second precision; wait past it.
		time.Sleep(1100 * time.Millisecond)

		res := c.do(http.MethodGet, "/api/v1/auth/me", nil, false)
		assert.Equal(t, http.StatusUnauthorized, res.Status)
		assert.Equal(t, "token_expired", res.errCode())

		res = c.do(http.MethodPost, "/api/v1/auth/refresh", nil, false)
		assert.Equal(t, http.StatusOK, res.Status, res.Body)
		assert.NotNil(t, res.data()["user"])
	})
}
