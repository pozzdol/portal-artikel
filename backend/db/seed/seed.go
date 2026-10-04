// Package seed inserts default structure (--base) and sample content (--demo).
//
// Both modes are idempotent: base only ensures defaults exist (never overwrites
// admin edits); demo upserts sample content by slug so re-running refreshes it.
package seed

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Options selects the seed modes.
type Options struct {
	Base, Demo bool
	Now        time.Time // reference time for relative demo dates
	UploadDir  string    // used to read brand/logo.png dimensions
}

// Run executes the selected seed modes, each inside its own transaction.
func Run(ctx context.Context, pool *pgxpool.Pool, log *slog.Logger, opts Options) error {
	if !opts.Base && !opts.Demo {
		return errors.New("seed: pilih minimal satu mode (--base atau --demo)")
	}
	if opts.Now.IsZero() {
		opts.Now = time.Now()
	}
	if opts.Base {
		start := time.Now()
		if err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error { return runBase(ctx, tx, opts) }); err != nil {
			return fmt.Errorf("seed base: %w", err)
		}
		log.Info("seed base selesai", "duration", time.Since(start).Round(time.Millisecond))
		logCounts(ctx, pool, log, baseTables)
	}
	if opts.Demo {
		start := time.Now()
		if err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error { return runDemo(ctx, tx, opts) }); err != nil {
			return fmt.Errorf("seed demo: %w", err)
		}
		log.Info("seed demo selesai", "duration", time.Since(start).Round(time.Millisecond))
		logCounts(ctx, pool, log, demoTables)
	}
	return nil
}

var baseTables = []string{"categories", "media", "site_settings", "menus", "menu_items", "pages", "homepage_sections"}

var demoTables = []string{"users", "tags", "articles", "article_tags", "article_views_daily", "events", "alumni_profiles", "videos", "snippets"}

func logCounts(ctx context.Context, pool *pgxpool.Pool, log *slog.Logger, tables []string) {
	for _, t := range tables {
		var n int64
		// Table names come from the fixed lists above, never from input.
		if err := pool.QueryRow(ctx, "SELECT count(*) FROM "+pgx.Identifier{t}.Sanitize()).Scan(&n); err != nil {
			log.Warn("gagal menghitung baris", "table", t, "error", err)
			continue
		}
		log.Info("jumlah baris", "table", t, "rows", n)
	}
}
