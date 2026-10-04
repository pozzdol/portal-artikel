import { timingSafeEqual } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';

// On-demand revalidation webhook called by the Go backend
// (backend/internal/revalidate): POST {"tags": [...]} with header
// X-Revalidate-Secret. The backend treats 4xx as permanent failures and
// 5xx/408/429 as retryable, so 5xx is only returned for server faults.

const MAX_TAGS = 128;
const MAX_TAG_LENGTH = 256;

function secretMatches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function parseTags(body: unknown): string[] | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    return null;
  const tags = (body as { tags?: unknown }).tags;
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > MAX_TAGS)
    return null;
  for (const tag of tags) {
    if (
      typeof tag !== 'string' ||
      tag.length === 0 ||
      tag.length > MAX_TAG_LENGTH
    )
      return null;
  }
  return [...new Set(tags as string[])];
}

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    console.error('[revalidate] REVALIDATE_SECRET is not configured');
    return Response.json({ error: 'not_configured' }, { status: 500 });
  }

  if (!secretMatches(request.headers.get('x-revalidate-secret'), secret)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  const tags = parseTags(body);
  if (!tags) {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  // { expire: 0 }: the next request blocks on a fresh fetch instead of being
  // served stale content (docs: webhook invalidation outside Server Actions).
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
  }

  return Response.json({ revalidated: tags.length });
}
