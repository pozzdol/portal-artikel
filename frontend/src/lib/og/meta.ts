import type { Metadata } from 'next';

import type { Media, SitePayload } from '@/lib/api/types';
import { absoluteUrl } from '@/lib/site-url';

type OgImage = { url: string; width?: number; height?: number; alt?: string };

export type OgKind =
  | 'artikel'
  | 'video'
  | 'agenda'
  | 'tokoh'
  | 'penulis'
  | 'halaman'
  | 'kategori'
  | 'tag';

/** Short stable token from a timestamp so edited content gets a fresh image URL. */
function versionOf(updatedAt?: string | null): string {
  if (!updatedAt) return '';
  const t = Date.parse(updatedAt);
  return Number.isNaN(t) ? '' : `?v=${Math.floor(t / 1000).toString(36)}`;
}

/** Generated branded card (app/api/og) for one piece of content. */
export function generatedOgImage(
  kind: OgKind,
  slug: string,
  alt: string,
  updatedAt?: string | null,
): OgImage {
  return {
    url: absoluteUrl(
      `/api/og/${kind}/${encodeURIComponent(slug)}.jpg${versionOf(updatedAt)}`,
    ),
    width: 1200,
    height: 630,
    alt,
  };
}

/** An image the editor picked (e.g. an article's custom OG image) used as is. */
export function mediaOgImage(media: Media, fallbackAlt: string): OgImage {
  return {
    url: absoluteUrl(media.url),
    width: media.width ?? undefined,
    height: media.height ?? undefined,
    alt: media.alt ?? fallbackAlt,
  };
}

/** Site card: the default OG image from Pengaturan SEO, else the generated one. */
export function siteOgImage(site: SitePayload): OgImage {
  const name = site.settings['site.identity']?.name ?? 'ALMAIDAH';
  const media = site.settings['seo.defaults']?.default_og_media;
  if (media) return mediaOgImage(media, name);
  return {
    url: absoluteUrl('/api/og/situs.jpg'),
    width: 1200,
    height: 630,
    alt: name,
  };
}

/**
 * Fields every page repeats in its own `openGraph`: Next replaces the parent's
 * openGraph object instead of merging it, so siteName/locale must be restated.
 */
export function baseOpenGraph(
  site: SitePayload,
): NonNullable<Metadata['openGraph']> {
  return {
    siteName: site.settings['site.identity']?.name ?? 'ALMAIDAH',
    locale: 'id_ID',
  };
}

export const LARGE_CARD: NonNullable<Metadata['twitter']> = {
  card: 'summary_large_image',
};
