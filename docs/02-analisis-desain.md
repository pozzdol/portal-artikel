# 02 — Analisis Desain Referensi

**Sumber:** claude.ai/design, proyek `c6c59291-98dd-4d74-9317-1762b5b97783`
**File utama:** `ALMAIDAH Homepage.dc.html` (652 baris)
**Aset:** `uploads/logo-1786070367709-ed33.png` (logo), design system `_ds/ttl-design-system-…`

---

## 1. Temuan penting

1. **Desain homepage tidak memakai design system TTL secara visual.** File tersebut me-load
   Bootstrap + token TTL (biru korporat `#004575`), tetapi seluruh elemen di-styling ulang
   dengan inline style bergaya **editorial minimalis**: hitam, putih, abu-abu, dan aksen **emas**.
   Implementasi mengikuti **tampilan halaman**, bukan token TTL.
2. **Sudut kotak (radius 0)** untuk gambar, kartu, dan section, sesuai `data-radius="square"`.
   Pengecualian yang disengaja: tombol header (radius 8px), tag chip (pill 20px),
   avatar/bullet timeline (lingkaran), dan badge "Breaking" (4px).
3. **Font:** *Cormorant Garamond* (serif, untuk judul) dan *Inter* (sans, untuk UI dan body),
   keduanya dari Google Fonts. Font TTL (EuropaNuova, SF UI Text) **tidak dipakai**.
4. Ada interaksi di sisi klien: **toggle dark mode**, **quote berputar** setiap 6 detik
   (fade), **FAQ accordion** (satu terbuka), **marquee** breaking news (26 detik, loop), dan
   form newsletter.
5. **Breadcrumb** "Beranda / Kajian" muncul di homepage. Ini kemungkinan sisa template.
   Di implementasi, breadcrumb **hanya dipakai di halaman dalam** (detail, listing), tidak di homepage.
6. Lebar konten maksimum **1320px** dengan padding horizontal **40px**. Jarak antar section **88px**.

## 2. Design tokens (untuk Tailwind)

### Warna

| Token | Nilai | Penggunaan di desain |
|---|---|---|
| `ink` | `#111111` | Teks utama, background bar gelap (announcement, breaking, quote, newsletter), border tebal judul widget |
| `paper` | `#FFFFFF` | Background halaman |
| `gold` | `#C9A227` | Eyebrow/kategori, angka trending, bullet timeline, tanggal agenda, badge Breaking, tombol Subscribe, `::selection`, underline menu aktif |
| `muted-100` | `#F5F5F5` | Placeholder gambar, kotak sidebar (agenda terdekat, kalender) |
| `line` | `#E8E8E8` | Semua border tipis dan divider |
| `text-body` | `#3A3A3A` | Paragraf hero |
| `text-soft` | `#555555` | Excerpt, link footer |
| `text-meta` | `#666666` | Meta (tanggal/penulis), subtitle logo |
| `text-faint` | light `#6A6A6A` (5,41:1 di paper, 4,96:1 di muted) · dark `#9C9C9C` (7,03:1 / 6,47:1) | Meta kecil, breadcrumb (AA, UX pass 2026-10) |
| `text-ghost` | light `#707070` (4,95:1 di paper, 4,54:1 di muted) · dark `#8A8A8A` (5,59:1 / 5,14:1) | Placeholder, angka kategori, copyright (AA) |
| Teks minimum | 12 px; target sentuh ≥ 44 px di < 1024 px | Berlaku untuk semua elemen interaktif dan teks |
| `dark-input-bg` | `#1A1A1A` | Input newsletter di latar gelap |
| `dark-input-line` | `#333333` | Border input di latar gelap |
| `on-dark-muted` | `#B8B8B8` | Paragraf di section gelap |

**Mode gelap:** desain memiliki tombol toggle, tetapi tidak menyertakan palet gelap.
Usulan palet gelap (divalidasi saat Fase 4):

| Token | Terang | Gelap |
|---|---|---|
| background | `#FFFFFF` | `#0E0E0E` |
| surface (muted) | `#F5F5F5` | `#181818` |
| line | `#E8E8E8` | `#2A2A2A` |
| teks utama | `#111111` | `#F2F2F2` |
| teks soft/meta | `#555` / `#666` / `#888` | `#B5B5B5` / `#9A9A9A` / `#7A7A7A` |
| gold | `#C9A227` | `#D4B04A` (sedikit lebih terang agar kontras) |
| section "ink" (quote, breaking) | `#111111` | `#000000` + border atas/bawah `#2A2A2A` |

