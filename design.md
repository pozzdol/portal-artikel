# Design — Panel Admin ALMAIDAH

Sistem terkunci untuk panel admin (Inertia + React). Setiap halaman admin baru
membaca berkas ini sebelum menulis kode. Situs publik (Blade) **tidak** diatur
di sini — ia punya bahasa sendiri (Cormorant Garamond + Inter).

## Genre
modern-minimal

## Varian
**Borderless.** Tidak ada `border` di komponen panel. Kalau menambah
komponen baru, pisahkan dengan isian dan bayangan — jangan menambah garis.

## Macrostructure
- **Halaman data / ringkasan** — Bento Grid. Tile dengan span beragam
  (1×1, 2×1, 2×2) di atas grid 2 → 4 → 6 kolom. Ritme datang dari variasi
  ukuran, bukan dari kartu seragam.
- **Halaman auth** — bukan bento. Satu kartu terpusat kiri-rata. Bento
  memecah perhatian; halaman masuk hanya punya satu gagasan.
- **Halaman daftar / form** (belum dibangun) — tetap di keluarga soft
  minimalist: satu `.ui-tile` sebagai wadah, bukan grid modular.

## Token
Nilainya hidup di [`resources/css/app.css`](resources/css/app.css), di blok
bertanda `Hallmark · genre: modern-minimal`. **Jangan disalin ke sini** —
duplikasi token akan basi. Yang berlaku:

- Warna: `--ui-paper`, `--ui-surface`, `--ui-surface-2`, `--ui-ink`,
  `--ui-ink-2`, `--ui-accent`, `--ui-accent-ink`, `--ui-danger`, `--ui-ok`
- Bentuk: `--ui-r-tile`, `--ui-r-control`, `--ui-gap`, `--ui-shadow`
- Isian: `--ui-field-fill`, `--ui-field-ring`, `--ui-accent-wash`
- Gerak: `--ui-dur`, `--ui-ease-out`

Warna dan radius **selalu** dirujuk lewat nama token. Nilai mentah
(`#hex`, `oklch(...)`, `rgb(...)`) tidak boleh muncul di komponen.
Skala jarak memakai skala Tailwind bawaan (4pt) — tidak diduplikasi jadi token.

## Tipografi
- Satu keluarga: **Inter**. Tanpa serif di panel admin, tanpa kecuali.
- Judul halaman: 1.6rem, weight 600, tracking `-0.02em`
- Angka besar (tile bento): weight 600, tracking `-0.035em`, `tabular-nums`
- Eyebrow tile: 0.7rem, weight 500, tracking `0.06em`, uppercase
- Body: 0.875–0.925rem, weight 400

## Warna — aturan pakai
- Permukaan: kartu putih (`--ui-surface`) mengambang di atas dasar hangat
  (`--ui-paper`). Perbedaan dasar inilah yang membuat grid terbaca.
- Emas (`--ui-accent`) dipakai **sekali per layar**, hanya pada elemen yang
  menuntut tindakan. Kalau semua tile beraksen, tidak ada yang menonjol.
- `--ui-accent-ink` untuk teks dan cincin fokus — varian emas yang cukup
  gelap untuk lolos kontras.

## Borderless — apa yang memikul pemisahan
Tidak ada satu pun garis di panel. Penggantinya:

- **Tile** dipisahkan oleh beda warna dasar (kartu putih di atas kertas hangat)
  ditambah `--ui-shadow`. Karena itu jarak `--ui-paper` ke `--ui-surface`
  tidak boleh dipersempit — begitu keduanya mendekat, grid rata dan hilang.
- **Tile yang menuntut tindakan** memakai `--ui-accent-wash`, bukan garis aksen.
  Satu per layar.
- **Tombol sekunder** dibedakan lewat isian (`--ui-surface-2`), bukan outline.
- **Baris daftar** dipisahkan jarak dan hover, bukan divider.
- **Isian** diisi `--ui-field-fill` plus cincin dalam (`inset box-shadow`)
  setipis rambut. Inset dipakai agar tidak menambah tinggi kotak.

## Aksesibilitas
- Teks: minimal 4.5:1. Terukur: judul 16.2:1, teks vs isian 15.6:1,
  teks redup 5.4:1 (terang) / 7.6:1 (gelap), cincin fokus 7.0:1 / 11.8:1.
- **Utang yang diketahui:** batas isian kini **1.67:1** (terang) dan
  **2.12:1** (gelap) — di bawah 3:1 yang diminta WCAG 1.4.11 untuk batas
  komponen. Ini konsekuensi langsung dari pilihan borderless, diambil sadar,
  bukan kelalaian. Field tetap dikenali lewat isian yang berbeda dari
  wadahnya, label yang selalu tampak, dan placeholder.
- **Cara membayar utang itu** tanpa mengubah apa pun yang lain: setel
  `--ui-field-ring` ke `oklch(0.640 0.008 90)` (terang) dan
  `oklch(0.505 0.008 260)` (gelap). Keduanya terukur 3.0:1 — ambang persis,
  garis paling samar yang masih lolos.
- Cincin fokus tampil **seketika**, tidak pernah dianimasikan, dan tetap
  berupa garis tegas. Ini satu-satunya garis yang tidak boleh dilepas.
- Cincin fokus tampil **seketika**, tidak pernah dianimasikan.
- Setiap lebar 320 / 375 / 414 / 768 px wajib bebas scroll horizontal.
  Track grid memakai `minmax(0, 1fr)`, tidak pernah `1fr` telanjang.

## Gerak
Minimal. Reveal mati — halaman tersusun, bukan tampil bertahap.
Hanya dua primitif: transisi antar tahap (`.ui-step`) dan tekan tombol.
`prefers-reduced-motion: reduce` mematikan keduanya.

## Komponen
Primitif dari shadcn/ui (`resources/js/components/ui/`). Skin ada di
[`resources/js/admin/Components/form.tsx`](resources/js/admin/Components/form.tsx) —
`Field`, `SubmitButton`, `TextLink`. Perilaku dan a11y tetap milik shadcn;
hanya permukaannya yang diganti. Jangan menulis ulang primitifnya.

## Nada tulisan
Bahasa Indonesia, kalimat aktif, tanpa basa-basi. Label memakai kata yang
dikenal redaksi ("Naskah", "Rubrik", "Terbit"), bukan istilah sistem.
Layar kosong adalah ajakan bertindak, bukan keluhan — sebut langkah
berikutnya ("Tulis yang pertama lewat menu Artikel").

## Angka
Hanya angka nyata dari basis data. Tidak ada metrik karangan, tidak ada
data contoh yang disamarkan sebagai nyata.
