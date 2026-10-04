//go:build integration

package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/testdb"
)

type env struct {
	t      *testing.T
	pool   *pgxpool.Pool
	svc    *Service
	router http.Handler
}

// jar holds the auth cookies of one simulated browser.
type jar map[string]string

func newEnv(t *testing.T) *env {
	t.Helper()
	pool := testdb.New(t)
	issuer := NewTokenIssuer(testSecret, 15*time.Minute)
	svc := NewService(pool, issuer, audit.New(pool), NewLoginLimiter(5, time.Minute), Config{
		AccessTTL:          15 * time.Minute,
		RefreshTTL:         7 * 24 * time.Hour,
		RefreshTTLRemember: 30 * 24 * time.Hour,
	})
	// Stub authn: verify the access cookie with the real issuer.
	authn := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c, err := r.Cookie(CookieAccess)
			if err != nil {
				httpx.WriteError(w, r, apperr.Unauthenticated(""))
				return
			}
			p, err := issuer.Verify(c.Value)
			if err != nil {
				httpx.WriteError(w, r, apperr.Unauthenticated(""))
				return
			}
			next.ServeHTTP(w, r.WithContext(WithPrincipal(r.Context(), p)))
		})
	}
	passCSRF := func(next http.Handler) http.Handler { return next }
	r := chi.NewRouter()
	r.Route("/api/v1/auth", NewHandler(svc, CookieConfig{}, authn, passCSRF).Register)
	return &env{t: t, pool: pool, svc: svc, router: r}
}

func (e *env) do(method, path string, body any, j jar) *httptest.ResponseRecorder {
	e.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		require.NoError(e.t, json.NewEncoder(&buf).Encode(body))
	}
	req := httptest.NewRequest(method, "/api/v1/auth"+path, &buf)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "integration-test")
	for k, v := range j {
		req.AddCookie(&http.Cookie{Name: k, Value: v})
	}
	rec := httptest.NewRecorder()
	e.router.ServeHTTP(rec, req)
	if j != nil {
		for _, c := range rec.Result().Cookies() {
			if c.MaxAge < 0 {
				delete(j, c.Name)
			} else {
				j[c.Name] = c.Value
			}
		}
	}
	return rec
}

func (e *env) login(email, password string) (jar, *httptest.ResponseRecorder) {
	e.t.Helper()
	j := jar{}
	rec := e.do(http.MethodPost, "/login", map[string]any{"email": email, "password": password}, j)
	return j, rec
}

func errCode(t *testing.T, rec *httptest.ResponseRecorder) (string, string) {
	t.Helper()
	var body struct {
		Error struct{ Code, Message string } `json:"error"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body), rec.Body.String())
	return body.Error.Code, body.Error.Message
}

func (e *env) count(sql string, args ...any) int {
	e.t.Helper()
	var n int
	require.NoError(e.t, e.pool.QueryRow(context.Background(), sql, args...).Scan(&n))
	return n
}

func (e *env) auditCount(action string) int {
	return e.count("SELECT count(*) FROM audit_logs WHERE action = $1", action)
}

func TestLoginSuccess(t *testing.T) {
	e := newEnv(t)
	id, email, pw := testdb.SuperAdmin(t, e.pool)

	j, rec := e.login("  "+"ADMIN@test.local"+" ", pw)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.NotEmpty(t, j[CookieAccess])
	assert.NotEmpty(t, j[CookieRefresh])
	assert.NotEmpty(t, j[CookieCSRF])

	var body struct {
		Data struct{ User Me } `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, id, body.Data.User.ID)
	assert.Equal(t, email, *body.Data.User.Email)
	assert.Contains(t, body.Data.User.Permissions, "users.manage")
	require.Len(t, body.Data.User.Roles, 1)
	assert.Equal(t, "super_admin", body.Data.User.Roles[0].Code)
	assert.NotNil(t, body.Data.User.LastLoginAt)

	assert.Equal(t, 1, e.count("SELECT count(*) FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL", id))
	assert.Equal(t, 1, e.auditCount(audit.ActionLogin))

	// Access token works on /me.
	rec = e.do(http.MethodGet, "/me", nil, j)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Contains(t, rec.Body.String(), `"display_name":"Super Admin Uji"`)
}

