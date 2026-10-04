# Dokumentasi Portal Berita ALMAIDAH

Portal berita resmi komunitas **ALMAIDAH — Alumni Darul Hikmah Sumedang**.
Dokumen di folder ini merekam seluruh hasil diskusi perencanaan (26 September 2026)
dan menjadi acuan implementasi. Jika ada keputusan yang berubah, perbarui dokumen
terkait **sebelum** mengubah kode.

## Daftar dokumen

| No | Dokumen | Isi |
|---|---|---|
| 01 | [Ringkasan Diskusi & Keputusan](01-diskusi-dan-keputusan.md) | Semua pertanyaan, pilihan, jawaban, dan alasan keputusan |
| 02 | [Analisis Desain](02-analisis-desain.md) | Bedah desain referensi: token visual, 14 section homepage, pemetaan ke data |
| 03 | [Arsitektur Sistem](03-arsitektur.md) | Tech stack, struktur monorepo, alur request, auth, ISR, media, keamanan |
| 04 | [Skema Database](04-skema-database.md) | Seluruh tabel, kolom, relasi, index, dan seed awal |
| 05 | [Spesifikasi API](05-api.md) | Endpoint publik & admin, format respons, error, paginasi |
| 06 | [Frontend Publik](06-frontend-publik.md) | Routing, komponen, section types homepage, SEO, dark mode |
| 07 | [Admin CMS](07-admin-cms.md) | Halaman admin, editor, section builder, RBAC di UI |
| 08 | [Fase Kerja](08-fase-kerja.md) | Pembagian fase, task detail, deliverable, kriteria selesai |
| 09 | [Konvensi & Operasional](09-konvensi-dan-operasional.md) | Coding standard, environment, cara menjalankan, pertanyaan terbuka |
| 10 | [Kekurangan & Rencana Pasca-MVP](10-rencana-pasca-mvp.md) | Semua yang belum ada di v1.0.0: tindakan pemilik, keamanan, operasional, editorial, fitur pembaca, SEO, UX, skala, urutan Fase 7–10 |
| — | [Produksi (Deploy)](deploy.md) | Systemd units, Nginx/Caddy config, backup, tanpa Docker |

## Ringkasan satu paragraf

Monorepo tanpa Docker berisi **backend Go** (Chi, sqlc + pgx, goose) dan **frontend
Next.js + TypeScript** (App Router, SSR + ISR, Tailwind), dengan database
**PostgreSQL 17** di server `<DB_HOST>:<DB_PORT>`. Hampir seluruh konten, termasuk
susunan homepage, menu, dan pengaturan situs, dikelola dari **Admin CMS** di `/admin`,
sehingga perubahan konten tidak memerlukan perubahan kode. Halaman publik tetap
SEO-friendly karena dirender di server dan di-cache, lalu otomatis diperbarui
(revalidate) setiap kali admin menyimpan perubahan.
