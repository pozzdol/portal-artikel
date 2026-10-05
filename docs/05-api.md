# 05 — Spesifikasi API

Base path: **`/api/v1`**. Semua respons berformat `application/json; charset=utf-8`.
Kontrak ini dijadikan acuan bersama backend dan frontend. Tipe TypeScript di
`frontend/src/lib/api/types.ts` ditulis mengikuti dokumen ini.

## 1. Konvensi

### Format respons sukses
```json
// objek tunggal
{ "data": { "id": 12, "title": "…" } }

// daftar dengan paginasi
{
  "data": [ { … }, { … } ],
  "meta": { "page": 1, "per_page": 12, "total": 128, "total_pages": 11 }
}
```

### Format error
```json
{
  "error": {
    "code": "validation_failed",
    "message": "Data yang dikirim tidak valid.",
    "fields": { "title": "Judul wajib diisi.", "slug": "Slug sudah dipakai." }
  }
}
```

| HTTP | `code` | Kapan |
|---|---|---|
| 400 | `bad_request` | JSON rusak, parameter salah |
| 401 | `unauthenticated` | Tidak ada / token tidak valid |
| 401 | `token_expired` | Access token kedaluwarsa (klien lakukan refresh) |
| 401 | `invalid_credentials` | Email atau kata sandi salah (login) |
| 403 | `forbidden` | Tidak punya permission |
| 403 | `csrf_failed` | Header CSRF tidak cocok |
| 403 | `password_change_required` | User wajib mengganti kata sandi sebelum akses dasbor (hanya `/admin/*` dan PUT `/auth/me/password`) |
| 404 | `not_found` | |
| 409 | `conflict` | Slug duplikat, entitas masih dipakai |
| 413 | `payload_too_large` | Upload melebihi batas (>5 MB) |
| 415 | `unsupported_media_type` | Tipe file ditolak (hanya JPEG/PNG/GIF/WebP) |
| 422 | `validation_failed` | Validasi field (berisi `fields`) |
| 429 | `rate_limited` | Terlalu banyak request (+ header `Retry-After`) |
| 500 | `internal_error` | Pesan generik |

Pesan error ditulis dalam **Bahasa Indonesia** agar bisa langsung ditampilkan di UI admin.

### Paginasi, sort, filter
- Query `page` (default 1) dan `per_page` (default 12, maksimum 50 untuk publik, 100 untuk admin).
- `sort` memakai whitelist per endpoint, misal `sort=-published_at` (tanda `-` = desc).
- Filter memakai query string biasa: `?status=published&category=kajian&q=adab`.

### Tanggal
ISO-8601 dengan offset, misal `"2026-08-05T07:00:00+07:00"`. Kolom `DATE` dikirim sebagai `"2026-08-05"`.

### Representasi media
```json
"cover": {
  "id": 7, "url": "/uploads/2026/09/2f1c.webp",
  "width": 1600, "height": 900, "alt": "Kajian Subuh di Masjid Pusat", "caption": "Foto: Tim Media"
}
```

### Representasi ringkas (dipakai di banyak respons)
```ts
type ArticleCard = {
  id: number; slug: string; title: string; excerpt: string | null;
  url: string;                         // "/kajian/adab-menuntut-ilmu" (dihitung backend)
  cover: Media | null;
  category: { name: string; slug: string; parent: { name: string; slug: string } | null };
  author: { display_name: string; slug: string; title: string | null };
  published_at: string; reading_minutes: number;
  event_date: string | null; event_location: string | null;
};
```
Field `url` dihitung backend dari slug kategori level 1 dan slug artikel, sehingga frontend tidak perlu merakit URL sendiri.

---

## 2. Endpoint publik (tanpa auth)

Semua di bawah `/api/v1/public`. Hanya mengembalikan konten `published` yang
`published_at <= now()`. Respons mendapat header `Cache-Control: public, max-age=60`.

