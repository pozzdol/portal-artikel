# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-27

MVP release: Portal berita ALMAIDAH siap produksi dengan fitur lengkap dan verifikasi keamanan.

### Added
- **Fase 6 SEO & Hardening:**
  - RSS feed `/feed.xml` (RSS 2.0, 20 artikel terbaru)
  - Default OG media di pengaturan situs untuk fallback gambar artikel
  - JSON-LD enrichment lengkap (NewsArticle, Event, VideoObject, Person, BreadcrumbList)
  - Google site verification metadata
  - Preview token hardening (invalid/expired/wrong article → 404, rate limit 60/min/IP)
  - Trusted proxy configuration (`TRUSTED_PROXIES` untuk `X-Forwarded-For`)
  - CSP & security headers (script-src, frame-ancestors, Permissions-Policy)
  - Dark mode inline script (no flash)
  - Header menu overflow "Lainnya" dropdown (ResizeObserver measuring)
  - Logo dark mode plate (constant light background)
  - Calendar fallback (current month kosong → next event month)

- **Production deployment:**
  - Systemd unit files (almaidah-api.service, almaidah-web.service)
  - Nginx config example (TLS, proxying, XFF override)
  - Caddy config example (automatic TLS)
  - Backup script (`pg_dump` + uploads folder)
  - Deployment documentation (`docs/deploy.md`)

- **Toolchain upgrades:**
  - Go 1.27.1 (dari 1.22.5), chi v5.3.2, pgx v5.11.0, goose v3.28, sqlc v1.31.1, staticcheck v0.8.1
  - govulncheck v1.8.0 (vulnerabilities: 0 reachable)
  - Frontend version bumped to 1.0.0

### Fixed
- Flaky auth integration test (root cause: DB clock skew; fixed with Go-side timestamps)
- Test hardening (ConnectTimeout, health check pings before schema creation)
- Uploads error responses now have `Cache-Control: no-store` (not cached as immutable)

### Verified
- 15 acceptance scenarios all passing (login, article publish, scheduling, slug redirect, section reorder, menu overflow, dark mode, RBAC, token rotation, upload validation, ISR cache)
- Lighthouse scores (mobile): Performance 90–93, SEO 100, Accessibility 95–96, Best Practices 100
- EXPLAIN queries (1000+ articles): no seq scans, worst 10.4 ms
- Integration test suite: 36/36 passing with `-race` flag

---

## [0.6.0] - 2026-09-27

Fase 6: SEO, hardening & verifikasi end-to-end.

---

## [0.5.0] - 2026-09-27

Fase 5: Admin CMS dengan shadcn/ui, section builder, media manager, user & role RBAC.

---

## [0.4.0] - 2026-09-27

Fase 4: Frontend publik — 13 section types, halaman dalam (artikel, kategori, tag, pencarian, agenda, tokoh, video), dark mode, responsive, SEO metadata.

---

## [0.3.0] - 2026-09-27

Fase 3: API konten — artikel, kategorisasi, tag, search (FTS + fallback), trending, media, homepage resolver, revalidasi webhook, analytics view tracking.

---

## [0.2.0] - 2026-09-27

Fase 2: Autentikasi & RBAC — JWT, refresh token rotation, session management, rate limiting, audit logs, permission matrix.

---

## [0.1.0] - 2026-09-27

Fase 1: Fondasi proyek — Go backend skeleton, Next.js frontend scaffold, PostgreSQL migrations (25 tabel), seed data (demo content), Makefile targets.

---

## [0.0.0] - 2026-09-27

Fase 0: Dokumentasi & kesepakatan — 9 dokumen perencanaan, diskusi keputusan (18 item), analisis desain, arsitektur, skema database, API contract.
