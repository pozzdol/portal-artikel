// Zod schemas for the settings tabs. Every text field in `setting.Keys`
// (backend/internal/setting/keys.go) is a plain Go string, not a pointer, so
// unlike most admin forms these stay '' (never transformed to null) — the
// PUT body must keep the exact struct shape.

import { z } from 'zod';

import { mediaId, MSG } from '@/lib/forms/schemas';

const text = (max: number) => z.string().trim().max(max, MSG.maxChars(max));
const requiredText = (max: number) =>
  z.string().trim().min(1, MSG.required).max(max, MSG.maxChars(max));

export const identitySchema = z.object({
  name: requiredText(120),
  tagline: text(200),
  logo_media_id: mediaId,
  favicon_media_id: mediaId,
});
export type IdentityValues = z.infer<typeof identitySchema>;

export const footerSchema = z.object({
  description: text(2000),
  copyright: text(300),
});
export type FooterValues = z.infer<typeof footerSchema>;

export const contactSchema = z.object({
  address: text(500),
  email: text(254).refine(
    (v) => v === '' || z.string().email().safeParse(v).success,
    MSG.email,
  ),
  phone: text(60),
});
export type ContactValues = z.infer<typeof contactSchema>;

export const SOCIAL_PLATFORMS = [
  'instagram',
  'youtube',
  'whatsapp',
  'facebook',
  'tiktok',
  'x',
  'telegram',
  'website',
] as const;

export const PLATFORM_LABEL: Record<(typeof SOCIAL_PLATFORMS)[number], string> =
  {
    instagram: 'Instagram',
    youtube: 'YouTube',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    x: 'X (Twitter)',
    telegram: 'Telegram',
    website: 'Situs web',
  };

const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;

export const socialLinkSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS, { error: MSG.required }),
  url: z
    .string()
    .trim()
    .min(1, MSG.required)
    .max(500, MSG.maxChars(500))
    .refine((v) => HTTP_URL_RE.test(v), MSG.url),
});

export const socialSchema = z.object({
  links: z.array(socialLinkSchema),
});
export type SocialValues = z.infer<typeof socialSchema>;

export const seoSchema = z.object({
  title_template: text(300).refine(
    (v) => v.includes('%s'),
    'Wajib memuat "%s" (placeholder judul halaman).',
  ),
  default_description: text(300),
  default_og_media_id: mediaId,
  google_site_verification: text(200),
});
export type SeoValues = z.infer<typeof seoSchema>;

export const headerOptionsSchema = z.object({
  show_date: z.boolean(),
  show_search: z.boolean(),
  show_theme_toggle: z.boolean(),
  show_login_button: z.boolean(),
  login_label: text(60),
});
export type HeaderOptionsValues = z.infer<typeof headerOptionsSchema>;