### Situs & layout
| Method | Path | Keterangan |
|---|---|---|
| GET | `/site` | Satu panggilan untuk layout: `settings` (identity + logo/favicon Media, footer, contact, social, seo.defaults dengan `default_og_media` (Media\|null) untuk fallback OG, header.options), `menus` (code → item tree dengan href ter-resolve), `announcements` aktif snippet |
| GET | `/feed.xml` | RSS 2.0: 20 artikel terbaru, atom:link, language=id, per item title/link/guid/pubDate/description/category/dc:creator + optional enclosure |
| GET | `/homepage` | Daftar section aktif **beserta datanya** (lihat §2.1) |
| GET | `/sitemap` | `{"data":{"entries":[{type:"home"\|"category"\|"article"\|"tag"\|"author"\|"event"\|"alumni"\|"video"\|"page", url:"", updated_at}]}}` (untuk `app/sitemap.ts`) |

### Artikel
| Method | Path | Keterangan |
|---|---|---|
| GET | `/articles` | List. Filter: `category` (slug, termasuk turunan), `tag`, `author`, `featured=true`; sort `-published_at`; default page 1, per_page 12 (max 50) |
| GET | `/articles/{slug}` | Detail: semua field + `content_html`, `tags`, `seo`, `related` (4 artikel: kategori/tag sama), `view_count`, `updated_at`. Jika slug ada di `article_slug_redirects`, respons **200** `{"data":{"redirect":"/kajian/slug-baru"}}` (frontend lakukan 308). Parameter `?preview=<token>` untuk melihat draft (token HS256 JWT, issuer `almaidah-preview`, subject `article_id`, TTL 30m); response `Cache-Control: no-store`. Token tidak valid/kedaluwarsa/untuk artikel lain → **404** (tidak pernah jatuh ke versi terbit). Dibatasi 60 req/menit/IP → **429** + `Retry-After` |
| GET | `/articles/slug-check` | `?slug=&exclude_id=` (admin). Respons `{"data":{"slug":"uji-fase-3","available":false,"suggestion":"uji-fase-3-1"}}` |
| POST | `/articles/{id}/view` | Catat view (204 selalu, termasuk rate limit 429). Rate limited 60/menit per IP, abaikan bot |
| GET | `/articles/trending` | `?window=day\|week` (default day), `limit=1..10` (default 5). Respons `[ArticleCard…]` |
| GET | `/articles/popular` | `?days=1..365` (default 30), `limit=1..10` (default 5). Respons `[ArticleCard…]` |
| GET | `/search` | `?q=<text>&page=1`. Mengembalikan `{"data":[{ArticleCard, "highlight":"<cuplikan>"}],"meta":{…}}`. Header `X-Search-Fallback: true` jika fallback trigram; `q` > 100 chars dipotong; `q` kosong → 200 empty |

### Taksonomi & penulis
| Method | Path | Keterangan |
|---|---|---|
| GET | `/categories` | Pohon kategori aktif + `article_count` |
| GET | `/categories/{slug}` | Detail kategori + children + `seo` |
| GET | `/tags` | `?popular=true&limit=10` (urut jumlah artikel) |
| GET | `/tags/{slug}` | Detail tag |
| GET | `/authors/{slug}` | Profil publik penulis (tanpa email) |

### Entitas lain
| Method | Path | Keterangan |
|---|---|---|
| GET | `/events` | `?when=upcoming\|past&month=2026-08&page=`. Month: parsed in Jakarta; `upcoming` = `starts_at >= now` ASC, `past` = `< now` DESC. Default: no time filter, ASC |
| GET | `/events/{slug}` | Detail + `description_html`, `location_address`, `maps_url`, `registration_url`, `seo` |
| GET | `/alumni` | `?featured=true&page=`. Default page 1, per_page 12 |
| GET | `/alumni/{slug}` | Detail + `story_html`, `seo` |
| GET | `/videos` | `?page=`. Default page 1, per_page 12 |
| GET | `/videos/{slug}` | Detail + `description`, `embed_url` (YouTube nocookie), `others` (6 video lain), `seo` |
| GET | `/pages/{slug}` | Detail: title, `content_html`, `seo`, `updated_at`; published only |
| GET | `/snippets` | `?type=quote\|faq\|breaking\|announcement`. Aktif only (window transitions) |

