// Reusable zod v4 field schemas mirroring backend validation. Messages are
// the same Indonesian strings the Go validator uses (httpx/decode.go) so
// client- and server-side errors read alike. The server stays authoritative.
//
// Convention: text inputs hold strings ('' when empty); optional ones are
// transformed to `null` on submit so PUT bodies (full replaces) clear them.

import { z } from 'zod';

export const MSG = {
  required: 'Wajib diisi.',
  email: 'Format email tidak valid.',
  url: 'Format URL tidak valid.',
  slug: 'Hanya huruf kecil, angka, dan tanda hubung.',
  maxChars: (n: number) => `Maksimal ${n} karakter.`,
  minChars: (n: number) => `Minimal ${n} karakter.`,
  min: (n: number) => `Minimal ${n}.`,
  max: (n: number) => `Maksimal ${n}.`,
  date: 'Format tanggal tidak valid.',
  datetime: 'Format tanggal dan waktu tidak valid.',
  integer: 'Harus berupa bilangan bulat.',
} as const;

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;
/** url | /path | #anchor (homepage more_link, menu url targets). */
export const HREF_RE = /^(\/|#|https?:\/\/)/;

/** '' / whitespace / undefined → null; otherwise trimmed. */
export function emptyToNull(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  return t === '' ? null : t;
}

/** Required trimmed text. */
export function requiredText(max: number) {
  return z.string().trim().min(1, MSG.required).max(max, MSG.maxChars(max));
}

/** Optional text: '' → null on output. */
export function optionalText(max: number) {
  return z
    .string()
    .max(max, MSG.maxChars(max))
    .nullable()
    .optional()
    .transform((v) => emptyToNull(v));
}

/** Optional slug: '' → undefined (backend auto-generates / keeps current). */
export const optionalSlug = z
  .string()
  .trim()
  .max(160, MSG.maxChars(160))
  .refine((v) => v === '' || SLUG_RE.test(v), MSG.slug)
  .optional()
  .transform((v) => (v ? v : undefined));

export const requiredSlug = z
  .string()
  .trim()
  .min(1, MSG.required)
  .max(160, MSG.maxChars(160))
  .regex(SLUG_RE, MSG.slug);

export const email = z
  .string()
  .trim()
  .min(1, MSG.required)
  .max(254, MSG.maxChars(254))
  .email(MSG.email);

export const optionalEmail = z
  .string()
  .trim()
  .max(254, MSG.maxChars(254))
  .refine((v) => v === '' || z.string().email().safeParse(v).success, MSG.email)
  .nullable()
  .optional()
  .transform((v) => emptyToNull(v));

/** Optional absolute http(s) URL ('' → null). */
export function optionalUrl(max = 500) {
  return z
    .string()
    .trim()
    .max(max, MSG.maxChars(max))
    .refine((v) => v === '' || HTTP_URL_RE.test(v), MSG.url)
    .nullable()
    .optional()
    .transform((v) => emptyToNull(v));
}

export const password = z
  .string()
  .min(10, MSG.minChars(10))
  .max(128, MSG.maxChars(128));

/** Media id picked through MediaField (null = none). */
export const mediaId = z.number().int().positive().nullable();

/** Required foreign key chosen from a select (null until chosen). */
export const requiredId = z
  .number({ error: MSG.required })
  .int()
  .positive(MSG.required)
  .nullable()
  .refine((v) => v !== null, MSG.required)
  .transform((v) => v as number);

/** 'YYYY-MM-DD' or null. */
export const optionalDate = z
  .string()
  .refine((v) => v === '' || DATE_RE.test(v), MSG.date)
  .nullable()
  .optional()
  .transform((v) => emptyToNull(v));

/** RFC 3339 timestamp (from DateTimePicker) or null. */
export const optionalDateTime = z
  .string()
  .refine((v) => v === '' || !Number.isNaN(Date.parse(v)), MSG.datetime)
  .nullable()
  .optional()
  .transform((v) => emptyToNull(v));

export const requiredDateTime = z
  .string({ error: MSG.required })
  .min(1, MSG.required)
  .refine((v) => !Number.isNaN(Date.parse(v)), MSG.datetime);

/** Integer from a number input that may be empty (NaN/'' → null). */
export function optionalInt(min?: number, max?: number) {
  let n = z.number({ error: MSG.integer }).int(MSG.integer);
  if (min !== undefined) n = n.min(min, MSG.min(min));
  if (max !== undefined) n = n.max(max, MSG.max(max));
  return z.preprocess(
    (v) =>
      v === '' || v === undefined || (typeof v === 'number' && Number.isNaN(v))
        ? null
        : v,
    n.nullable(),
  );
}

/** Tiptap editor value as produced by RichTextEditor. */
export const richText = z.object({
  json: z.record(z.string(), z.unknown()).nullable(),
  html: z.string(),
});

/** SEO block shared by articles/events/alumni/pages. */
export const seoFields = {
  seo_title: optionalText(200),
  seo_description: optionalText(300),
};
