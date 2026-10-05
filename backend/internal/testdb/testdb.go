//go:build integration

// Package testdb provisions throwaway, fully migrated PostgreSQL schemas for
// integration tests. It needs TEST_DATABASE_URL and never touches the public
// schema's data.
//
// It deliberately imports neither auth nor rbac, so in-package integration
// tests of those packages can use it without an import cycle.
package testdb

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/argon2"

	"portal-berita/backend/db/seed"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/migrate"
)

// Default super admin credentials created by SuperAdmin.
const (
	SuperAdminEmail    = "admin@test.local"
	SuperAdminPassword = "Password-Uji-123"
)

// New creates schema portal_test_<hex12>, applies all migrations there and
// returns a pool whose search_path is "<schema>,public". The schema is dropped
// on test cleanup. Skips the test when TEST_DATABASE_URL is unset.
func New(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	buf := make([]byte, 6)
	if _, err := rand.Read(buf); err != nil {
		t.Fatalf("testdb: random schema name: %v", err)
	}
	schema := "portal_test_" + hex.EncodeToString(buf)

	adminCfg, err := poolConfig(dsn)
	if err != nil {
		t.Fatalf("testdb: parse dsn: %v", err)
	}
	adminCfg.MaxConns = 2
	admin, err := pgxpool.NewWithConfig(ctx, adminCfg)
	if err != nil {
		t.Fatalf("testdb: connect: %v", err)
	}
	// The DB is remote: fail fast with a clear message on a transient network
	// problem instead of hanging, but tolerate a blip before the schema exists.
	if err := pingWithRetry(ctx, admin); err != nil {
		admin.Close()
		t.Fatalf("testdb: ping (schema %s not created): %v", schema, err)
	}
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		admin.Close()
		t.Fatalf("testdb: create schema %s: %v", schema, err)
	}

	cfg, err := poolConfig(dsn)
	if err != nil {
		admin.Close()
		t.Fatalf("testdb: parse dsn: %v", err)
	}
	// public stays on the path so extension types/operators (citext, pg_trgm) resolve.
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	cfg.MaxConns = 4
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatalf("testdb: create pool for schema %s: %v", schema, err)
	}

	// Registered first so it runs last (after test-registered cleanups).
	t.Cleanup(func() {
		pool.Close()
		cctx, ccancel := context.WithTimeout(context.Background(), time.Minute)
		defer ccancel()
		if _, err := admin.Exec(cctx, "DROP SCHEMA IF EXISTS "+schema+" CASCADE"); err != nil {
			t.Errorf("testdb: drop schema %s: %v", schema, err)
		}
		admin.Close()
	})

	if err := migrate.Up(ctx, pool); err != nil {
		t.Fatalf("testdb: migrate up (schema %s): %v", schema, err)
	}
	return pool
}

// poolConfig parses dsn with settings suited to the shared remote test DB:
// UTC sessions, a bounded connect timeout and periodic health checks.
func poolConfig(dsn string) (*pgxpool.Config, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	cfg.ConnConfig.RuntimeParams["timezone"] = "UTC"
	cfg.ConnConfig.ConnectTimeout = 15 * time.Second
	cfg.HealthCheckPeriod = 30 * time.Second
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute
	return cfg, nil
}

// pingWithRetry pings pool up to four times (backoff 500 ms, 1 s, 2 s). It is
// used only before any state is created, so a retry cannot mask a test failure.
func pingWithRetry(ctx context.Context, pool *pgxpool.Pool) error {
	var err error
	for _, wait := range []time.Duration{500 * time.Millisecond, time.Second, 2 * time.Second, 0} {
		pctx, cancel := context.WithTimeout(ctx, 20*time.Second)
		err = pool.Ping(pctx)
		cancel()
		if err == nil || wait == 0 {
			break
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("%w (last error: %v)", ctx.Err(), err)
		case <-time.After(wait):
		}
	}
	return err
}

// SeedBase runs the base seed (categories, settings, menus, pages, homepage
// sections, brand logo media row) into pool's schema.
func SeedBase(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	runSeed(t, pool, seed.Options{Base: true})
}

// SeedDemo runs the demo seed (authors, tags, 21 articles, views, events,
// alumni, videos, snippets) relative to now. Call SeedBase first.
func SeedDemo(t *testing.T, pool *pgxpool.Pool, now time.Time) {
	t.Helper()
	runSeed(t, pool, seed.Options{Demo: true, Now: now})
}

