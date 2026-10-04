# 09 — Konvensi & Operasional

## 1. Environment variables

### `backend/.env`
| Variabel | Contoh | Wajib | Keterangan |
|---|---|:-:|---|
| `APP_ENV` | `development` | ✅ | `development` \| `staging` \| `production` |
| `HTTP_ADDR` | `:8080` | ✅ | |
| `DATABASE_URL` | `postgres://portal:<PASSWORD>@<DB_HOST>:<DB_PORT>/portal_berita?sslmode=disable` | ✅ | Konversi dari JDBC. `sslmode=require` jika server mendukung TLS |
| `DB_MAX_CONNS` | `10` | | |
| `JWT_SECRET` | 64 karakter acak | ✅ | `openssl rand -hex 32` |
| `ACCESS_TOKEN_TTL` | `15m` | | |
| `REFRESH_TOKEN_TTL` | `168h` | | 7 hari |
| `REFRESH_TOKEN_TTL_REMEMBER` | `720h` | | 30 hari |
| `COOKIE_SECURE` | `false` (dev) / `true` (prod) | ✅ | |
| `COOKIE_DOMAIN` | kosong | | Kosong = host saat ini |
| `CORS_ORIGINS` | kosong | | Hanya jika frontend diakses langsung beda origin (tidak perlu dengan rewrite) |
| `TRUSTED_PROXIES` | `127.0.0.0/8,::1/128` | | IP/CIDR (pisah koma) peer yang header `X-Forwarded-For`/`X-Real-IP`-nya dipercaya; `none` = tidak percaya siapa pun. XFF dibaca dari kanan, entri tepercaya dilewati. Default loopback tepat bila Next.js & API satu host; reverse proxy wajib menimpa XFF (`proxy_set_header X-Forwarded-For $remote_addr;`) |
| `UPLOAD_DIR` | `./uploads` | ✅ | |
| `UPLOAD_MAX_MB` | `5` | | |
| `PUBLIC_SITE_URL` | `http://localhost:3000` | ✅ | Untuk URL absolut |
| `NEXT_REVALIDATE_URL` | `http://127.0.0.1:3000/api/revalidate` | ✅ | |
| `REVALIDATE_SECRET` | 32 karakter acak | ✅ | Harus sama dengan frontend |
| `VIEW_HASH_SALT` | acak | ✅ | Salt hash visitor |
| `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` | | | Hanya untuk `tool create-superadmin` non-interaktif |
| `LOG_LEVEL` | `info` | | |

### `frontend/.env.local`
| Variabel | Contoh | Keterangan |
|---|---|---|
| `API_INTERNAL_URL` | `http://127.0.0.1:8080` | Dipakai server Next.js dan rewrites |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical, OG, sitemap |
| `REVALIDATE_SECRET` | sama dengan backend | Harus cocok dengan `backend/.env` untuk verifikasi webhook |

`.env` dan `.env.local` **tidak di-commit**. Yang di-commit hanya `.env.example` dengan placeholder.

**Catatan:** `REVALIDATE_SECRET` di `backend/.env` dan `frontend/.env.local` harus **identik** (32 karakter). Backend mengirim webhook ke `NEXT_REVALIDATE_URL` dengan header `X-Revalidate-Secret`; frontend verifikasi dengan `crypto.timingSafeEqual` setelah length check.

## 2. Menjalankan secara lokal (tanpa Docker)

```bash
# sekali saja
cd /opt/portal-berita
cp backend/.env.example backend/.env         # isi DATABASE_URL, JWT_SECRET, dst.
cp frontend/.env.example frontend/.env.local # isi REVALIDATE_SECRET (harus sama dengan backend)
make tools            # install sqlc & goose
make migrate-up
go run ./backend/cmd/tool create-superadmin --email admin@almaidah.id --name "Administrator"
make seed             # --base --demo

# setiap hari (dua terminal)
make dev-api          # http://localhost:8080
make dev-web          # http://localhost:3000   (admin: /admin)

# production (satu terminal atau systemd)
bun run build         # ⚠️ Memerlukan API running (go run ./backend/cmd/api) untuk prerender homepage
bun run start         # http://localhost:3000
```

Setiap mengubah file di `backend/db/queries/*.sql`, jalankan `make sqlc` (hasilnya di-commit).

## 3. Konvensi kode

### Umum
- Bahasa **kode, nama variabel, dan komentar: Inggris**. **Teks UI dan pesan error untuk pengguna: Indonesia**. Dokumentasi: Indonesia.
- Commit memakai format *Conventional Commits*: `feat(article): …`, `fix(auth): …`, `docs: …`, `chore: …`.
- Branch: `main` (stabil), `feat/<nama>`, `fix/<nama>`.

