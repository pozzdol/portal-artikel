import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';

import { getArticle, getSite } from '@/lib/api/queries';
import { absoluteUrl } from '@/lib/site-url';
import {
  baseOpenGraph,
  generatedOgImage,
  LARGE_CARD,
  mediaOgImage,
} from '@/lib/og/meta';
import { ArticleView } from '@/components/article/ArticleView';

// Article detail route (docs/06 §2, §5). Fully cached ISR: only `params` is
// read, invalidated by the `article:{slug}` tag the backend sends on publish/
// update. Two behaviors are handled outside generateMetadata's control flow
// per plan §1.7:
//   - a moved slug (`GET /public/articles/{slug}` → {redirect}) → 308 via
//     permanentRedirect, thrown OUTSIDE any try/catch;
//   - a slug whose current URL uses a different level-1 category segment
//     than the one requested → 308 to the canonical `/{level1}/{slug}`.
// generateMetadata does not need the canonical-category check: the page
// throws the same redirect on the same memoized fetch before metadata would
// ever reach a client.

export async function generateMetadata({
  params,
}: PageProps<'/[category]/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const result = await getArticle(slug);
  if (result.kind === 'redirect') return {};

  const { article } = result;
  const site = await getSite();
  // An OG image picked by the editor wins; otherwise the branded card, which
  // already shows the cover photo.
  const ogImage = article.seo.og
    ? mediaOgImage(article.seo.og, article.title)
    : generatedOgImage(
        'artikel',
        article.slug,
        article.title,
        article.updated_at,
      );

  return {
    title: article.seo.title,
    description: article.seo.description ?? undefined,
    alternates: {
      canonical: article.seo.canonical_url,
      types: { 'application/rss+xml': absoluteUrl('/feed.xml') },
    },
    openGraph: {
      ...baseOpenGraph(site),
      type: 'article',
      title: article.seo.title,
      description: article.seo.description ?? undefined,
      url: article.seo.canonical_url,
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.updated_at,
      authors: [absoluteUrl(`/penulis/${article.author.slug}`)],
      section: article.category.name,
      tags: article.tags.map((tag) => tag.name),
      images: [ogImage],
    },
    twitter: LARGE_CARD,
  };
}

export default async function ArticlePage({
  params,
}: PageProps<'/[category]/[slug]'>) {
  const { category, slug } = await params;
  const result = await getArticle(slug);

  if (result.kind === 'redirect') {
    permanentRedirect(result.to);
  }

  const { article } = result;
  const canonicalCategory = article.url.split('/')[1];
  if (category !== canonicalCategory) {
    permanentRedirect(article.url);
  }

  return <ArticleView article={article} />;
}

// ISR for all paths at runtime: nothing prebuilt, each slug cached on first visit (Next 16 generateStaticParams docs).
export function generateStaticParams() {
  return [];
}
