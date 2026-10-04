# 01 — Ringkasan Diskusi & Keputusan

Tanggal diskusi: **26 September 2026**
Peserta: Pemilik proyek (Fikri Anshori) dan Claude (peran: senior software engineer)

Dokumen ini mencatat setiap pertanyaan yang diajukan, opsi yang tersedia, pilihan
yang diambil, dan alasan/konsekuensinya. Tujuannya agar keputusan tidak dibahas
ulang tanpa alasan baru.

---

## Konteks awal

- **Kebutuhan:** portal berita untuk komunitas alumni.
- **Stack yang ditentukan pemilik:** frontend Next.js + TypeScript, backend Go, database PostgreSQL.
- **Database:** awalnya diberikan sebagai `jdbc:postgresql://localhost:<DB_PORT>/portal_berita`, lalu **dikoreksi**: host sebenarnya `<DB_HOST>`, bukan localhost.
  - Hasil verifikasi koneksi: **PostgreSQL 17.10** (Ubuntu), database `portal_berita` **masih kosong** (belum ada tabel).
- **Desain referensi:** proyek claude.ai/design `c6c59291-98dd-4d74-9317-1762b5b97783`, file `ALMAIDAH Homepage.dc.html`. Analisis lengkapnya ada di [02-analisis-desain.md](02-analisis-desain.md).
- **Kondisi mesin pengembangan:** WSL2 Linux, Go 1.22.5, Node.js v24.15.0, dan `psql` sudah terpasang. Folder `/opt/portal-berita` masih kosong dan belum menjadi git repository.

---

## Putaran 1 — Produk & Rendering

### Q1. Siapa yang menulis dan mengelola berita?
| Opsi | Keterangan |
|---|---|
| Admin + Editor + Penulis | Alur draft → review → publish |
| Admin saja | Paling sederhana |
| Admin + kontributor publik | Anggota bisa mengirim tulisan |

**Jawaban:** *"Untuk sekarang hanya admin dan super administrator, mungkin ke depannya akan ada editor dan lain-lain."*

**Keputusan:**
- Role awal: `super_admin` dan `admin`.
- RBAC dibuat **dapat diperluas sejak awal** dengan tabel `roles`, `permissions`, dan `role_permissions`. Kode selalu memeriksa *permission* (misal `articles.publish`), **bukan** nama role, sehingga role baru seperti `editor` bisa ditambah lewat data tanpa mengubah logika.

### Q2. Bentuk panel admin / CMS?
| Opsi | Keterangan |
|---|---|
| **Dashboard di Next.js yang sama** ✅ | Route `/admin`, editor rich-text |
| Aplikasi admin terpisah | Dua codebase frontend |
| Belum perlu CMS | Konten via API/seed |

**Alasan:** satu codebase frontend, satu proses deploy, dan design token yang dipakai bersama.

### Q3. Strategi rendering halaman publik?
| Opsi | Keterangan |
|---|---|
| **SSR + ISR** ✅ | Di-cache, direvalidasi saat konten berubah |
| Full SSR | Selalu render per request |
| SPA / client-side | SEO lemah |

**Alasan:** SEO optimal, respons cepat karena di-cache, dan konten tetap segar lewat revalidasi on-demand saat admin menyimpan.

### Q4. Fitur interaksi pembaca untuk MVP?
**Jawaban:** *"Kita obrolkan setelah kamu membaca desainnya."* Dijawab di Putaran 4 (Q14).

---

## Putaran 2 — Backend & Infrastruktur

### Q5. Framework HTTP Go?
| Opsi | Keterangan |
|---|---|
| **Chi** ✅ | Ringan, kompatibel penuh dengan net/http |
| Gin | Populer, ekosistem besar |
| Fiber | Berbasis fasthttp, tidak kompatibel net/http |
| net/http standar | Tanpa dependency |

**Alasan:** idiomatis, middleware standar `net/http` bisa dipakai langsung, dan mudah dirawat jangka panjang.

### Q6. Akses database?
| Opsi | Keterangan |
|---|---|
| **sqlc + pgx + goose** ✅ | SQL murni menghasilkan kode Go yang type-safe |
| GORM | ORM, auto-migrate |
| pgx + query manual | Banyak boilerplate |

**Alasan:** query kompleks (full-text search, agregasi view, JSONB) tetap terkendali dan eksplisit. Tidak ada perilaku ORM yang tersembunyi.

### Q7. Autentikasi admin?
| Opsi | Keterangan |
|---|---|
| **JWT di httpOnly cookie** ✅ | Access pendek + refresh di DB |
| Session di database | Session ID di cookie |
| JWT di localStorage | Rentan XSS, tidak jalan di SSR |

**Alasan:** token tidak bisa dibaca JavaScript, bekerja pada SSR, dan sesi bisa dicabut kapan saja karena refresh token tersimpan di DB.

