//go:build integration

package user_test

import (
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/testdb"
	"portal-berita/backend/internal/user"
)

// fakeInvalidator records Invalidate/InvalidateAll calls without needing
// Worker B's real rbac.Checker.
type fakeInvalidator struct {
	mu             sync.Mutex
	invalidated    []int64
	invalidatedAll bool
}

func (f *fakeInvalidator) Invalidate(id int64) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.invalidated = append(f.invalidated, id)
}

func (f *fakeInvalidator) InvalidateAll() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.invalidatedAll = true
}

func (f *fakeInvalidator) called(id int64) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, v := range f.invalidated {
		if v == id {
			return true
		}
	}
	return false
}

func newService(pool *pgxpool.Pool) (*user.Service, *fakeInvalidator) {
	inv := &fakeInvalidator{}
	return user.NewService(pool, audit.New(pool), inv, &revalidate.Recorder{}), inv
}

// newServiceWithReval is like newService but also returns the revalidate
// recorder, for tests asserting which tags a mutation enqueues.
func newServiceWithReval(pool *pgxpool.Pool) (*user.Service, *fakeInvalidator, *revalidate.Recorder) {
	inv := &fakeInvalidator{}
	rec := &revalidate.Recorder{}
	return user.NewService(pool, audit.New(pool), inv, rec), inv, rec
}

func actorWith(userID int64, codes ...string) user.Actor {
	return user.Actor{UserID: userID, Perms: rbac.NewSet(codes...), Meta: audit.Meta{UserID: &userID}}
}

func auditCount(t *testing.T, pool *pgxpool.Pool, action string, entityID int64) int64 {
	t.Helper()
	var n int64
	err := pool.QueryRow(context.Background(),
		`SELECT count(*) FROM audit_logs WHERE action = $1 AND entity_id = $2`, action, entityID).Scan(&n)
	require.NoError(t, err)
	return n
}

func ptr[T any](v T) *T { return &v }

func TestServiceCreateAuthorAndLoginUser(t *testing.T) {
	pool := testdb.New(t)
	svc, _ := newService(pool)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	actor := actorWith(adminID, rbac.PermUsersManage)
	ctx := context.Background()

	author, err := svc.Create(ctx, actor, user.CreateInput{DisplayName: "Penulis Tamu"})
	require.NoError(t, err)
	assert.False(t, author.CanLogin)
	assert.Nil(t, author.Email)
	assert.Equal(t, "penulis-tamu", author.Slug)
	assert.Equal(t, int64(1), auditCount(t, pool, "create", author.ID))

	login, err := svc.Create(ctx, actor, user.CreateInput{
		DisplayName: "Staf Admin", Email: ptr("staf@test.local"), Password: ptr("Password-Staf-1"),
		CanLogin: true, RoleIDs: []int64{roleID(t, pool, "admin")},
	})
	require.NoError(t, err)
	assert.True(t, login.CanLogin)
	require.Len(t, login.Roles, 1)
	assert.Equal(t, "admin", login.Roles[0].Code)
}

func TestServiceCreateDuplicateEmailAndSlug(t *testing.T) {
	pool := testdb.New(t)
	svc, _ := newService(pool)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	actor := actorWith(adminID, rbac.PermUsersManage)
	ctx := context.Background()

	_, err := svc.Create(ctx, actor, user.CreateInput{
		DisplayName: "Dupe", Email: ptr("dupe@test.local"), Password: ptr("Password-Dupe-1"), CanLogin: true,
	})
	require.NoError(t, err)

	_, err = svc.Create(ctx, actor, user.CreateInput{
		DisplayName: "Dupe Lagi", Email: ptr("dupe@test.local"), Password: ptr("Password-Dupe-2"), CanLogin: true,
	})
	var appErr *apperr.Error
	require.True(t, errors.As(err, &appErr))
	assert.True(t, errors.Is(err, apperr.ErrValidation))
	assert.Contains(t, appErr.Fields, "email")

	_, err = svc.Create(ctx, actor, user.CreateInput{DisplayName: "Slug Bentrok", Slug: ptr("slug-bentrok-uji")})
	require.NoError(t, err)
	_, err = svc.Create(ctx, actor, user.CreateInput{DisplayName: "Slug Bentrok Lain", Slug: ptr("slug-bentrok-uji")})
	require.True(t, errors.As(err, &appErr))
	assert.Contains(t, appErr.Fields, "slug")

	// An auto-derived slug (no Slug given) is suffixed on collision instead
	// of erroring, since the client did not ask for that exact value.
	again, err := svc.Create(ctx, actor, user.CreateInput{DisplayName: "Dupe"})
	require.NoError(t, err)
	assert.Equal(t, "dupe-2", again.Slug)
}

