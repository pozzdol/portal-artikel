//go:build integration

package role_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/authctx"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/rbac"
	"portal-berita/backend/internal/role"
	"portal-berita/backend/internal/testdb"
)

// fakeGuard is a no-op stand-in for rbac.Checker.Guard(): the role package
// does not check permissions itself, that is the caller's job.
func fakeGuard(_ ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler { return next }
}

// fakeInvalidator records Invalidate/InvalidateAll calls instead of touching
// a real rbac.Checker cache.
type fakeInvalidator struct {
	invalidated []int64
	allCalls    int
}

func (f *fakeInvalidator) Invalidate(userID int64) { f.invalidated = append(f.invalidated, userID) }
func (f *fakeInvalidator) InvalidateAll()          { f.allCalls++ }

func withActor(actorID int64, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := authctx.WithPrincipal(r.Context(), authctx.Principal{UserID: actorID})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func newTestServer(pool *pgxpool.Pool, actorID int64, inv rbac.Invalidator) *httptest.Server {
	svc := role.NewService(pool, audit.New(pool), inv)
	h := role.NewHandler(svc)
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler { return withActor(actorID, next) })
	h.Register(r, fakeGuard)
	return httptest.NewServer(r)
}

func doJSON(t *testing.T, method, url string, body any) *http.Response {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		require.NoError(t, err)
		reader = bytes.NewReader(b)
	} else {
		reader = bytes.NewReader(nil)
	}
	req, err := http.NewRequest(method, url, reader)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	return resp
}

func decodeBody(t *testing.T, resp *http.Response, v any) {
	t.Helper()
	defer resp.Body.Close()
	require.NoError(t, json.NewDecoder(resp.Body).Decode(v))
}

