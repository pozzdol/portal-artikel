import 'server-only';

import type { Me } from '@/lib/api/admin/types';
import { getSite } from '@/lib/api/queries';

export const ACCESS_COOKIE = 'access_token';

const API_BASE = `${(process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:8080').replace(/\/+$/, '')}/api/v1`;

export type ServerMeResult =
  | { status: 'ok'; me: Me }
  /** Session is gone (revoked, invalid token, user deactivated). */
  | { status: 'unauthenticated' }
  /** Token expired, API unreachable or unexpected answer: let the client decide (it can refresh). */
  | { status: 'unknown' };

/**
 * Best-effort GET /auth/me with the browser's cookies, never cached. The
 * refresh cookie is scoped to /api/v1/auth, so the server cannot refresh an
 * expired access token itself — `token_expired` is reported as `unknown` and
 * the client (lib/api/client.ts) refreshes.
 */
export async function fetchServerMe(
  cookieHeader: string,
): Promise<ServerMeResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { cookie: cookieHeader, accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const body = (await res.json()) as { data?: Me };
      return body.data
        ? { status: 'ok', me: body.data }
        : { status: 'unknown' };
    }
    if (res.status === 401) {
      const body = (await res.json().catch(() => null)) as {
        error?: { code?: string };
      } | null;
      return body?.error?.code === 'token_expired'
        ? { status: 'unknown' }
        : { status: 'unauthenticated' };
    }
    return { status: 'unknown' };
  } catch {
    return { status: 'unknown' };
  }
}

export type AdminBrand = { name: string; tagline: string; logoUrl: string };

const FALLBACK_BRAND: AdminBrand = {
  name: 'ALMAIDAH',
  tagline: 'Alumni Darul Hikmah Sumedang',
  logoUrl: '/brand/logo.png',
};

/** Site name + logo from the public site settings (content is data), with a static fallback. */
export async function getAdminBrand(): Promise<AdminBrand> {
  try {
    const identity = (await getSite()).settings['site.identity'];
    return {
      name: identity?.name || FALLBACK_BRAND.name,
      tagline: identity?.tagline || FALLBACK_BRAND.tagline,
      logoUrl: identity?.logo?.url || FALLBACK_BRAND.logoUrl,
    };
  } catch {
    return FALLBACK_BRAND;
  }
}