func runSeed(t *testing.T, pool *pgxpool.Pool, opts seed.Options) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	// The brand logo is absent in the temp dir; the seed then stores unknown dimensions.
	opts.UploadDir = t.TempDir()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	if err := seed.Run(ctx, pool, log, opts); err != nil {
		t.Fatalf("testdb: seed: %v", err)
	}
}

// Exec runs a raw SQL statement (test fixtures, time travel) and fails the
// test on error.
func Exec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("testdb: exec %q: %v", sql, err)
	}
}

// UserOpts describes a user to create. Empty Slug derives one from
// DisplayName; empty DisplayName defaults to "Pengguna Uji". Email, Phone and
// Password are only stored when non-empty; Phone must already be normalized
// (e.g. "8123456789"). Roles are role codes (e.g. "super_admin").
type UserOpts struct {
	Email, Phone, Password, DisplayName, Slug string
	CanLogin, IsActive, MustChangePassword    bool
	Roles                                     []string
}

// CreateUser inserts a user (and its roles) and returns its id.
func CreateUser(t *testing.T, pool *pgxpool.Pool, o UserOpts) int64 {
	t.Helper()
	ctx := context.Background()
	if o.DisplayName == "" {
		o.DisplayName = "Pengguna Uji"
	}
	if o.Slug == "" {
		o.Slug = slugify(o.DisplayName) + "-" + randHex(t, 3)
	}
	var email, phone, hash *string
	if o.Email != "" {
		email = &o.Email
	}
	if o.Phone != "" {
		phone = &o.Phone
	}
	if o.Password != "" {
		h := HashPassword(t, o.Password)
		hash = &h
	}
	q := dbgen.New(pool)
	u, err := q.CreateUser(ctx, dbgen.CreateUserParams{
		Email:              email,
		Phone:              phone,
		PasswordHash:       hash,
		DisplayName:        o.DisplayName,
		Slug:               o.Slug,
		CanLogin:           o.CanLogin,
		IsActive:           o.IsActive,
		MustChangePassword: o.MustChangePassword,
	})
	if err != nil {
		t.Fatalf("testdb: create user %q: %v", o.DisplayName, err)
	}
	if len(o.Roles) > 0 {
		ids := make([]int64, 0, len(o.Roles))
		for _, code := range o.Roles {
			var id int64
			if err := pool.QueryRow(ctx, "SELECT id FROM roles WHERE code = $1", code).Scan(&id); err != nil {
				t.Fatalf("testdb: role %q: %v", code, err)
			}
			ids = append(ids, id)
		}
		if err := q.AddUserRoles(ctx, dbgen.AddUserRolesParams{UserID: u.ID, RoleIds: ids}); err != nil {
			t.Fatalf("testdb: add roles: %v", err)
		}
	}
	return u.ID
}

// SuperAdmin creates an active login user with role super_admin and returns
// its id and credentials (SuperAdminEmail / SuperAdminPassword).
func SuperAdmin(t *testing.T, pool *pgxpool.Pool) (id int64, email, password string) {
	t.Helper()
	id = CreateUser(t, pool, UserOpts{
		Email:       SuperAdminEmail,
		Password:    SuperAdminPassword,
		DisplayName: "Super Admin Uji",
		Slug:        "super-admin-uji",
		CanLogin:    true,
		IsActive:    true,
		Roles:       []string{"super_admin"},
	})
	return id, SuperAdminEmail, SuperAdminPassword
}

// HashPassword returns an argon2id PHC hash accepted by auth.VerifyPassword,
// using deliberately cheap parameters to keep tests fast.
func HashPassword(t *testing.T, password string) string {
	t.Helper()
	const (
		mem     uint32 = 8 * 1024
		iters   uint32 = 1
		threads uint8  = 1
	)
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		t.Fatalf("testdb: salt: %v", err)
	}
	key := argon2.IDKey([]byte(password), salt, iters, mem, threads, 32)
	b64 := base64.RawStdEncoding
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, mem, iters, threads, b64.EncodeToString(salt), b64.EncodeToString(key))
}

func randHex(t *testing.T, n int) string {
	t.Helper()
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		t.Fatalf("testdb: random: %v", err)
	}
	return hex.EncodeToString(b)
}

func slugify(s string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(s) {
		switch {
		case r >= 'a' && r <= 'z' || r >= '0' && r <= '9':
			b.WriteRune(r)
			dash = false
		case b.Len() > 0 && !dash:
			b.WriteByte('-')
			dash = true
		}
	}
	out := strings.TrimSuffix(b.String(), "-")
	if out == "" {
		out = "user"
	}
	return out
}
