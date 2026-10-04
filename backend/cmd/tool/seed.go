package main

import (
	"context"
	"errors"
	"flag"
	"io"
	"time"

	"portal-berita/backend/db/seed"
	"portal-berita/backend/internal/config"
)

func init() {
	register(Command{
		Name:  "seed",
		Usage: "seed [--base] [--demo] [--force]  (isi struktur dasar dan/atau konten contoh)",
		Run:   runSeed,
	})
}

func runSeed(ctx context.Context, env *Env, args []string) error {
	fs := flag.NewFlagSet("seed", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	base := fs.Bool("base", false, "menu, pengaturan situs, kategori, homepage sections, halaman statis")
	demo := fs.Bool("demo", false, "konten contoh (penulis, artikel, agenda, tokoh, video, snippet)")
	force := fs.Bool("force", false, "izinkan --demo pada APP_ENV=production")
	if err := fs.Parse(args); err != nil {
		return errors.New("penggunaan: seed [--base] [--demo] [--force]")
	}
	if fs.NArg() > 0 {
		return errors.New("penggunaan: seed [--base] [--demo] [--force]")
	}
	if !*base && !*demo {
		return errors.New("pilih minimal satu: --base dan/atau --demo")
	}
	if *demo && env.Cfg.AppEnv == config.EnvProduction && !*force {
		return errors.New("--demo ditolak pada APP_ENV=production (tambahkan --force bila benar-benar disengaja)")
	}
	return seed.Run(ctx, env.Pool, env.Log, seed.Options{
		Base:      *base,
		Demo:      *demo,
		Now:       time.Now(),
		UploadDir: env.Cfg.UploadDir,
	})
}
