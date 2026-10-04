// Public origin of the site (no trailing slash), used for canonical URLs,
// Open Graph, JSON-LD and the sitemap. NEXT_PUBLIC_* is inlined at build time.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
).replace(/\/+$/, '');

/** Absolute URL for a site path ("/kajian/x" → "https://…/kajian/x"); absolute inputs are returned unchanged. */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
