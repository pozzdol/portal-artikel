// Indonesian mobile numbers; mirrors backend/internal/phone. The canonical
// (stored) form is the national significant number without prefix: 8xxxxxxxxx.

const NATIONAL_RE = /^8[0-9]{8,11}$/;

/** Any accepted spelling (0821…, 62821…, +62 821…) → "821…", or null when invalid. */
export function normalizePhone(raw: string): string | null {
  let s = raw.trim().replace(/[\s\-.()]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^[0-9]+$/.test(s)) return null;
  if (s.startsWith('62')) s = s.slice(2);
  else if (s.startsWith('0')) s = s.slice(1);
  return NATIONAL_RE.test(s) ? s : null;
}

/** "8123456789" → "+62 812-3456-789". Returns the input untouched when not normalized. */
export function formatPhone(n: string | null | undefined): string {
  if (!n) return '';
  if (!NATIONAL_RE.test(n)) return n;
  return `+62 ${n.slice(0, 3)}-${n.slice(3, 7)}${n.length > 7 ? `-${n.slice(7)}` : ''}`;
}

/** "8123456789" → "+628123456789". */
export function phoneE164(n: string): string {
  return `+62${n}`;
}