### SEO
| Method | Path | Keterangan |
|---|---|---|
| GET | `/sitemap` | Semua URL publik + `updated_at` (dipakai `app/sitemap.ts`) |

### 2.1 Respons `/homepage`

Backend menjalankan query untuk setiap section aktif (paralel dengan `errgroup`), lalu
mengembalikan data siap render. Frontend tidak perlu melakukan fetch tambahan.

```json
{
  "data": {
    "sections": [
      {
        "id": 1, "type": "hero_trending", "config": { "trending_limit": 5, "trending_title": "Trending Hari Ini" },
        "data": { "hero": { /* ArticleCard + excerpt */ }, "trending": [ /* ArticleCard x5 */ ] }
      },
      {
        "id": 3, "type": "article_grid",
        "config": { "eyebrow": "Kategori Utama", "title": "Kajian Terbaru", "columns": 3, "limit": 3, "show_excerpt": true, "more_link": { "label": "Lihat Semua Kajian →", "href": "/kajian" } },
        "data": { "items": [ /* ArticleCard x3 */ ] }
      }
    ]
  }
}
```
Jika data sebuah section kosong (misal belum ada event), section tetap dikirim dengan `data` kosong. Frontend memutuskan untuk menyembunyikannya (perilaku default: disembunyikan).

---

## 3. Endpoint auth

| Method | Path | Body | CSRF | Keterangan |
|---|---|---|---|---|
| POST | `/auth/login` | `{identifier, password, remember}` | ✗ | `identifier` = email atau nomor HP (normalized); field `email` diterima sebagai alias (deprecated) untuk backward compatibility. Berisi '@' atau format valid nomor HP → akun diingat sebagai email/phone. Set cookie `access_token`, `refresh_token`, `csrf_token` (Max-Age = sisa sesi 7d/30d). Respons: `{data: {user}}` dengan `roles[]`, `permissions[]`, `phone`, `must_change_password` |
| POST | `/auth/refresh` | — | ✗ | Rotasi token, set cookie baru. Refresh tidak pernah return `token_expired` |
| POST | `/auth/logout` | — | ✓ | Cabut sesi, hapus cookie |
| GET | `/auth/me` | — | ✗ | User login + `roles` + `permissions[]` (untuk UI admin menyembunyikan menu) + `phone`, `must_change_password` |
| PUT | `/auth/me` | profil | ✓ | Ubah profil sendiri (display_name, title, bio, avatar). Return 403 `password_change_required` jika `must_change_password=true` |
| PUT | `/auth/me/password` | `{current_password, new_password}` | ✓ | Verifikasi current password (422 field jika salah atau sama dengan yang baru). Pada sukses: hash, set `must_change_password=false`, bump `perm_version`, cabut semua sesi lain. Caller akan menerima 401 `token_expired` sekali pada request berikutnya |
| GET | `/auth/sessions` | — | ✗ | Sesi aktif milik user |
| DELETE | `/auth/sessions/{family_id}` | — | ✓ | Cabut sesi tertentu |

**Catatan:** Jika user `must_change_password=true`, endpoint yang **diizinkan** adalah: login, refresh, logout, GET /auth/me, GET/DELETE /auth/sessions, dan PUT /auth/me/password. Request ke endpoint lain (termasuk seluruh `/admin/*`) akan return **403 password_change_required**.

**Keterangan cookie dan session:**
- Access token: JWT valid 15 menit; cookie Max-Age = sisa lifetime sesi (7 hari standar, 30 hari dengan `remember=true`)
- Refresh token: TTL absolut 7 atau 30 hari (tanpa sliding); rotasi otomatis setiap refresh, family_id tetap sama
- CSRF token: rotates on login & refresh
- Session info shape: `{family_id, user_agent?, ip?, started_at, last_used_at, expires_at, current: bool}`

