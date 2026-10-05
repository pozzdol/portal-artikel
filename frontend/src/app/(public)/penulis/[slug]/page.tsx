import type { Metadata } from 'next';

import { getAuthor, listArticles } from '@/lib/api/queries';
import { absoluteUrl } from '@/lib/site-url';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Container } from '@/components/ui/Container';
import { FixedImage } from '@/components/ui/ImageBox';
import { JsonLd } from '@/components/ui/JsonLd';
import { Pagination } from '@/components/ui/Pagination';
import { ListingGrid } from '@/components/listing/ListingGrid';

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
}: PageProps<'/penulis/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const { page: pageRaw } = await searchParams;
  const page = parsePage(firstValue(pageRaw));
  const author = await getAuthor(slug);

  const title =
    page > 1 ? `${author.display_name} — Halaman ${page}` : author.display_name;
  const canonicalPath =
    page > 1 ? `/penulis/${slug}?page=${page}` : `/penulis/${slug}`;

  return {
    title,
    description:
      author.bio ?? `Artikel yang ditulis oleh ${author.display_name}.`,
    alternates: {
      canonical: absoluteUrl(canonicalPath),
      types: { 'application/rss+xml': absoluteUrl('/feed.xml') },
    },
    openGraph: {
      type: 'profile',
      title,
      url: absoluteUrl(canonicalPath),
      ...(author.avatar ? { images: [absoluteUrl(author.avatar.url)] } : {}),
    },
  };
}

export default async function AuthorPage({
  params,
  searchParams,
}: PageProps<'/penulis/[slug]'>) {
  const { slug } = await params;
  const { page: pageRaw } = await searchParams;
  const page = parsePage(firstValue(pageRaw));

  const author = await getAuthor(slug);
  const { items, meta } = await listArticles({
    author: slug,
    page,
    per_page: PER_PAGE,
  });

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.display_name,
    ...(author.title ? { jobTitle: author.title } : {}),
    ...(author.bio ? { description: author.bio } : {}),
    ...(author.avatar ? { image: absoluteUrl(author.avatar.url) } : {}),
    url: absoluteUrl(author.url),
  };

  return (
    <Container as="main" className="py-8 sm:py-12 lg:py-16">
      <JsonLd data={personJsonLd} />
      <div className="mb-5 sm:mb-7">
        <Breadcrumb
          items={[
            { label: 'Beranda', href: '/' },
            { label: 'Penulis' },
            { label: author.display_name },
          ]}
        />
      </div>
      <header className="border-line mb-11 flex flex-col items-start gap-4 border-b pb-9 sm:flex-row sm:gap-5">
        <FixedImage
          media={author.avatar}
          size={96}
          alt={author.display_name}
          className="rounded-full"
        />
        <div>
          <h1 className="text-ink mb-1.5 font-serif text-[30px] leading-[1.2] font-semibold lg:text-[36px]">
            {author.display_name}
          </h1>
          {author.title ? (
            <p className="text-gold-strong mb-3 text-[13.5px] font-medium">
              {author.title}
            </p>
          ) : null}
          {author.bio ? (
            <p className="text-soft max-w-[640px] text-[15px] leading-[1.7]">
              {author.bio}
            </p>
          ) : null}
        </div>
      </header>
      <ListingGrid
        items={items}
        showHeroFirst={page === 1}
        emptyLabel="Belum ada artikel dari penulis ini."
      />
      <div className="mt-14">
        <Pagination
          page={page}
          totalPages={meta.total_pages}
          hrefFor={(n) => `/penulis/${slug}?page=${n}`}
        />
      </div>
    </Container>
  );
}
