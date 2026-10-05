/** Default landing page after login. */
export const ADMIN_HOME = '/admin';

/** Where a user with a pending forced password change must go. */
export const CHANGE_PASSWORD_PATH = '/admin/ganti-password';

const ADMIN_RE = /^\/admin(?:[/?#]|$)/;
const LOGIN_RE = /^\/admin\/login(?:[/?#]|$)/;
const CHANGE_PASSWORD_RE = /^\/admin\/ganti-password(?:[/?#]|$)/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

/**
 * Sanitize a `?next=` value: only same-origin relative paths inside /admin
 * (never the login or forced-change pages) are allowed; everything else falls back to
 * `fallback`. Guards against open redirects (`//evil`, `/\evil`, absolute
 * URLs, `/admin/../x`).
 */
export function safeNext(
  raw: string | string[] | null | undefined,
  fallback: string = ADMIN_HOME,
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.includes('\\') || CONTROL_RE.test(value)) return fallback;

  let normalized: string;
  try {
    const base = 'http://internal.invalid';
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    normalized = `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
  if (
    !ADMIN_RE.test(normalized) ||
    LOGIN_RE.test(normalized) ||
    CHANGE_PASSWORD_RE.test(normalized)
  ) {
    return fallback;
  }
  return normalized;
}

/** Post-login destination: the forced-change page while the flag is set, else `next`. */
export function postLoginPath(
  me: { must_change_password?: boolean },
  next: string,
): string {
  return me.must_change_password ? CHANGE_PASSWORD_PATH : safeNext(next);
}