### Go
- Susunan per domain: `handler.go` (HTTP), `service.go` (logika bisnis & transaksi), `repository` = kode sqlc (`dbgen`) yang dipanggil service.
- Handler tidak memanggil `dbgen` langsung; handler memanggil service.
- `context.Context` selalu menjadi parameter pertama; tidak ada variabel global selain konfigurasi yang di-inject.
- Error: `fmt.Errorf("…: %w", err)`. Error domain didefinisikan (`ErrNotFound`, `ErrConflict`) lalu dipetakan ke HTTP di satu tempat (`httpx`).
- `gofmt` + `go vet` + `staticcheck` di `make lint`.
- Test: `*_test.go` di package yang sama. Integration test memakai build tag `integration` dan schema DB terpisah (`portal_test_<random>`), dibuat lalu di-drop otomatis.

### TypeScript / Next.js
- `strict: true`, tanpa `any` (ESLint `no-explicit-any`).
- Server Component secara default; `'use client'` hanya untuk file yang butuh interaksi.
- Nama file komponen `PascalCase.tsx`, util `camelCase.ts`.
- Tailwind: pakai token (`text-gold`, `border-line`), **bukan** warna hex langsung. Urutan class dirapikan otomatis oleh prettier-plugin-tailwindcss.
- Tidak ada fetch data langsung di komponen klien publik, kecuali untuk view tracker & pencarian overlay.

### SQL
- Nama query sqlc: `-- name: ListPublishedArticles :many`.
- Setiap query publik wajib memuat filter status + `published_at <= now()` + `deleted_at IS NULL`.
- Migrasi bersifat **append-only**: migrasi yang sudah dijalankan di server tidak diedit, melainkan dibuat migrasi baru.

## 4. Keamanan operasional

- Database berada di **IP publik** `<DB_HOST>`. Rekomendasi (di luar cakupan kode, perlu tindakan pemilik server):
  1. Batasi port <DB_PORT> hanya dari IP server aplikasi/pengembang (firewall / `pg_hba.conf`).
  2. Aktifkan TLS di PostgreSQL, lalu pakai `sslmode=require`.
  3. **Ganti password user `portal`** dengan password kuat sebelum produksi, karena password saat ini sudah muncul di percakapan.
  4. Buat user terpisah untuk migrasi (DDL) dan aplikasi (DML saja) di produksi.
- Backup harian: `pg_dump -Fc` + arsip folder `uploads/`, simpan di luar server.
- **Sinkronisasi jam (NTP):** host aplikasi dan host DB wajib tersinkron NTP (chrony/systemd-timesyncd). Pengecekan kedaluwarsa mencampur jam DB (`now()`) dan jam aplikasi (Go `time.Now()`), mis. kedaluwarsa refresh token/sesi. Di Fase 6 jam server DB terukur ~+0,87 detik lebih cepat dari host pengembang, cukup untuk membuat tes batas waktu flaky; selisih besar di produksi bisa membuat sesi kedaluwarsa terlalu cepat/lambat.
- **Audit dependensi:** jalankan `make vuln` (govulncheck + `bun audit --audit-level=moderate`) sebelum tiap rilis. Hasil awal Fase 6 (go1.22.5): 45 temuan reachable (stdlib + `x/net`, `x/image`, `x/text`, `pgx/v5`). Atas keputusan pemilik, toolchain di-upgrade ke go1.27.1 (`backend/go.mod`, `GOTOOLCHAIN=auto`) dan dependensi dinaikkan dengan `go get mod@versi` eksplisit; hasil akhir: **0 temuan reachable**, `bun audit` bersih. Sisa 1 temuan non-reachable: GO-2026-5932 (paket `x/crypto/openpgp` usang; tidak diimpor, tanpa versi perbaikan). Catatan upgrade: pgx ≥ v5.8 men-decode `tsvector` dalam format biner, sehingga override sqlc `tsvector` kini `pgtype.TSVector` (bukan `string`). Panic dekoder WebP tetap diredam di `media.DetectImage` (jadi 415, bukan 500).

### Keterbatasan yang diterima (Fase 6)