func TestLoginRememberExtendsLifetime(t *testing.T) {
	e := newEnv(t)
	_, email, pw := testdb.SuperAdmin(t, e.pool)
	rec := e.do(http.MethodPost, "/login", map[string]any{"email": email, "password": pw, "remember": true}, jar{})
	require.Equal(t, http.StatusOK, rec.Code)
	for _, c := range rec.Result().Cookies() {
		assert.InDelta(t, 30*24*3600, c.MaxAge, 5, c.Name)
	}
	assert.Equal(t, 1, e.count("SELECT count(*) FROM refresh_tokens WHERE expires_at > now() + interval '29 days'"))
}

func TestLoginFailures(t *testing.T) {
	e := newEnv(t)
	testdb.SuperAdmin(t, e.pool)
	testdb.CreateUser(t, e.pool, testdb.UserOpts{Email: "inactive@test.local", Password: "Rahasia-12345", CanLogin: true, IsActive: false})
	testdb.CreateUser(t, e.pool, testdb.UserOpts{Email: "author@test.local", Password: "Rahasia-12345", CanLogin: false, IsActive: true})

	cases := []struct{ name, email, pw string }{
		{"wrong password", testdb.SuperAdminEmail, "salah-sekali-123"},
		{"unknown email", "nobody@test.local", "Rahasia-12345"},
		{"inactive", "inactive@test.local", "Rahasia-12345"},
		{"cannot login", "author@test.local", "Rahasia-12345"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, rec := e.login(tc.email, tc.pw)
			require.Equal(t, http.StatusUnauthorized, rec.Code, rec.Body.String())
			code, msg := errCode(t, rec)
			assert.Equal(t, "invalid_credentials", code)
			assert.Equal(t, "Email atau kata sandi salah.", msg)
			assert.Empty(t, rec.Result().Cookies())
		})
	}
	assert.Equal(t, 4, e.auditCount(audit.ActionLoginFailed))
	// Known users are attributed, unknown email is not.
	assert.Equal(t, 1, e.count("SELECT count(*) FROM audit_logs WHERE action = 'login_failed' AND user_id IS NULL"))
	assert.Equal(t, 1, e.count(`SELECT count(*) FROM audit_logs WHERE action = 'login_failed' AND changes->>'email' = 'nobody@test.local'`))
	assert.Equal(t, 0, e.count("SELECT count(*) FROM refresh_tokens"))

	// Validation.
	_, rec := e.login("not-an-email", "x")
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
}

func TestLoginRateLimited(t *testing.T) {
	e := newEnv(t)
	_, email, pw := testdb.SuperAdmin(t, e.pool)
	for i := 0; i < 5; i++ {
		_, rec := e.login(email, "wrong-password-1")
		require.Equal(t, http.StatusUnauthorized, rec.Code)
	}
	_, rec := e.login(email, pw) // correct password, but limited
	require.Equal(t, http.StatusTooManyRequests, rec.Code)
	code, _ := errCode(t, rec)
	assert.Equal(t, "rate_limited", code)
	secs, err := strconv.Atoi(rec.Header().Get("Retry-After"))
	require.NoError(t, err)
	assert.True(t, secs >= 1 && secs <= 60)
	// The limited attempt did no DB work and was not audited.
	assert.Equal(t, 5, e.auditCount(audit.ActionLoginFailed))
}

