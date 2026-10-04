# ALMAIDAH — Portal Berita Alumni Darul Hikmah Sumedang

Monorepo portal berita + CMS. **Tanpa Docker** (keputusan pemilik).

```
backend/    Go 1.27 · chi v5 · pgx v5 · sqlc · goose      (API di :8080)
frontend/   Next.js App Router · TypeScript · Tailwind v4 · bun   (web di :3000, CMS di /admin)
docs/       Sumber kebenaran: keputusan, skema, kontrak API, fase kerja
```

Dokumentasi lengkap ada di [`docs/`](docs/README.md). Panduan singkat untuk agen AI: [`AGENTS.md`](AGENTS.md).

## Prasyarat

- **Go ≥ 1.21** terpasang; toolchain **go1.27.1** diunduh otomatis sesuai `backend/go.mod` (`GOTOOLCHAIN=auto`, diverifikasi checksum oleh perintah `go`)
- **bun 1.3** (satu-satunya tooling JS; jangan pakai npm/yarn/pnpm)
- Akses ke **PostgreSQL 17** bersama (`<DB_HOST>:<DB_PORT>`, database `portal_berita`, `sslmode=require`)
- `gcc` (dibutuhkan `go install` sqlc karena memakai cgo)

> **Penting — toolchain & dependensi Go.** Makefile meng-export `GOTOOLCHAIN=auto` dan
> `GOPROXY=https://proxy.golang.org,direct`: Go yang terpasang (≥ 1.21) otomatis memakai
> toolchain go1.27.1 yang tercantum di `backend/go.mod`. Jangan set `GOTOOLCHAIN=local`
> bila Go terpasang lebih lama dari 1.27.1. `make tools` membangun sqlc/staticcheck/govulncheck
> dengan toolchain yang sama. Naikkan dependensi dengan versi eksplisit
> (`go get github.com/jackc/pgx/v5@v5.11.0`), bukan `go get -u`, lalu `go mod tidy` dan `make vuln`.

## Setup (sekali saja)

```bash
cd /opt/portal-berita
cp backend/.env.example backend/.env           # isi DATABASE_URL, JWT_SECRET, REVALIDATE_SECRET, VIEW_HASH_SALT
cp frontend/.env.example frontend/.env.local   # REVALIDATE_SECRET harus sama dengan backend
make tools                                     # sqlc v1.27.0 + staticcheck v0.5.1
make migrate-up
make create-superadmin EMAIL=admin@almaidah.id NAME="Administrator"
make seed                                      # data dasar + demo (idempoten)
```

Rahasia acak dapat dibuat dengan `openssl rand -hex 32` (JWT) dan `openssl rand -hex 16`.
`backend/.env` dan `frontend/.env.local` **tidak di-commit**.

## Menjalankan (dua terminal)

```bash
make dev-api     # http://localhost:8080
make dev-web     # http://localhost:3000   (admin: /admin)
```

Cek kesehatan API:

```bash
curl -si localhost:8080/healthz    # 200 {"status":"ok"}
curl -si localhost:8080/readyz     # 200 {"status":"ok","database":"ok"} atau 503 bila DB tidak terjangkau
```

### Contoh login via API (dengan cookie jar)

```bash
# Siapkan cookie jar (file kosong, akan diisi otomatis)
COOKIES=$(mktemp)

# 1. Login
curl -si -b "$COOKIES" -c "$COOKIES" -X POST localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@almaidah.id","password":"<PASSWORD>","remember":false}' | jq .

# 2. Ambil profil (harus ada cookie access_token)
curl -si -b "$COOKIES" localhost:8080/api/v1/auth/me | jq .

# 3. Logout
curl -si -b "$COOKIES" -c "$COOKIES" -X POST localhost:8080/api/v1/auth/logout \
  -H "X-CSRF-Token: <ambil dari response login>"

# 4. Cek login sudah dihapus (harus 401)
curl -si -b "$COOKIES" localhost:8080/api/v1/auth/me
```

## Target Makefile

| Target | Fungsi |
|---|---|
| `make help` | Daftar target |
| `make tools` | Pasang sqlc & staticcheck (versi dipin) |
| `make dev-api` | Jalankan API Go di :8080 |
| `make dev-web` | Jalankan Next.js dev di :3000 |
| `make migrate-up` | Terapkan semua migrasi yang tertunda |
| `make migrate-down` | Mundurkan satu migrasi (hanya `APP_ENV=development`) |
| `make migrate-status` | Status migrasi |
| `make migrate-reset` | Mundurkan semua migrasi (hanya `APP_ENV=development`) |
| `make sqlc` | Generate ulang `backend/internal/dbgen` (hasilnya di-commit) |
| `make seed` | Seed data dasar + demo |
| `make seed-base` / `make seed-demo` | Seed dasar saja / demo saja |
| `make create-superadmin EMAIL=… NAME="…"` | Buat/perbarui akun superadmin |
| `make lint` | gofmt + go vet + staticcheck + lint frontend |
| `make test` | Unit test backend |
| `make test-integration` | Test integrasi backend (butuh `DATABASE_URL`) |
| `make build` | Build `backend/bin/{api,tool}` dan frontend |

## CLI `tool`

Semua operasi (migrasi, seed, superadmin) melalui satu binary:

```bash
cd backend
go run ./cmd/tool help
go run ./cmd/tool migrate status
go run ./cmd/tool seed --base --demo
go run ./cmd/tool create-superadmin --email admin@almaidah.id --name "Administrator"
```

`tool` membaca konfigurasi dari `backend/.env` (atau file yang ditunjuk `ENV_FILE`).
Variabel yang sudah ada di environment proses menang atas isi file.

## Admin CMS

Setelah login, akses CMS admin di **`http://localhost:3000/admin`** (di production: `https://yourdomain.com/admin`).

- **Login:** gunakan email & password super admin yang dibuat via `make create-superadmin`.
- **Interface:** sidebar navigasi, topbar dengan breadcrumb, dark mode toggle.
- **Fungsi:** manajemen artikel, kategori, tag, media, agenda, tokoh, video, halaman statis, homepage section builder, menu, pengaturan situs, pengguna, dan role permission.

> Jalankan `make create-superadmin EMAIL=admin@almaidah.id NAME="Administrator"` sekali saja untuk membuat akun pertama. Jangan tulis password di argumen; sistem akan meminta input atau baca dari `SEED_SUPERADMIN_PASSWORD` env var.

## Database

Server PostgreSQL bersifat **bersama dan tidak bisa dibuang**. Hati-hati dengan
`migrate-down`/`migrate-reset`. Setiap sesi koneksi dipaksa `timezone=UTC`
(default server Asia/Shanghai); tampilan waktu memakai WIB (Asia/Jakarta).
Migrasi bersifat append-only: jangan ubah migrasi yang sudah diterapkan.

## Produksi (tanpa Docker)

Backend (`bin/api`) dan frontend (`bun run start`) berjalan sebagai proses
biasa dikelola systemd, di belakang Nginx atau Caddy untuk TLS. Panduan
lengkap (build, env vars, unit systemd, reverse proxy, backup/restore,
runbook) ada di [`docs/deploy.md`](docs/deploy.md); berkas contoh siap-salin
ada di [`deploy/`](deploy/README.md).
