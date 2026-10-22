import { NextResponse, type NextRequest } from 'next/server';

// Next 16 Proxy (formerly middleware). Three jobs, selected by config.matcher:
//
// 1. Preview rewrite — only two-segment paths that carry ?preview=, so article
//    pages stay fully cached: /{category}/{slug}?preview={token} is rewritten
//    to the uncached preview route /halaman/pratinjau/{slug}?token={token},
//    but only when the token has JWT shape (see JWT_SHAPE).
// 2. Admin guard — /admin and /admin/*: every response gets
//    `X-Robots-Tag: noindex, nofollow`; pages other than /admin/login without
//    an access_token cookie are redirected to /admin/login?next=<path+search>.
//    This only checks the cookie's presence (its Max-Age is the session
//    lifetime); Go validates the token, and the (shell) layout / AdminGate
//    handle expired or revoked sessions.
// 3. Client IP hand-off — /api/v1/*, only when FRONTEND_PROXY_SECRET is set
//    (frontend and API on different hosts): the request continues to the
//    next.config rewrite with X-Proxy-Secret and X-Client-IP, so Go rate-limits
//    and counts views per visitor instead of per frontend server. The IP is
//    read from CLIENT_IP_HEADER, which must be a header the hosting platform
//    overwrites (x-real-ip: nginx/Vercel, cf-connecting-ip: Cloudflare,
//    x-nf-client-connection-ip: Netlify). Client-sent copies are replaced.

/** First segments that are not article categories (reserved slugs, 00004_taxonomy.sql). */
const RESERVED_FIRST_SEGMENTS = new Set([
  'agenda',
  'tokoh',
  'video',
  'tag',
  'cari',
  'penulis',
  'halaman',
  'admin',
  'api',
  'uploads',
  'feed',
  '_next',
  'brand',
]);

/**
 * Preview tokens are JWTs (compact form: three base64url parts). Anything else
 * is never rewritten: rewriting junk like ?preview=x would turn every cached
 * article view into an uncached render plus a Go/DB hit (cache bypass / DoS
 * amplifier). Unmatched requests fall through to the ISR article page, which
 * ignores the query string and is served from cache. Well-formed but invalid
 * or expired tokens are rejected by Go with 404 (and rate-limited per IP).
 */
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_PREVIEW_TOKEN_LENGTH = 2048;

const ACCESS_COOKIE = 'access_token';
const LOGIN_PATH = '/admin/login';
const ROBOTS_HEADER = 'noindex, nofollow';

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function adminGuard(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const isLogin =
    pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`);

  let response: NextResponse;
  if (!isLogin && !request.cookies.get(ACCESS_COOKIE)?.value) {
    const target = new URL(LOGIN_PATH, request.url);
    target.search = '';
    target.searchParams.set('next', `${pathname}${search}`);
    response = NextResponse.redirect(target);
  } else {
    response = NextResponse.next();
  }
  response.headers.set('X-Robots-Tag', ROBOTS_HEADER);
  return response;
}

function previewRewrite(request: NextRequest): NextResponse {
  const { pathname, searchParams } = request.nextUrl;
  const token = searchParams.get('preview');
  if (
    !token ||
    token.length > MAX_PREVIEW_TOKEN_LENGTH ||
    !JWT_SHAPE.test(token)
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 2 || RESERVED_FIRST_SEGMENTS.has(segments[0])) {
    return NextResponse.next();
  }

  const target = new URL(`/halaman/pratinjau/${segments[1]}`, request.url);
  target.search = `?token=${encodeURIComponent(token)}`;
  return NextResponse.rewrite(target);
}

function apiHandoff(request: NextRequest): NextResponse {
  const secret = process.env.FRONTEND_PROXY_SECRET;
  if (!secret) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.set('x-proxy-secret', secret);
  const source = (process.env.CLIENT_IP_HEADER || 'x-real-ip').toLowerCase();
  const ip = request.headers.get(source)?.split(',')[0]?.trim();
  if (ip) headers.set('x-client-ip', ip);
  else headers.delete('x-client-ip');
  return NextResponse.next({ request: { headers } });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api/v1/')) return apiHandoff(request);
  if (isAdminPath(pathname)) return adminGuard(request);
  return previewRewrite(request);
}

export const config = {
  matcher: [
    { source: '/:category/:slug', has: [{ type: 'query', key: 'preview' }] },
    '/admin',
    '/admin/:path*',
    '/api/v1/:path*',
  ],
};
