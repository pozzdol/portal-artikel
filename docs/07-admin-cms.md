# 07 — Admin CMS

Lokasi: `frontend/src/app/admin/*` (aplikasi Next.js yang sama).
Seluruh halaman admin adalah **Client Component** yang memakai React Query ke `/api/v1/admin/*`,
kecuali shell layout. Halaman admin tidak di-cache, diberi `noindex`, dan diblokir di `robots.txt`.

## 1. Prinsip UX

1. **Bahasa Indonesia**, istilah konsisten: "Artikel", "Terbitkan", "Draf", "Jadwalkan", "Arsipkan".
2. **Tidak kehilangan pekerjaan:** autosave draf lokal (localStorage) setiap 10 detik di editor, serta peringatan saat meninggalkan halaman dengan perubahan yang belum disimpan.
3. **Umpan balik jelas:** toast sukses/gagal, error per field dari respons `422`, dan konfirmasi sebelum hapus.
4. **Menu mengikuti permission:** item sidebar dan tombol disembunyikan jika user tidak memiliki permission (dari `GET /auth/me`). Backend tetap memvalidasi.
5. **Visual:** memakai token warna yang sama dengan situs publik, tetapi dengan kepadatan UI admin (font Inter 14px, tabel, form). Tersedia dark mode.

## 2. Struktur navigasi

```
/(auth)/login                     Login (tidak di-sidebar)
/(shell)/                         Dashboard
├── Konten
│   ├── /(shell)/articles         Artikel (list, filter, bulk)
│   ├── /(shell)/articles/new     Tulis artikel
│   ├── /(shell)/articles/[id]    Edit artikel
│   ├── /(shell)/categories       Kategori (pohon, drag untuk urutan)
│   ├── /(shell)/tags             Tag (merge)
│   └── /(shell)/media            Pustaka media
├── Komunitas
│   ├── /(shell)/events           Agenda
│   ├── /(shell)/events/new       Agenda baru
│   ├── /(shell)/events/[id]      Edit agenda
│   ├── /(shell)/alumni           Tokoh Alumni
│   ├── /(shell)/alumni/new       Tokoh baru
│   ├── /(shell)/alumni/[id]      Edit tokoh
│   ├── /(shell)/videos           Video
│   ├── /(shell)/videos/new       Video baru
│   └── /(shell)/videos/[id]      Edit video
├── Tampilan
│   ├── /(shell)/homepage         Section builder
│   ├── /(shell)/snippets         Pengumuman · Breaking · Kutipan · FAQ (tab)
│   ├── /(shell)/pages            Halaman statis
│   ├── /(shell)/pages/new        Halaman baru
│   ├── /(shell)/pages/[id]       Edit halaman
│   └── /(shell)/menus            Menu header & footer
├── Pengaturan
│   ├── /(shell)/settings         Identitas, kontak, sosmed, SEO default, opsi header
│   ├── /(shell)/users            Pengguna & penulis
│   ├── /(shell)/roles            Role & permission
│   └── /(shell)/audit-logs       Log aktivitas
└── /(shell)/profile              Profil saya, ganti password, sesi aktif
```

> Catatan: route group `(auth)` untuk login (tanpa sidebar) dan `(shell)` untuk halaman admin (dengan sidebar). Layout middleware di src/proxy.ts mengecek cookie, shell layout di app/admin/(shell)/layout.tsx melakukan best-effort fetch /auth/me.

## 3. Halaman per halaman

### 3.1 Login
- Field identifier (label "Email atau nomor HP") + password, checkbox "Ingat saya" (refresh 30 hari), tombol "Masuk".
- Input menerima email atau nomor HP dalam bentuk apa pun (0821…, 62…, atau +62…) — backend menormalkan.
- Error generik: "Email atau nomor HP tidak valid atau kata sandi salah." Untuk 429: "Terlalu banyak percobaan, coba lagi dalam N detik."
- Jika sudah login dan `must_change_password=true`, diarahkan ke `/admin/ganti-password`. Jika tidak ada flag, diarahkan ke `/admin`. Mendukung `?next=` untuk kembali ke halaman asal.

