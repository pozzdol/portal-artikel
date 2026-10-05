import type { Metadata } from 'next';

import { getCategory, listArticles } from '@/lib/api/queries';
import { absoluteUrl } from '@/lib/site-url';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Container } from '@/components/ui/Container';
import { Pagination } from '@/components/ui/Pagination';
import { ListingGrid } from '@/components/listing/ListingGrid';
import { ListingHeader } from '@/components/listing/ListingHeader';
import { SubcategoryPills } from '@/components/listing/SubcategoryPills';

const PER_PAGE = 12;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** Builds the query string of a category listing URL, keeping `sub` when present. */
function buildQuery(page: number, sub?: string): string {
  const params = new URLSearchParams();
  if (sub) params.set('sub', sub);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/[category]'>): Promise<Metadata> {
  const { category: slug } = await params;
  const sp = await searchParams;
  const page = parsePage(firstValue(sp.page));
  const category = await getCategory(slug);

  const subSlug = firstValue(sp.sub);
  const activeSub = category.children.find((child) => child.slug === subSlug);
  const name = activeSub ? activeSub.name : category.name;

  const title = page > 1 ? `${name} — Halaman ${page}` : name;
  const canonicalPath = `/${slug}${buildQuery(page, activeSub?.slug)}`;

  return {
    title: category.seo_title ?? title,
    description: category.seo_description ?? category.description ?? undefined,
    alternates: {
      canonical: absoluteUrl(canonicalPath),
      types: { 'application/rss+xml': absoluteUrl('/feed.xml') },
    },
    openGraph: { type: 'website', title, url: absoluteUrl(canonicalPath) },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<'/[category]'>) {
  const { category: slug } = await params;
  const sp = await searchParams;
  const page = parsePage(firstValue(sp.page));

  const category = await getCategory(slug);

  const requestedSub = firstValue(sp.sub);
  const activeSub = category.children.find(
    (child) => child.slug === requestedSub,
  );

  const { items, meta } = await listArticles({
    category: activeSub ? activeSub.slug : slug,
    page,
    per_page: PER_PAGE,
  });

  return (
    <Container as="main" className="py-8 sm:py-12 lg:py-16">
      <div className="mb-5 sm:mb-7">
        <Breadcrumb
          items={[
            { label: 'Beranda', href: '/' },
            activeSub
              ? { label: category.name, href: `/${slug}` }
              : { label: category.name },
            ...(activeSub ? [{ label: activeSub.name }] : []),
          ]}
        />
      </div>
      <ListingHeader
        eyebrow="Kategori"
        title={category.name}
        description={category.description}
      />
      <SubcategoryPills
        baseHref={`/${slug}`}
        items={category.children}
        activeSlug={activeSub?.slug}
      />
      <ListingGrid
        items={items}
        showHeroFirst={page === 1}
        emptyLabel="Belum ada artikel di kategori ini."
      />
      <div className="mt-14">
        <Pagination
          page={page}
          totalPages={meta.total_pages}
          hrefFor={(n) => `/${slug}${buildQuery(n, activeSub?.slug)}`}
        />
      </div>
    </Container>
  );
}
