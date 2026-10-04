import type { ReactNode } from 'react';
import { JsonLd } from '@/components/ui/JsonLd';
import { getSite } from '@/lib/api/queries';
import { absoluteUrl } from '@/lib/site-url';
import { AnnouncementBar } from './AnnouncementBar';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { SkipLink } from './SkipLink';

export async function PublicShell({ children }: { children: ReactNode }) {
  const site = await getSite();
  const identity = site.settings['site.identity'];
  const name = identity?.name ?? 'ALMAIDAH';

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url: absoluteUrl('/'),
    ...(identity?.logo ? { logo: absoluteUrl(identity.logo.url) } : {}),
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url: absoluteUrl('/'),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absoluteUrl('/cari')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <>
      <SkipLink />
      <AnnouncementBar items={site.announcements} />
      <SiteHeader site={site} />
      <main id="konten">{children}</main>
      <SiteFooter site={site} />
      <JsonLd data={organizationJsonLd} />
      <JsonLd data={websiteJsonLd} />
    </>
  );
}
