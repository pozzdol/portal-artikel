import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PublicShell } from '@/components/layout/PublicShell';
import { getSite } from '@/lib/api/queries';
import { absoluteUrl } from '@/lib/site-url';
import { LARGE_CARD, siteOgImage } from '@/lib/og/meta';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const identity = site.settings['site.identity'];
  const seo = site.settings['seo.defaults'];
  const name = identity?.name ?? 'ALMAIDAH';
  const tagline = identity?.tagline ?? 'Alumni Darul Hikmah Sumedang';
  const favicon = identity?.favicon ?? null;
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
      images: [siteOgImage(site)],
    },
    twitter: LARGE_CARD,
    // Lets Google show large image previews (Discover, search).
    robots: { 'max-image-preview': 'large' },
    ...(verification ? { verification: { google: verification } } : {}),
    // Favicon chosen in Pengaturan situs replaces the static brand icons.
    ...(favicon ? { icons: { icon: favicon.url, apple: favicon.url } } : {}),
    alternates: {
      types: { 'application/rss+xml': absoluteUrl('/feed.xml') },
    },
  };
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