### 3.1a Ganti kata sandi wajib (`/admin/ganti-password`)
- Tampil jika user login dengan `must_change_password=true` atau mencoba akses `/admin/*` dengan flag aktif.
- Header merek seperti halaman login.
- Alert peringatan: "Demi keamanan, Anda wajib mengganti kata sandi awal sebelum menggunakan dasbor."
- Form: password lama (disabled, placeholder contoh), password baru (min 10 karakter, harus berbeda dari password awal), konfirmasi.
- Helper text: "Minimal 10 karakter dan harus berbeda dari kata sandi awal. Sesi di perangkat lain akan dikeluarkan."
- Tombol: "Ganti Kata Sandi" (submit), "Keluar" (logout, ghost style).
- Pada sukses: toast "Kata sandi diperbarui. Selamat datang di dasbor." → refresh session → redirect `/admin`.
- Redirect rules: tidak ada cookie → `/admin/login?next=/admin/ganti-password`; user sudah login & tidak flagged → `/admin`; user sudah login & flagged → render form.

### 3.2 Dashboard
- Kartu statistik: Artikel terbit, Draf, Terjadwal, View 7 hari.
- Grafik batang view 14 hari (sederhana, SVG).
- Top 5 artikel minggu ini, draf terakhir yang saya edit, agenda terdekat.
- Tombol cepat: "Tulis Artikel", "Tambah Agenda".

### 3.3 Artikel — list
- Tabel: judul (+ kategori kecil), penulis, status (badge), tanggal terbit, views, aksi.
- Filter: pencarian judul, status, kategori, penulis. Sort per kolom. Paginasi 20.
- Aksi baris: Edit, Lihat (buka URL publik / preview), Terbitkan/Batalkan terbit, Hapus.
- Tab "Sampah" untuk artikel yang di-soft delete (Pulihkan).

### 3.4 Artikel — editor
Layout dua kolom:

| Kolom utama | Panel samping |
|---|---|
| Judul (input besar, serif) | **Status & publikasi:** status, tanggal terbit (datetime WIB), tombol Simpan Draf / Terbitkan / Jadwalkan |
| Slug (auto dari judul, bisa diedit, cek unik realtime) | **Penulis:** dropdown dari `/admin/authors` (default diri sendiri) |
| Ringkasan / excerpt (hitungan karakter, maks 300) | **Kategori:** select pohon (wajib) |
| **Editor Tiptap** | **Tag:** multi-select + buat tag baru inline |
| | **Gambar sampul:** pilih dari pustaka / upload, caption |
| | **Opsi:** Unggulan (hero), Breaking |
| | **Kegiatan** (tampil jika kategori = Yayasan atau turunannya): tanggal & lokasi kegiatan |
| | **SEO:** judul SEO, deskripsi SEO (dengan hitungan 60/160), gambar OG, canonical, serta **pratinjau Google snippet** |

**Toolbar Tiptap:** Paragraf/H2/H3, Bold, Italic, Underline, Link, Bullet/Numbered list, Blockquote,
Gambar (dari pustaka media, dengan alt & caption), Embed YouTube, Garis pemisah, Undo/Redo.
Paste dari Word/Google Docs dibersihkan (format tidak dikenal dibuang).

**Tombol Pratinjau:** membuka URL publik dengan `?preview=token` di tab baru, untuk melihat tampilan persis sebelum terbit.

### 3.5 Kategori
- Pohon 2 level dengan drag & drop (urutan dan parent).
- Form: nama, slug, induk, deskripsi, aktif, SEO. Menampilkan jumlah artikel.
- Hapus ditolak jika masih ada artikel. Tampil pesan "Pindahkan N artikel terlebih dahulu."