func TestRoleCRUD(t *testing.T) {
	pool := testdb.New(t)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	inv := &fakeInvalidator{}
	srv := newTestServer(pool, adminID, inv)
	defer srv.Close()

	// Create.
	resp := doJSON(t, http.MethodPost, srv.URL+"/roles", role.CreateInput{
		Code: "editor", Name: "Editor", PermissionCodes: []string{"articles.read", "articles.update"},
	})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var created struct {
		Data role.RoleDTO `json:"data"`
	}
	decodeBody(t, resp, &created)
	assert.Equal(t, "editor", created.Data.Code)
	assert.ElementsMatch(t, []string{"articles.read", "articles.update"}, created.Data.Permissions)
	assert.Equal(t, int64(0), created.Data.UserCount)

	// Audit row for create.
	assertAuditAction(t, pool, "create", created.Data.ID)

	// Get.
	resp = doJSON(t, http.MethodGet, fmt.Sprintf("%s/roles/%d", srv.URL, created.Data.ID), nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var got struct {
		Data role.RoleDTO `json:"data"`
	}
	decodeBody(t, resp, &got)
	assert.Equal(t, created.Data.ID, got.Data.ID)

	// List includes it.
	resp = doJSON(t, http.MethodGet, srv.URL+"/roles", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var list struct {
		Data []role.RoleDTO `json:"data"`
	}
	decodeBody(t, resp, &list)
	found := false
	for _, r := range list.Data {
		if r.ID == created.Data.ID {
			found = true
		}
	}
	assert.True(t, found)

	// Assign a user to the new role and update its permissions: perm_version
	// must bump for that user and InvalidateAll must be called.
	memberID := testdb.CreateUser(t, pool, testdb.UserOpts{
		DisplayName: "Editor Uji", CanLogin: false, IsActive: true, Roles: []string{"editor"},
	})
	permBefore := permVersion(t, pool, memberID)

	resp = doJSON(t, http.MethodPut, fmt.Sprintf("%s/roles/%d", srv.URL, created.Data.ID), role.UpdateInput{
		Name: "Editor Senior", PermissionCodes: []string{"articles.read"},
	})
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var updated struct {
		Data role.RoleDTO `json:"data"`
	}
	decodeBody(t, resp, &updated)
	assert.Equal(t, "Editor Senior", updated.Data.Name)
	assert.Equal(t, []string{"articles.read"}, updated.Data.Permissions)
	assert.Equal(t, int64(1), updated.Data.UserCount)
	assert.Equal(t, permBefore+1, permVersion(t, pool, memberID))
	assert.Equal(t, 1, inv.allCalls)
	assertAuditAction(t, pool, "update", created.Data.ID)

	// Delete while still in use -> 409.
	resp = doJSON(t, http.MethodDelete, fmt.Sprintf("%s/roles/%d", srv.URL, created.Data.ID), nil)
	assert.Equal(t, http.StatusConflict, resp.StatusCode)
	resp.Body.Close()

	// Delete an unused role -> 204 + audit.
	resp = doJSON(t, http.MethodPost, srv.URL+"/roles", role.CreateInput{Code: "temp_role", Name: "Sementara"})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var temp struct {
		Data role.RoleDTO `json:"data"`
	}
	decodeBody(t, resp, &temp)

	resp = doJSON(t, http.MethodDelete, fmt.Sprintf("%s/roles/%d", srv.URL, temp.Data.ID), nil)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	resp.Body.Close()
	assertAuditAction(t, pool, "delete", temp.Data.ID)
}

func TestRoleSystemDeleteConflict(t *testing.T) {
	pool := testdb.New(t)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	srv := newTestServer(pool, adminID, &fakeInvalidator{})
	defer srv.Close()

	q := dbgen.New(pool)
	sysRole, err := q.GetRole(context.Background(), roleIDByCode(t, pool, "admin"))
	require.NoError(t, err)
	assert.True(t, sysRole.IsSystem)

	resp := doJSON(t, http.MethodDelete, fmt.Sprintf("%s/roles/%d", srv.URL, sysRole.ID), nil)
	assert.Equal(t, http.StatusConflict, resp.StatusCode)
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	decodeBody(t, resp, &body)
	assert.Equal(t, "conflict", body.Error.Code)
}

func TestRoleValidation(t *testing.T) {
	pool := testdb.New(t)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	srv := newTestServer(pool, adminID, &fakeInvalidator{})
	defer srv.Close()

	// Invalid code format.
	resp := doJSON(t, http.MethodPost, srv.URL+"/roles", role.CreateInput{Code: "Not Valid", Name: "X"})
	require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	var body struct {
		Error struct {
			Fields map[string]string `json:"fields"`
		} `json:"error"`
	}
	decodeBody(t, resp, &body)
	assert.Contains(t, body.Error.Fields, "code")

	// Unknown permission code.
	resp = doJSON(t, http.MethodPost, srv.URL+"/roles", role.CreateInput{
		Code: "weird_role", Name: "Weird", PermissionCodes: []string{"nope.manage"},
	})
	require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	decodeBody(t, resp, &body)
	assert.Contains(t, body.Error.Fields, "permission_codes")

	// Duplicate code -> 422 on the code field.
	resp = doJSON(t, http.MethodPost, srv.URL+"/roles", role.CreateInput{Code: "admin", Name: "Dup"})
	require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	decodeBody(t, resp, &body)
	assert.Contains(t, body.Error.Fields, "code")

	// Not found.
	resp = doJSON(t, http.MethodGet, srv.URL+"/roles/999999", nil)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	resp.Body.Close()
}

func TestListPermissions(t *testing.T) {
	pool := testdb.New(t)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	srv := newTestServer(pool, adminID, &fakeInvalidator{})
	defer srv.Close()

	resp := doJSON(t, http.MethodGet, srv.URL+"/permissions", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body struct {
		Data []dbgen.Permission `json:"data"`
	}
	decodeBody(t, resp, &body)
	assert.Len(t, body.Data, len(rbac.AllPermissions))
}

func permVersion(t *testing.T, pool *pgxpool.Pool, userID int64) int32 {
	t.Helper()
	var v int32
	require.NoError(t, pool.QueryRow(context.Background(), "SELECT perm_version FROM users WHERE id = $1", userID).Scan(&v))
	return v
}

func roleIDByCode(t *testing.T, pool *pgxpool.Pool, code string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(context.Background(), "SELECT id FROM roles WHERE code = $1", code).Scan(&id))
	return id
}

func assertAuditAction(t *testing.T, pool *pgxpool.Pool, action string, entityID int64) {
	t.Helper()
	var count int
	require.NoError(t, pool.QueryRow(context.Background(),
		"SELECT count(*) FROM audit_logs WHERE entity_type = 'role' AND action = $1 AND entity_id = $2",
		action, entityID,
	).Scan(&count))
	assert.GreaterOrEqual(t, count, 1)
}