func TestRefreshRotates(t *testing.T) {
	e := newEnv(t)
	id, email, pw := testdb.SuperAdmin(t, e.pool)
	j, rec := e.login(email, pw)
	require.Equal(t, http.StatusOK, rec.Code)
	oldRefresh, oldCSRF := j[CookieRefresh], j[CookieCSRF]

	rec = e.do(http.MethodPost, "/refresh", nil, j)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Contains(t, rec.Body.String(), `"user":`)
	assert.NotEqual(t, oldRefresh, j[CookieRefresh])
	assert.NotEqual(t, oldCSRF, j[CookieCSRF])

	assert.Equal(t, 2, e.count("SELECT count(*) FROM refresh_tokens WHERE user_id = $1", id))
	assert.Equal(t, 1, e.count("SELECT count(DISTINCT family_id) FROM refresh_tokens"))
	assert.Equal(t, 1, e.count("SELECT count(DISTINCT expires_at) FROM refresh_tokens"))
	assert.Equal(t, 1, e.count("SELECT count(*) FROM refresh_tokens WHERE rotated_at IS NOT NULL"))

	rec = e.do(http.MethodGet, "/me", nil, j)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestRefreshReuseRevokesFamily(t *testing.T) {
	e := newEnv(t)
	_, email, pw := testdb.SuperAdmin(t, e.pool)
	j, _ := e.login(email, pw)
	stolen := j[CookieRefresh]

	rec := e.do(http.MethodPost, "/refresh", nil, j) // legit rotation
	require.Equal(t, http.StatusOK, rec.Code)

	attacker := jar{CookieRefresh: stolen}
	rec = e.do(http.MethodPost, "/refresh", nil, attacker)
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	code, msg := errCode(t, rec)
	assert.Equal(t, "unauthenticated", code)
	assert.Contains(t, msg, "aktivitas mencurigakan")
	assert.Empty(t, attacker, "cookies cleared")

	// Committed despite the 401.
	assert.Equal(t, 0, e.count("SELECT count(*) FROM refresh_tokens WHERE revoked_at IS NULL"))
	assert.Equal(t, 1, e.auditCount(audit.ActionRefreshReuse))

	// The legit client's current token is now dead too.
	rec = e.do(http.MethodPost, "/refresh", nil, j)
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	code, msg = errCode(t, rec)
	assert.Equal(t, "unauthenticated", code)
	assert.Equal(t, "Sesi tidak valid.", msg)
	assert.Equal(t, 1, e.auditCount(audit.ActionRefreshReuse), "revoked token is not a reuse")
}

func TestRefreshConcurrentIsStrict(t *testing.T) {
	e := newEnv(t)
	_, email, pw := testdb.SuperAdmin(t, e.pool)
	j, _ := e.login(email, pw)
	raw := j[CookieRefresh]

	var wg sync.WaitGroup
	codes := make([]int, 2)
	for i := range codes {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, err := e.svc.Refresh(context.Background(), raw, Client{})
			if err == nil {
				codes[i] = 200
			} else {
				codes[i] = 401
			}
		}(i)
	}
	wg.Wait()
	assert.ElementsMatch(t, []int{200, 401}, codes)
	assert.Equal(t, 0, e.count("SELECT count(*) FROM refresh_tokens WHERE revoked_at IS NULL"))
}

func TestRefreshExpired(t *testing.T) {
	e := newEnv(t)
	_, email, pw := testdb.SuperAdmin(t, e.pool)
	j, _ := e.login(email, pw)
	// Service.Refresh compares expires_at with the Go clock, so the fixture
	// must use the Go clock too: the remote DB clock runs ~0.9 s ahead of the
	// test host, which made "now() - 1s" land barely in the past (or, with
	// more drift, in the future).
	_, err := e.pool.Exec(context.Background(), "UPDATE refresh_tokens SET expires_at = $1", time.Now().Add(-time.Hour))
	require.NoError(t, err)

	rec := e.do(http.MethodPost, "/refresh", nil, j)
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	code, msg := errCode(t, rec)
	assert.Equal(t, "unauthenticated", code)
	assert.Equal(t, "Sesi telah berakhir. Silakan masuk kembali.", msg)
	assert.Empty(t, j[CookieRefresh])
	assert.Equal(t, 1, e.count("SELECT count(*) FROM refresh_tokens WHERE revoked_at IS NULL"), "no family revoke")
}

