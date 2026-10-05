//go:build integration

package testdb

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/auth"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/dbgen"
)

func TestNewAndSuperAdmin(t *testing.T) {
	pool := New(t)
	ctx := context.Background()
	q := dbgen.New(pool)

	var schema string
	require.NoError(t, pool.QueryRow(ctx, "SELECT current_schema()").Scan(&schema))
	assert.Regexp(t, `^portal_test_[0-9a-f]{12}$`, schema)

	id, email, password := SuperAdmin(t, pool)
	u, err := q.GetUserByEmail(ctx, email)
	require.NoError(t, err)
	assert.Equal(t, id, u.ID)
	require.NotNil(t, u.PasswordHash)
	ok, err := auth.VerifyPassword(password, *u.PasswordHash)
	require.NoError(t, err)
	assert.True(t, ok)

	perms, err := q.ListUserPermissionCodes(ctx, id)
	require.NoError(t, err)
	assert.Len(t, perms, 22)

	roles, err := q.ListUserRoles(ctx, id)
	require.NoError(t, err)
	require.Len(t, roles, 1)
	assert.Equal(t, "super_admin", roles[0].Code)

	n, err := q.CountActiveSuperAdminsExcept(ctx, 0)
	require.NoError(t, err)
	assert.EqualValues(t, 1, n)
	n, err = q.CountActiveSuperAdminsExcept(ctx, id)
	require.NoError(t, err)
	assert.EqualValues(t, 0, n)

	author := CreateUser(t, pool, UserOpts{DisplayName: "Penulis Tamu", IsActive: true})
	a, err := q.GetUserByID(ctx, author)
	require.NoError(t, err)
	assert.Nil(t, a.Email)
	assert.Nil(t, a.Phone)
	assert.False(t, a.CanLogin)
	assert.False(t, a.MustChangePassword)

	// A login user may be identified by phone only.
	phoneUser := CreateUser(t, pool, UserOpts{
		Phone: "8123456789", Password: "12345678", DisplayName: "Pengguna HP",
		CanLogin: true, IsActive: true, MustChangePassword: true,
	})
	p, err := q.GetUserByPhone(ctx, "8123456789")
	require.NoError(t, err)
	assert.Equal(t, phoneUser, p.ID)
	assert.True(t, p.MustChangePassword)
	acc, err := q.GetUserAccess(ctx, phoneUser)
	require.NoError(t, err)
	assert.True(t, acc.MustChangePassword)
	require.NoError(t, q.UpdateUserPassword(ctx, dbgen.UpdateUserPasswordParams{ID: phoneUser, PasswordHash: p.PasswordHash, MustChangePassword: false}))
	acc, err = q.GetUserAccess(ctx, phoneUser)
	require.NoError(t, err)
	assert.False(t, acc.MustChangePassword)
	qs := "812345"
	found, err := q.ListUsers(ctx, dbgen.ListUsersParams{Q: &qs, Limit: 10})
	require.NoError(t, err)
	require.Len(t, found, 1)
	assert.Equal(t, phoneUser, found[0].ID)
	require.NoError(t, q.ClearUserCredentials(ctx, phoneUser))
	p2, err := q.GetUserByID(ctx, phoneUser)
	require.NoError(t, err)
	assert.Nil(t, p2.Phone)
	assert.False(t, p2.CanLogin)
}

// TestConstraintNames pins the constraint names services map to field errors.
func TestConstraintNames(t *testing.T) {
	pool := New(t)
	ctx := context.Background()
	q := dbgen.New(pool)
	SuperAdmin(t, pool)

	email := SuperAdminEmail
	_, err := q.CreateUser(ctx, dbgen.CreateUserParams{Email: &email, DisplayName: "X", Slug: "x-1", IsActive: true})
	c, ok := database.UniqueViolation(err)
	require.True(t, ok, "%v", err)
	assert.Equal(t, "users_email_key", c)

	_, err = q.CreateUser(ctx, dbgen.CreateUserParams{DisplayName: "X", Slug: "super-admin-uji", IsActive: true})
	c, ok = database.UniqueViolation(err)
	require.True(t, ok, "%v", err)
	assert.Equal(t, "users_slug_key", c)

	phone := "8123456789"
	CreateUser(t, pool, UserOpts{Phone: phone, DisplayName: "Pemilik HP", IsActive: true})
	_, err = q.CreateUser(ctx, dbgen.CreateUserParams{Phone: &phone, DisplayName: "Z", Slug: "z-1", IsActive: true})
	c, ok = database.UniqueViolation(err)
	require.True(t, ok, "%v", err)
	assert.Equal(t, "users_phone_key", c)

	bad := "08123456789" // not normalized
	_, err = q.CreateUser(ctx, dbgen.CreateUserParams{Phone: &bad, DisplayName: "B", Slug: "b-1", IsActive: true})
	c, ok = database.CheckViolation(err)
	require.True(t, ok, "%v", err)
	assert.Equal(t, "users_phone_format", c)

	hash := HashPassword(t, "Kata-Sandi-Awal")
	_, err = q.CreateUser(ctx, dbgen.CreateUserParams{PasswordHash: &hash, DisplayName: "L", Slug: "l-1", CanLogin: true, IsActive: true})
	c, ok = database.CheckViolation(err)
	require.True(t, ok, "%v", err)
	assert.Equal(t, "users_login_requires_credentials", c)

	_, err = q.CreateRole(ctx, dbgen.CreateRoleParams{Code: "admin", Name: "Dup"})
	c, ok = database.UniqueViolation(err)
	require.True(t, ok, "%v", err)
	assert.Equal(t, "roles_code_key", c)

	media := int64(999999)
	_, err = q.CreateUser(ctx, dbgen.CreateUserParams{DisplayName: "Y", Slug: "y-1", AvatarMediaID: &media, IsActive: true})
	c, ok = database.ForeignKeyViolation(err)
	require.True(t, ok, "%v", err)
	assert.Equal(t, "users_avatar_media_id_fkey", c)

	_, ok = database.UniqueViolation(err)
	assert.False(t, ok)
}

