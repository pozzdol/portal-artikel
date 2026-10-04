// Package migrate runs the embedded goose SQL migrations against a pgx pool.
package migrate

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"text/tabwriter"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/database"
	"github.com/pressly/goose/v3/lock"

	"portal-berita/backend/db/migrations"
)

// versionTable is the goose bookkeeping table name (unqualified).
const versionTable = "goose_db_version"

// newProvider builds a goose provider on top of the pool. The returned close
// function closes only the *sql.DB wrapper; the pool itself stays open.
//
// The version table is qualified with current_schema() because goose's
// Postgres existence check otherwise assumes schema "public", which breaks
// when the pool's search_path points elsewhere (e.g. integration tests).
func newProvider(ctx context.Context, pool *pgxpool.Pool) (*goose.Provider, error) {
	var schema string
	if err := pool.QueryRow(ctx, "SELECT current_schema()").Scan(&schema); err != nil {
		return nil, fmt.Errorf("migrate: resolve current schema: %w", err)
	}
	store, err := database.NewStore(database.DialectPostgres, schema+"."+versionTable)
	if err != nil {
		return nil, fmt.Errorf("migrate: create store: %w", err)
	}
	locker, err := lock.NewPostgresSessionLocker()
	if err != nil {
		return nil, fmt.Errorf("migrate: create session locker: %w", err)
	}
	db := stdlib.OpenDBFromPool(pool)
	p, err := goose.NewProvider("", db, migrations.FS,
		goose.WithStore(store),
		goose.WithSessionLocker(locker),
	)
	if err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate: create provider: %w", err)
	}
	return p, nil
}

// withProvider runs fn with a fresh provider and always closes the *sql.DB
// wrapper afterwards (closing it does not close the pgx pool).
func withProvider(ctx context.Context, pool *pgxpool.Pool, fn func(p *goose.Provider) error) (err error) {
	p, err := newProvider(ctx, pool)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := p.Close(); cerr != nil && !errors.Is(cerr, sql.ErrConnDone) && err == nil {
			err = fmt.Errorf("migrate: close provider: %w", cerr)
		}
	}()
	return fn(p)
}

func logResults(results []*goose.MigrationResult) {
	for _, r := range results {
		logResult(r)
	}
}

func logResult(r *goose.MigrationResult) {
	if r == nil || r.Source == nil {
		return
	}
	slog.Info("migration applied",
		"direction", r.Direction,
		"version", r.Source.Version,
		"source", r.Source.Path,
		"duration_ms", r.Duration.Milliseconds(),
	)
}

// Up applies all pending migrations.
func Up(ctx context.Context, pool *pgxpool.Pool) error {
	return withProvider(ctx, pool, func(p *goose.Provider) error {
		results, err := p.Up(ctx)
		logResults(results)
		if err != nil {
			return fmt.Errorf("migrate up: %w", err)
		}
		if len(results) == 0 {
			slog.Info("no pending migrations")
		}
		return nil
	})
}

// Down rolls back the most recently applied migration (one step).
func Down(ctx context.Context, pool *pgxpool.Pool) error {
	return withProvider(ctx, pool, func(p *goose.Provider) error {
		result, err := p.Down(ctx)
		logResult(result)
		if err != nil {
			if errors.Is(err, goose.ErrNoNextVersion) {
				slog.Info("no migration to roll back")
				return nil
			}
			return fmt.Errorf("migrate down: %w", err)
		}
		return nil
	})
}

// Reset rolls back every applied migration (down to version 0).
func Reset(ctx context.Context, pool *pgxpool.Pool) error {
	return withProvider(ctx, pool, func(p *goose.Provider) error {
		results, err := p.DownTo(ctx, 0)
		logResults(results)
		if err != nil {
			return fmt.Errorf("migrate reset: %w", err)
		}
		return nil
	})
}

// DownTo0 is an alias of Reset.
func DownTo0(ctx context.Context, pool *pgxpool.Pool) error { return Reset(ctx, pool) }

// Status writes one line per known migration: version, applied time or
// "pending", and source file.
func Status(ctx context.Context, pool *pgxpool.Pool, w io.Writer) error {
	return withProvider(ctx, pool, func(p *goose.Provider) error {
		statuses, err := p.Status(ctx)
		if err != nil {
			return fmt.Errorf("migrate status: %w", err)
		}
		tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
		fmt.Fprintln(tw, "VERSION\tAPPLIED AT (UTC)\tSOURCE")
		for _, s := range statuses {
			applied := "pending"
			if s.State == goose.StateApplied {
				applied = s.AppliedAt.UTC().Format(time.DateTime)
			}
			fmt.Fprintf(tw, "%05d\t%s\t%s\n", s.Source.Version, applied, s.Source.Path)
		}
		return tw.Flush()
	})
}

// Version returns the current database migration version (0 if none).
func Version(ctx context.Context, pool *pgxpool.Pool) (int64, error) {
	var v int64
	err := withProvider(ctx, pool, func(p *goose.Provider) error {
		var err error
		v, err = p.GetDBVersion(ctx)
		if err != nil {
			return fmt.Errorf("migrate version: %w", err)
		}
		return nil
	})
	return v, err
}
