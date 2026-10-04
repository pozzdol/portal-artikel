# Pemulihan (restore) dari backup

Pasangan berkas yang dihasilkan `deploy/backup.sh`:

- `db-YYYYmmdd-HHMM.dump` — dump database dalam format custom `pg_dump -Fc`.
- `uploads-YYYYmmdd-HHMM.tgz` — arsip folder `backend/uploads/`.

Lakukan ini di server yang benar-benar butuh dipulihkan (server baru, atau
setelah insiden). **Selalu backup kondisi saat ini dulu** sebelum menimpa apa
pun, kecuali servernya memang kosong.

## 1. Hentikan layanan

```bash
sudo systemctl stop almaidah-web almaidah-api
```

## 2. Pulihkan database

Database berada di server bersama (`<DB_HOST>:<DB_PORT>`, lihat `AGENTS.md`) —
**jangan** `DROP DATABASE`; gunakan `--clean --if-exists` agar `pg_restore`
sendiri yang menghapus objek lama sebelum membuat ulang.

```bash
pg_restore --clean --if-exists --no-owner \
  -d "$DATABASE_URL" \
  /path/ke/db-YYYYmmdd-HHMM.dump
```

`$DATABASE_URL` bisa disalin dari `backend/.env` (jangan tulis di shell
history / log). Bila restore ke database/skema yang berbeda dari sumber
dump, sesuaikan `-d` sesuai target.

Setelah restore, jalankan `make migrate-status` untuk memastikan versi skema
migrasi konsisten dengan kode yang di-deploy — bila dump lebih lama dari
migrasi terbaru, jalankan `make migrate-up`.

## 3. Pulihkan uploads

```bash
cd /opt/portal-berita/backend
rm -rf uploads   # hanya bila memang menimpa total; backup dulu jika ragu
tar -xzf /path/ke/uploads-YYYYmmdd-HHMM.tgz
chown -R almaidah:almaidah uploads
```

## 4. Bersihkan cache dan nyalakan kembali

```bash
sudo systemctl start almaidah-api
sudo systemctl start almaidah-web
```

Karena homepage/detail artikel memakai ISR (Next.js ambil data dari cache
bertag, disegarkan lewat webhook `REVALIDATE_SECRET`), konten yang dipulihkan
bisa saja masih menampilkan versi cache lama sesaat setelah restore. Segarkan
dengan salah satu:

- Tombol **"Bersihkan cache"** di `/admin` (Pengaturan), atau
- Restart `almaidah-web` (menghapus cache in-memory milik proses; cache di
  disk `.next/cache` tetap ada dan divalidasi ulang oleh tag saat request
  berikutnya).

## 5. Verifikasi

```bash
curl -si https://example.com/healthz-nya-lewat-proxy   # atau langsung :8080/healthz di server
curl -si http://127.0.0.1:8080/readyz                  # {"status":"ok","database":"ok"}
curl -si https://example.com/ | head -20
```

Cek juga login admin (`/admin`) dan bahwa jumlah artikel/media masuk akal
dibanding sebelum insiden.
