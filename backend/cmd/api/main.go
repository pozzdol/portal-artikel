// Command api runs the ALMAIDAH HTTP API.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	_ "time/tzdata" // embed tz database so Asia/Jakarta always resolves

	"golang.org/x/sync/errgroup"

	"portal-berita/backend/internal/config"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/jobs"
	"portal-berita/backend/internal/logging"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/server"
)

func main() {
	if err := run(); err != nil {
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return err
	}
	log := logging.New(cfg.AppEnv, cfg.LogLevel)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := database.NewPool(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		log.Error("database connection failed", "error", err)
		return err
	}
	defer pool.Close()

	// One revalidate worker shared by every service; it flushes pending tags
	// (bounded by its shutdown timeout) when ctx ends.
	reval := revalidate.NewWorker(cfg.NextRevalidateURL, cfg.RevalidateSecret, log)
	app := server.NewApp(server.Deps{Cfg: cfg, Pool: pool, Log: log, Reval: reval})
	runner := jobs.NewRunner(log, app.Jobs...)

	// The HTTP server, job runner and revalidate worker stop together: a
	// signal (or a fatal server error) cancels gctx, the server drains, the
	// runner waits for in-flight jobs and the worker flushes its queue. The
	// pool is closed (deferred) only after all three returned.
	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		reval.Run(gctx)
		return nil
	})
	g.Go(func() error {
		runner.Run(gctx)
		return nil
	})
	g.Go(func() error {
		if err := server.Run(gctx, cfg, app.Handler, log); err != nil {
			return fmt.Errorf("http server: %w", err)
		}
		// Returning nil after a clean shutdown; make sure siblings stop even
		// if the server exited without a signal.
		stop()
		return nil
	})
	if err := g.Wait(); err != nil {
		log.Error("server error", "error", err)
		return err
	}
	log.Info("shutdown complete")
	return nil
}