func TestServiceAuthorsOnlyActorRestrictions(t *testing.T) {
	pool := testdb.New(t)
	svc, _ := newService(pool)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	admin := actorWith(adminID, rbac.PermUsersManage)
	authorsOnly := actorWith(adminID, rbac.PermAuthorsManage)
	ctx := context.Background()

	loginUser := testdb.CreateUser(t, pool, testdb.UserOpts{
		Email: "loginuser@test.local", Password: "Password-Login-1", DisplayName: "Login User", CanLogin: true, IsActive: true,
	})

	// Cannot create a login user.
	_, err := svc.Create(ctx, authorsOnly, user.CreateInput{
		DisplayName: "X", Email: ptr("x@test.local"), Password: ptr("Password-X-12345"), CanLogin: true,
	})
	assert.True(t, errors.Is(err, apperr.ErrForbidden))

	// Can create an author.
	author, err := svc.Create(ctx, authorsOnly, user.CreateInput{DisplayName: "Penulis Baru"})
	require.NoError(t, err)

	// A users.manage actor can see the login user; authors.manage cannot.
	_, err = svc.Get(ctx, admin, loginUser)
	assert.NoError(t, err)
	_, err = svc.Get(ctx, authorsOnly, loginUser)
	assert.True(t, errors.Is(err, apperr.ErrForbidden))
	_, err = svc.Update(ctx, authorsOnly, loginUser, user.UpdateInput{DisplayName: "Renamed"})
	assert.True(t, errors.Is(err, apperr.ErrForbidden))

	// Can update the author's profile, but not grant it login.
	_, err = svc.Update(ctx, authorsOnly, author.ID, user.UpdateInput{
		DisplayName: "Penulis Baru", CanLogin: ptr(true),
	})
	assert.True(t, errors.Is(err, apperr.ErrForbidden))

	updated, err := svc.Update(ctx, authorsOnly, author.ID, user.UpdateInput{DisplayName: "Penulis Diperbarui"})
	require.NoError(t, err)
	assert.Equal(t, "Penulis Diperbarui", updated.DisplayName)

	// List forces can_login=false regardless of the requested filter.
	yes := true
	items, _, err := svc.List(ctx, authorsOnly, user.ListFilter{CanLogin: &yes, Page: page(1, 50)})
	require.NoError(t, err)
	for _, it := range items {
		assert.False(t, it.CanLogin)
	}
}

func TestServiceLastSuperAdminProtection(t *testing.T) {
	pool := testdb.New(t)
	svc, _ := newService(pool)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	other := actorWith(999999, rbac.PermUsersManage) // acting as a different super admin

	err := svc.SetActive(context.Background(), other, adminID, false)
	assert.True(t, errors.Is(err, apperr.ErrConflict), "expected conflict, got %v", err)

	_, err = svc.Update(context.Background(), other, adminID, user.UpdateInput{
		DisplayName: "Super Admin Uji", RoleIDs: []int64{roleID(t, pool, "admin")},
	})
	assert.True(t, errors.Is(err, apperr.ErrConflict), "expected conflict demoting last super admin, got %v", err)
}

func TestServiceSelfProtection(t *testing.T) {
	pool := testdb.New(t)
	svc, _ := newService(pool)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	self := actorWith(adminID, rbac.PermUsersManage)

	err := svc.SetActive(context.Background(), self, adminID, false)
	assert.True(t, errors.Is(err, apperr.ErrConflict))

	_, err = svc.Update(context.Background(), self, adminID, user.UpdateInput{
		DisplayName: "Super Admin Uji", IsActive: ptr(false),
	})
	assert.True(t, errors.Is(err, apperr.ErrConflict))

	// Changing only display_name for self is fine.
	_, err = svc.Update(context.Background(), self, adminID, user.UpdateInput{DisplayName: "Nama Baru"})
	assert.NoError(t, err)
}

