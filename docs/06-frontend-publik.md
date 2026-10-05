# 06 — Frontend Publik

Next.js App Router + TypeScript (`strict`) + Tailwind CSS. Semua halaman publik adalah
**Server Component**. Komponen klien hanya dipakai untuk interaksi: toggle tema, marquee,
rotasi quote, FAQ accordion, pencarian, menu mobile, dan view tracker.

## 1. Layout global

```
<html lang="id" class="(dark?)">
 └─ (public)/layout.tsx          ← fetch /public/site (tag: settings, menus, snippets)
     ├─ <AnnouncementBar>        snippets.announcement aktif (dipisah • emas); disembunyikan jika kosong
     ├─ <SiteHeader>             sticky; logo+nama+tagline | nav (menu "header") | tanggal · cari · tema · Login Admin
     ├─ <main>{children}</main>
     └─ <SiteFooter>             logo+deskripsi+sosmed | menu footer_categories | footer_about | kontak | © + footer_legal
```

- **Menu aktif:** diberi underline emas 2px. Aktif jika `pathname` sama dengan href atau diawali href + `/`.
- **Tanggal di header:** diformat `id-ID` (misal "Sabtu, 26 September 2026"), dihitung di server dengan zona `Asia/Jakarta`. Karena halaman di-cache, tanggal bisa basi. Solusinya: render di klien (`<TodayLabel>` kecil) dengan fallback kosong agar tidak terjadi hydration mismatch.
- **Tombol "Login Admin":** menuju `/admin/login`. Bisa disembunyikan lewat `header.options`.
- **Mobile (< 1024px):** nav disembunyikan dan diganti tombol hamburger yang membuka drawer. Tombol cari membuka overlay pencarian.
- **Menu header overflow "Lainnya" (Fase 6):** pada ukuran wide (xl, ≥1280px), jika menu items tidak fit inline (measuring ResizeObserver), item tambahan ditampilkan di DropdownMenu shadcn "Lainnya" + chevron emas.

## 2. Routing

| Route | File | Rendering | Revalidate tags |
|---|---|---|---|
| `/` | `(public)/page.tsx` | ISR (prerendered at `bun run build`, TTL 5m) | `homepage`, `settings`, `snippets`, `trending` |
| `/{kategori}` | `[category]/page.tsx` | **Dinamis** (reads `searchParams.page`) | `category:{slug}` |
| `/{kategori}/{slug}` | `[category]/[slug]/page.tsx` | ISR (generated on first visit with `generateStaticParams(){return []}`) | `article:{slug}` |
| `/{kategori}/{slug}?preview=…` | — | Proxy rewrite → `/halaman/pratinjau/[slug]?token=…` (no-store, noindex) | — |
| `/tag/{slug}` | `tag/[slug]/page.tsx` | **Dinamis** (reads `searchParams.page`) | `tag:{slug}` |
| `/penulis/{slug}` | `penulis/[slug]/page.tsx` | **Dinamis** (reads `searchParams.page`) | `author:{slug}` |
| `/cari?q=` | `cari/page.tsx` | **Dinamis** (no-store), `noindex` | — |
| `/agenda` | `agenda/page.tsx` | **Dinamis** (reads `searchParams.bulan`, `searchParams.tab`) | `events` |
| `/agenda/{slug}` | `agenda/[slug]/page.tsx` | ISR | `event:{slug}` |
| `/tokoh` | `tokoh/page.tsx` | **Dinamis** (reads `searchParams.page`) | `alumni` |
| `/tokoh/{slug}` | `tokoh/[slug]/page.tsx` | ISR | `alumni:{slug}` |
| `/video` | `video/page.tsx` | **Dinamis** (reads `searchParams.page`) | `videos` |
| `/video/{slug}` | `video/[slug]/page.tsx` | ISR | `video:{slug}` |
| `/halaman/{slug}` | `halaman/[slug]/page.tsx` | ISR | `page:{slug}` |
| `/halaman/pratinjau/{slug}` | `halaman/pratinjau/[slug]/page.tsx` | **Dinamis** (no-store), `noindex`, shows "Mode pratinjau" banner | — |
| `/sitemap.xml` | `sitemap.ts` | ISR | `sitemap` |
| `/robots.txt` | `robots.ts` | statis | — |