---

## 4. Endpoint admin

Semua di bawah `/api/v1/admin`. Wajib: access token valid, permission sesuai, dan
`X-CSRF-Token` untuk method non-GET. Kolom **Permission** menunjukkan permission yang diperiksa.

### Dashboard
| Method | Path | Permission | Keterangan |
|---|---|---|---|
| GET | `/dashboard` | `dashboard.view` | Respons: `{articles:{draft, scheduled, published, archived}, views_7d, views_daily:[{day, views}]×14, top_week:[{ArticleCard, views}]×5, upcoming_events:[EventCard]×3, recent_drafts:[{id, title, status, updated_at, url_admin?}]×5}` |

### Artikel
| Method | Path | Permission |
|---|---|---|
| GET | `/articles` (`?q=&status=&category=&author=&page=&sort=`) | `articles.read` |
| POST | `/articles` | `articles.create` |
| GET | `/articles/{id}` | `articles.read` |
| PUT | `/articles/{id}` | `articles.update` (+ `articles.update_any` jika bukan miliknya) |
| DELETE | `/articles/{id}` (soft delete) | `articles.delete` |
| POST | `/articles/{id}/publish` `{published_at?}` | `articles.publish`. Tanggal di masa depan = `scheduled`; past/omitted = now (truncated to seconds) |
| POST | `/articles/{id}/unpublish` | `articles.publish`. Status → `draft`, `published_at` tetap |
| POST | `/articles/{id}/restore` | `articles.delete` |
| GET | `/articles/{id}/preview-token` | `articles.read`. Token 30 menit untuk melihat draft di frontend (`/{cat}/{slug}?preview=…`) |
| GET | `/articles/slug-check?slug=&exclude_id=` | `articles.read` |

**Keterangan**:
- Sort whitelist: `-updated_at` (default), `-published_at`, `published_at`, `title`, `-title`, `-view_count`
- Filter `category` menerima slug kategori (termasuk turunan auto) atau kosong (semua)
- Filter `author` menerima user id (numeric) atau kosong
- `trashed=true` mengecualikan soft-deleted

**Body create/update:**
```json
{
  "title": "…", "slug": "…(opsional, auto dari judul)", "excerpt": "…(auto jika kosong)",
  "content_json": { "type": "doc", "content": [ … ] },
  "content_html": "<p>…</p>...",
  "cover_media_id": 7, "cover_caption": null,
  "category_id": 3, "author_id": 5, "tag_ids": [1, 4], "new_tags": ["Reuni"],
  "is_featured": false, "is_breaking": false,
  "event_date": null, "event_location": null,
  "seo_title": null, "seo_description": null, "og_media_id": null, "canonical_url": null
}
```
**Backend menghasilkan:** `content_text` (teks plain dari `content_html`), `reading_minutes` (hitung dari content_text), `excerpt` (auto dari content_text jika kosong, max 300 chars).

> **Keputusan teknis:** render Tiptap JSON → HTML dilakukan **di backend Go** (renderer kecil untuk node yang diizinkan). Alternatifnya, frontend mengirim HTML hasil `editor.getHTML()` lalu backend hanya menyanitasi. Opsi kedua **lebih sederhana dan dipilih untuk MVP**: frontend mengirim `content_json` **dan** `content_html`, backend **wajib** menyanitasi `content_html` dengan bluemonday dan tidak mempercayainya begitu saja.