func TestServiceUpdateEnqueuesAuthorRevalidation(t *testing.T) {
	pool := testdb.New(t)
	svc, _, rec := newServiceWithReval(pool)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	actor := actorWith(adminID, rbac.PermUsersManage)
	ctx := context.Background()

	author, err := svc.Create(ctx, actor, user.CreateInput{DisplayName: "Penulis Reval"})
	require.NoError(t, err)
	assert.Contains(t, rec.Tags(), revalidate.Author(author.Slug))
	rec.Reset()

	updated, err := svc.Update(ctx, actor, author.ID, user.UpdateInput{
		DisplayName: "Penulis Reval", Slug: ptr("penulis-reval-baru"),
	})
	require.NoError(t, err)
	tags := rec.Tags()
	assert.Contains(t, tags, revalidate.Author(updated.Slug))
	assert.Contains(t, tags, revalidate.Author(author.Slug))
	assert.Contains(t, tags, revalidate.TagHomepage)
	assert.Contains(t, tags, revalidate.TagSitemap)
	rec.Reset()

	// Changing only role_ids (no profile field) does not touch author tags.
	_, err = svc.Update(ctx, actor, author.ID, user.UpdateInput{
		DisplayName: "Penulis Reval", RoleIDs: []int64{},
	})
	require.NoError(t, err)
	assert.NotContains(t, rec.Tags(), revalidate.Author(updated.Slug))
}

func TestServiceResetPasswordRevokesSessions(t *testing.T) {
	pool := testdb.New(t)
	svc, _ := newService(pool)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	actor := actorWith(adminID, rbac.PermUsersManage)
	ctx := context.Background()

	target := testdb.CreateUser(t, pool, testdb.UserOpts{
		Email: "reset@test.local", Password: "Password-Reset-1", DisplayName: "Reset Target", CanLogin: true, IsActive: true,
	})
	insertRefreshToken(t, pool, target)

	err := svc.ResetPassword(ctx, actor, target, user.ResetPasswordInput{NewPassword: "Password-Baru-123"})
	require.NoError(t, err)
	assert.Equal(t, int64(0), activeSessionCount(t, pool, target))
	assert.Equal(t, int64(1), auditCount(t, pool, "reset_password", target))

	author := testdb.CreateUser(t, pool, testdb.UserOpts{DisplayName: "Non Login"})
	err = svc.ResetPassword(ctx, actor, author, user.ResetPasswordInput{NewPassword: "Password-Baru-123"})
	assert.True(t, errors.Is(err, apperr.ErrConflict))
}

func TestServiceLoginAuthorConversion(t *testing.T) {
	pool := testdb.New(t)
	svc, inv := newService(pool)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	actor := actorWith(adminID, rbac.PermUsersManage)
	ctx := context.Background()

	author, err := svc.Create(ctx, actor, user.CreateInput{DisplayName: "Calon Staf"})
	require.NoError(t, err)

	// Missing password/email -> validation error.
	_, err = svc.Update(ctx, actor, author.ID, user.UpdateInput{DisplayName: "Calon Staf", CanLogin: ptr(true)})
	assert.True(t, errors.Is(err, apperr.ErrValidation))

	loggedIn, err := svc.Update(ctx, actor, author.ID, user.UpdateInput{
		DisplayName: "Calon Staf", CanLogin: ptr(true), Email: ptr("calon@test.local"), Password: ptr("Password-Calon-1"),
	})
	require.NoError(t, err)
	assert.True(t, loggedIn.CanLogin)
	assert.True(t, inv.called(author.ID))

	insertRefreshToken(t, pool, author.ID)
	back, err := svc.Update(ctx, actor, author.ID, user.UpdateInput{DisplayName: "Calon Staf", CanLogin: ptr(false)})
	require.NoError(t, err)
	assert.False(t, back.CanLogin)
	assert.Nil(t, back.Email)
	assert.Empty(t, back.Roles)
	assert.Equal(t, int64(0), activeSessionCount(t, pool, author.ID))
}

// --- helpers ---

func page(p, per int) httpx.Pagination {
	return httpx.Pagination{Page: p, PerPage: per, Offset: (p - 1) * per}
}

func roleID(t *testing.T, pool *pgxpool.Pool, code string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(context.Background(), "SELECT id FROM roles WHERE code = $1", code).Scan(&id))
	return id
}

func insertRefreshToken(t *testing.T, pool *pgxpool.Pool, userID int64) {
	t.Helper()
	_, err := pool.Exec(context.Background(), `
		INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		VALUES ($1, decode(md5(random()::text), 'hex'), now() + interval '7 days')`, userID)
	require.NoError(t, err)
}

func activeSessionCount(t *testing.T, pool *pgxpool.Pool, userID int64) int64 {
	t.Helper()
	var n int64
	err := pool.QueryRow(context.Background(),
		`SELECT count(*) FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL`, userID).Scan(&n)
	require.NoError(t, err)
	return n
}
