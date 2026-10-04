import type { Metadata } from 'next';

import { getTag, listArticles } from '@/lib/api/queries';
import { absoluteUrl } from '@/lib/site-url';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Container } from '@/components/ui/Container';
import { Pagination } from '@/components/ui/Pagination';
import { ListingGrid } from '@/components/listing/ListingGrid';
import { ListingHeader } from '@/components/listing/ListingHeader';

const PER_PAGE = 12;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/tag/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const { page: pageRaw } = await searchParams;
  const page = parsePage(firstValue(pageRaw));
  const tag = await getTag(slug);

  const title =
    page > 1 ? `Tag: ${tag.name} — Halaman ${page}` : `Tag: ${tag.name}`;
  const canonicalPath = page > 1 ? `/tag/${slug}?page=${page}` : `/tag/${slug}`;

  return {
    title,
    description: `Artikel dengan tag "${tag.name}" di ALMAIDAH.`,
    alternates: {
      canonical: absoluteUrl(canonicalPath),
      types: { 'application/rss+xml': absoluteUrl('/feed.xml') },
    },
    openGraph: { type: 'website', title, url: absoluteUrl(canonicalPath) },
  };
}

export default async function TagPage({
  params,
  searchParams,
}: PageProps<'/tag/[slug]'>) {
  const { slug } = await params;
  const { page: pageRaw } = await searchParams;
  const page = parsePage(firstValue(pageRaw));

  const tag = await getTag(slug);
  const { items, meta } = await listArticles({
    tag: slug,
    page,
    per_page: PER_PAGE,
  });

  return (
    <Container as="main" className="py-16 lg:py-20">
      <div className="mb-7">
        <Breadcrumb
          items={[
            { label: 'Beranda', href: '/' },
            { label: 'Tag' },
            { label: tag.name },
          ]}
        />
      </div>
      <ListingHeader
        eyebrow="Tag"
        title={tag.name}
        description={`${tag.article_count} artikel bertag "${tag.name}".`}
      />
      <ListingGrid
        items={items}
        showHeroFirst={page === 1}
        emptyLabel="Belum ada artikel dengan tag ini."
      />
      <div className="mt-14">
        <Pagination
          page={page}
          totalPages={meta.total_pages}
          hrefFor={(n) => `/tag/${slug}?page=${n}`}
        />
      </div>
    </Container>
  );
}
