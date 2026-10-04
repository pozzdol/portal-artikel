# AGENTS.md

Guide for any AI coding agent (Claude Code, Codex, Cursor, etc.) working in this repo.
Human-facing documentation lives in `docs/` (Indonesian). This file is the short operational contract.

## Project

**ALMAIDAH** — news portal for the Alumni Darul Hikmah Sumedang community.
Monorepo, **no Docker** (explicit owner decision; do not add Dockerfiles/compose).

```
backend/    Go 1.27 · chi v5 · pgx v5 · sqlc · goose   (API on :8080)
frontend/   Next.js App Router · TypeScript strict · Tailwind v4 · bun   (web on :3000, CMS at /admin)
docs/       Source of truth for decisions, schema, API contract, phases
```

Read before changing anything non-trivial:
- `docs/01-diskusi-dan-keputusan.md`: settled decisions. Do not re-litigate them.
- `docs/04-skema-database.md`: DB schema. `docs/05-api.md`: API contract. `docs/06-frontend-publik.md`: routes & section types.
- `docs/08-fase-kerja.md`: phase checklist. Tick items (☐ → ☑) as they are completed.

If implementation must deviate from the docs, **update the doc in the same change**.

## Hard rules

1. **JS tooling = bun only.** Use `bun install`, `bun add`, `bun run`, `bunx`. Never npm/yarn/pnpm. Do not commit `package-lock.json`/`yarn.lock`/`pnpm-lock.yaml`. If bun is missing: `curl -fsSL https://bun.sh/install | bash`.
2. **Commits:** one-line Conventional Commit message (`feat(article): add publish scheduler`), **no body, no Co-Authored-By, no tool watermark**. After finishing a phase, create/update the phase tag (`v0.<phase>.0`, e.g. `v0.1.0` = Fase 1).
3. **Secrets never committed.** `backend/.env` and `frontend/.env.local` are gitignored. Only `.env.example` files with placeholders are committed. Never write the DB password into docs, code, or commit messages.
4. **Content is data, not code.** Anything a reader sees that may change (texts, menus, homepage sections, contacts, FAQ, …) comes from the DB and is editable in `/admin`. Code only defines display *types*.
5. **Migrations are append-only.** Never edit a migration that has been applied to the shared DB; add a new one.
6. **sqlc output (`backend/internal/dbgen`) is generated.** Edit `backend/db/queries/*.sql`, then run `make sqlc`, and commit the result.
7. Code, identifiers, and comments in **English**. User-facing UI text and API error messages in **Indonesian**.

## Commands

```bash
make tools          # install sqlc + goose (go install)
make migrate-up     # apply migrations to DATABASE_URL (backend/.env)
make migrate-status
make seed           # base + demo content (idempotent)
make sqlc           # regenerate backend/internal/dbgen
make dev-api        # go run backend API on :8080
make dev-web        # bun run dev on :3000
make lint           # go vet + staticcheck + bun run lint
make test           # go test ./... + frontend tests
```

## Database

- PostgreSQL 17 on a **shared remote server** (`<DB_HOST>:<DB_PORT>`, db `portal_berita`). It is not disposable, so be careful with `migrate reset`/`down` (only allowed when `APP_ENV=development`).
- Connection uses `sslmode=require`, and sessions are forced to `timezone=UTC` (the server default is Asia/Shanghai). Display times in `Asia/Jakarta` (WIB).
- Extensions used: `unaccent`, `pg_trgm`, `citext`.

## Backend conventions (Go)

- Per domain in `internal/<domain>/`: `handler.go` (HTTP) calls `service.go` (logic, transactions), which calls `dbgen` (sqlc). Handlers never call `dbgen` directly.
- `ctx` is the first param. Wrap errors with `%w`. Domain errors (`ErrNotFound`, `ErrConflict`, …) are mapped to HTTP in `internal/httpx` only.
- JSON envelope: `{"data": …, "meta": …}` / `{"error": {"code","message","fields"}}` (see `docs/05-api.md`).
- Every public query filters `status='published' AND published_at <= now() AND deleted_at IS NULL`.
- Logging with `log/slog`. No global mutable state besides injected config.

## Frontend conventions

- **Next.js 16 has breaking changes vs. older training data.** Read `frontend/AGENTS.md` and the guides in `frontend/node_modules/next/dist/docs/` before writing Next code (e.g. `middleware.ts` is now `proxy.ts`). Tailwind v4 tokens use `@theme inline`.
- **UI primitives = shadcn/ui only** (Radix + Tailwind), themed via the shadcn CSS variables mapped to ALMAIDAH tokens in `globals.css`. Add components with `bunx shadcn@latest add <name>`; never hand-roll buttons/inputs/selects/pickers/dialogs or add another component library.
- Server Components by default; `'use client'` only for interactivity.
- Server data via `lib/api/server.ts` (`fetch` with `next.tags` for on-demand revalidation). Browser calls go through Next rewrites (`/api/v1/*`, `/uploads/*` → Go).
- Use Tailwind theme tokens (`text-gold`, `border-line`, `font-serif`), never raw hex in components.
- Design reference: black/white + gold `#C9A227`, Cormorant Garamond (headings) + Inter (UI), square corners. See `docs/02-analisis-desain.md`.

## Definition of done (per change)

- Builds: `go build ./...` and `bun run build`
- `make lint` clean, relevant tests added/passing
- Docs updated if behavior/contract changed; phase checklist ticked
