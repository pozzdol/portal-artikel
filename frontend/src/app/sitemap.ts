import type { MetadataRoute } from 'next';

import { getSitemapEntries } from '@/lib/api/queries';
import { absoluteUrl } from '@/lib/site-url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getSitemapEntries();

  return entries.map((entry) => ({
    url: absoluteUrl(entry.url),
    lastModified: entry.updated_at,
  }));
}
