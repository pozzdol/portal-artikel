# Deploy — Production tanpa Docker

Panduan menjalankan ALMAIDAH di server production, tanpa Docker (keputusan
pemilik, lihat `AGENTS.md`). Backend Go dan frontend Next.js berjalan sebagai
dua proses biasa (`bin/api`, `bun run start`), dikelola oleh systemd, di
belakang reverse proxy (Nginx atau Caddy) yang menangani TLS.

Berkas contoh siap-salin ada di [`deploy/`](../deploy/README.md). Dokumen ini
menjelaskan urutan dan alasannya; §1 env vars melengkapi (bukan menggantikan)
tabel di `docs/09-konvensi-dan-operasional.md` §1.

Arsitektur satu server:

```
Internet → Nginx/Caddy (443, TLS) → Next.js "next start" (127.0.0.1:3000)
                                          │  rewrites /api/v1/*, /uploads/*
                                          ▼
                                     Go API (127.0.0.1:8080)
                                          │
                                          ▼
                              PostgreSQL 17 (server bersama, jarak jauh)
```

## 1. Prasyarat server

- Linux dengan systemd (Ubuntu/Debian LTS disarankan).
- Go ≥ 1.21 terpasang; toolchain go1.27.1 diunduh otomatis sesuai
  `backend/go.mod` (`GOTOOLCHAIN=auto`, default Go; pastikan tidak di-set
  `local` — lihat `README.md`). Unduhan disimpan di module cache user yang
  menjalankan `go build` dan perlu akses keluar ke `proxy.golang.org`. Atau
  cukup salin binary hasil build dari mesin CI/dev (lihat §2).
- bun 1.3.x untuk build frontend (`curl -fsSL https://bun.sh/install | bash`).
  **Satu-satunya tooling JS** — jangan pakai npm/yarn/pnpm di server ini juga.
- `gcc` bila build sqlc dilakukan di server yang sama (biasanya tidak perlu —
  `dbgen` sudah di-commit, sqlc hanya dipakai saat mengubah query).
- Akses jaringan keluar ke PostgreSQL bersama (`<DB_HOST>:<DB_PORT>`,
  `sslmode=require`). Firewall server aplikasi harus mengizinkan koneksi
  keluar ke IP:port tersebut; sebaliknya, pemilik server database sebaiknya
  membatasi port <DB_PORT> hanya menerima dari IP server aplikasi ini
  (`docs/09-konvensi-dan-operasional.md` §4).
- Reverse proxy: **Nginx** (+ certbot) *atau* **Caddy** (TLS otomatis) — pilih
  salah satu, jangan dua-duanya.

## 2. User, direktori, dan build

```bash
# Sekali saja: buat user layanan tanpa login shell
sudo useradd --system --create-home --shell /usr/sbin/nologin almaidah

# Checkout kode di bawah kepemilikan user tersebut
sudo mkdir -p /opt/portal-berita
sudo chown almaidah:almaidah /opt/portal-berita
sudo -u almaidah git clone <remote-repo> /opt/portal-berita
cd /opt/portal-berita

# bun untuk user almaidah (jika belum ada)
sudo -u almaidah bash -c 'curl -fsSL https://bun.sh/install | bash'

# .env dari template, isi rahasia, kunci permission
sudo -u almaidah cp backend/.env.example backend/.env
sudo -u almaidah cp frontend/.env.example frontend/.env.local
sudo -u almaidah chmod 600 backend/.env frontend/.env.local
sudo -u almaidah $EDITOR backend/.env frontend/.env.local   # lihat §3

# Migrasi + superadmin pertama (sekali saja)
cd backend && sudo -u almaidah env $(grep -v '^#' .env | xargs) go run ./cmd/tool migrate up
sudo -u almaidah env $(grep -v '^#' .env | xargs) go run ./cmd/tool create-superadmin \
  --email admin@example.com --name "Administrator"
cd ..

# Build backend (dua binary)
cd backend
sudo -u almaidah go build -o bin/api ./cmd/api
sudo -u almaidah go build -o bin/tool ./cmd/tool
cd ..

# uploads/ harus bisa ditulis oleh proses API
sudo -u almaidah mkdir -p backend/uploads
sudo chmod 750 backend/uploads

# Build frontend — PENTING: API HARUS SUDAH JALAN saat build, karena prerender
# homepage/sitemap memanggilnya. Urutan: start almaidah-api dulu (§4), baru build.
sudo systemctl start almaidah-api   # setelah unit dipasang, lihat §4
cd frontend
sudo -u almaidah bun install --frozen-lockfile
sudo -u almaidah bun run build
cd ..
```