Semua warna dipasang sebagai **CSS variables**, lalu dipetakan ke Tailwind melalui `@theme`,
sehingga mode gelap cukup mengganti nilai variabel di `.dark`.

### Tipografi

| Peran | Font | Ukuran / line-height / weight |
|---|---|---|
| H1 hero / artikel | Cormorant Garamond | 30–32px (< 640) · 36px (640–1023) · 44px (1024–1535) · 52px (≥ 1536) / 1.12 / 600, letter-spacing −0.01em |
| Lebar baca artikel | — | `--container-prose` 40rem (640 px), dipakai `max-w-prose` dan `.prose-almaidah` |
| H2 section | Cormorant Garamond | 34px / 600 (varian 28–30px) |
| H3 kartu besar | Cormorant Garamond | 22px / 1.3 / 600 |
| H3 kartu kecil | Cormorant Garamond | 18–20px / 1.35 / 600 |
| Quote | Cormorant Garamond italic | 38px / 1.5 / 500 |
| Nama brand | Cormorant Garamond | 22px / 700, letter-spacing 0.02em |
| Body lead | Inter | 17px / 1.7 / 400 |
| Body | Inter | 14–15px / 1.6–1.7 / 400 |
| Nav | Inter | 14.5px / 500 |
| Eyebrow / kategori | Inter | 10.5–12px / 700, uppercase, letter-spacing 0.1–0.12em |
| Judul widget sidebar | Inter | 12px / 700, uppercase, 0.12em, border-bottom 2px ink |
| Meta | Inter | 11.5–13.5px / 500 |

Font di-load dengan `next/font/google` (self-hosted otomatis, tanpa layout shift):
Cormorant Garamond (500, 600, 700, italic 500) dan Inter (400, 500, 600, 700).

### Spacing & layout

| Token | Nilai |
|---|---|
| Container | `max-width: 1320px`, padding-x 40px (mobile: 16–20px) |
| Jarak vertikal section | 56px (< 640) · 72px (640–1023) · 88px (≥ 1024); quote 110px, newsletter 96px di desktop |
| Gap grid | 32–40px (kartu), 56px (kolom utama vs sidebar) |
| Lebar sidebar | hero trending 300px (md) · 340px (lg) · 380px (xl); latest & agenda 340px |
| Rasio gambar | 16:9 (hero, opini utama, video), 4:3 (kartu, timeline), 3:4 (tokoh), 1:1 (thumbnail 64/96px) |

### Responsif

Desain hanya berupa versi desktop. Aturan responsif yang diusulkan:

| Breakpoint | Perilaku |
|---|---|
| `< 640px` | Semua grid menjadi 1 kolom; sidebar turun ke bawah; nav menjadi menu hamburger (drawer); H1 36px; H2 28px |
| `640–1023px` | Grid 4 menjadi 2 kolom, grid 3 menjadi 2 kolom; sidebar di bawah konten |
| `≥ 1024px` | Sesuai desain; nav tampil dari 1024 px (overflow → Lainnya), tanggal header tetap ≥ 1536 px |

---

## 3. Bedah 14 section homepage → data

