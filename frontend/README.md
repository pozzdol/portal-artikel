# ALMAIDAH — Frontend

Next.js App Router frontend for the ALMAIDAH portal (public site + `/admin` CMS).
See `/opt/portal-berita/AGENTS.md` and `docs/` for project-wide conventions.

## Requirements

- [bun](https://bun.sh) — this project uses bun only (no npm/yarn/pnpm).

## Development

```bash
cp .env.example .env.local   # adjust if backend runs elsewhere
bun install
bun run dev                  # http://localhost:3000
```

The backend API is expected on `API_INTERNAL_URL` (default `http://127.0.0.1:8080`);
`/api/v1/*` and `/uploads/*` are proxied to it via `next.config.ts` rewrites.

## Scripts

```bash
bun run dev              # Start dev server (Turbopack) — http://localhost:3000
bun run build            # Production build (requires Go API on :8080 for homepage prerender)
bun run start            # Run production build — http://localhost:3000
bun run lint             # ESLint
bun run typecheck        # TypeScript type check (tsc --noEmit)
bun run format           # Prettier format --write .
bun run format:check     # Prettier format --check .
bun run test             # Run tests (bun test — format.ts + bun built-ins)
```
