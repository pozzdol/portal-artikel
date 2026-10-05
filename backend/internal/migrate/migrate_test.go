//go:build integration

package migrate

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

// TestUpDownUp applies all migrations in a throwaway schema, resets them,
// applies them again and finally drops the schema.
func TestUpDownUp(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	buf := make([]byte, 6)
	_, err := rand.Read(buf)
	require.NoError(t, err)
	schema := "portal_mig_" + hex.EncodeToString(buf)

	admin, err := pgxpool.New(ctx, dsn)
	require.NoError(t, err)
	_, err = admin.Exec(ctx, "CREATE SCHEMA "+schema)
	require.NoError(t, err)
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), time.Minute)
		defer ccancel()
		if _, err := admin.Exec(cctx, "DROP SCHEMA IF EXISTS "+schema+" CASCADE"); err != nil {
			t.Errorf("drop schema %s: %v", schema, err)
		}
		admin.Close()
	})

	cfg, err := pgxpool.ParseConfig(dsn)
	require.NoError(t, err)
	// public stays on the path so extension types/operators (citext, gin_trgm_ops) resolve.
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	cfg.ConnConfig.RuntimeParams["timezone"] = "UTC"
	cfg.MaxConns = 4
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	require.NoError(t, err)
	defer pool.Close()

	countTables := func() int {
		var n int
		require.NoError(t, pool.QueryRow(ctx,
			`SELECT count(*) FROM information_schema.tables WHERE table_schema = $1`, schema).Scan(&n))
		return n
	}
	countRows := func(table string) int {
		var n int
		require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM "+table).Scan(&n))
		return n
	}

	// Up: 24 tables + goose_db_version.
	require.NoError(t, Up(ctx, pool))
	require.Equal(t, 25, countTables())
	require.Equal(t, 22, countRows("permissions"))
	require.Equal(t, 2, countRows("roles"))
	var adminPerms int
	require.NoError(t, pool.QueryRow(ctx, `SELECT count(*) FROM role_permissions rp
		JOIN roles r ON r.id = rp.role_id WHERE r.code = 'admin'`).Scan(&adminPerms))
	require.Equal(t, 18, adminPerms)
	require.Equal(t, 40, countRows("role_permissions"))

	v, err := Version(ctx, pool)
	require.NoError(t, err)
	require.EqualValues(t, 12, v)

	var status bytes.Buffer
	require.NoError(t, Status(ctx, pool, &status))
	require.Contains(t, status.String(), "00012_users_phone.sql")
	require.NotContains(t, status.String(), "pending")

	// Smoke-test constraints and the search_vector trigger.
	_, err = pool.Exec(ctx, `INSERT INTO categories (name, slug) VALUES ('Agenda', 'agenda')`)
	require.Error(t, err, "reserved level-1 slug must be rejected")
	var userID, catID int64
	require.NoError(t, pool.QueryRow(ctx,
		`INSERT INTO users (display_name, slug) VALUES ('Penulis', 'penulis-uji') RETURNING id`).Scan(&userID))
	require.NoError(t, pool.QueryRow(ctx,
		`INSERT INTO categories (name, slug) VALUES ('Kajian', 'kajian') RETURNING id`).Scan(&catID))
	var sv string
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO articles (title, slug, category_id, author_id, content_text)
		VALUES ('Menjaga Keikhlasan', 'menjaga-keikhlasan', $1, $2, 'Café niat') RETURNING search_vector::text`,
		catID, userID).Scan(&sv))
	require.True(t, strings.Contains(sv, "'menjaga':1A") && strings.Contains(sv, "'cafe'"), sv)

	// Reset: only goose_db_version remains.
	require.NoError(t, Reset(ctx, pool))
	require.Equal(t, 1, countTables())
	v, err = Version(ctx, pool)
	require.NoError(t, err)
	require.EqualValues(t, 0, v)

	// Up again.
	require.NoError(t, Up(ctx, pool))
	require.Equal(t, 25, countTables())
	require.Equal(t, 22, countRows("permissions"))

	// One step down (00012 drops users.phone) and back up.
	hasPhone := func() bool {
		var ok bool
		require.NoError(t, pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM information_schema.columns
			WHERE table_schema = $1 AND table_name = 'users' AND column_name = 'phone')`, schema).Scan(&ok))
		return ok
	}
	require.NoError(t, Down(ctx, pool))
	require.False(t, hasPhone())
	v, err = Version(ctx, pool)
	require.NoError(t, err)
	require.EqualValues(t, 11, v)
	require.NoError(t, Up(ctx, pool))
	require.True(t, hasPhone())
	require.Equal(t, 22, countRows("permissions"))
}