1. **Access token tetap berlaku ≤ 15 menit setelah logout/revoke/ganti password.** Refresh token langsung dicabut, tetapi JWT access yang sudah terbit tidak dicek ke DB. Denylist `sid` in-process dipertimbangkan (backlog, prioritas Rendah); risikonya kecil karena CMS hanya untuk admin tepercaya dan jendela maksimal 15 menit.
2. **CSP memakai `script-src 'unsafe-inline'`.** Nonce Next.js memaksa semua halaman render dinamis (bertentangan dengan ISR) dan payload RSC inline tidak bisa di-hash. Pertahanan XSS bertumpu pada sanitasi server (bluemonday) + escaping React; CSP menutup clickjacking, `<base>`, `<object>`, form-action, dan sumber eksternal (dok 03 §5).
3. **HSTS:** dikirim Next.js hanya bila `NEXT_PUBLIC_SITE_URL` https (nilai build-time). Respons yang tidak lewat Next.js (mis. akses langsung ke Go) bergantung pada reverse proxy; disarankan mengaktifkan HSTS juga di proxy (`deploy/caddy/Caddyfile`, `docs/deploy.md`) setelah HTTPS stabil.
4. **Jaminan IP klien bergantung pada reverse proxy.** Tanpa proxy yang menimpa `X-Forwarded-For`, klien lokal/loopback bisa memalsukan XFF (rate limit & dedup view). Di produksi proxy wajib `proxy_set_header X-Forwarded-For $remote_addr;` (atau setara Caddy).

## 5. Risiko & rencana cadangan

| Risiko | Dampak | Mitigasi |
|---|---|---|
| User `portal` tidak bisa `CREATE EXTENSION` | FTS tanpa unaccent, tanpa fallback typo | (a) minta pemilik server menjalankan `CREATE EXTENSION` sebagai superuser; (b) jika tidak bisa: FTS `simple` tanpa `unaccent`, fallback typo memakai `ILIKE`, email di-lowercase di aplikasi alih-alih `citext` |
| Latensi ke DB remote tinggi | Render SSR lambat saat cache miss | ISR membuat sebagian besar request tidak menyentuh DB; resolver homepage paralel; pool koneksi dipanaskan |
| Revalidasi gagal (Next.js mati saat admin simpan) | Konten basi | Retry 3x + TTL jaring pengaman 1 jam + tombol "Bersihkan cache" di admin (fase 5) |
| Registry section frontend/backend tidak sinkron | Section tidak dirender | Test sinkronisasi + frontend melewati tipe tak dikenal tanpa crash |
| Tidak ada stemmer Bahasa Indonesia | "membaca" tidak menemukan "baca" | Diterima untuk MVP; opsi lanjutan: kamus sinonim/`ispell` Indonesia atau mesin pencari eksternal |
| Kontras teks emas rendah | Aksesibilitas | Varian `gold-strong` untuk teks kecil (dok 06 §8) |

## 6. Pertanyaan terbuka (status keputusan)

Item berikut memakai status keputusan:

| # | Pertanyaan | Usulan default | Status |
|---|---|---|---|
| 1 | Library komponen admin: Tailwind murni + Radix headless, atau shadcn/ui? | Tailwind + Radix (shadcn/ui boleh dipakai sebagai kode yang disalin, karena berbasis Radix + Tailwind) | ✅ **Diputuskan Fase 5:** shadcn/ui radix-vega (Q19) |
| 2 | Permission default role `admin`: boleh kelola pengaturan situs? | **Tidak** (hanya super_admin); lihat tabel dok 04 §4.1 | ✅ Dikonfirmasi default |
| 3 | Terima upload SVG? | **Tidak** di MVP (risiko XSS) | ✅ Dikonfirmasi default |
| 4 | Batas ukuran upload gambar | 5 MB | ✅ Dikonfirmasi default |
| 5 | Domain produksi & lokasi hosting aplikasi | Belum diketahui; dibutuhkan untuk canonical, cookie `Secure`, dan dokumen deploy | ⏳ **Pending pemilik proyek** |
| 6 | RSS feed di MVP? | Ya, murah untuk dibuat (Fase 6) | ✅ **Selesai Fase 6:** `/feed.xml` RSS 2.0 |
| 7 | Playwright untuk uji E2E otomatis? | Ya, untuk skenario inti (login, terbitkan, homepage) | ✅ **Selesai Fase 6:** 15 skenario otomatis |
| 8 | Format tanggal kalender: minggu dimulai hari Minggu (sesuai desain M S S R K J S)? | Ya, mengikuti desain | ✅ Dikonfirmasi default |
| 9 | Apakah breadcrumb di homepage (ada di desain) memang diinginkan? | Tidak ditampilkan di homepage, hanya di halaman dalam | ✅ Dikonfirmasi default |