Redeploy berikutnya (kode berubah): lihat runbook §6 — urutannya sama
(`git pull` → build backend → build frontend dengan API tetap hidup → restart
API dulu, lalu web).

## 3. Environment variables

Tabel lengkap ada di `docs/09-konvensi-dan-operasional.md` §1. Nilai yang
**wajib beda dari default development**:

| Variabel | File | Production |
|---|---|---|
| `APP_ENV` | `backend/.env` | `production` |
| `COOKIE_SECURE` | `backend/.env` | `true` (cookie hanya dikirim lewat HTTPS) |
| `COOKIE_DOMAIN` | `backend/.env` | biasanya tetap kosong (host saat ini) kecuali butuh cookie lintas subdomain |
| `PUBLIC_SITE_URL` | `backend/.env` | `https://example.com` |
| `NEXT_PUBLIC_SITE_URL` | `frontend/.env.local` | `https://example.com` (sama domain; dipakai juga untuk mengaktifkan CSP `upgrade-insecure-requests` dan header HSTS di aplikasi) |
| `TRUSTED_PROXIES` | `backend/.env` | lihat catatan di bawah |
| `JWT_SECRET`, `REVALIDATE_SECRET`, `VIEW_HASH_SALT` | keduanya | acak, unik untuk production (`openssl rand -hex 32` / `-hex 16`); **`REVALIDATE_SECRET` harus identik** di kedua berkas |
| `LOG_LEVEL` | `backend/.env` | `info` (naikkan ke `debug` sementara saat investigasi) |

### Trusted proxies (`TRUSTED_PROXIES`)

Backend membaca IP klien asli dari header `X-Forwarded-For`/`X-Real-IP`
**hanya** bila koneksi TCP langsung (`RemoteAddr`) berasal dari IP yang
terdaftar di `TRUSTED_PROXIES` — daftar CIDR/IP dipisah koma. Default:
`127.0.0.0/8,::1/128`. Nilai `none` mematikan pemercayaan sama sekali (header
apa pun diabaikan, selalu pakai `RemoteAddr` apa adanya).

- **Topologi standar di dokumen ini** (Next.js dan Go di host yang sama, Next
  memanggil Go lewat `127.0.0.1:8080`): default loopback **sudah benar**,
  tidak perlu diubah. Reverse proxy (Nginx/Caddy) berbicara ke Next di
  `127.0.0.1:3000`, dan Next lah yang menjadi peer langsung Go di loopback.
- Ubah `TRUSTED_PROXIES` **hanya** jika Go menerima koneksi langsung dari
  alamat lain yang bukan loopback (mis. reverse proxy dan API dipisah host,
  atau load balancer di depan beberapa instance API) — isi dengan IP proxy
  tersebut, bukan `0.0.0.0/0`.
- Prasyarat keamanan yang **wajib**: reverse proxy harus **menimpa** (bukan
  menambah) `X-Forwarded-For` dengan IP koneksi TCP yang sebenarnya diterimanya
  (`proxy_set_header X-Forwarded-For $remote_addr;` di Nginx — lihat
  `deploy/nginx/almaidah.conf`; Caddy melakukan ini secara default). Jika
  proxy justru meneruskan header dari klien apa adanya, klien bisa memalsukan
  IP-nya sendiri (dipakai untuk rate limit login, dedup view, audit log).