### Taksonomi
| Method | Path | Permission |
|---|---|---|
| GET/POST | `/categories` | `categories.manage`. Tree 2 level; Create: slug auto dari name (`slugutil.Make` + suffix jika clash); reserved slug (level-1) ditolak 422 |
| PUT/DELETE | `/categories/{id}` | `categories.manage`. Delete: 409 jika ada artikel atau children |
| PUT | `/categories/reorder` `{items:[{id,parent_id,sort_order}]}` | `categories.manage`. Harus exact set kategori level-1 dan anak-anaknya (order valid for depth in Go) |
| GET/POST | `/tags` | `tags.manage`. Create: slug auto jika kosong (GetOrCreateTag) |
| PUT/DELETE | `/tags/{id}` | `tags.manage` |
| POST | `/tags/{id}/merge` `{into_id}` | `tags.manage`. Pindah artikel dari tag → into_id, delete tag asli; 409 jika same id atau unknown |

### Media
| Method | Path | Permission |
|---|---|---|
| GET | `/media` (`?q=&type=image&page=`) | `media.manage`. Filter `type` misal `image` → prefix `image/*` |
| GET | `/media?ids=1,2,3` | `media.manage`. Ambil beberapa item sekaligus (media picker); max 100 id, id non-angka atau list terlalu panjang → 400, urutan hasil mengikuti urutan `ids`, id yang tidak ada dilewati, respons `{"data":[…]}` tanpa `meta` |
| POST | `/media` (multipart `file`, `alt_text`, `caption`) | `media.manage`. Max 5 MB, whitelist: JPEG/PNG/GIF/WebP; magic-byte sniff + DecodeConfig cross-check |
| GET | `/media/{id}` | `media.manage`. 404 jika tidak ada |
| PUT | `/media/{id}` (alt, caption) | `media.manage` |
| DELETE | `/media/{id}` | `media.manage`. 409 jika masih dipakai (artikel, event, alumni, video, page, settings) |

### Agenda, Tokoh, Video, Halaman, Snippet
CRUD standar dengan pola yang sama:

| Resource | Path | Permission | Aksi tambahan |
|---|---|---|---|
| Agenda | `/events` | `events.manage` | — |
| Tokoh | `/alumni` | `alumni.manage` | `PUT /alumni/reorder` `{items:[{id,sort_order}]}` |
| Video | `/videos` | `videos.manage` | `POST /videos/parse-url {url}` → `{youtube_id, thumbnail_url}` |
| Halaman | `/pages` | `pages.manage` | — |
| Snippet | `/snippets` (`?type=`) | `snippets.manage` | `PUT /snippets/reorder` `{items:[{id,sort_order}]}` per type |

### Homepage builder
| Method | Path | Permission | Keterangan |
|---|---|---|---|
| GET | `/homepage/section-types` | `homepage.manage` | Respons: `{type, label, description, schema (JSON Schema draft-07), default_config}` per type |
| GET | `/homepage/sections` | `homepage.manage` | Semua section (termasuk nonaktif); respons termasuk `config_valid` bool |
| POST | `/homepage/sections` | `homepage.manage` | `{type, label, config}`. Normalize config → reject unknown keys → fill defaults → validate per-type; referenced slugs/IDs exist → 422; result has `config_valid` |
| PUT | `/homepage/sections/{id}` | `homepage.manage` | Ubah label/config/is_active (fields optional) |
| DELETE | `/homepage/sections/{id}` | `homepage.manage` | |
| PUT | `/homepage/sections/reorder` | `homepage.manage` | `{ids:[3,1,2,…]}`. Harus exact set semua section untuk page 'home' → else 422; two-pass renumber dengan DEFERRABLE constraint |
| GET | `/homepage/preview` | `homepage.manage` | Sama seperti `/public/homepage`, tetapi memakai draft config (fase lanjutan) |

