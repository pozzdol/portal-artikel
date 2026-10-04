import { getSite, listArticles } from '@/lib/api/queries';
import { absoluteUrl } from '@/lib/site-url';
import type { ArticleCard } from '@/lib/api/types';

// RSS 2.0 feed of the latest published articles (docs/06 §6, Issue 11c). The
// underlying `listArticles` call goes through the tagged fetch Data Cache
// (tags: ['homepage']), so this route stays cheap between publish/update
// webhooks; `force-dynamic` only means the route itself is not statically
// prerendered at build time (Route Handlers convention, Next 16 docs).
export const dynamic = 'force-dynamic';

const FEED_SIZE = 20;

/** Escapes text for use inside XML element content or attribute values. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Best-effort MIME type from a media URL's extension; undefined when unrecognized (enclosure is skipped). */
function mimeFromUrl(url: string): string | undefined {
  const ext = url.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return undefined;
  }
}

function itemXml(article: ArticleCard): string {
  const link = absoluteUrl(article.url);
  const description = xmlEscape(article.excerpt ?? article.title);
  const pubDate = article.published_at
    ? new Date(article.published_at).toUTCString()
    : undefined;

  const enclosure = (() => {
    if (!article.cover) return '';
    const url = absoluteUrl(article.cover.url);
    const type = mimeFromUrl(article.cover.url);
    if (!type) return '';
    return `<enclosure url="${xmlEscape(url)}" type="${xmlEscape(type)}"/>`;
  })();

  return [
    '<item>',
    `<title>${xmlEscape(article.title)}</title>`,
    `<link>${xmlEscape(link)}</link>`,
    `<guid isPermaLink="true">${xmlEscape(link)}</guid>`,
    pubDate ? `<pubDate>${pubDate}</pubDate>` : '',
    `<description>${description}</description>`,
    `<category>${xmlEscape(article.category.name)}</category>`,
    `<dc:creator>${xmlEscape(article.author.display_name)}</dc:creator>`,
    enclosure,
    '</item>',
  ]
    .filter(Boolean)
    .join('');
}

export async function GET(): Promise<Response> {
  const [site, { items }] = await Promise.all([
    getSite(),
    listArticles({ per_page: FEED_SIZE }),
  ]);

  const identity = site.settings['site.identity'];
  const siteName = identity?.name ?? 'ALMAIDAH';
  const tagline = identity?.tagline ?? 'Alumni Darul Hikmah Sumedang';
  const selfUrl = absoluteUrl('/feed.xml');
  const homeUrl = absoluteUrl('/');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '<channel>',
    `<title>${xmlEscape(siteName)}</title>`,
    `<link>${xmlEscape(homeUrl)}</link>`,
    `<atom:link href="${xmlEscape(selfUrl)}" rel="self" type="application/rss+xml"/>`,
    `<description>${xmlEscape(tagline)}</description>`,
    '<language>id</language>',
    `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    ...items.map(itemXml),
    '</channel>',
    '</rss>',
  ].join('');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
