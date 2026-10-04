# 10 — Kekurangan Versi 1.0.0 & Rencana Pasca-MVP

Ditulis: **5 Oktober 2026**, setelah rilis `v1.0.0` (Fase 0–6 selesai, lihat [08-fase-kerja.md](08-fase-kerja.md)).

Dokumen ini merangkum **semua yang belum ada atau belum ideal** di versi sekarang, diambil dari
seluruh diskusi sejak awal proyek: keputusan yang sengaja ditunda, temuan QA dan audit tiap fase,
keterbatasan yang diterima, serta celah yang baru terlihat setelah sistem berjalan utuh. Setiap butir
menjelaskan **kondisi sekarang**, **dampaknya**, **rencana teknis**, dan **kriteria selesai**, sehingga
bisa langsung dijadikan bahan planner untuk fase berikutnya.

## 1. Cara membaca

| Prioritas | Arti |
|---|---|
| **P0** | Wajib sebelum situs dibuka ke publik / produksi |
| **P1** | Penting dalam 1–3 bulan pertama setelah produksi |
| **P2** | Bernilai, dikerjakan bila kapasitas ada |
| **P3** | Opsional / menunggu kebutuhan nyata |

| Ukuran | Perkiraan |
|---|---|
| **S** | ≤ 1 hari kerja (1 worker) |
| **M** | 2–4 hari (beberapa worker paralel) |
| **L** | ≥ 1 minggu (perlu fase tersendiri + planner) |

Kode butir: `SEC` keamanan · `OPS` operasional · `QA` kualitas · `ED` editorial/admin ·
`RD` fitur pembaca · `SEO` · `UX` desain & aksesibilitas · `PERF` performa & skala · `DATA` data & media.

---

## 2. Tindakan pemilik sebelum produksi (P0, non-kode)

Butir berikut **bukan pekerjaan kode** dan tidak bisa dikerjakan agen. Semuanya pernah muncul selama diskusi.