### Menu & pengaturan
| Method | Path | Permission |
|---|---|---|
| GET | `/menus` | `menus.manage`. Respons: `{code, name, items:[…]}` per menu (item punya `label`, bukan menu-nya) |
| GET | `/menus/{code}` | `menus.manage` |
| PUT | `/menus/{code}/items` | `menus.manage`. Body: `{items:[{label, link_type(url\|route\|category\|page\|anchor), link_target, open_new_tab, is_active, children?:[…]}]}`. Max depth 2; transaksi; `url` harus http(s) atau start `/`; `route` whitelist: `/`, `/agenda`, `/tokoh`, `/video`, `/cari`; `category`/`page` slug must exist → 422; `anchor` → `/#target`; sort_order auto `(i+1)*10` |
| GET | `/settings` | `settings.manage`. Respons: `{<key>: <value>, …}` (raw map). Kunci: `site.identity`, `site.footer`, `site.contact`, `site.social`, `seo.defaults`, `header.options` |
| PUT | `/settings/{key}` | `settings.manage`. Unknown key → 404; bad body (DisallowUnknownFields) → 422; media id existence-checked → 422; result in audit log with key |

### User, role, penulis
| Method | Path | Permission | Keterangan |
|---|---|---|---|
| GET | `/authors` | `articles.create` | Daftar pilihan penulis (id, display_name, title) untuk dropdown |
| GET/POST | `/users` | `users.manage` (atau `authors.manage` bila `can_login=false`) | POST: soft delete via `is_active=false`, bukan DELETE; lihat rules di bawah |
| GET/PUT | `/users/{id}` | idem | |
| POST | `/users/{id}/reset-password` | `users.manage` | `{new_password, must_change_password?=true}`: target harus `can_login=true`, set hash, set flag, bump perm_version, cabut semua sesi |
| POST | `/users/{id}/deactivate` · `/activate` | `users.manage` | Menolak menonaktifkan super admin terakhir; deactivate cabut semua sesi target |
| GET | `/roles` | `roles.manage` | Role + permissions |
| POST/PUT/DELETE | `/roles/{id}` | `roles.manage` | POST body: `{code regex ^[a-z][a-z0-9_]*$, name, description?, permission_codes[]}`. Code immutable. DELETE: role `is_system` → 409, role masih dipakai → 409 |
| GET | `/permissions` | `roles.manage` | |
| GET | `/audit-logs` | `audit.view` | Filter: `?entity_type=&action=&user_id=&from=RFC3339/YYYY-MM-DD&to=RFC3339/YYYY-MM-DD&page=&per_page=` (default 20, max 100). Date range in WIB; date-only `to` covers whole day |

**POST /users body:** `{email?, phone?, password?, display_name required, slug?, title?, bio?, avatar_media_id?, can_login bool, is_active?, must_change_password? bool, role_ids[]}`. Create login user: (email OR phone) & password required. Convert author→login: requires password + (email OR phone). `must_change_password` default `true` saat admin menyediakan password. 422 if duplicate email/phone/slug, if unknown role_ids, if bad slug regex, if bad phone format, if login user tanpa email/phone. 403 if `authors.manage` actor tries login/phone fields. 409 if self-role/status/deactivate, if last active super admin would be deactivated. Converting to author clears phone.

**PUT /users/{id} body:** same as POST, fields optional. `phone` dapat diupdate (dengan normalisasi). Update own role/is_active/can_login → 409. Change permissions bumps user's `perm_version` (forces token_expired on next request).

**Audit actions:** login, login_failed, logout, refresh_reuse, password_change, reset_password, session_revoke, create, update, delete, activate, deactivate. Auth events use entity_type="user".

---

## 5. Endpoint internal / sistem

| Method | Path | Keterangan |
|---|---|---|
| GET | `/healthz` | 200 jika proses hidup |
| GET | `/readyz` | 200 jika DB bisa di-ping |
| GET | `/uploads/*` | File statis media |

**Webhook ke Next.js** (dipanggil oleh Go):
```
POST {NEXT_REVALIDATE_URL}            # misal http://127.0.0.1:3000/api/revalidate
X-Revalidate-Secret: {REVALIDATE_SECRET}
{ "tags": ["article:adab-menuntut-ilmu", "category:kajian", "homepage"] }
→ 200 { "revalidated": 3 }
```
