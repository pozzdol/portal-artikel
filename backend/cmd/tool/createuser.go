package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/term"

	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/auth"
	"portal-berita/backend/internal/phone"
)

const (
	// minInitialPasswordLen applies with --must-change: a short initial password
	// (e.g. 8 digits handed over by phone) is acceptable when the user must replace it.
	minInitialPasswordLen = 8
	maxPasswordLen        = 128
	maxEmailLen           = 254
	maxNameLen            = 120
)

const createUserUsage = "penggunaan: create-user (--email <email> | --phone <nomor HP> | keduanya) --name <nama> " +
	"[--role admin] [--must-change] [--password-env <VAR> | --password-stdin] [--update]"

func init() {
	register(Command{
		Name: "create-user",
		Usage: "create-user (--email E | --phone P) --name N [--role admin] [--must-change] " +
			"[--password-env VAR | --password-stdin] [--update]  (tanpa sumber: prompt TTY)",
		Run: runCreateUser,
	})
}

// createUserOpts are the parsed and validated create-user flags.
type createUserOpts struct {
	Email         string // lower-cased; "" when absent
	Phone         string // normalized (phone.Normalize); "" when absent
	Name          string // "" allowed only with --update
	Role          string
	MustChange    bool
	Update        bool
	PasswordEnv   string
	PasswordStdin bool
}

// parseCreateUserFlags parses and validates args (everything except the password).
func parseCreateUserFlags(args []string) (createUserOpts, error) {
	var o createUserOpts
	fs := flag.NewFlagSet("create-user", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	email := fs.String("email", "", "email login")
	phoneRaw := fs.String("phone", "", "nomor HP login (0821…, 62…, +62…)")
	name := fs.String("name", "", "nama tampilan")
	fs.StringVar(&o.Role, "role", "admin", "kode peran")
	fs.BoolVar(&o.MustChange, "must-change", false, "wajib ganti kata sandi saat login pertama")
	fs.BoolVar(&o.Update, "update", false, "perbarui pengguna yang sudah ada")
	fs.StringVar(&o.PasswordEnv, "password-env", "", "nama variabel lingkungan berisi kata sandi")
	fs.BoolVar(&o.PasswordStdin, "password-stdin", false, "baca kata sandi dari baris pertama stdin")
	if err := fs.Parse(args); err != nil {
		return o, fmt.Errorf("%v; %s", err, createUserUsage)
	}
	if fs.NArg() > 0 {
		return o, fmt.Errorf("argumen tidak dikenal %q (kata sandi tidak boleh lewat argumen); %s", fs.Arg(0), createUserUsage)
	}

	o.Email = strings.ToLower(strings.TrimSpace(*email))
	if o.Email != "" {
		if !strings.Contains(o.Email, "@") || strings.ContainsAny(o.Email, " \t\r\n") || len(o.Email) > maxEmailLen {
			return o, fmt.Errorf("email tidak valid: %q", o.Email)
		}
	}
	if raw := strings.TrimSpace(*phoneRaw); raw != "" {
		n, ok := phone.Normalize(raw)
		if !ok {
			return o, fmt.Errorf("format nomor HP tidak valid: %q (contoh: 0821xxxxxxxx)", raw)
		}
		o.Phone = n
	}
	if o.Email == "" && o.Phone == "" {
		return o, fmt.Errorf("isi --email atau --phone; %s", createUserUsage)
	}

	o.Name = strings.TrimSpace(*name)
	if o.Name == "" && !o.Update {
		return o, fmt.Errorf("--name wajib diisi; %s", createUserUsage)
	}
	if utf8.RuneCountInString(o.Name) > maxNameLen {
		return o, fmt.Errorf("nama maksimal %d karakter", maxNameLen)
	}

	o.Role = strings.TrimSpace(o.Role)
	if o.Role == "" {
		return o, errors.New("--role tidak boleh kosong")
	}
	o.PasswordEnv = strings.TrimSpace(o.PasswordEnv)
	if o.PasswordEnv != "" && o.PasswordStdin {
		return o, errors.New("pilih salah satu: --password-env atau --password-stdin")
	}
	return o, nil
}

// validateInitialPassword enforces 10..128 runes, or 8..128 with mustChange.
func validateInitialPassword(pw string, mustChange bool) error {
	minLen := minPasswordLen
	if mustChange {
		minLen = minInitialPasswordLen
	}
	n := utf8.RuneCountInString(pw)
	if n < minLen {
		if !mustChange {
			return fmt.Errorf("kata sandi minimal %d karakter (atau minimal %d dengan --must-change)", minLen, minInitialPasswordLen)
		}
		return fmt.Errorf("kata sandi minimal %d karakter", minLen)
	}
	if n > maxPasswordLen {
		return fmt.Errorf("kata sandi maksimal %d karakter", maxPasswordLen)
	}
	return nil
}

// readCreateUserPassword takes the password from the named env var, the first
// line of stdin, or (fallback) a twice-typed terminal prompt. Never from argv.
func readCreateUserPassword(o createUserOpts, stdin io.Reader, getenv func(string) string) (string, error) {
	switch {
	case o.PasswordEnv != "":
		pw := getenv(o.PasswordEnv)
		if pw == "" {
			return "", fmt.Errorf("variabel lingkungan %s kosong atau tidak ada", o.PasswordEnv)
		}
		return pw, nil
	case o.PasswordStdin:
		line, err := bufio.NewReader(stdin).ReadString('\n')
		if err != nil && !errors.Is(err, io.EOF) {
			return "", fmt.Errorf("baca kata sandi dari stdin: %w", err)
		}
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			return "", errors.New("stdin tidak berisi kata sandi")
		}
		return line, nil
	default:
		return promptPasswordTwice()
	}
}

