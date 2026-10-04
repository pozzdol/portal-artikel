# deploy/

Berkas konfigurasi siap-pakai untuk menjalankan ALMAIDAH di production **tanpa
Docker** (keputusan pemilik — lihat `AGENTS.md`). Panduan lengkap dan
penjelasan ada di [`docs/deploy.md`](../docs/deploy.md); folder ini hanya
berisi berkas yang disalin/ditautkan ke server.

| Berkas | Fungsi |
|---|---|
| `systemd/almaidah-api.service` | Unit systemd untuk backend Go (`bin/api`, port 8080) |
| `systemd/almaidah-web.service` | Unit systemd untuk frontend Next.js (`bun run start`, port 3000) |
| `nginx/almaidah.conf` | Contoh reverse proxy Nginx (TLS via certbot) |
| `caddy/Caddyfile` | Contoh reverse proxy Caddy (TLS otomatis) |
| `backup.sh` | Skrip backup harian (dump database + arsip `uploads/`) |
| `restore.md` | Prosedur pemulihan dari hasil `backup.sh` |

Semua berkas di sini adalah **contoh/template**: ganti `example.com`, path
`/opt/portal-berita`, dan nama user `almaidah` sesuai server yang sebenarnya.
Tidak ada rahasia (password, secret) di berkas manapun di sini — isi rahasia
selalu ada di `backend/.env` / `frontend/.env.local` (gitignored, dibuat dari
`.env.example`) dengan permission `0600`.

Pilih **satu** reverse proxy (Nginx *atau* Caddy), bukan keduanya. Nginx cocok
bila TLS sudah dikelola lewat certbot terpisah; Caddy lebih sederhana karena
mengurus TLS otomatis (Let's Encrypt) tanpa konfigurasi tambahan.

Mulai dari `docs/deploy.md` untuk urutan langkah lengkap (build, user/dir,
env vars, systemd, reverse proxy, backup, runbook).
