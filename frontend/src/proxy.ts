import { NextResponse, type NextRequest } from 'next/server';

// Next 16 Proxy (formerly middleware). Two jobs, selected by config.matcher:
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

export function proxy(request: NextRequest) {
  if (isAdminPath(request.nextUrl.pathname)) return adminGuard(request);
  return previewRewrite(request);
}

export const config = {
  matcher: [
    { source: '/:category/:slug', has: [{ type: 'query', key: 'preview' }] },
    '/admin',
    '/admin/:path*',
  ],
};