func promptPasswordTwice() (string, error) {
	fd := int(os.Stdin.Fd())
	if !term.IsTerminal(fd) {
		return "", errors.New("stdin bukan terminal; gunakan --password-env <VAR> atau --password-stdin")
	}
	fmt.Fprint(os.Stderr, "Kata sandi: ")
	first, err := term.ReadPassword(fd)
	fmt.Fprintln(os.Stderr)
	if err != nil {
		return "", fmt.Errorf("baca kata sandi: %w", err)
	}
	fmt.Fprint(os.Stderr, "Ulangi kata sandi: ")
	second, err := term.ReadPassword(fd)
	fmt.Fprintln(os.Stderr)
	if err != nil {
		return "", fmt.Errorf("baca kata sandi: %w", err)
	}
	if string(first) != string(second) {
		return "", errors.New("kata sandi tidak sama")
	}
	return string(first), nil
}

func runCreateUser(ctx context.Context, env *Env, args []string) error {
	o, err := parseCreateUserFlags(args)
	if err != nil {
		return err
	}
	pw, err := readCreateUserPassword(o, os.Stdin, os.Getenv)
	if err != nil {
		return err
	}
	if err := validateInitialPassword(pw, o.MustChange); err != nil {
		return err
	}
	hash, err := auth.HashPassword(pw)
	if err != nil {
		return fmt.Errorf("hash kata sandi: %w", err)
	}

	res, err := upsertLoginUser(ctx, env.Pool, o, hash)
	if err != nil {
		return err
	}

	ident := o.Email
	if ident == "" {
		ident = phone.Display(o.Phone)
	}
	action, summary := audit.ActionCreate, "Pengguna dibuat via CLI: "+ident
	if res.Updated {
		action, summary = audit.ActionPasswordReset, "Pengguna diperbarui via CLI: "+ident
	}
	audit.New(env.Pool).LogBestEffort(ctx, audit.Entry{
		Action:     action,
		EntityType: audit.EntityUser,
		EntityID:   &res.ID,
		Summary:    summary,
		Changes: map[string]any{
			"via":                  "cli",
			"role":                 o.Role,
			"must_change_password": o.MustChange,
			"revoked_tokens":       res.RevokedTokens,
		},
	})

	env.Log.Info("pengguna siap", "user_id", res.ID, "role", o.Role, "updated", res.Updated)
	yn := "tidak"
	if o.MustChange {
		yn = "ya"
	}
	fmt.Printf("Pengguna %s siap (id=%d, role=%s, wajib ganti kata sandi: %s)\n", ident, res.ID, o.Role, yn)
	return nil
}