**Aturan URL artikel:** `/{slug kategori level-1}/{slug artikel}`. Contohnya, artikel di subkategori
"Fikih" (induk: Kajian) ber-URL `/kajian/adab-menuntut-ilmu`.
- Slug artikel unik global. Jika segmen kategori di URL salah, halaman melakukan **redirect 308** ke URL kanonik.
- Slug lama (tercatat di `article_slug_redirects`) juga di-redirect permanen.
- Route statis (`agenda`, `tag`, dst.) diprioritaskan Next.js di atas `[category]`. Backend juga menolak slug kategori yang bentrok dengan daftar cadangan (dok 04).

**Listing subkategori:** `/kajian?sub=fikih` menampilkan filter pill subkategori di atas listing. Subkategori tidak punya URL level pertama sendiri agar tidak bentrok.

**`generateStaticParams`:** tidak dipakai untuk artikel (jumlahnya bertambah terus). Halaman di-render saat pertama diakses, lalu di-cache (`dynamicParams = true`).

**Halaman error:**
- `not-found.tsx`: gaya editorial, dengan tautan ke beranda dan pencarian.
- `error.tsx`: pesan generik + tombol coba lagi.
- Jika API tidak bisa dihubungi saat revalidasi, Next.js tetap menyajikan cache lama (*stale*) sehingga situs tidak down.

## 3. Section types

Setiap tipe section memiliki:
1. **Komponen render** di `components/sections/{Type}.tsx`.
2. **Skema config** (zod di frontend, struct + validasi di Go) dengan nilai default.
3. **Resolver data** di backend `internal/homepage/resolvers.go`.
4. **Form config** di admin, dibangkitkan dari skema (lihat dok 07).

Registry ada di `frontend/src/lib/sections/registry.ts` dan `backend/internal/homepage/types.go`.
Kedua daftar harus sinkron. Ada test yang membandingkan output `GET /admin/homepage/section-types` dengan registry frontend.

Field umum yang dimiliki **semua** tipe (opsional):
`anchor_id` (untuk link `#kajian` di menu), `eyebrow`, `title`, `more_link {label, href}`, `background: "paper" | "ink" | "muted"`.