### 3.6 Pustaka media
- Grid thumbnail, pencarian nama, upload drag & drop (multi-file, progress bar).
- Detail: pratinjau, URL (salin), dimensi, ukuran, alt text, caption, dan daftar konten yang memakai media ini.
- Dipakai ulang sebagai **modal pemilih media** dari editor, form tokoh, pengaturan logo, dll.

### 3.7 Agenda, Tokoh Alumni, Video, Halaman
List + form standar sesuai kolom di dok 04. Hal khusus:
- **Agenda:** date-time picker WIB, toggle "sepanjang hari", tombol "Duplikat" untuk acara rutin.
- **Tokoh:** urutan drag & drop, toggle "Tampil di beranda".
- **Video:** paste URL YouTube, sistem mengekstrak ID, lalu thumbnail tampil otomatis. Durasi dan jumlah tonton diisi manual.
- **Halaman:** editor Tiptap yang sama dengan artikel.

### 3.8 Snippet
Satu halaman dengan 4 tab:

| Tab | Field | Catatan |
|---|---|---|
| Pengumuman | teks, link, periode tayang, aktif | Tampil di bar atas; lebih dari satu dipisah • emas |
| Breaking | teks, link, periode tayang, aktif | Tampil di ticker |
| Kutipan | teks, sumber, aktif | Berputar di section quote |
| FAQ | pertanyaan, jawaban (rich text ringan) | |

Semua tab mendukung urutan drag & drop.

### 3.9 Section builder (Beranda)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Beranda                                  [Lihat Beranda ↗] [+ Tambah section] │
├────────────────────────────────────────────────────────────────────────────┤
│ ≡  Hero + Trending Hari Ini      hero_trending        ● Aktif   [Edit] [⋯]   │
│ ≡  Breaking News                 breaking_ticker      ● Aktif   [Edit] [⋯]   │
│ ≡  Kajian Terbaru                article_grid · 3 kol ● Aktif   [Edit] [⋯]   │
│ ≡  Berita Alumni                 article_grid · 4 kol ● Aktif   [Edit] [⋯]   │
│ ≡  Berita Terbaru + Sidebar      latest_with_sidebar  ● Aktif   [Edit] [⋯]   │
│ ≡  Kutipan                       quote_rotator        ● Aktif   [Edit] [⋯]   │
│ ≡  Kegiatan Yayasan              timeline             ● Aktif   [Edit] [⋯]   │
│ ≡  Opini                         feature_split        ● Aktif   [Edit] [⋯]   │
│ ≡  Tokoh Alumni                  people_grid          ● Aktif   [Edit] [⋯]   │
│ ≡  Agenda                        agenda_calendar      ● Aktif   [Edit] [⋯]   │
│ ≡  Video                         video_gallery        ● Aktif   [Edit] [⋯]   │
│ ≡  Pertanyaan Umum               faq                  ● Aktif   [Edit] [⋯]   │
│ ≡  Newsletter                    newsletter           ○ Nonaktif [Edit] [⋯]  │
└────────────────────────────────────────────────────────────────────────────┘
 [⋯] = Duplikat · Hapus  (di layar ponsel juga Edit)