## 4. systemd

Salin unit dari `deploy/systemd/`, sesuaikan path/`User=` bila berbeda dari
contoh (`/opt/portal-berita`, user `almaidah`):

```bash
sudo cp deploy/systemd/almaidah-api.service deploy/systemd/almaidah-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now almaidah-api
sudo systemctl enable --now almaidah-web
sudo systemctl status almaidah-api almaidah-web
```

Catatan tentang unit:

- `almaidah-web` mendeklarasikan `After=`/`Requires=almaidah-api.service` —
  Next.js butuh API untuk rewrites runtime, dan build-time prerender juga
  butuh API (§2).
- `Restart=on-failure` + `RestartSec=3`: proses naik ulang otomatis bila
  crash. Backend Go sendiri sudah menangani graceful shutdown (`SIGINT`/
  `SIGTERM` mengalirkan context ke HTTP server, job runner, dan revalidate
  worker — lihat `backend/cmd/api/main.go`), jadi `systemctl stop`/`restart`
  tidak memutus koneksi yang sedang berjalan secara paksa.
- Hardening (`NoNewPrivileges`, `ProtectSystem=full`, `ProtectHome`,
  `ReadWritePaths=` terbatas ke `uploads/` dan `.next/`) membatasi proses agar
  tidak bisa menulis ke luar direktori yang memang dibutuhkan.

## 5. Reverse proxy & TLS

Pilih satu:

- **Nginx** — `deploy/nginx/almaidah.conf`. Pasang certbot lalu jalankan
  `certbot --nginx -d example.com` (akan menulis ulang blok TLS secara
  otomatis); redirect HTTP→HTTPS sudah ada di contoh.