### Q8. Penyimpanan media?
| Opsi | Keterangan |
|---|---|
| **Disk lokal dulu, siap S3** ✅ | Interface `Storage` |
| MinIO sejak awal | Butuh Docker |
| Cloud storage | Butuh akun cloud |

---

## Putaran 3 — Struktur Proyek & Lingkungan

### Q9. Struktur repository?
**Jawaban:** *"Monorepo, tetapi jangan gunakan Docker terlebih dahulu."*
**Keputusan:** satu repo `/opt/portal-berita` dengan folder `backend/`, `frontend/`, dan `docs/`. **Tidak ada Dockerfile atau docker-compose** di fase ini. Aplikasi dijalankan langsung dengan `go run` / `npm run dev`.

### Q10. Library styling frontend?
| Opsi | Keterangan |
|---|---|
| Ikuti design system TTL | Port tokens.css |
| **Tailwind CSS** ✅ | Token dipetakan ke Tailwind theme |
| Bootstrap | Seperti vendor desain |

**Catatan setelah membaca desain:** tampilan homepage ALMAIDAH **tidak** memakai palet biru TTL. Desainnya editorial hitam-putih dengan aksen emas, dan hampir seluruhnya berupa inline style. Token Tailwind diambil dari desain homepage (lihat [02-analisis-desain.md](02-analisis-desain.md)), **bukan** dari `tokens.css` TTL.

### Q11. Bahasa konten?
**Jawaban:** **Bahasa Indonesia saja**. Tidak ada i18n. Slug, label UI, dan format tanggal (`id-ID`) berbahasa Indonesia.

### Q-DB. PostgreSQL di localhost:<DB_PORT> tidak menyala?
**Jawaban:** *"Bukan di localhost tetapi di <DB_HOST>."*
**Tindak lanjut:** koneksi sudah diverifikasi berhasil ke PostgreSQL 17.10. Credential disimpan di `backend/.env` dan **tidak** ditulis di dokumentasi atau di-commit.

---

## Putaran 4 — Konten & Fitur (setelah membaca desain)

### Q12. Section mana yang dikelola lewat CMS?
Opsi (multi-pilih): Agenda/Event, Tokoh Alumni, Video (embed YouTube), Konten pendek (announcement bar, breaking ticker, quote, FAQ).

**Jawaban:** semua opsi dipilih, ditambah catatan: *"Saya mau semuanya mayoritas dinamis agar tidak sering merubah code ke depannya, tetapi tetap SEO friendly."*

**Keputusan (prinsip desain utama proyek):**
> **Konten adalah data, bukan kode.** Semua yang terlihat oleh pembaca dan mungkin berubah
> (teks, urutan section, menu, kontak, sosmed, FAQ, quote, announcement, logo, dsb.)
> disimpan di database dan diedit dari admin. Kode hanya mendefinisikan **tipe** tampilan
> (komponen) dan aturan validasinya.

