//go:build integration

package rbac_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/authctx"
	"portal-berita/backend/internal/rbac"
	"portal-berita/backend/internal/testdb"
)

func TestCheckerDB(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	id, _, _ := testdb.SuperAdmin(t, pool)
	author := testdb.CreateUser(t, pool, testdb.UserOpts{DisplayName: "Penulis Uji", IsActive: true})

	c := rbac.NewChecker(pool, time.Minute)
	p := authctx.Principal{UserID: id, PermVersion: 1}
	var pv int32
	require.NoError(t, pool.QueryRow(ctx, "SELECT perm_version FROM users WHERE id=$1", id).Scan(&pv))
	p.PermVersion = pv

	a, err := c.Access(ctx, p)
	require.NoError(t, err)
	assert.Equal(t, rbac.AllPermissions, a.Perms.Codes())
	assert.Len(t, a.Perms, 22)

	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	h := c.Guard()(rbac.PermRolesManage)(ok)
	do := func(p authctx.Principal) int {
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req = req.WithContext(authctx.WithPrincipal(req.Context(), p))
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	assert.Equal(t, http.StatusNoContent, do(p))

	// Author (can_login=false) is rejected.
	_, err = c.Access(ctx, authctx.Principal{UserID: author, PermVersion: pv})
	assert.ErrorIs(t, err, apperr.ErrUnauthenticated)

	// Unknown user.
	_, err = c.Access(ctx, authctx.Principal{UserID: 1 << 40, PermVersion: 1})
	assert.ErrorIs(t, err, apperr.ErrUnauthenticated)

	// Perm version bump → old token gets token_expired.
	_, err = pool.Exec(ctx, "UPDATE users SET perm_version = perm_version + 1 WHERE id=$1", id)
	require.NoError(t, err)
	_, err = c.Access(ctx, p)
	require.NoError(t, err, "fresh cache entry still matches the old token")
	c.Invalidate(id) // services invalidate alongside BumpUserPermVersion
	_, err = c.Access(ctx, p)
	assert.ErrorIs(t, err, apperr.ErrTokenExpired)
	p.PermVersion++
	_, err = c.Access(ctx, p)
	require.NoError(t, err)

	// Deactivate → cached until invalidated, then 401.
	_, err = pool.Exec(ctx, "UPDATE users SET is_active = false WHERE id=$1", id)
	require.NoError(t, err)
	assert.Equal(t, http.StatusNoContent, do(p))
	c.Invalidate(id)
	assert.Equal(t, http.StatusUnauthorized, do(p))
}
