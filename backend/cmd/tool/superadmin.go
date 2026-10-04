package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"golang.org/x/term"

	"portal-berita/backend/db/seed"
	"portal-berita/backend/internal/auth"
)

const minPasswordLen = 10

func init() {
	register(Command{
		Name:  "create-superadmin",
		Usage: "create-superadmin --email <email> --name <nama>  (password dari SEED_SUPERADMIN_PASSWORD atau prompt)",
		Run:   runCreateSuperadmin,
	})
}

func runCreateSuperadmin(ctx context.Context, env *Env, args []string) error {
	const usage = "penggunaan: create-superadmin --email <email> --name <nama>"
	fs := flag.NewFlagSet("create-superadmin", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	emailFlag := fs.String("email", "", "email login (default: SEED_SUPERADMIN_EMAIL)")
	nameFlag := fs.String("name", "", "nama tampilan")
	if err := fs.Parse(args); err != nil || fs.NArg() > 0 {
		return errors.New(usage)
	}

	email := strings.TrimSpace(*emailFlag)
	if email == "" {
		email = strings.TrimSpace(env.Cfg.SeedSuperadminEmail)
	}
	if email == "" || !strings.Contains(email, "@") || strings.ContainsAny(email, " \t\r\n") {
		return fmt.Errorf("email tidak valid atau kosong (--email atau SEED_SUPERADMIN_EMAIL); %s", usage)
	}
	name := strings.TrimSpace(*nameFlag)
	if name == "" {
		name = "Administrator"
	}
	if n := utf8.RuneCountInString(name); n > 120 {
		return errors.New("nama maksimal 120 karakter")
	}

	password, err := superadminPassword(env.Cfg.SeedSuperadminPassword)
	if err != nil {
		return err
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	var id int64
	err = pgx.BeginFunc(ctx, env.Pool, func(tx pgx.Tx) error {
		slug, err := superadminSlug(ctx, tx, email, name)
		if err != nil {
			return err
		}
		if err := tx.QueryRow(ctx, `
			INSERT INTO users (email, password_hash, display_name, slug, can_login, is_active)
			VALUES ($1, $2, $3, $4, true, true)
			ON CONFLICT (email) DO UPDATE SET
				password_hash = EXCLUDED.password_hash,
				display_name  = EXCLUDED.display_name,
				can_login     = true,
				is_active     = true,
				perm_version  = users.perm_version + 1
			RETURNING id`, email, hash, name, slug).Scan(&id); err != nil {
			return fmt.Errorf("upsert user: %w", err)
		}
		tag, err := tx.Exec(ctx, `
			INSERT INTO user_roles (user_id, role_id)
			SELECT $1::bigint, r.id FROM roles r WHERE r.code = 'super_admin'
			ON CONFLICT DO NOTHING`, id)
		if err != nil {
			return fmt.Errorf("assign role: %w", err)
		}
		if tag.RowsAffected() == 0 {
			var exists bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM roles WHERE code = 'super_admin')`).Scan(&exists); err != nil {
				return err
			}
			if !exists {
				return errors.New("role super_admin tidak ditemukan; jalankan migrate up terlebih dahulu")
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	env.Log.Info("super admin siap", "email", email, "user_id", id)
	fmt.Printf("Super admin %s siap (id=%d)\n", email, id)
	return nil
}

// superadminPassword takes the password from the environment, else prompts twice on a terminal.
func superadminPassword(fromEnv string) (string, error) {
	pw := fromEnv
	if pw == "" {
		fd := int(os.Stdin.Fd())
		if !term.IsTerminal(fd) {
			return "", errors.New("SEED_SUPERADMIN_PASSWORD kosong dan stdin bukan terminal; tidak dapat meminta password")
		}
		fmt.Fprint(os.Stderr, "Password: ")
		first, err := term.ReadPassword(fd)
		fmt.Fprintln(os.Stderr)
		if err != nil {
			return "", fmt.Errorf("baca password: %w", err)
		}
		fmt.Fprint(os.Stderr, "Ulangi password: ")
		second, err := term.ReadPassword(fd)
		fmt.Fprintln(os.Stderr)
		if err != nil {
			return "", fmt.Errorf("baca password: %w", err)
		}
		if string(first) != string(second) {
			return "", errors.New("password tidak sama")
		}
		pw = string(first)
	}
	if utf8.RuneCountInString(pw) < minPasswordLen {
		return "", fmt.Errorf("password minimal %d karakter", minPasswordLen)
	}
	return pw, nil
}

// superadminSlug keeps the slug of an existing account with this email; otherwise
// derives one from the name, appending -2, -3, … while taken by another user.
func superadminSlug(ctx context.Context, tx pgx.Tx, email, name string) (string, error) {
	var existing string
	err := tx.QueryRow(ctx, `SELECT slug FROM users WHERE email = $1`, email).Scan(&existing)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", fmt.Errorf("cek email: %w", err)
	}
	base := slugifyName(name)
	for i := 1; i < 1000; i++ {
		candidate := base
		if i > 1 {
			candidate = fmt.Sprintf("%s-%d", base, i)
		}
		var taken bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM users WHERE slug = $1)`, candidate).Scan(&taken); err != nil {
			return "", fmt.Errorf("cek slug: %w", err)
		}
		if !taken {
			return candidate, nil
		}
	}
	return "", errors.New("tidak menemukan slug yang tersedia")
}

// slugifyName derives a user slug from a display name, leaving room for a "-N" suffix.
func slugifyName(s string) string {
	out := seed.Slugify(s)
	if len(out) > 150 {
		out = strings.TrimRight(out[:150], "-")
	}
	if out == "" {
		out = "admin"
	}
	return out
}
