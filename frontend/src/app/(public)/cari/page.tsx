import type { Metadata } from 'next';

import { getPopularTags, listArticles, search } from '@/lib/api/queries';
import type { ArticleCard as ArticleCardData, TagItem } from '@/lib/api/types';
import { Container } from '@/components/ui/Container';
import { Pagination } from '@/components/ui/Pagination';
import { SearchBox } from '@/components/listing/SearchBox';
import { SearchEmptyState } from '@/components/listing/SearchEmptyState';
import { SearchResults } from '@/components/listing/SearchResults';
import { absoluteUrl } from '@/lib/site-url';

// Always dynamic + uncached (docs/06 §2): search hits the FTS endpoint live.
export const metadata: Metadata = {
  title: 'Pencarian',
  robots: { index: false, follow: false },
  alternates: {
    types: { 'application/rss+xml': absoluteUrl('/feed.xml') },
  },
};

const EMPTY_STATE_LIMIT = 6;
const POPULAR_TAGS_LIMIT = 10;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export default async function SearchPage({ searchParams }: PageProps<'/cari'>) {
  const params = await searchParams;
  const q = (firstValue(params.q) ?? '').trim();
  const page = parsePage(firstValue(params.page));

  if (!q) {
    const [tags, latest] = await Promise.all([
      getPopularTags(POPULAR_TAGS_LIMIT),
      listArticles({ page: 1, per_page: EMPTY_STATE_LIMIT }),
    ]);
    return (
      <Container as="main" className="py-16 lg:py-20">
        <h1 className="text-ink mb-3.5 font-serif text-[36px] leading-[1.2] font-semibold lg:text-[44px]">
          Pencarian
        </h1>
        <p className="text-soft mb-9 max-w-[640px] text-[15px] leading-[1.7]">
          Cari artikel kajian, berita, kisah tokoh, dan agenda alumni.
        </p>
        <SearchBox />
        <SearchEmptyState
          tags={tags}
          articles={latest.items}
          noResults={false}
        />
      </Container>
    );
  }

  const result = await search(q, page);
  const hasHits = result.items.length > 0;

  let tags: TagItem[] = [];
  let latestArticles: ArticleCardData[] = [];
  if (!hasHits) {
    const [popularTags, latest] = await Promise.all([
      getPopularTags(POPULAR_TAGS_LIMIT),
      listArticles({ page: 1, per_page: EMPTY_STATE_LIMIT }),
    ]);
    tags = popularTags;
    latestArticles = latest.items;
  }

  return (
    <Container as="main" className="py-16 lg:py-20">
      <h1 className="text-ink mb-3.5 font-serif text-[36px] leading-[1.2] font-semibold lg:text-[44px]">
        Hasil pencarian: &ldquo;{q}&rdquo;
      </h1>
      <p className="text-faint mb-9 text-[14px] font-medium">
        {result.meta.total} hasil ditemukan
        {result.fallback && hasHits
          ? ' — menampilkan hasil serupa untuk ejaan yang mendekati'
          : ''}
      </p>
      <SearchBox defaultValue={q} />
      {hasHits ? (
        <>
          <SearchResults items={result.items} />
          <div className="mt-14">
            <Pagination
              page={result.meta.page}
              totalPages={result.meta.total_pages}
              hrefFor={(n) => `/cari?q=${encodeURIComponent(q)}&page=${n}`}
            />
          </div>
        </>
      ) : (
        <SearchEmptyState tags={tags} articles={latestArticles} noResults />
      )}
    </Container>
  );
}
