//go:build integration

package user_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/authctx"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
	"portal-berita/backend/internal/testdb"
	"portal-berita/backend/internal/user"
)

// fakeGuard is a self-contained stand-in for rbac.Checker.Guard() (Worker
// B): it injects a fixed principal + permission set into the request
// context and 403s when none of the required codes are held, so handler
// tests do not depend on a real Checker.
func fakeGuard(userID int64, perms rbac.Set) rbac.Guard {
	return func(codes ...string) func(http.Handler) http.Handler {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if len(codes) > 0 && !perms.HasAny(codes...) {
					httpx.WriteError(w, r, apperr.Forbidden(""))
					return
				}
				ctx := authctx.WithPrincipal(r.Context(), authctx.Principal{UserID: userID})
				ctx = rbac.WithPermissions(ctx, perms)
				next.ServeHTTP(w, r.WithContext(ctx))
			})
		}
	}
}

func newTestServer(t *testing.T, userID int64, codes ...string) *httptest.Server {
	t.Helper()
	pool := testdb.New(t)
	svc, _ := newService(pool)
	h := user.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, fakeGuard(userID, rbac.NewSet(codes...)))
	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv
}

func doJSON(t *testing.T, method, url string, body any) (*http.Response, map[string]any) {
	t.Helper()
	var rdr *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		require.NoError(t, err)
		rdr = bytes.NewReader(b)
	} else {
		rdr = bytes.NewReader(nil)
	}
	req, err := http.NewRequestWithContext(context.Background(), method, url, rdr)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	var out map[string]any
	if resp.ContentLength != 0 {
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&out))
	}
	return resp, out
}

func TestHandlerListAndCreate(t *testing.T) {
	srv := newTestServer(t, 1, rbac.PermUsersManage)

	resp, body := doJSON(t, http.MethodGet, srv.URL+"/users", nil)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Contains(t, body, "meta")

	resp, body = doJSON(t, http.MethodPost, srv.URL+"/users", map[string]any{
		"display_name": "Penulis Handler",
	})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	data := body["data"].(map[string]any)
	assert.Equal(t, "Penulis Handler", data["display_name"])
	assert.Equal(t, false, data["can_login"])
}

func TestHandlerGetMissingIs404(t *testing.T) {
	srv := newTestServer(t, 1, rbac.PermUsersManage)
	resp, body := doJSON(t, http.MethodGet, srv.URL+"/users/999999999", nil)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	errObj := body["error"].(map[string]any)
	assert.Equal(t, "not_found", errObj["code"])
}

func TestHandlerAuthorsOnlyActorForbiddenOnLoginFields(t *testing.T) {
	srv := newTestServer(t, 1, rbac.PermAuthorsManage)
	resp, body := doJSON(t, http.MethodPost, srv.URL+"/users", map[string]any{
		"display_name": "X", "email": "x@test.local", "password": "Password-X-12345", "can_login": true,
	})
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	errObj := body["error"].(map[string]any)
	assert.Equal(t, "forbidden", errObj["code"])
}

func TestHandlerGuardRejectsWithoutPermission(t *testing.T) {
	srv := newTestServer(t, 1, rbac.PermArticlesRead)
	resp, _ := doJSON(t, http.MethodGet, srv.URL+"/users", nil)
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)

	resp, _ = doJSON(t, http.MethodPost, srv.URL+"/users/1/reset-password", map[string]any{"new_password": "Password-Baru-1"})
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestHandlerActivateDeactivate(t *testing.T) {
	pool := testdb.New(t)
	svc, _ := newService(pool)
	h := user.NewHandler(svc)
	r := chi.NewRouter()
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	h.Register(r, fakeGuard(adminID, rbac.NewSet(rbac.PermUsersManage)))
	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)

	target := testdb.CreateUser(t, pool, testdb.UserOpts{
		Email: "handler-target@test.local", Password: "Password-Target-1", DisplayName: "Handler Target",
		CanLogin: true, IsActive: true,
	})

	resp, _ := doJSON(t, http.MethodPost, srv.URL+"/users/"+itoa(target)+"/deactivate", nil)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)

	// Self-deactivation is rejected.
	resp, body := doJSON(t, http.MethodPost, srv.URL+"/users/"+itoa(adminID)+"/deactivate", nil)
	assert.Equal(t, http.StatusConflict, resp.StatusCode)
	errObj := body["error"].(map[string]any)
	assert.Equal(t, "conflict", errObj["code"])
}

func itoa(id int64) string {
	b, _ := json.Marshal(id)
	return string(b)
}