| Tipe | Tampilan (sesuai desain) | Config khusus | Data dari resolver |
|---|---|---|---|
| `hero_trending` | Artikel utama besar (kiri) + daftar trending bernomor 01–05 (kanan 380px) | `hero_source: "featured" \| "latest" \| "manual"`, `hero_article_id?`, `hero_category_slug?`, `trending_title` (default "Trending Hari Ini"), `trending_window: "day" \| "week"`, `trending_limit` (3–8, default 5), `show_thumbnails` | `hero: ArticleCard` (fallback manual→featured→latest; topup trending dengan latest jika < limit), `trending: ArticleCard[]` (excludes hero) |
| `breaking_ticker` | Bar hitam, badge emas, marquee | `label` (default "Breaking"), `source: "snippets" \| "articles" \| "both"`, `speed_seconds` (default 26), `limit` | `items: {text, href?}[]` |
| `article_grid` | Grid kartu 2/3/4 kolom | `category_slug?` (kosong = semua), `include_children` (default true), `tag_slug?`, `columns: 2\|3\|4`, `limit` (1–12, default 6), `show_excerpt`, `show_author`, `show_reading_time`, `image_ratio: "4/3" \| "16/9" \| "1/1"`, `dedupe` (default false), `exclude_hero` (default true) | `items: ArticleCard[]` |
| `latest_with_sidebar` | List artikel terbaru (kiri) + sidebar widget (kanan 340px) | `list_title`, `limit`, `category_slug?`, `widgets: ("popular" \| "categories" \| "tags" \| "next_event")[]` (urutan = urutan tampil), `popular_limit`, `popular_days`, `tags_limit`, `dedupe` (default false), `exclude_hero` (default false) | `items`, `widgets: {popular?, categories?, tags?, next_event?}` |
| `quote_rotator` | Latar hitam, kutipan italic besar berputar (fade) | `interval_seconds` (default 6), `order: "sequential" \| "random"` | `quotes: {text, source}[]` |
| `timeline` | Garis vertikal + bullet emas, gambar 160px, "tanggal · lokasi", judul, ringkasan | `category_slug` (default `yayasan`), `limit` (default 3), `order_by: "event_date" \| "published_at"`, `dedupe` (default false), `exclude_hero` (default false) | `items: ArticleCard[]` |
| `feature_split` | 1 artikel utama (1.4fr) + list N artikel dengan thumbnail 96px (1fr) | `category_slug`, `featured_label` (default "Opini Utama"), `side_limit` (default 3), `show_author_title`, `dedupe` (default false), `exclude_hero` (default false) | `featured: ArticleCard`, `items: ArticleCard[]` |
| `people_grid` | Grid 4 foto 3:4, nama, peran (emas), deskripsi, "Baca Kisah" | `limit` (default 4), `only_featured` (default true), `columns: 3\|4`, `cta_label` | `items: AlumniCard[]` |
| `agenda_calendar` | List event (tanggal besar emas) + kalender bulan berjalan | `limit` (default 3), `show_calendar` (default true), `calendar_month: "current" \| "next_event"` | `items: EventCard[]`, `calendar: {month, days_with_events: [{day, slug, is_next}]}` — **fallback (Fase 6):** jika bulan saat ini kosong event, tampil bulan event berikutnya |
| `video_gallery` | 1 video besar (1.5fr) + 2 kecil | `limit` (default 3), `layout: "feature" \| "grid"` | `items: VideoCard[]` |
| `faq` | Accordion, satu terbuka, ikon +/− emas | `default_open_index` (default 0, -1 = semua tertutup), `limit?` | `items: {question, answer_html}[]` |
| `newsletter` | Latar hitam, judul, deskripsi, input + tombol emas | `description`, `button_label`, `placeholder` | — (**nonaktif di MVP**; form menampilkan "Segera hadir" jika diaktifkan sebelum backend siap) |
| `rich_text` | Blok teks/HTML bebas (misal sambutan, banner) | `content_html` (disanitasi), `align: "left" \| "center" \| "right"`, `max_width: "prose" \| "wide" \| "full"` | — |

> `rich_text` **tidak ada di desain**, tetapi ditambahkan sebagai "jalan keluar" agar admin bisa
> menambah blok konten sederhana tanpa perubahan kode, sesuai prinsip "mayoritas dinamis".

**Perilaku section kosong:** jika resolver tidak menemukan data (misal belum ada event), section tidak dirender. Hal ini dicatat di admin preview agar admin paham kenapa section tidak tampil.

**Deduplikasi:** resolver homepage menyimpan daftar id artikel yang sudah tampil (hero lebih dulu). Section dengan `exclude_hero`/`dedupe: true` tidak menampilkan ulang artikel yang sama.

## 4. Komponen utama