```

Kolom tengah menampilkan nama tipe yang ramah (mis. "Hero + Trending"); kode tipe
(`hero_trending`, …) hanya muncul sebagai tooltip.

- **Drag handle (≡)** untuk mengubah urutan. Urutan disimpan otomatis (`PUT /reorder`), dengan tombol Urungkan di toast.
- **Toggle aktif** langsung tersimpan.
- **[+ Tambah section]** membuka galeri tipe section. Setiap tipe punya ikon, deskripsi, dan gambar mini tata letak. Setelah dipilih, form config terbuka dengan nilai default.
- **Form Edit** dibangkitkan dari skema tipe (JSON Schema dari `GET /homepage/section-types`):
  - `string` → input, `boolean` → switch, `enum` → select/segmented, `integer` → number (min/max),
  - `category_slug` → pemilih kategori, `tag_slug` → pemilih tag, `article_id` → pencari artikel,
  - `widgets[]` → daftar checkbox yang bisa diurutkan.
- **Pratinjau** (MVP): simpan, lalu klik "Lihat Beranda". Revalidasi berjalan otomatis sehingga perubahan langsung terlihat.
  **Fase lanjutan:** pratinjau langsung di panel samping (iframe dengan mode draft) sebelum disimpan.
- Peringatan di list jika section **tidak akan tampil** karena datanya kosong (misal "Belum ada agenda mendatang").

### 3.10 Menu
- Pilih menu (Header, Footer · Kategori, Footer · Tentang, Footer · Legal).
- Pohon item dengan drag & drop (maksimal 2 level untuk header).
- Tambah item: pilih tipe tautan, yaitu **Kategori** (pilih dari daftar), **Halaman statis**, **Rute bawaan** (Beranda, Agenda, Tokoh, Video), **Anchor beranda** (`#kajian`), atau **URL bebas**.
- Tombol "Simpan" mengganti seluruh pohon (satu transaksi).

### 3.11 Pengaturan (super_admin)
Tab: **Identitas** (nama, tagline, logo, favicon) · **Footer** (deskripsi, copyright; `{year}` otomatis) ·
**Kontak** (alamat, email, telepon) · **Sosial media** (daftar platform + URL, dapat diurutkan) ·
**SEO** (template judul, deskripsi default, gambar OG default, kode verifikasi Google) ·
**Header** (tampilkan tanggal/cari/tema/tombol login, label tombol).

### 3.12 Pengguna, penulis & role
- Tabel pengguna: nama tampil, email/nomor HP (email ?? phone), role, **Bisa login** (ya/tidak), aktif, login terakhir. Badge "Wajib ganti sandi" jika `must_change_password=true`.
- Search placeholder: "Cari nama, email, atau nomor HP…"; backend cocok dengan query pada email, phone (setelah didenormalisasi), dan display_name.
- Filter cepat: "Semua", "Admin (bisa login)", "Penulis saja".
- **Tambah penulis** (form ringkas): nama tampil, gelar/jabatan, bio, foto. `can_login` otomatis `false`. Tersedia untuk yang punya `authors.manage`.
- **Tambah pengguna admin** (super_admin): nama tampil, email (opsional), nomor HP (opsional; label "Nomor HP", placeholder "0821…", description "Disimpan sebagai +62; boleh ditulis 0821…, 62…, atau +62…"), password sementara, role. Validasi: login user wajib punya email OR nomor HP. Checkbox "Wajib ganti kata sandi saat login pertama" (default checked saat create).
- **Reset password dialog:** password baru (min 10), checkbox "Wajib ganti kata sandi saat login pertama" (default checked).
- **Ubah penulis menjadi admin:** aktifkan "Bisa login", lalu isi email & password (atau nomor HP, atau keduanya).
- **Role** (super_admin): list role, matriks checkbox permission per role, buat role baru. Ini jalan menuju role `editor` kelak tanpa perubahan kode.
- Proteksi: tidak bisa menonaktifkan diri sendiri atau super admin terakhir.

### 3.13 Log aktivitas
Tabel: waktu, pengguna, aksi, entitas (link), ringkasan. Filter pengguna, tipe entitas, dan rentang tanggal.

### 3.14 Profil saya
Ubah nama tampil, gelar, bio, dan foto; ganti password; daftar sesi aktif (perangkat, IP, terakhir aktif) dengan tombol "Keluarkan".

## 4. Pola teknis admin

### Lokasi shadcn components
- 43 komponen shadcn di `src/components/ui/shadcn/` (generated via `bunx shadcn add`).
- **Tidak ada komponen `form`** (radix-vega form kosong) → gunakan `field` (FieldLabel, FieldError, FieldDescription) + react-hook-form Controller.
- Admin composites di `src/components/admin/`: PageHeader, DataTable, Combobox, CategorySelect, CategoryCombobox, TagInput, SlugField, SeoFields, MediaField, MediaPickerDialog, RichTextEditor, dll.
- Pickers di `src/components/ui/pickers/` (DatePicker, TimePicker, DateTimePicker, DateRangePicker).
- Editor Tiptap di `src/components/admin/editor/`.

