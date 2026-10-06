import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      // Share images live under /api; crawlers that honor robots.txt (X/Twitter)
      // must be allowed to fetch them. The longer rule wins over `/api`.
      allow: ['/', '/api/og/'],
      disallow: ['/admin', '/api', '/cari', '/halaman/pratinjau'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