| Komponen | Keterangan |
|---|---|
| `Container` | `max-w-[1320px] mx-auto px-5 lg:px-10` |
| `Eyebrow` | Teks kecil uppercase emas (kategori / label) |
| `SectionHeading` | Eyebrow + H2 serif + link "Lihat Semua →" (underline) + divider bawah |
| `WidgetHeading` | Judul widget sidebar: uppercase 12px + border bawah 2px ink |
| `ImageBox` | Wrapper `next/image` dengan rasio tetap. Jika gambar kosong, tampil kotak `muted` + border `line` (seperti desain) |
| `ArticleCard` | Varian: `hero`, `grid`, `grid-compact`, `list-row` (terbaru), `thumb-row` (opini kanan), `trending` (bernomor), `timeline` |
| `ArticleMeta` | "Penulis · tanggal · N menit baca" (item opsional sesuai varian) |
| `ArticleBody` | Merender `content_html` dengan kelas typografi (`prose` kustom: serif untuk heading, Inter untuk body, blockquote bergaris emas) |
| `TagChip` | Pill border `line` (shadcn Badge asChild) |
| `Pagination` | Nomor halaman + prev/next; link `?page=n` (SEO-friendly, bisa di-crawl) — shadcn Pagination |
| `Breadcrumb` | Beranda / Kategori / (Subkategori) + JSON-LD `BreadcrumbList` — shadcn Breadcrumb |
| `ThemeToggle` | Klien; ikon bulan berubah emas saat gelap |
| `Marquee` | Klien; CSS animation, menghormati `prefers-reduced-motion` (tidak bergerak) |
| `QuoteRotator` | Klien; fade 6 detik, berhenti saat hover & saat `prefers-reduced-motion` |
| `FaqAccordion` | Klien; `<button aria-expanded>` + region, dapat diakses keyboard |
| `MonthCalendar` | Server; grid 7 kolom mulai **Minggu** (M S S R K J S, sesuai desain), tanggal event ditandai |
| `YouTubeEmbed` | Lite embed: thumbnail + tombol play, iframe `youtube-nocookie.com` baru dimuat saat diklik |
| `ViewTracker` | Klien; `sendBeacon` setelah halaman terlihat 5 detik |
| `SearchOverlay` / `SearchForm` | Klien; submit ke `/cari?q=` — shadcn Dialog overlay |

**shadcn/ui di publik:** Dialog (pencarian overlay), Sheet (menu mobile), Accordion (FAQ), Button, Input, Badge, Pagination, Breadcrumb — dari registry radix-vega. Semua memakai token warna kami (--paper, --ink, --gold, --line, dst.), tidak ada perubahan visual vs baseline.

## 5. Halaman dalam

### Detail artikel `/{kategori}/{slug}`
1. Breadcrumb
2. Eyebrow kategori → H1 serif → excerpt (lead 17px)
3. Meta: avatar kecil + nama penulis (link `/penulis/slug`) · tanggal · waktu baca
4. Cover 16:9 + caption
5. Isi artikel (lebar baca maksimal ~720px)
6. Untuk artikel Yayasan: kotak info "Tanggal kegiatan · Lokasi"
7. Tag (chip, link ke `/tag/slug`)
8. Tombol bagikan (WhatsApp, Facebook, X, salin tautan). Tanpa SDK pihak ketiga, cukup link share
9. Kotak penulis (bio)
10. Artikel terkait (grid 4)
11. Sidebar desktop: Trending + Populer (dipakai ulang dari widget)

### Listing kategori / tag / penulis
- Header: eyebrow "Kategori", H1 nama, deskripsi. Untuk kategori ada pill subkategori.
- Item pertama tampil besar (hero listing), sisanya grid 3 kolom (≥768 px gambar dan teks hero berdampingan; <640 px kartu grid tampil sebagai baris ringkas). Paginasi 12 per halaman.
- Halaman ke-2 dan seterusnya: `<link rel="canonical">` menunjuk ke URL halaman itu sendiri (bukan halaman 1), serta judul "… — Halaman 2".

### Pencarian `/cari`
- Input besar, jumlah hasil, list hasil dengan cuplikan yang di-highlight (`<mark>` emas lembut), dan paginasi.
- Keadaan kosong: saran kata kunci populer (tag teratas) dan artikel terbaru.

### Agenda, Tokoh, Video
- `/agenda`: tab "Mendatang" / "Selesai", kalender bulanan dengan navigasi bulan (`?bulan=`), list event. Detailnya memuat tanggal, jam WIB, lokasi, link Maps, deskripsi, tombol daftar (jika ada), dan JSON-LD `Event`.
- `/tokoh`: grid 4; detail memuat foto, nama, peran, angkatan, kisah lengkap, dan JSON-LD `Person`.
- `/video`: grid; detail memuat embed, deskripsi, video lain, dan JSON-LD `VideoObject`.

### Halaman statis `/halaman/{slug}`
Judul + isi (typografi sama dengan artikel). Tidak memakai sidebar.

## 6. SEO