func TestRefreshMissingOrUnknown(t *testing.T) {
	e := newEnv(t)
	for _, j := range []jar{{}, {CookieRefresh: "bogus"}} {
		rec := e.do(http.MethodPost, "/refresh", nil, j)
		require.Equal(t, http.StatusUnauthorized, rec.Code)
		code, msg := errCode(t, rec)
		assert.Equal(t, "unauthenticated", code, "never token_expired")
		assert.Equal(t, "Sesi tidak valid.", msg)
		assert.Len(t, rec.Result().Cookies(), 3, "cookies cleared")
	}
}

func TestRefreshDisabledUserRevokes(t *testing.T) {
	e := newEnv(t)
	id, email, pw := testdb.SuperAdmin(t, e.pool)
	j, _ := e.login(email, pw)
	_, err := e.pool.Exec(context.Background(), "UPDATE users SET is_active = false WHERE id = $1", id)
	require.NoError(t, err)
	rec := e.do(http.MethodPost, "/refresh", nil, j)
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Equal(t, 0, e.count("SELECT count(*) FROM refresh_tokens WHERE revoked_at IS NULL"))
}

func TestLogout(t *testing.T) {
	e := newEnv(t)
	_, email, pw := testdb.SuperAdmin(t, e.pool)
	j, _ := e.login(email, pw)
	refresh := j[CookieRefresh]

	rec := e.do(http.MethodPost, "/logout", nil, j)
	require.Equal(t, http.StatusNoContent, rec.Code)
	assert.Empty(t, j)
	assert.Equal(t, 0, e.count("SELECT count(*) FROM refresh_tokens WHERE revoked_at IS NULL"))
	assert.Equal(t, 1, e.auditCount(audit.ActionLogout))

	rec = e.do(http.MethodPost, "/refresh", nil, jar{CookieRefresh: refresh})
	assert.Equal(t, http.StatusUnauthorized, rec.Code)

	// Logout without cookies still succeeds.
	rec = e.do(http.MethodPost, "/logout", nil, jar{})
	assert.Equal(t, http.StatusNoContent, rec.Code)
	assert.Equal(t, 1, e.auditCount(audit.ActionLogout))
}

