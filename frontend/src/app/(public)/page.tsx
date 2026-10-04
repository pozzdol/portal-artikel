import type { Metadata } from 'next';

import { SectionRenderer } from '@/components/sections/SectionRenderer';
import { getHomepage, getSite } from '@/lib/api/queries';
import { absoluteUrl } from '@/lib/site-url';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const identity = site.settings['site.identity'];
  const name = identity?.name ?? 'ALMAIDAH';
  const tagline = identity?.tagline ?? 'Alumni Darul Hikmah Sumedang';

  return {
    title: { absolute: `${name} — ${tagline}` },
    alternates: {
      canonical: absoluteUrl('/'),
      // `alternates` merges shallowly with the layout's metadata (Next 16
      // docs), so setting `canonical` here drops the layout's RSS `types`
      // unless it is repeated.
      types: { 'application/rss+xml': absoluteUrl('/feed.xml') },
    },
  };
}

export default async function HomePage() {
  const homepage = await getHomepage();
  return <SectionRenderer sections={homepage.sections} />;
}