| Aspek | Implementasi |
|---|---|
| Metadata | `generateMetadata` per route: `title` (template dari `seo.defaults.title_template`), `description`, `alternates.canonical` (+ `alternates.types['application/rss+xml']` ke `/feed.xml` di layout dan tiap halaman detail), `openGraph` (type `article`, `published_time`, `modified_time`, `authors`, `section`, `tags`, gambar 1200×630), `twitter` (`summary_large_image` bila ada gambar OG, jika tidak `summary`), `verification.google` dari `seo.defaults.google_site_verification` (bila diisi) |
| Prioritas nilai | `seo_title` → `title`; `seo_description` → `excerpt` → 160 karakter pertama isi; `og_media` → cover → `seo.defaults.default_og_media` (dihidrasi backend `GET /public/site`, lihat docs/05 §1) |
| JSON-LD | `Organization` + `WebSite` (dengan `SearchAction` ke `/cari?q=`) di layout; `NewsArticle` di detail (headline, description, image, datePublished, dateModified, author `Person` + url, publisher `Organization` + logo (fallback `/brand/logo.png`), articleSection, keywords, inLanguage `id`, isAccessibleForFree); `BreadcrumbList`; `Event` (+ `organizer` Organization, `location.address` sebagai `PostalAddress`); `Person` (tokoh **dan** penulis); `VideoObject` |
| Sitemap | `app/sitemap.ts` dari `/public/sitemap`: beranda, kategori, artikel, tag (yang punya ≥1 artikel), penulis, event, tokoh, video, halaman statis. Semua dengan `lastModified` |
| Robots | Mengizinkan semua kecuali `/admin`, `/api`, `/cari`; mencantumkan `Sitemap:` |
| Canonical | Selalu absolut memakai `NEXT_PUBLIC_SITE_URL`. Query string yang tidak relevan tidak ikut |
| Performa | Font `next/font` (`display: swap`), `next/image` dengan `sizes` yang benar, hero `priority`, JS klien minimal. Target Lighthouse Mobile: Performance ≥ 90, SEO = 100, Accessibility ≥ 95 |
| Draft | Halaman preview draft memakai `noindex, nofollow` |
| Bahasa | `<html lang="id">`, `og:locale = id_ID` |
| RSS | `/feed.xml` (Route Handler, `dynamic = 'force-dynamic'`): RSS 2.0, 20 artikel terbaru dari `listArticles`, `atom:link rel="self"`, `language=id`, `lastBuildDate`, per item `title/link/guid/pubDate/description/category/dc:creator` + `enclosure` opsional untuk cover. **Selesai** (sebelumnya usulan di dok 09) |

## 7. Tema & dark mode

- Tailwind v4 dengan `@theme inline` (token dipasang langsung dalam deklarasi).
- **Warna:** CSS variables di `:root` dan `.dark`. Color classes: `text-body`, `text-meta`, `text-soft`, `text-faint`, `text-ghost` (teks); `bg-paper`, `bg-ink`, `bg-muted`, `border-line` (surface); `text-gold`, `bg-gold`, `text-gold-strong` (aksen); `bg-ink-surface`, `text-on-ink`, `text-on-ink-muted`, `bg-ink-input`, `border-ink-input-line`, `text-on-gold`, `bg-mark` (komponen khusus).
- **shadcn theme vars:** --background, --foreground, --card, --popover, --primary, --secondary, --muted, --accent, --destructive (--danger), --border, --input, --ring (--gold), --chart-1..5, --radius (0px), dipetakan ke token kami di globals.css sehingga `.dark` otomatis beralih tanpa redefine.
- **Type scale:** `text-display` (52px), `text-h2` (34px), `text-h2-sm` (28px), `text-h3` (22px), `text-h3-sm` (18px), `text-quote` (38px), `text-brand` (22px), `text-lead` (17px), `text-copy` (15px, body text), `text-copy-sm` (14px), `text-nav` (14.5px), `text-caption` (13.5px, meta), `text-caption-sm` (12.5px), `text-caption-xs` (11.5px), `text-eyebrow` (12px), `text-eyebrow-sm` (11px), `text-eyebrow-xs` (10.5px).
- Preferensi disimpan di `localStorage('theme')`: `light` | `dark` | tidak ada (ikut `prefers-color-scheme`).
- **Anti-flash (Fase 6 inline script):** script inline kecil di `<head>` menerapkan class `dark` sebelum render (`<html suppressHydrationWarning>`, beforeInteractive), sehingga `.dark` ada di `<body>` insertion. Menjaga preferensi dari localStorage + system `prefers-color-scheme` tanpa kedipan.
- Section "ink" (quote, breaking, announcement, newsletter) tetap `bg-ink-surface text-on-ink` di kedua mode.
- `::selection` memakai `bg-gold` dan `text-on-gold`.

