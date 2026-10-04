# HTTP REST Collection

Koleksi request API untuk testing dan dokumentasi, format VS Code REST Client.

## Setup

1. Install extension **REST Client** di VS Code.
2. Buka file `.http` → klik tombol "Send Request" di atas setiap request.
3. Variabel global di bawah berlaku untuk semua file:
   - `@base = http://localhost:8080/api/v1` — base URL API (ganti ke prod jika perlu)
   - `@token = …` — set setelah login (ambil dari response atau cookie)
   - `@csrf = …` — set setelah login (ambil dari response)

## Struktur file

- **public.http** — endpoint publik (tanpa auth)
- **admin.http** — endpoint admin (auth + CSRF required)

## Cara kerja

1. Buka `admin.http`, cari request `Login` (###), tekan "Send Request".
2. Response berisi cookie dan CSRF token → otomatis disimpan di variabel lokal.
3. Request berikutnya menggunakan `@token` dan `@csrf` dari variabel.

## Catatan

- Password dalam contoh: `<PASSWORD>` — ganti dengan password admin sebenarnya.
- Content-Type multipart/form-data untuk upload media (REST Client auto-generate boundary).
- Request dengan `###` separator bisa dikirim satu-satu.

## Testing scenario (dari Fase 3 §4 live verification)

1. Public: `/public/site`, `/public/homepage`, `/public/categories`, `/public/articles?category=kajian`
2. Admin login, upload media (PNG OK, EXE → 415), create article dengan XSS (← sanitized)
3. Publish → public visible, revalidate webhook captured
4. Homepage reorder, menu replace, settings update
5. Slug change → old slug returns `{"data":{"redirect":"/…"}}`
6. Dashboard, media delete (409 if referenced), cleanup