// TestQueriesSmoke executes the Fase 2 queries once against a real schema.
func TestQueriesSmoke(t *testing.T) {
	pool := New(t)
	ctx := context.Background()
	q := dbgen.New(pool)
	id, _, _ := SuperAdmin(t, pool)
	CreateUser(t, pool, UserOpts{DisplayName: "Penulis Tamu", IsActive: true})

	qs := "super"
	yes := true
	users, err := q.ListUsers(ctx, dbgen.ListUsersParams{Q: &qs, CanLogin: &yes, Limit: 10})
	require.NoError(t, err)
	require.Len(t, users, 1)
	role := "super_admin"
	n, err := q.CountUsersFiltered(ctx, dbgen.CountUsersFilteredParams{RoleCode: &role})
	require.NoError(t, err)
	assert.EqualValues(t, 1, n)
	n, err = q.CountUsersFiltered(ctx, dbgen.CountUsersFilteredParams{})
	require.NoError(t, err)
	assert.EqualValues(t, 2, n)
	byIDs, err := q.ListUserRolesByUserIDs(ctx, []int64{id})
	require.NoError(t, err)
	require.Len(t, byIDs, 1)

	pv, err := q.BumpUserPermVersion(ctx, id)
	require.NoError(t, err)
	assert.EqualValues(t, 2, pv)

	exp := time.Now().Add(time.Hour)
	rt, err := q.CreateRefreshToken(ctx, dbgen.CreateRefreshTokenParams{UserID: id, TokenHash: []byte("h1"), ExpiresAt: exp})
	require.NoError(t, err)
	require.True(t, rt.FamilyID.Valid)
	rt2, err := q.CreateRefreshToken(ctx, dbgen.CreateRefreshTokenParams{UserID: id, FamilyID: rt.FamilyID, TokenHash: []byte("h2"), ExpiresAt: rt.ExpiresAt})
	require.NoError(t, err)
	assert.Equal(t, rt.FamilyID, rt2.FamilyID)
	require.NoError(t, q.MarkRefreshTokenRotated(ctx, rt.ID))
	sessions, err := q.ListActiveSessions(ctx, id)
	require.NoError(t, err)
	require.Len(t, sessions, 1)
	assert.False(t, sessions[0].StartedAt.After(sessions[0].LastUsedAt))

	tx, err := pool.Begin(ctx)
	require.NoError(t, err)
	row, err := dbgen.New(tx).GetRefreshTokenByHashForUpdate(ctx, []byte("h1"))
	require.NoError(t, err)
	assert.NotNil(t, row.RotatedAt)
	assert.EqualValues(t, 2, row.PermVersion)
	require.NoError(t, tx.Rollback(ctx))

	revoked, err := q.RevokeRefreshTokenFamily(ctx, rt.FamilyID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, revoked)
	_, err = q.DeleteExpiredRefreshTokens(ctx)
	require.NoError(t, err)

	roles, err := q.ListRoles(ctx)
	require.NoError(t, err)
	require.Len(t, roles, 2)
	perms, err := q.ListPermissionsByCodes(ctx, []string{"audit.view", "nope.nope"})
	require.NoError(t, err)
	require.Len(t, perms, 1)
	r, err := q.CreateRole(ctx, dbgen.CreateRoleParams{Code: "editor", Name: "Editor"})
	require.NoError(t, err)
	require.NoError(t, q.AddRolePermissions(ctx, dbgen.AddRolePermissionsParams{RoleID: r.ID, PermissionIds: []int64{perms[0].ID}}))
	codes, err := q.ListRolePermissionCodes(ctx, r.ID)
	require.NoError(t, err)
	assert.Equal(t, []string{"audit.view"}, codes)
	require.NoError(t, q.BumpPermVersionByRole(ctx, r.ID))
	deleted, err := q.DeleteRole(ctx, r.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 1, deleted)

	require.NoError(t, q.InsertAuditLog(ctx, dbgen.InsertAuditLogParams{UserID: &id, Action: "login", EntityType: "user", EntityID: &id, Summary: "Masuk", Changes: []byte(`{"a":1}`)}))
	action := "login"
	logs, err := q.ListAuditLogs(ctx, dbgen.ListAuditLogsParams{Action: &action, Limit: 10})
	require.NoError(t, err)
	require.Len(t, logs, 1)
	require.NotNil(t, logs[0].UserDisplayName)
	from := time.Now().Add(-time.Hour)
	n, err = q.CountAuditLogs(ctx, dbgen.CountAuditLogsParams{From: &from, UserID: &id})
	require.NoError(t, err)
	assert.EqualValues(t, 1, n)
}