| # | Tindakan | Alasan / asal |
|---|---|---|
| O1 | **Ganti password user DB `portal`** dan batasi port DB dengan firewall (hanya IP server aplikasi) | Password sempat tertulis di percakapan (Fase 0); DB berada di IP publik |
| O2 | **Ganti password sudo** mesin pengembangan | Tertulis di percakapan saat perbaikan izin folder |
| O3 | **Cabut token GitHub** yang dipakai untuk push pertama dan buat token baru dengan scope minimum | Tertulis di percakapan saat push |
| O4 | **Ganti password super admin** `admin@almaidah.id` lewat `/admin/profile` | Password awal dibuat agen dan ditampilkan di laporan Fase 1 |
| O5 | **Tentukan domain produksi** | Diperlukan untuk canonical/sitemap/RSS absolut, cookie `Secure`, HSTS, verifikasi Google (pertanyaan terbuka #5 di dok 09) |
| O6 | **Pisahkan database dev/staging/produksi** | Saat ini satu DB bersama dipakai untuk pengembangan, test integrasi (schema sementara), dan data seed; produksi tidak boleh berisi data demo |
| O7 | **Aktifkan TLS di PostgreSQL** (sudah `sslmode=require`) dan buat **user migrasi terpisah** dari user aplikasi (DDL vs DML) | Rekomendasi dok 09 §4 |
| O8 | **Sinkronisasi jam (NTP)** di server aplikasi dan DB | Jam DB terukur ±0,87 detik lebih cepat (akar masalah test flaky Fase 6); pemeriksaan kedaluwarsa token mencampur jam DB dan aplikasi |
| O9 | **Isi konten nyata**: foto sampul artikel, foto tokoh, isi halaman statis (Profil Yayasan, Redaksi, Pedoman Media, Karier, Kebijakan Privasi, S&K), gambar OG default, URL sosmed resmi, video YouTube resmi | Seluruh konten sekarang adalah data contoh (seed demo); halaman statis berisi "Halaman ini sedang disusun"; tidak ada satu pun artikel bergambar |
| O10 | **Hapus data demo** dari DB produksi (atau seed hanya `--base`) | `seed --demo` hanya untuk dev/staging |
| O11 | **Putuskan nasib branch GitHub**: `portal-berita-v1` (snapshot 1 commit, IP DB sudah disamarkan) vs `main`/`development` lama | Push awal sengaja ke branch baru; tag `v0.0.0`–`v1.0.0` hanya ada di mesin lokal karena riwayatnya memuat IP DB |
| O12 | **Review desain mobile & dark mode oleh desainer** | Desain referensi hanya versi desktop 1440 px tanpa palet gelap; versi mobile, tablet, dan palet gelap adalah usulan kami (dok 02 §2) |

---

## 3. Kekurangan per area

### 3.A Keamanan & akses

#### SEC-1 · Lupa password lewat email — **P1 · M**
- **Sekarang:** tidak ada alur "Lupa kata sandi". Password hanya bisa direset oleh super admin (`POST /admin/users/{id}/reset-password`). Jika satu-satunya super admin lupa password, pemulihan hanya lewat CLI `tool create-superadmin`.
- **Dampak:** beban operasional, risiko terkunci.
- **Rencana:** tabel `password_reset_tokens (id, user_id, token_hash, expires_at, used_at, ip)`; `POST /auth/forgot-password {email}` (selalu 204, rate limit per IP+email, token acak 32 byte, berlaku 30 menit); `POST /auth/reset-password {token, new_password}` mencabut semua sesi. Halaman `/admin/lupa-password` & `/admin/reset-password?token=` (shadcn Form). **Prasyarat:** infrastruktur email (OPS-6).
- **Selesai bila:** e2e reset berhasil; token dipakai ulang → ditolak; audit `password_reset`.

#### SEC-2 · Autentikasi dua faktor (TOTP) untuk admin — **P2 · M**
- **Sekarang:** login hanya email + password (rate limit 5/menit).
- **Rencana:** kolom `users.totp_secret_enc`, `totp_enabled_at`; enkripsi secret dengan kunci dari env; kode cadangan (hash); langkah kedua setelah password (token sementara 5 menit); wajib untuk role `super_admin` (opsional untuk lainnya). UI: QR + verifikasi di `/admin/profile`.
- **Selesai bila:** login tanpa kode ditolak; kode cadangan sekali pakai; audit `2fa_enabled`/`2fa_failed`.

#### SEC-3 · Access token tetap berlaku ≤ 15 menit setelah logout/cabut sesi — **P2 · S**
- **Sekarang:** keterbatasan yang diterima (Fase 2, dok 09 §4). Refresh token dicabut, tetapi JWT access token stateless tetap valid sampai kedaluwarsa.
- **Rencana:** denylist `sid` di memori (map + TTL 15 menit) yang diisi saat logout/revoke/reuse, dicek di middleware `Authenticate`. Untuk multi-instance → simpan di DB (`revoked_sessions`) atau Redis (lihat PERF-3).
- **Selesai bila:** setelah logout, request dengan access token lama → 401 seketika.

#### SEC-4 · CSP masih memakai `'unsafe-inline'` untuk script & style — **P2 · M**
- **Sekarang:** dibutuhkan oleh script anti-flash tema (inline `<head>`) dan inline style Next/shadcn (Fase 6).
- **Rencana:** CSP berbasis **nonce** via `proxy.ts` (Next 16 mendukung nonce per request — baca `node_modules/next/dist/docs` bagian CSP), konsekuensinya halaman menjadi dinamis; alternatif **hash** SHA-256 untuk script tema yang statis. Evaluasi dampak ke ISR sebelum memutuskan.
- **Selesai bila:** `script-src` tanpa `'unsafe-inline'`, 0 pelanggaran CSP di semua halaman (pakai skrip uji Fase 6).

#### SEC-5 · Penguncian akun & deteksi brute force lintas IP — **P3 · S**
- **Sekarang:** rate limit login per IP+email, in-memory per proses.
- **Rencana:** hitung gagal per akun di DB, kunci sementara 15 menit setelah N gagal, notifikasi email ke pemilik akun (butuh OPS-6).

#### SEC-6 · Optimistic locking saat mengedit konten — **P1 · S**
- **Sekarang:** dua admin yang membuka artikel/halaman/section yang sama lalu menyimpan → **perubahan yang pertama tertimpa tanpa peringatan**. Tidak ada pengecekan versi di `PUT`.
- **Rencana:** sertakan `updated_at` (atau kolom `version int`) di respons; `PUT` wajib mengirim `If-Match`/field `expected_updated_at`; mismatch → 409 `conflict` "Konten sudah diubah oleh pengguna lain". UI: dialog bandingkan / muat ulang. Berlaku untuk artikel, halaman, agenda, tokoh, video, section, menu, pengaturan.
- **Selesai bila:** test integrasi dua update bersamaan → yang kedua 409.

#### SEC-7 · Retensi & arsip log audit — **P3 · S**
- **Sekarang:** `audit_logs` tumbuh tanpa batas (contoh: 328 → 417 baris hanya dari sesi uji).
- **Rencana:** job harian memindahkan log > 12 bulan ke tabel arsip / file terkompresi; indeks waktu sudah ada.

#### SEC-8 · Pembersihan sesi kedaluwarsa terjadwal — **P3 · S**
- **Sekarang:** `DeleteExpiredRefreshTokens` hanya dipanggil best-effort saat login; sesi rotated/revoked menumpuk (pernah dibersihkan manual puluhan baris).
- **Rencana:** tambah `jobs.Job` harian (pola sama dengan `analytics.cleanup_view_dedup`).

### 3.B Operasional, infrastruktur & deploy

#### OPS-1 · Deploy produksi belum pernah dijalankan — **P0 · M**
- **Sekarang:** `docs/deploy.md` + `deploy/` (systemd, Nginx/Caddy, backup/restore) hanya dokumentasi; belum diuji di server sungguhan.
- **Rencana:** staging server → jalankan runbook persis → catat penyimpangan → perbaiki dokumen. Verifikasi `TRUSTED_PROXIES` dengan reverse proxy nyata (proxy wajib **menimpa** `X-Forwarded-For`), HSTS & `upgrade-insecure-requests` aktif saat `NEXT_PUBLIC_SITE_URL` https.
- **Selesai bila:** semua 15 skenario penerimaan (dok 08 §6.5) lulus di staging dengan HTTPS.

#### OPS-2 · Backup otomatis & uji restore — **P0 · S**
- **Sekarang:** `deploy/backup.sh` ada (pg_dump -Fc + uploads, retensi 14 hari) tetapi belum dijadwalkan dan restore belum pernah diuji.
- **Rencana:** cron/systemd timer harian, salin ke lokasi di luar server (object storage), uji restore bulanan ke DB sementara dan cek jumlah baris.

#### OPS-3 · Monitoring, alert & pelacakan error — **P1 · M**
- **Sekarang:** hanya `/healthz`, `/readyz`, dan log `slog` ke stdout/journal.
- **Rencana:** uptime check eksternal (homepage, `/readyz`, `/feed.xml`); metrik Prometheus sederhana dari Go (latensi per route, jumlah 5xx, antrean revalidasi, durasi job); pelacakan error frontend & backend (mis. Sentry/GlitchTip self-hosted); alert ke email/WhatsApp admin.
- **Selesai bila:** mematikan API memicu alert < 5 menit.

#### OPS-4 · CI/CD belum ada — **P1 · M**
- **Sekarang:** semua pengecekan (`make lint`, `make test`, test integrasi, `make vuln`, `bun run build`) dijalankan manual oleh agen.
- **Rencana:** GitHub Actions: (1) lint + unit test Go & bun, (2) test integrasi dengan **PostgreSQL service container lokal** (bukan DB bersama), (3) `govulncheck` + `bun audit`, (4) build; job e2e Playwright terhadap stack sementara (QA-1). Proteksi branch `main`; rilis via tag.
- **Catatan:** keputusan "tanpa Docker" berlaku untuk aplikasi; service container di CI tidak melanggarnya, tetapi tetap minta persetujuan pemilik.

#### OPS-5 · Pembaruan dependency terjadwal — **P2 · S**
- **Sekarang:** Go dinaikkan manual ke 1.27.1 di Fase 6 karena 45 temuan `govulncheck`; tidak ada mekanisme rutin.
- **Rencana:** Renovate/Dependabot (Go modules, bun, GitHub Actions) mingguan + `make vuln` di CI; kebijakan: patch otomatis, minor via PR dengan e2e.

#### OPS-6 · Infrastruktur email — **P1 · S** (prasyarat SEC-1, SEC-5, RD-1, ED-2)
- **Rencana:** paket `internal/mail` dengan antarmuka `Sender` (SMTP dulu, penyedia transaksional kemudian), template HTML berbahasa Indonesia, antrean + retry, SPF/DKIM/DMARC pada domain (butuh O5).

#### OPS-7 · Lingkungan staging — **P1 · S**
- DB, domain, dan secret terpisah; seed `--base --demo`; dipakai untuk QA sebelum rilis.

#### OPS-8 · Dev server Next tidak selalu memantulkan revalidasi — **P3 · S**
- **Sekarang:** di `next dev`, data `menus`/`settings` kadang tidak berubah setelah webhook revalidasi (build produksi normal; catatan Fase 6).
- **Rencana:** dokumentasikan di dok 09 (uji perubahan data di build produksi), atau tambahkan `revalidate: 0` khusus development di `apiFetch`.

### 3.C Kualitas: testing, kontrak API

#### QA-1 · Skrip uji e2e/acceptance tidak tersimpan di repo — **P1 · M**
- **Sekarang:** seluruh skrip Playwright (uji penerimaan 15 skenario, cek CSP, JSON-LD, Lighthouse, pixel-diff visual, uji revalidasi) ditulis di **scratchpad sesi** dan **sudah terhapus**. Hasilnya tercatat di dok 08, tetapi tidak bisa diulang otomatis.
- **Rencana:** folder `e2e/` (Playwright Test, dijalankan dengan `bunx playwright test`) berisi: skenario §6.5, smoke publik, alur admin CRUD (dengan pembersihan data), cek header keamanan & CSP, validasi JSON-LD, pixel-diff halaman utama terhadap baseline yang disimpan di repo. Konfigurasi base URL via env; data uji dibuat & dihapus sendiri.
- **Selesai bila:** `make e2e` lulus di staging dan di CI.

#### QA-2 · Test komponen frontend minim — **P2 · M**
- **Sekarang:** `bun test` hanya menguji util (format, datetime, slug, tree, schema-form, client API) — 188 test; tidak ada test render komponen.
- **Rencana:** test komponen untuk form admin kritis (ArticleEditor, SectionConfigForm, MenuEditor) dengan React Testing Library + happy-dom.

#### QA-3 · Test integrasi lambat & bergantung pada DB remote — **P2 · S**
- **Sekarang:** tiap test membuat schema dan migrasi sendiri di server remote (10–20 detik/test, suite penuh ±25 menit dengan `-race`), wajib `-p 1`.
- **Rencana:** jalankan dengan PostgreSQL lokal/CI; opsi template database (`CREATE DATABASE … TEMPLATE`) untuk mempercepat.

#### QA-4 · Kontrak API ditulis manual di dua tempat — **P2 · M**
- **Sekarang:** tipe TypeScript (`src/lib/api/types.ts`, `src/lib/api/admin/types.ts`) disalin manual dari DTO Go; registry tipe section ada di Go dan TS (dijaga test sinkronisasi parsial).
- **Rencana:** spesifikasi **OpenAPI** (dihasilkan dari kode Go atau ditulis lalu divalidasi), generate tipe TS di build; contoh request `docs/http/*.http` dijadikan smoke test.

#### QA-5 · Rencana detail per fase dari planner tidak tersimpan — **P3 · S**
- **Sekarang:** rencana rinci tiap fase (kontrak antar worker, daftar file) hanya ada di scratchpad dan hilang; dok 08 menyimpan ringkasan & penyimpangan.
- **Rencana:** mulai fase berikutnya, simpan rencana planner ke `docs/rencana/fase-N.md` sebelum worker dijalankan (perlu tambahan aturan di `CLAUDE.md`).

### 3.D Konten & editorial (Admin CMS)

#### ED-1 · Role editor & alur review — **P1 · L**
- **Sekarang:** hanya `super_admin` dan `admin` (keputusan Q1); RBAC sudah siap ditambah role lewat data.
- **Rencana:** status artikel baru `review`; role `editor` (publish) dan `penulis` (create/update miliknya, ajukan review); permission baru `articles.submit`, `articles.review`; tombol "Ajukan review" / "Setujui & terbitkan" / "Kembalikan dengan catatan"; tabel `article_reviews (article_id, reviewer_id, decision, note, created_at)`; notifikasi (OPS-6). Penulis tanpa login (`can_login=false`) tetap didukung.
- **Selesai bila:** penulis tidak bisa menerbitkan; editor bisa; riwayat review tersimpan.

#### ED-2 · Revisi artikel (riwayat versi & kembalikan) — **P1 · M**
- **Rencana:** tabel `article_revisions (id, article_id, title, excerpt, content_json, content_html, seo, created_by, created_at)` ditulis setiap simpan; UI daftar revisi + pratinjau + diff teks + "Kembalikan versi ini"; batasi 50 revisi per artikel. Bisa diperluas ke halaman statis.

#### ED-3 · Aksi massal di daftar artikel — **P2 · S**
- **Sekarang:** dok 07 §3.3 menyebut aksi massal, tetapi belum dibuat (hanya aksi per baris).
- **Rencana:** checkbox baris DataTable; aksi: terbitkan, batalkan terbit, pindah kategori, tambah tag, hapus (ke Sampah); endpoint `POST /admin/articles/bulk {ids, action, params}` dalam satu transaksi + satu batch revalidasi.

#### ED-4 · Draft tersimpan di server (autosave) — **P2 · S**
- **Sekarang:** autosave hanya ke `localStorage` setiap 10 detik; pindah perangkat → draft hilang.
- **Rencana:** autosave ke server untuk artikel berstatus draft (debounce 30 detik), indikator "Tersimpan …"; tetap pertahankan cadangan lokal.

#### ED-5 · Pratinjau langsung section builder — **P2 · M**
- **Sekarang:** perubahan section harus disimpan lalu dilihat di beranda (ditunda sejak Fase 5).
- **Rencana:** `POST /admin/homepage/preview {sections}` mengembalikan payload seperti `/public/homepage` tanpa menyimpan; panel samping iframe ke rute pratinjau `noindex` yang merender payload draft.

#### ED-6 · Media: daftar "dipakai oleh" — **P2 · S**
- **Sekarang:** menghapus media yang dipakai ditolak 409, tetapi admin tidak tahu dipakai di mana (ditunda Fase 3/5).
- **Rencana:** `GET /admin/media/{id}/usages` (artikel cover/OG/isi, agenda, tokoh, video, halaman, pengaturan) → tampil di `MediaDetailSheet` dengan tautan edit.

#### ED-7 · Filter mendatang/selesai agenda di admin — **P3 · S**
- **Sekarang:** filter dilakukan di sisi klien per halaman (backend admin tidak punya parameter `when`; catatan Fase 5).
- **Rencana:** tambah `when` ke query admin events (sqlc) + paginasi benar.

#### ED-8 · Penjadwalan lanjutan — **P3 · S**
- Jadwal **batal terbit** (embargo kedaluwarsa), jadwal aktif/nonaktif section homepage, agenda berulang (mingguan) selain tombol "Duplikat".

#### ED-9 · Sinkronisasi video dari YouTube Data API — **P3 · S**
- **Sekarang:** durasi & jumlah tonton diisi manual.
- **Rencana:** API key di env; job harian memperbarui `duration_seconds`, `view_count`, judul/thumbnail opsional; kuota API diperhitungkan.

#### ED-10 · Kategori & tag: SEO dan deskripsi tag — **P3 · S**
- Tag belum punya deskripsi/SEO title; kategori "Agenda" (`kabar-agenda`) berisi 0 artikel di seed — tinjau struktur kategori bersama redaksi.

#### ED-11 · Logo versi gelap & favicon dari pengaturan — **P2 · S**
- **Sekarang:** `site.identity` punya `logo_media_id` dan `favicon_media_id`, tetapi **favicon yang tersaji masih `favicon.ico` bawaan Next.js** (`src/app/favicon.ico`); logo hanya satu versi.
- **Rencana:** generate `icon.png`/`apple-icon.png` dari logo ALMAIDAH (512 px sudah tersedia) via file konvensi Next (`src/app/icon.png`, `apple-icon.png`) atau route `icon.tsx` yang membaca pengaturan; field opsional `logo_dark_media_id`.
- **Selesai bila:** tab browser & bookmark iOS menampilkan logo ALMAIDAH.

### 3.E Fitur pembaca

#### RD-1 · Newsletter — **P1 · L** (section `newsletter` sudah ada, nonaktif)
- **Sekarang:** keputusan Q14 — tidak masuk MVP; form menampilkan "Segera hadir" bila diaktifkan.
- **Rencana:** tabel `newsletter_subscribers (id, email citext unique, status pending|active|unsubscribed, token_hash, confirmed_at, created_at, source)`; `POST /public/newsletter/subscribe` (rate limit, honeypot), email konfirmasi **double opt-in**, `GET /newsletter/confirm?token=`, `GET /newsletter/unsubscribe?token=` satu klik; admin: daftar, filter, ekspor CSV, hapus (hak privasi); pengiriman ringkasan mingguan otomatis (artikel terbit 7 hari) via OPS-6 dengan header `List-Unsubscribe`.
- **Selesai bila:** alur daftar→konfirmasi→terima ringkasan→berhenti berlangganan lulus e2e.

#### RD-2 · Komentar pembaca dengan moderasi — **P3 · L**
- Tidak ada di desain; perlu keputusan kebijakan komunitas, anti-spam, dan identitas (login pembaca atau nama+email).

#### RD-3 · Akun pembaca & bookmark — **P3 · L**
- Login pembaca terpisah dari admin, simpan artikel, riwayat baca.

#### RD-4 · Pencarian lebih cerdas — **P2 · M**
- **Sekarang:** FTS konfigurasi `simple` + `unaccent`, fallback trigram (`word_similarity`); **tidak ada stemming Bahasa Indonesia** (mis. "membaca" tidak menemukan "baca"); tanpa filter.
- **Rencana:** kamus sinonim/stemming Indonesia (tabel kata dasar sederhana atau ekstensi ispell bila tersedia), filter kategori & rentang tanggal di `/cari`, saran kata kunci populer, log kata kunci tanpa hasil (untuk redaksi).

#### RD-5 · Tambah ke kalender & berbagi agenda — **P3 · S**
- Unduh `.ics` per agenda dan feed kalender (`/agenda.ics`), tombol "Tambah ke Google Calendar".

#### RD-6 · Notifikasi/PWA — **P3 · M**
- Manifest PWA, ikon, mode offline halaman yang pernah dibuka, push notification untuk breaking news (perlu persetujuan pengguna).

#### RD-7 · Fitur baca — **P3 · S**
- Indikator progres baca, gaya cetak (print stylesheet), ukuran teks, tombol salin kutipan.

### 3.F SEO & distribusi

#### SEO-1 · Sitemap Google News & meta preview gambar — **P1 · S**
- **Sekarang:** sitemap umum (54 URL) dan RSS ada; **tidak ada news sitemap** (artikel 48 jam terakhir, format `news:news`) yang dibutuhkan portal berita untuk Google News; belum ada `robots: max-image-preview:large`.
- **Rencana:** route `/sitemap-news.xml` + daftarkan di `robots.txt`; tambahkan `max-image-preview:large` di metadata artikel; daftar Google Search Console & Google News Publisher (butuh O5).

#### SEO-2 · Gambar OG otomatis untuk artikel tanpa sampul — **P2 · S**
- **Sekarang:** fallback OG/JSON-LD → gambar OG default (belum diisi) → logo; semua artikel seed tanpa sampul sehingga pratinjau tautan di WhatsApp/sosmed memakai logo.
- **Rencana:** `opengraph-image.tsx` per artikel memakai `next/og` (judul serif + eyebrow kategori + logo, palet hitam-emas).

#### SEO-3 · Validasi eksternal — **P1 · S** (setelah O5)
- Rich Results Test, PageSpeed Insights di domain produksi (skor Lighthouse saat ini diukur di localhost tanpa TLS/HTTP2), Search Console coverage.

#### SEO-4 · Sitemap index untuk skala besar — **P3 · S**
- Saat artikel > 50.000 URL: pecah sitemap per jenis/tahun via `generateSitemaps`.

#### SEO-5 · Canonical `/agenda` dan halaman paginasi — **P3 · S**
- `/agenda` sengaja memakai satu canonical (tampilan kalender); evaluasi ulang bila konten agenda bertambah banyak dan perlu diindeks per halaman.

### 3.G Desain, aksesibilitas & UX

#### UX-1 · Kontras token `faint`/`ghost` — **P2 · S**
- **Sekarang:** `#888888`/`#999999` di teks kecil ±3,5:1 (di bawah AA 4,5:1); skor A11y tetap 96 (catatan Fase 6).
- **Rencana:** gelapkan ke ±`#737373`/`#6f6f6f` (light) dan sesuaikan dark; verifikasi pixel-diff & persetujuan desainer.

#### UX-2 · Review desainer untuk mobile, tablet, dark mode — **P1 · S** (lihat O12)
- Termasuk keputusan yang kami ambil sendiri: breadcrumb tidak tampil di beranda; tanggal header hanya tampil ≥ 1536 px; menu "Lainnya" untuk menu panjang; pelat/latar logo; palet gelap.

#### UX-3 · Audit aksesibilitas manual — **P2 · S**
- Uji pembaca layar (NVDA/VoiceOver) pada alur utama publik & admin, navigasi keyboard menyeluruh editor Tiptap & section builder, fokus setelah dialog tertutup.

#### UX-4 · Ruang kosong saat konten belum ada — **P3 · S**
- Section kosong disembunyikan otomatis; tinjau keadaan kosong di halaman listing/agenda/tokoh agar tetap informatif saat data sedikit di awal peluncuran.

#### UX-5 · Pengalaman admin di mobile — **P3 · M**
- Admin bisa dipakai di 375 px, tetapi tabel mengandalkan scroll horizontal dan editor dua kolom menumpuk; pertimbangkan tampilan kartu untuk daftar di mobile.

### 3.H Performa & skalabilitas

#### PERF-1 · CDN & cache statis — **P2 · S**
- `/_next/static` dan `/uploads` sudah immutable; letakkan CDN di depan reverse proxy, atau sajikan `/uploads` langsung dari Nginx (alternatif di `deploy/nginx`).

#### PERF-2 · Pemantauan Core Web Vitals pengguna nyata — **P2 · S**
- `useReportWebVitals` → endpoint ringan di Go → dashboard (LCP/CLS/INP per halaman).

#### PERF-3 · Multi-instance (horizontal scaling) — **P3 · L**
- **Sekarang (satu instance):** rate limiter, cache permission, denylist sesi (SEC-3), dan jadwal job berjalan in-memory per proses; cache ISR Next per instance; media di disk lokal.
- **Rencana bila dibutuhkan:** Redis/PostgreSQL untuk rate limit & cache bersama; job scheduler dengan advisory lock PostgreSQL (hindari publish ganda); `cacheHandler` Next bersama; storage S3 (DATA-1).

#### PERF-4 · Varian gambar di sisi server — **P3 · S**
- Saat ini optimasi gambar sepenuhnya oleh `next/image` (cache per instance). Untuk skala besar: thumbnail pra-generate saat upload atau image CDN.

### 3.I Data & media

#### DATA-1 · Storage S3/MinIO — **P2 · M**
- **Sekarang:** media di disk lokal di balik antarmuka `Storage` (keputusan Q8).
- **Rencana:** implementasi kedua `storage.S3` (endpoint/bucket/kredensial via env), migrasi file lama, URL publik via CDN; `next.config.ts` `remotePatterns` diperbarui.

#### DATA-2 · Pembersihan file yatim — **P3 · S**
- Job mingguan mencari file di `uploads/` tanpa baris `media` (dan sebaliknya), laporan sebelum menghapus.

#### DATA-3 · Kualitas metadata media — **P3 · S**
- Wajibkan alt text sebelum media dipakai di artikel terbit; peringatan ukuran gambar terlalu kecil untuk sampul 16:9.

#### DATA-4 · Ekspor & portabilitas data — **P3 · S**
- Ekspor artikel (JSON/Markdown) dan pengguna (CSV) dari admin untuk arsip/migrasi.

#### DATA-5 · Kebijakan privasi & data pribadi — **P1 · S**
- Isi halaman Kebijakan Privasi yang sesuai praktik nyata: hash IP harian untuk statistik baca (tanpa menyimpan IP mentah), cookie hanya untuk admin (`access_token`, `refresh_token`, `csrf_token`) dan preferensi tema di `localStorage`; jika newsletter/analytics pihak ketiga ditambahkan, tinjau kebutuhan banner persetujuan cookie.

---

## 4. Utang teknis & catatan dari diskusi

| Catatan | Asal | Tindak lanjut |
|---|---|---|
| Setelah perubahan konten, **request pertama** ke halaman ISR masih versi lama (stale-while-revalidate), request berikutnya segar | Fase 4 | Diterima; jika redaksi butuh instan, pertimbangkan `revalidatePath` + prefetch sinkron setelah webhook |
| `/cari` mengembalikan 500 (dengan kerangka situs) saat API mati, sedangkan halaman lain tetap tersaji dari cache | Fase 6 skenario 15 | Tampilkan pesan "Pencarian sedang tidak tersedia" dengan status 503 |
| Peringatan dev "Encountered a script tag…" pada 404 yang dirender klien | Fase 5–6 | Diterima demi mencegah kedipan tema; pantau saat Next diperbarui |
| `DashboardPlaceholder`, `plate`, dan token lain sudah dihapus; tetap jalankan `/ponytail-audit` berkala untuk sisa abstraksi | — | Audit sebelum fase berikutnya |
| Komponen `alert`/`button-group` shadcn terpasang tapi belum dipakai | Fase 5 | Biarkan (dipakai fitur mendatang) atau hapus saat audit |
| Struktur URL artikel memakai slug kategori level 1; subkategori via `?sub=` | Dok 06 | Tetap; dokumentasikan bila redaksi meminta URL subkategori |
| Kalender beranda: `current` kini otomatis jatuh ke bulan agenda terdekat bila kosong | Fase 6 | Selesai — catat di panduan redaksi |
| Seluruh foto masih placeholder abu-abu | Seed | Lihat O9 |

---

## 5. Usulan urutan fase lanjutan

Setiap fase mengikuti aturan yang sama (planner `fable` → worker paralel → integrasi & verifikasi → laporan → tag).

| Fase | Fokus | Butir | Tag |
|---|---|---|---|
| **Fase 7 — Siap Produksi** | Deploy staging & produksi, backup terjadwal, monitoring, CI, e2e di repo, favicon, news sitemap, optimistic locking | O1–O12 (pemilik), OPS-1, OPS-2, OPS-3, OPS-4, OPS-7, QA-1, ED-11, SEO-1, SEO-3, SEC-6, DATA-5 | `v1.1.0` |
| **Fase 8 — Email & Akun** | Infrastruktur email, lupa password, 2FA, newsletter | OPS-6, SEC-1, SEC-2, SEC-3, RD-1 | `v1.2.0` |
| **Fase 9 — Redaksi** | Role editor & review, revisi, aksi massal, autosave server, pratinjau section, media "dipakai oleh" | ED-1, ED-2, ED-3, ED-4, ED-5, ED-6, ED-7 | `v1.3.0` |
| **Fase 10 — Mutu & Pengalaman** | Pencarian cerdas, OG otomatis, kontras, audit a11y, Web Vitals, kontrak OpenAPI, test komponen | RD-4, SEO-2, UX-1, UX-3, PERF-2, QA-2, QA-3, QA-4, OPS-5 | `v1.4.0` |
| **Backlog terbuka** | Bila ada kebutuhan nyata | RD-2, RD-3, RD-5, RD-6, RD-7, PERF-1, PERF-3, PERF-4, DATA-1–DATA-4, ED-8, ED-9, ED-10, SEC-4, SEC-5, SEC-7, SEC-8, SEO-4, SEO-5, UX-4, UX-5, OPS-8, QA-5 | — |

---

## 6. Pertanyaan terbuka untuk pemilik

1. Domain produksi dan lokasi hosting (VPS mana, region)? *(O5)*
2. Penyedia email untuk transaksional & newsletter (SMTP sendiri atau layanan)? *(OPS-6)*
3. Apakah GitHub Actions dengan service container PostgreSQL boleh dipakai di CI meski aplikasi tanpa Docker? *(OPS-4)*
4. Siapa saja calon pengguna admin dan role apa (editor/penulis)? *(ED-1)*
5. Apakah komentar pembaca dan akun pembaca memang dibutuhkan komunitas? *(RD-2, RD-3)*
6. Branch GitHub mana yang menjadi `main` resmi, dan apakah riwayat lengkap + tag perlu dipush (setelah IP DB disamarkan di seluruh riwayat)? *(O11)*
7. Apakah desainer dapat meninjau versi mobile & dark mode sebelum peluncuran? *(O12, UX-2)*
