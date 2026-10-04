package main

import (
	"context"
	"errors"
	"fmt"
	"os"

	"portal-berita/backend/internal/migrate"
)

func init() {
	register(Command{
		Name:  "migrate",
		Usage: "migrate up|down|status|reset|version",
		Run:   runMigrate,
	})
}

func runMigrate(ctx context.Context, env *Env, args []string) error {
	if len(args) != 1 {
		return errors.New("penggunaan: migrate up|down|status|reset|version")
	}
	switch args[0] {
	case "up":
		return migrate.Up(ctx, env.Pool)
	case "down":
		return migrate.Down(ctx, env.Pool)
	case "status":
		return migrate.Status(ctx, env.Pool, os.Stdout)
	case "reset":
		if !env.Cfg.IsDevelopment() {
			return errors.New("reset hanya diizinkan pada APP_ENV=development")
		}
		env.Log.Warn("resetting all migrations")
		return migrate.Reset(ctx, env.Pool)
	case "version":
		v, err := migrate.Version(ctx, env.Pool)
		if err != nil {
			return err
		}
		fmt.Println(v)
		return nil
	default:
		return fmt.Errorf("subperintah migrate tidak dikenal: %q (gunakan up|down|status|reset|version)", args[0])
	}
}