## 8. Aksesibilitas

- Heading berurutan: satu `h1` per halaman (homepage: judul hero), `h2` per section.
- Semua tombol ikon punya `aria-label` ("Cari", "Mode gelap", "Buka menu").
- **Kontras emas:** `--gold: #C9A227` di atas putih ≈ 2.4:1 (kurang). Eyebrow emas disetting **bold, uppercase, ≥ 11px** per desain (WCAG AA untuk text besar). Token `--gold-strong: #8A6D12` tersedia (≈5:1) untuk teks emas penting jika diperlukan. Eye icon (moon) di `ThemeToggle` berubah emas saat dark mode.
- Fokus terlihat jelas (`outline` emas 2px), skip-link "Lewati ke konten".
- Animasi menghormati `prefers-reduced-motion` (marquee pause, quote rotation off).

## 9. Pengambilan data (frontend)

```ts
// src/lib/api/server.ts (server-only)
export class ApiError extends Error { constructor(public status, public code?, public body?) {} }
export type FetchOpts = { tags?: string[]; revalidate?: number; noStore?: boolean; query?: Record<string, ...> };
export async function apiFetch<T>(path, opts?): Promise<{ data: T; meta?: PageMeta; headers }>;
export async function apiGet<T>(path, opts?): Promise<T>;              // data only
export async function apiList<T>(path, opts?): Promise<{ items: T[]; meta: PageMeta }>;
```

Behavior: base `${API_INTERNAL_URL ?? 'http://127.0.0.1:8080'}/api/v1`; query serialized dengan `URLSearchParams`; `noStore` → `cache: 'no-store'`, else `next: { revalidate: 3600 (default), tags: [] }`; 404 → `notFound()`; non-2xx → `throw ApiError`; no AbortSignal.

**Cache tags per function** (memoized per-render dengan `React.cache`):

| Function | Tags | Revalidate |
|---|---|---|
| `getSite()` | `settings`, `menus`, `snippets` | 3600 |
| `getHomepage()` | `homepage`, `settings`, `snippets`, `trending` | 300 |
| `getArticle(slug)` | `article:{slug}` | 3600 |
| `getArticlePreview(slug, token)` | — | no-store |
| `listArticles({…})` | `category:{slug}` / `tag:{slug}` / `author:{slug}` | 3600 |
| `getCategory(slug)` | `category:{slug}` | 3600 |
| `getCategoryTree()` | `menus`, `homepage` | 3600 |
| `getTag(slug)` / `getPopularTags(limit)` | `tag:{slug}` / (300) | 3600 / 300 |
| `getAuthor(slug)` | `author:{slug}` | 3600 |
| `search(q, page)` | — | no-store |
| `getTrending(window, limit)` / `getPopular(days, limit)` | `trending` / (300) | 3600 / 300 |
| `listEvents({…})` / `getEvent(slug)` | `events` / `event:{slug}` | 3600 |
| `listAlumni({…})` / `getAlumni(slug)` | `alumni` / `alumni:{slug}` | 3600 |
| `listVideos({…})` / `getVideo(slug)` | `videos` / `video:{slug}` | 3600 |
| `getPage(slug)` | `page:{slug}` | 3600 |
| `getSitemapEntries()` | `sitemap` | 3600 |

- Pemanggilan dalam satu render yang sama dideduplikasi dengan `React.cache`.
- Tipe respons di `lib/api/types.ts` (mirror backend JSON snake_case). **Usulan:** generate dari OpenAPI.