### Inventaris komponen admin & pemetaan JSON Schema → kontrol
**Frontend komponen untuk form field:**
| x-ui | Komponen | Props |
|---|---|---|
| `category_slug` | CategoryCombobox | value (slug \| null), onChange, level?, allowClear? |
| `tag_slug` | TagCombobox | value (slug \| null), onChange |
| `article_id` | ArticleSearchCombobox | value (id \| null), onChange |
| `widgets` | SortableCheckList | value (string[]), onChange, items (string list) |
| `richtext` | RichTextEditor | value ({json, html}), onChange |
| (textarea) | Textarea | (shadcn) |
| `boolean` | Switch | (shadcn) |
| enum (string) | Select | (shadcn) |
| enum (integer) | ToggleGroup | (shadcn) |
| `integer` | Input + number | min/max dari schema |
| (default string) | Input | (shadcn) |

### Klien API & guard
- **API client:** `src/lib/api/client.ts` dengan request<T>(path, {method?, body?, query?, signal?}) → {data, meta?, status, headers}.
- **CSRF:** X-CSRF-Token header dibaca dari document.cookie, disisipkan di setiap POST/PUT/PATCH/DELETE.
- **Token refresh:** single-flight module-level refreshOnce() pada 401 token_expired, rotasi csrf cookie, retry request sekali. Gagal → dispatch `admin:unauthenticated` event.
- **Guard:** `src/proxy.ts` matcher /admin/:path* → no access_token cookie → 307 /admin/login?next=…. Layout `(shell)` best-effort fetch /auth/me, initialMe=null jika error (client refresh). PermissionGate di UI mengecek any-of perms.

### Server state & form pattern
- **React Query:** staleTime 30s, refetchOnWindowFocus false, retry ≥500 ×2. Keys di `src/lib/api/admin/keys.ts` sebagai qk.family.kind.
- **Form:** useZodForm(schema, {defaultValues, mode: 'onBlur'}). applyServerErrors(form, err) memetakan fields[k] dari error 422 ke form.setError (exact key + last dot-segment), leftovers → toast.error.
- **PUT bodies:** full replaces (tidak partial patch). Empty nullable strings → null sebelum submit.
- **Toast:** sonner via src/lib/theme.ts useIsDark(), dark mode via .dark class (no next-themes).

### Layout & breadcrumb
- **Sidebar:** AdminSidebar dengan nav.ts NAV_GROUPS (Konten, Komunitas, Tampilan, Pengaturan, Profil). Item visibility: usePermission(...perms) any-of. Sidebar toggle dari AdminShell.
- **Topbar:** AdminTopbar + breadcrumbFor(pathname) dari nav.ts. Search tidak ada (belum implementasi).
- **Breadcrumb:** BreadcrumbList (shadcn) dari router pathname.

### DataTable & SortableList
- **DataTable<T>:** columns, data, meta?, sort?, onSortChange?, page, onPageChange, toolbar? (search/actions), rowActions?.
  - Column meta: {sortKey?, align?, hideBelow?}. Sort string whitelist-validated di backend.
  - createDataTableColumnHelper<T>() utility. TanStack Table v9.
- **SortableList<T>:** items, getId, onReorder, renderItem(item, {handleProps, isDragging}).
- **SortableTree<T>:** items, maxDepth:2, onChange, renderItem(item, {depth, handleProps, isDragging, isOver}), canNest?.

### Konfirmasi & notifikasi
- **ConfirmDialog:** {open, onOpenChange, title, description?, confirmLabel?, destructive?, onConfirm, loading?}. Tidak auto-close.
- **Toast:** sonner.toast.success/error/promise.
- **Admin:unauthenticated event:** window.dispatchEvent(new Event('admin:unauthenticated')) saat 401 token_expired setelah refresh fail.
