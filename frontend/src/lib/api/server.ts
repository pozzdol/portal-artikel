import 'server-only';

import { notFound } from 'next/navigation';

import type { PageMeta } from './types';

// Server-side client for the Go API (docs/03 §4, plan §2.3). Uses the fetch
// Data Cache with tags (the "previous" caching model; cacheComponents is off),
// so every response is invalidated by POST /api/revalidate from the backend.

const API_BASE = `${(process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:8080').replace(/\/+$/, '')}/api/v1`;

/** Default safety-net TTL (seconds) for cached API responses. */
export const DEFAULT_REVALIDATE = 3600;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
    public body?: unknown,
  ) {
    super(`API error ${status}${code ? ` (${code})` : ''}`);
    this.name = 'ApiError';
  }
}

export type QueryValue = string | number | boolean | undefined | null;

export type FetchOpts = {
  /** Cache tags (contract with backend internal/revalidate). */
  tags?: string[];
  /** Seconds; defaults to DEFAULT_REVALIDATE. Ignored with noStore. */
  revalidate?: number;
  /** Bypass the Data Cache entirely (search, preview). */
  noStore?: boolean;
  query?: Record<string, QueryValue>;
};

type Envelope<T> = { data: T; meta?: PageMeta };
type ErrorEnvelope = { error?: { code?: string; message?: string } };

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

/**
 * Fetches `/api/v1{path}` and unwraps the JSON envelope. A 404 calls
 * `notFound()`; any other non-2xx throws ApiError. Never pass an AbortSignal
 * here: it would opt the request out of render memoization.
 */
export async function apiFetch<T>(
  path: string,
  opts: FetchOpts = {},
): Promise<{ data: T; meta?: PageMeta; headers: Headers }> {
  const init: RequestInit = opts.noStore
    ? { cache: 'no-store' }
    : {
        next: {
          revalidate: opts.revalidate ?? DEFAULT_REVALIDATE,
          tags: opts.tags ?? [],
        },
      };

  const res = await fetch(buildUrl(path, opts.query), {
    ...init,
    headers: { Accept: 'application/json' },
  });

  if (res.status === 404) notFound();
  if (!res.ok) {
    const body = await readJson(res);
    throw new ApiError(
      res.status,
      (body as ErrorEnvelope | undefined)?.error?.code,
      body,
    );
  }

  const body = (await readJson(res)) as Envelope<T> | undefined;
  if (!body || !('data' in body)) {
    throw new ApiError(res.status, 'invalid_envelope', body);
  }
  return { data: body.data, meta: body.meta, headers: res.headers };
}

/** Like apiFetch but returns only `data`. */
export async function apiGet<T>(path: string, opts?: FetchOpts): Promise<T> {
  const { data } = await apiFetch<T>(path, opts);
  return data;
}

/** For paginated list endpoints: `{data: T[], meta}` → `{items, meta}`. */
export async function apiList<T>(
  path: string,
  opts?: FetchOpts,
): Promise<{ items: T[]; meta: PageMeta }> {
  const { data, meta } = await apiFetch<T[]>(path, opts);
  const items = data ?? [];
  return {
    items,
    meta: meta ?? {
      page: 1,
      per_page: items.length,
      total: items.length,
      total_pages: 1,
    },
  };
}