SEO dijaga dengan SSR + ISR, metadata per konten, sitemap dinamis, dan JSON-LD. Detailnya di [06-frontend-publik.md](06-frontend-publik.md#seo).

### Q13. Siapa "penulis" yang tampil di artikel?
| Opsi | Keterangan |
|---|---|
| Entitas Penulis terpisah | Tanpa login, dipilih dari daftar |
| **Penulis = akun admin** ✅ | Nama penulis = user |

**Konsekuensi yang disampaikan dan disepakati:**
- Setiap nama yang tampil sebagai penulis (misal "Ust. Ahmad Fauzi") harus punya baris di tabel `users`.
- Tabel `users` dilengkapi profil publik: `display_name`, `title` (gelar/jabatan), `bio`, `avatar_media_id`, dan `slug` untuk halaman penulis `/penulis/[slug]`.
- Ada flag **`can_login`**. Ustaz yang hanya perlu tampil sebagai penulis dibuatkan akun dengan `can_login = false` dan tanpa password, sehingga ia tidak mendapat akses ke admin.
- Saat menulis artikel, admin memilih **penulis** dari daftar users. Default-nya diri sendiri. Kolom `created_by` tetap mencatat siapa yang sebenarnya menginput (audit).

### Q14. Fitur pembaca untuk MVP?
Opsi (multi-pilih): Pencarian, Trending & populer (view count), Newsletter, Mode gelap.

**Jawaban:** **Pencarian artikel, Trending & populer, Mode gelap.**
- **Newsletter TIDAK masuk MVP.** Tipe section `newsletter` tetap tersedia agar layout desain lengkap, tetapi **nonaktif** secara default. Backend penyimpanan subscriber dan pengiriman email dikerjakan di fase lanjutan.
- **Komentar** tidak ada di desain dan tidak masuk MVP.

### Q15. Halaman publik fase 1 selain homepage?
**Jawaban (semua dipilih):**
- Detail artikel
- Listing kategori & tag (dengan paginasi)
- Halaman statis (Profil Yayasan, Redaksi, Pedoman Media, Karier, Kebijakan Privasi, S&K), diedit dari admin
- Halaman Agenda, Tokoh Alumni, dan Video (index + detail)

---

## Putaran 5 — Tingkat Dinamisme

### Q16. Seberapa dinamis layout homepage?
| Opsi | Keterangan |
|---|---|
| **Section builder** ✅ | Urutan, show/hide, judul, sumber data diatur admin |
| Layout tetap, data dinamis | Hanya toggle on/off |

**Artinya:** admin dapat mengatur **urutan** (drag & drop), **show/hide**, **judul/eyebrow/link "lihat semua"**, dan **sumber data** setiap section (misal "Grid 3 kolom, kategori Kajian, 3 item"), serta **menambah section baru** dari tipe yang sudah tersedia tanpa mengubah kode. Daftar tipe section ada di [06-frontend-publik.md](06-frontend-publik.md#section-types).

### Q17. Menu header/footer, kontak, sosial media?
**Jawaban:** **Dikelola dari admin** melalui tabel `menus`, `menu_items`, dan `site_settings`.

### Q18. Model data "Kegiatan Yayasan"?
| Opsi | Keterangan |
|---|---|
| **Artikel kategori "Yayasan"** ✅ | + `event_date`, `event_location` opsional |
| Entitas terpisah | Tabel sendiri |

**Alasan:** kegiatan otomatis punya halaman detail, SEO, tag, dan pencarian. Section timeline cukup mengambil artikel dari kategori ini dan mengurutkannya berdasarkan `event_date`.

---

---

## Putaran 6 — Library Komponen (27 September 2026, awal Fase 5)

### Q19. Library komponen UI?
**Jawaban pemilik:** *"Saya mau semua components menggunakan shadcn termasuk button, input, select, datepicker, timepicker, rangepicker dan lain-lain dengan custom menyesuaikan token yang sudah kita bangun; ubah jika components lain menggunakan selain shadcn."*

**Keputusan:**
- **shadcn/ui** (Radix UI + Tailwind v4, kode komponen disalin ke `frontend/src/components/ui/shadcn/` via `bunx shadcn`) menjadi standar untuk **admin CMS dan situs publik**.
- Theme shadcn (`--background`, `--primary`, `--radius`, dst.) dipetakan ke token ALMAIDAH (`paper`, `ink`, `gold`, `line`, `muted`, …) di `globals.css`, termasuk dark mode; sudut kotak sesuai desain.
- Date picker, time picker, dan range picker dibangun dari komponen shadcn (`Calendar`/react-day-picker + `Popover` + `Input`/`Select`).
- Komponen interaktif yang sudah ada di Fase 4 (tombol, input pencarian, dialog/menu mobile, accordion FAQ, toggle tema, pagination, dsb.) **dimigrasi** ke shadcn tanpa mengubah tampilan desain.
- Menjawab pertanyaan terbuka #1 di dok 09.

## Tabel keputusan final

| Area | Keputusan |
|---|---|
| Struktur repo | Monorepo `/opt/portal-berita/{backend,frontend,docs}`, **tanpa Docker** |
| Backend | Go 1.27 (awalnya 1.22; di-upgrade di Fase 6 atas keputusan pemilik agar govulncheck bersih) · Chi v5 · sqlc + pgx v5 · goose |
| Database | PostgreSQL 17.10 di `<DB_HOST>:<DB_PORT>`, DB `portal_berita`, user `portal` (password di `.env`) |
| Auth | Access JWT (15 menit) + refresh token (7 hari, disimpan hash-nya di DB, rotasi, bisa di-revoke), keduanya di httpOnly cookie |
| RBAC | `roles` / `permissions` / `role_permissions`; awal: `super_admin`, `admin` |
| Penulis | = akun `users` (profil publik + flag `can_login`) |
| Frontend | Next.js App Router + TypeScript · SSR + ISR dengan revalidasi on-demand berbasis tag |
| Komponen UI | shadcn/ui (admin + publik), theme = token ALMAIDAH |
| Styling | Tailwind CSS, token dari desain ALMAIDAH (hitam/putih/emas `#C9A227`, Cormorant Garamond + Inter) |
| CMS | `/admin` di aplikasi Next.js yang sama |
| Homepage | Section builder (urutan, visibilitas, konfigurasi JSON per tipe, sumber data) |
| Konten dinamis | Artikel, kategori, tag, agenda, tokoh alumni, video YouTube, halaman statis, snippet (announcement/breaking/quote/FAQ), menu, pengaturan situs |
| Kegiatan Yayasan | Artikel kategori "Yayasan" + `event_date` / `event_location` |
| Media | Disk lokal di balik interface `Storage` (siap S3) |
| Bahasa | Bahasa Indonesia saja |
| Fitur pembaca MVP | Pencarian, trending & populer (view count), mode gelap |
| Tidak masuk MVP | Newsletter (section ada tapi nonaktif), komentar, bookmark, multi-bahasa, Docker |
