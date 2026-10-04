import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PublicShell } from '@/components/layout/PublicShell';
import { getSite } from '@/lib/api/queries';
import { absoluteUrl } from '@/lib/site-url';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const identity = site.settings['site.identity'];
  const seo = site.settings['seo.defaults'];
  const name = identity?.name ?? 'ALMAIDAH';
  const tagline = identity?.tagline ?? 'Alumni Darul Hikmah Sumedang';
  const ogMedia = seo?.default_og_media ?? null;
  const verification = seo?.google_site_verification?.trim();

  return {
    title: {
      default: `${name} — ${tagline}`,
      template: seo?.title_template ?? '%s — ALMAIDAH',
    },
    description: seo?.default_description ?? tagline,
    openGraph: {
      siteName: name,
      locale: 'id_ID',
      type: 'website',
      url: absoluteUrl('/'),
      ...(ogMedia
        ? {
            images: [
              {
                url: absoluteUrl(ogMedia.url),
                width: ogMedia.width ?? undefined,
                height: ogMedia.height ?? undefined,
              },
            ],
          }
        : {}),
    },
    twitter: { card: ogMedia ? 'summary_large_image' : 'summary' },
    ...(verification ? { verification: { google: verification } } : {}),
    alternates: {
      types: { 'application/rss+xml': absoluteUrl('/feed.xml') },
    },
  };
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