func TestChangePasswordRevokesOtherSessions(t *testing.T) {
	e := newEnv(t)
	_, email, pw := testdb.SuperAdmin(t, e.pool)
	j1, _ := e.login(email, pw)
	j2, _ := e.login(email, pw)

	rec := e.do(http.MethodPut, "/me/password", map[string]any{"current_password": "salah-123456", "new_password": "Baru-Sekali-123"}, j1)
	require.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
	assert.Contains(t, rec.Body.String(), "current_password")

	rec = e.do(http.MethodPut, "/me/password", map[string]any{"current_password": pw, "new_password": "pendek"}, j1)
	require.Equal(t, http.StatusUnprocessableEntity, rec.Code)

	rec = e.do(http.MethodPut, "/me/password", map[string]any{"current_password": pw, "new_password": "Baru-Sekali-123"}, j1)
	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	assert.Equal(t, 1, e.auditCount(audit.ActionPasswordChange))

	assert.Equal(t, http.StatusOK, e.do(http.MethodPost, "/refresh", nil, j1).Code, "current session kept")
	assert.Equal(t, http.StatusUnauthorized, e.do(http.MethodPost, "/refresh", nil, j2).Code, "other session revoked")

	_, rec = e.login(email, pw)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	_, rec = e.login(email, "Baru-Sekali-123")
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestSessionsListAndRevoke(t *testing.T) {
	e := newEnv(t)
	_, email, pw := testdb.SuperAdmin(t, e.pool)
	j1, _ := e.login(email, pw)
	j2, _ := e.login(email, pw)
	require.Equal(t, http.StatusOK, e.do(http.MethodPost, "/refresh", nil, j2).Code) // rotated family still one session

	list := func(j jar) []SessionInfo {
		rec := e.do(http.MethodGet, "/sessions", nil, j)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var body struct{ Data []SessionInfo }
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
		return body.Data
	}
	ss := list(j1)
	require.Len(t, ss, 2)
	var current, other SessionInfo
	for _, s := range ss {
		if s.Current {
			current = s
		} else {
			other = s
		}
	}
	require.NotEmpty(t, current.FamilyID)
	require.NotEmpty(t, other.FamilyID)
	require.NotNil(t, current.IP)
	assert.Equal(t, "192.0.2.1", *current.IP)
	assert.Equal(t, "integration-test", *current.UserAgent)
	_, err := time.Parse(time.RFC3339, current.StartedAt)
	assert.NoError(t, err)
	assert.Contains(t, current.ExpiresAt, "+07:00")

	assert.Equal(t, http.StatusNotFound, e.do(http.MethodDelete, "/sessions/not-a-uuid", nil, j1).Code)
	assert.Equal(t, http.StatusNotFound, e.do(http.MethodDelete, "/sessions/00000000-0000-0000-0000-000000000000", nil, j1).Code)

	rec := e.do(http.MethodDelete, "/sessions/"+other.FamilyID, nil, j1)
	require.Equal(t, http.StatusNoContent, rec.Code)
	assert.Empty(t, rec.Result().Cookies(), "other session: cookies kept")
	assert.Equal(t, 1, e.auditCount(audit.ActionSessionRevoke))
	require.Len(t, list(j1), 1)
	assert.Equal(t, http.StatusUnauthorized, e.do(http.MethodPost, "/refresh", nil, j2).Code)
	assert.Equal(t, http.StatusNotFound, e.do(http.MethodDelete, "/sessions/"+other.FamilyID, nil, j1).Code, "already revoked")

	// Another user's session is not found.
	testdb.CreateUser(t, e.pool, testdb.UserOpts{Email: "b@test.local", Password: "Rahasia-12345", CanLogin: true, IsActive: true})
	jb, _ := e.login("b@test.local", "Rahasia-12345")
	assert.Equal(t, http.StatusNotFound, e.do(http.MethodDelete, "/sessions/"+current.FamilyID, nil, jb).Code)

	rec = e.do(http.MethodDelete, "/sessions/"+current.FamilyID, nil, j1)
	require.Equal(t, http.StatusNoContent, rec.Code)
	assert.Len(t, rec.Result().Cookies(), 3, "current session: cookies cleared")
}

func TestUpdateMe(t *testing.T) {
	e := newEnv(t)
	_, email, pw := testdb.SuperAdmin(t, e.pool)
	j, _ := e.login(email, pw)

	rec := e.do(http.MethodPut, "/me", map[string]any{"display_name": "  Nama Baru ", "title": "Redaktur", "bio": " "}, j)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var body struct{ Data Me }
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, "Nama Baru", body.Data.DisplayName)
	require.NotNil(t, body.Data.Title)
	assert.Equal(t, "Redaktur", *body.Data.Title)
	assert.Nil(t, body.Data.Bio)
	assert.NotEmpty(t, body.Data.Permissions)
	assert.Equal(t, 1, e.auditCount(audit.ActionUpdate))

	rec = e.do(http.MethodPut, "/me", map[string]any{"display_name": ""}, j)
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	rec = e.do(http.MethodPut, "/me", map[string]any{"display_name": "   "}, j)
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	rec = e.do(http.MethodPut, "/me", map[string]any{"display_name": "X", "avatar_media_id": 999999}, j)
	require.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
	assert.Contains(t, rec.Body.String(), "Media tidak ditemukan.")
}

func TestMeInactiveUser(t *testing.T) {
	e := newEnv(t)
	id, email, pw := testdb.SuperAdmin(t, e.pool)
	j, _ := e.login(email, pw)
	_, err := e.pool.Exec(context.Background(), "UPDATE users SET is_active = false WHERE id = $1", id)
	require.NoError(t, err)
	rec := e.do(http.MethodGet, "/me", nil, j)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	rec = e.do(http.MethodGet, "/me", nil, jar{})
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