- **Caddy** — `deploy/caddy/Caddyfile`. TLS otomatis (Let's Encrypt), tidak
  perlu certbot terpisah.

Keduanya sudah dikonfigurasi untuk:

- Menimpa `X-Forwarded-For` dengan IP klien asli (lihat §3 di atas).
- Meneruskan `Host` dan `X-Forwarded-Proto`.
- `client_max_body_size`/`request_body max_size` 6 MB (5 MB batas upload
  aplikasi + headroom multipart).
- Cache panjang untuk `/_next/static/*` (content-hashed, aman di-cache
  selamanya).

HSTS (`Strict-Transport-Security`) bisa diaktifkan di level proxy (dikomentari
di kedua contoh) **atau** otomatis dikirim oleh aplikasi Next.js sendiri saat
`NEXT_PUBLIC_SITE_URL` berawalan `https://` — jangan set keduanya secara
berbeda (nilai `max-age` harus konsisten bila keduanya aktif).

### Varian: Cloudflare Tunnel (staging)

Bila TLS diterminasi di edge Cloudflare dan `cloudflared` satu-satunya jalur
masuk (tanpa certbot, tanpa port publik):

- Alur: Cloudflare → `cloudflared` → Nginx `127.0.0.1:<port>` → Next
  `127.0.0.1:3000` → Go `127.0.0.1:8081`. Semua listener hanya di loopback
  (`HTTP_ADDR=127.0.0.1:8081`, `next start -H 127.0.0.1`).
- Vhost Nginx cukup satu blok `listen 127.0.0.1:<port>` tanpa TLS; set
  `X-Forwarded-For` ke `CF-Connecting-IP` (bukan append), karena edge
  Cloudflare *menambahkan* ke XFF milik klien. `TRUSTED_PROXIES` tetap default
  loopback.
- `COOKIE_SECURE=true`, `PUBLIC_SITE_URL`/`NEXT_PUBLIC_SITE_URL` = URL https
  publik (rebuild frontend setelah mengubahnya), `APP_ENV=staging`.
- **Jangan** sajikan `next dev` lewat tunnel/CDN: nama chunk dev tidak
  ber-hash dan Browser Cache TTL Cloudflare menahannya berjam-jam, sehingga
  hidrasi gagal (tombol mati, form login terkirim native). Bila terpaksa,
  isi `NEXT_ALLOWED_DEV_ORIGINS` dengan hostname tunnel.

## 6. Runbook

### Update / redeploy

```bash
cd /opt/portal-berita
git pull
cd backend && go build -o bin/api ./cmd/api && go build -o bin/tool ./cmd/tool && cd ..
sudo systemctl restart almaidah-api        # API dulu
cd frontend && bun install --frozen-lockfile && bun run build && cd ..
sudo systemctl restart almaidah-web        # baru web, setelah build selesai
sudo systemctl status almaidah-api almaidah-web
curl -si http://127.0.0.1:8080/healthz
curl -si http://127.0.0.1:8080/readyz
```

Bila ada migrasi baru: `cd backend && go run ./cmd/tool migrate up` setelah
`git pull`, sebelum restart API.

### Inspeksi log

```bash
journalctl -u almaidah-api -f          # ikuti log backend
journalctl -u almaidah-web -f          # ikuti log frontend
journalctl -u almaidah-api --since "1 hour ago"
```

### Health check

```bash
curl -si http://127.0.0.1:8080/healthz     # 200 {"status":"ok"}
curl -si http://127.0.0.1:8080/readyz      # 200 jika DB terjangkau, 503 jika tidak
curl -si https://example.com/              # lewat proxy, dari luar
```

### Rotasi rahasia

- **`JWT_SECRET`**: mengganti nilai ini langsung membatalkan **semua** sesi
  login yang sedang aktif (access & refresh token yang sudah diterbitkan
  tidak lagi valid) — semua pengguna admin harus login ulang. Lakukan saat
  traffic rendah, umumkan ke pengguna CMS.
- **`REVALIDATE_SECRET`**: ganti di `backend/.env` **dan** `frontend/.env.local`
  secara bersamaan (harus identik), lalu restart kedua layanan; bila berbeda
  sebentar saja, webhook revalidate akan ditolak (401) dan konten yang baru
  disimpan admin tampil basi sampai TTL jaring pengaman 1 jam habis atau
  tombol "Bersihkan cache" ditekan.
- **Password database (`portal`)**: lihat `docs/09-konvensi-dan-operasional.md`
  §4 poin 3 — ganti sebelum production sungguhan, karena password lama sudah
  pernah muncul di percakapan pengembangan. Update `DATABASE_URL` di
  `backend/.env`, restart `almaidah-api`.

### Firewall database

Server PostgreSQL bersifat **bersama dan tidak bisa dibuang**
(`<DB_HOST>:<DB_PORT>`). Rekomendasi operasional (tindakan di sisi server DB,
bukan kode):

1. Batasi port <DB_PORT> hanya menerima koneksi dari IP server aplikasi ini
   (firewall / `pg_hba.conf`).
2. Pastikan `sslmode=require` benar-benar dipaksa (TLS aktif di sisi server).
3. User `portal` idealnya dipisah: satu untuk migrasi (DDL), satu untuk
   aplikasi (DML saja) — lihat `docs/09` §4 poin 4 (belum dilakukan; catatan
   untuk pemilik server).

### Backup & restore

Lihat [`deploy/backup.sh`](../deploy/backup.sh) (jalankan via cron harian) dan
[`deploy/restore.md`](../deploy/restore.md) untuk prosedur pemulihan lengkap.

## 7. Yang belum diputuskan pemilik

- **Domain produksi & lokasi hosting** — `docs/09-konvensi-dan-operasional.md`
  §6 pertanyaan #5 masih terbuka. Sampai domain final ditentukan, dokumen ini
  memakai `example.com` sebagai placeholder di semua contoh; ganti di setiap
  berkas `deploy/` saat domain sudah ada.
- Setelah deploy pertama ke domain asli: jalankan Google Rich Results Test
  pada satu URL artikel, satu agenda, dan satu video untuk memverifikasi
  JSON-LD di production (bukan bagian dari Fase 6, tindakan manual pemilik).
