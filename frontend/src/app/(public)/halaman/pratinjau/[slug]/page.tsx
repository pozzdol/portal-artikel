import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getArticlePreview } from '@/lib/api/queries';
import { ArticleView } from '@/components/article/ArticleView';

// Preview route (plan §1.7): reached only via the `/{category}/{slug}?preview=`
// rewrite in src/proxy.ts, so an article page can stay fully cached while
// preview stays dynamic and uncached. `getArticlePreview` always fetches with
// `cache: 'no-store'`. Never indexed.

export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}

export default async function ArticlePreviewPage({
  params,
  searchParams,
}: PageProps<'/halaman/pratinjau/[slug]'>) {
  const { slug } = await params;
  const sp = await searchParams;
  const tokenParam = sp.token;
  const token = typeof tokenParam === 'string' ? tokenParam : '';
  if (!token) notFound();

  const result = await getArticlePreview(slug, token);
  if (result.kind === 'redirect') notFound();

  return <ArticleView article={result.article} preview />;
}