Setiap baris di bawah menjadi satu **tipe section** di section builder (lihat
[06-frontend-publik.md](06-frontend-publik.md#section-types)) atau elemen layout global.

| # | Section desain | Jenis | Sumber data | Tipe section / komponen |
|---|---|---|---|---|
| 1 | **Top Announcement Bar** (hitam, 2 pesan dipisah • emas) | Layout global | `snippets` tipe `announcement` (bisa lebih dari satu, aktif/nonaktif, periode tayang) | `<AnnouncementBar>` |
| 2 | **Header** sticky: logo + nama + tagline, nav 8 item (aktif: underline emas), tanggal hari ini, tombol cari, toggle gelap, tombol "Login Admin" | Layout global | `site_settings` (logo, nama, tagline), `menus` `header` | `<SiteHeader>` |
| — | Breadcrumb | Hanya halaman dalam | Dihitung dari route | `<Breadcrumb>` |
| 3 | **Hero Editorial**: artikel utama (gambar 16:9, kategori, H1, excerpt, penulis • tanggal • waktu baca) + **Trending Hari Ini** (5 item bernomor 01–05, thumbnail 64px) | Section | Artikel `is_featured` terbaru (atau pilih manual) + trending 24 jam dari view count | `hero_trending` |
| 4 | **Breaking News** marquee (badge emas "Breaking", teks bergantian putih/emas) | Section | `snippets` tipe `breaking` (teks + link opsional) atau artikel `is_breaking` | `breaking_ticker` |
| 5 | **Kajian Terbaru**: eyebrow "Kategori Utama", H2, link "Lihat Semua Kajian →", grid 3 kartu (gambar 4:3, subkategori Fikih/Tafsir/Akhlak, judul, excerpt, penulis · waktu baca) | Section | Artikel dari kategori "Kajian" beserta subkategorinya | `article_grid` (columns=3, show_excerpt=true) |
| 6 | **Berita Alumni**: grid 4 kartu (gambar, kategori, judul, tanggal · menit) | Section | Artikel dari kategori "Berita"/"Alumni" | `article_grid` (columns=4, show_excerpt=false) |
| — | **Berita Terbaru + Sidebar**: list 4 artikel (kategori, judul, tanggal ringkas "25 Jul") + sidebar: Artikel Populer (3), Kategori + jumlah artikel, Tag Populer (chip), Agenda Terdekat | Section | Artikel terbaru semua kategori; populer 30 hari; kategori + count; tag teratas; event terdekat | `latest_with_sidebar` |
| 7 | **Quote**: latar hitam, kutipan italic 38px berputar tiap 6 detik (fade), sumber emas uppercase | Section | `snippets` tipe `quote` (teks + sumber) | `quote_rotator` |
| 8 | **Kegiatan Yayasan**: eyebrow "Yayasan Darul Hikmah", timeline vertikal (garis + bullet emas), tiap item: gambar 160px 4:3, "tanggal · lokasi", judul, ringkasan | Section | Artikel kategori "Yayasan", urut `event_date` desc | `timeline` |
| 9 | **Opini**: kiri artikel utama (16:9, "Opini Utama", H3 30px, excerpt, "Penulis · Jabatan"); kanan 3 artikel (thumb 96px, judul, penulis · menit) | Section | Artikel kategori "Opini" (yang pertama = utama) | `feature_split` |
| 10 | **Tokoh Alumni**: eyebrow "Author Expertise", grid 4 (foto 3:4, nama, peran emas, deskripsi, "Baca Kisah") | Section | `alumni_profiles` `is_featured` | `people_grid` |
| 11 | **Agenda**: list event (tanggal besar emas + bulan singkatan, judul, "jam WIB · lokasi") + **kalender bulanan** (tanggal event ditandai: emas = terdekat, hitam = lainnya) | Section | `events` mendatang | `agenda_calendar` |
| 12 | **Video**: 1 besar (1.5fr) + 2 kecil, thumbnail 16:9 dengan tombol play & durasi, judul, "3.2rb ditonton · tanggal" | Section | `videos` (YouTube) | `video_gallery` |
| — | **FAQ** "Pertanyaan Umum": accordion, satu terbuka, ikon +/− emas | Section | `snippets` tipe `faq` (pertanyaan + jawaban) | `faq` |
| 13 | **Newsletter**: latar hitam, judul, deskripsi, input email + tombol emas "Subscribe" | Section (**nonaktif** di MVP) | — | `newsletter` |
| 14 | **Footer**: logo + deskripsi + ikon sosmed (Instagram, YouTube, WhatsApp); kolom Kategori; kolom Tentang (Profil Yayasan, Redaksi, Pedoman Media, Karier); kolom Kontak (alamat, email, telepon); bar bawah © + Kebijakan Privasi + S&K | Layout global | `site_settings` (deskripsi, kontak, sosmed, copyright), `menus` `footer_1`, `footer_2`, `footer_legal` | `<SiteFooter>` |

## 4. Entitas yang muncul dari desain

| Entitas | Atribut yang terlihat di desain | Tambahan yang dibutuhkan |
|---|---|---|
| **Artikel** | gambar, kategori, subkategori, judul, excerpt, penulis, tanggal, waktu baca | slug, isi, tag, status, SEO meta, view count, `is_featured`, `event_date`/`event_location` (Yayasan) |
| **Kategori** | nama, jumlah artikel, hierarki (Kajian → Fikih/Tafsir/Akhlak) | slug, deskripsi, urutan, SEO |
| **Tag** | nama (chip) | slug |
| **Penulis (User)** | nama + gelar ("Ust.", "Ustzh.", "H."), jabatan ("Pengurus Yayasan") | slug, bio, avatar, `can_login` |
| **Event (Agenda)** | judul, tanggal, jam (WIB), lokasi | slug, deskripsi, gambar, waktu selesai |
| **Tokoh Alumni** | nama, peran, deskripsi singkat, foto, "Baca Kisah" (halaman detail) | slug, angkatan, kisah lengkap (rich text) |
| **Video** | judul, thumbnail, durasi, jumlah tonton, tanggal | URL/ID YouTube, deskripsi |
| **Snippet** | announcement, breaking, quote (teks + sumber), FAQ (tanya + jawab) | tipe, urutan, aktif, periode tayang |
| **Pengaturan situs** | nama, tagline, logo, deskripsi footer, alamat, email, telepon, sosmed, copyright | favicon, default OG image |
| **Menu** | nav header 8 item, footer Kategori, footer Tentang, footer legal | urutan, link internal/eksternal |

## 5. Contoh konten dari desain (dipakai sebagai seed)

Seed awal (Fase 1) memuat konten contoh berikut agar tampilan langsung sesuai desain:

- **Kategori:** Kajian (sub: Fikih, Tafsir, Akhlak, Aqidah), Berita (sub: Alumni, Prestasi, Komunitas, Karier), Yayasan, Opini, Agenda (kategori berita tentang agenda).
- **Penulis:** Ust. Ahmad Fauzi, Ust. Dedi Kurniawan, Ustzh. Nurul Hidayah, H. Muhammad Ridwan (Pengurus Yayasan), Siti Aminah, Fajar Nugraha, semuanya dengan `can_login = false`.
- **Artikel:** "Menjaga Keikhlasan di Tengah Derasnya Arus Informasi" (hero), 3 artikel kajian, 4 berita alumni, 4 berita terbaru, 3 kegiatan yayasan, 4 opini, dan judul-judul trending.
- **Tag:** Akhlak, Tahfidz, Beasiswa, Reuni, Fikih.
- **Agenda:** Kajian Subuh Bersama (15 Agu 2026, 05.00, Masjid Pusat Pesantren), Rapat Koordinasi Alumni Wilayah (22 Agu, 13.00, Aula Yayasan), Reuni Akbar Alumni 2026 (12 Des, 08.00, Kampus Pusat).
- **Tokoh:** Dr. H. Asep Suryana, Hj. Ratna Kusumawati, Muhammad Rizky Fadillah, Ustzh. Nurul Hidayah.
- **Video:** 3 video (URL YouTube placeholder yang bisa diganti admin).
- **Snippet:** 2 announcement, 3 breaking, 3 quote (QS. Al-Insyirah: 6; HR. Ahmad & Thabrani; HR. Bukhari), 3 FAQ.
- **Pengaturan:** alamat Jl. Darul Hikmah No. 1, Sumedang, Jawa Barat 45311; email redaksi@almaidah.id; telepon (0261) 123-456 (semua dapat diubah dari admin).

> Catatan: tanggal konten contoh di desain berada di Juli–Agustus 2026. Seed akan
> menggunakan tanggal relatif terhadap waktu seed dijalankan agar agenda tetap "mendatang".

## 6. Aset

- **Logo** `logo-1786070367709-ed33.png` diunduh ke `frontend/public/brand/logo.png` sebagai default, sekaligus di-seed ke `media` sehingga bisa diganti dari admin.
- Seluruh gambar di desain berupa **placeholder abu-abu**. Untuk seed, dipakai placeholder
  lokal yang netral, dan komponen menampilkan kotak `#F5F5F5` + border `#E8E8E8` bila gambar kosong (sesuai desain).