type upsertResult struct {
	ID            int64
	Updated       bool
	RevokedTokens int64
}

// upsertLoginUser creates the login user (or, with o.Update, resets an existing
// one matched by email/phone) and assigns o.Role, all in one transaction.
func upsertLoginUser(ctx context.Context, pool *pgxpool.Pool, o createUserOpts, hash string) (upsertResult, error) {
	var res upsertResult
	email, phoneNum := nilIfEmpty(o.Email), nilIfEmpty(o.Phone)
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		var roleID int64
		if err := tx.QueryRow(ctx, `SELECT id FROM roles WHERE code = $1`, o.Role).Scan(&roleID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return fmt.Errorf("peran %q tidak ditemukan", o.Role)
			}
			return fmt.Errorf("cek peran: %w", err)
		}

		byEmail, err := lockUserID(ctx, tx, `SELECT id FROM users WHERE email = $1 FOR UPDATE`, email)
		if err != nil {
			return fmt.Errorf("cek email: %w", err)
		}
		byPhone, err := lockUserID(ctx, tx, `SELECT id FROM users WHERE phone = $1 FOR UPDATE`, phoneNum)
		if err != nil {
			return fmt.Errorf("cek nomor HP: %w", err)
		}
		if byEmail != 0 && byPhone != 0 && byEmail != byPhone {
			return fmt.Errorf("email %s dan nomor HP %s milik dua pengguna berbeda (id=%d dan id=%d)",
				o.Email, phone.Display(o.Phone), byEmail, byPhone)
		}
		existing := byEmail
		if existing == 0 {
			existing = byPhone
		}

		if existing != 0 {
			if !o.Update {
				what := "email " + o.Email
				if byEmail == 0 {
					what = "nomor HP " + phone.Display(o.Phone)
				}
				return fmt.Errorf("%s sudah terdaftar (id=%d); gunakan --update untuk mengganti kata sandinya", what, existing)
			}
			if _, err := tx.Exec(ctx, `
				UPDATE users SET
					email                = COALESCE($2, email),
					phone                = COALESCE($3, phone),
					display_name         = COALESCE($4, display_name),
					password_hash        = $5,
					must_change_password = $6,
					can_login            = true,
					is_active            = true,
					perm_version         = perm_version + 1
				WHERE id = $1`, existing, email, phoneNum, nilIfEmpty(o.Name), hash, o.MustChange); err != nil {
				return fmt.Errorf("perbarui pengguna: %w", err)
			}
			tag, err := tx.Exec(ctx, `
				UPDATE refresh_tokens SET revoked_at = now()
				WHERE user_id = $1 AND revoked_at IS NULL`, existing)
			if err != nil {
				return fmt.Errorf("cabut sesi: %w", err)
			}
			res = upsertResult{ID: existing, Updated: true, RevokedTokens: tag.RowsAffected()}
		} else {
			slug, err := superadminSlug(ctx, tx, o.Email, o.Name)
			if err != nil {
				return err
			}
			if err := tx.QueryRow(ctx, `
				INSERT INTO users (email, phone, password_hash, display_name, slug, can_login, is_active, must_change_password)
				VALUES ($1, $2, $3, $4, $5, true, true, $6)
				RETURNING id`, email, phoneNum, hash, o.Name, slug, o.MustChange).Scan(&res.ID); err != nil {
				return fmt.Errorf("buat pengguna: %w", err)
			}
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
			ON CONFLICT DO NOTHING`, res.ID, roleID); err != nil {
			return fmt.Errorf("tetapkan peran: %w", err)
		}
		return nil
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return res, fmt.Errorf("email atau nomor HP sudah terdaftar (dibuat bersamaan); ulangi dengan --update: %w", err)
		}
		return res, err
	}
	return res, nil
}

// lockUserID returns the id matched by query (0 when val is nil or no row).
func lockUserID(ctx context.Context, tx pgx.Tx, query string, val *string) (int64, error) {
	if val == nil {
		return 0, nil
	}
	var id int64
	err := tx.QueryRow(ctx, query, *val).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	return id, err
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
