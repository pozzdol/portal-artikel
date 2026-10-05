import type { Metadata } from 'next';

import { VideoGrid } from '@/components/video/VideoGrid';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Container } from '@/components/ui/Container';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Pagination } from '@/components/ui/Pagination';
import { listVideos } from '@/lib/api/queries';
import { absoluteUrl } from '@/lib/site-url';

const DESCRIPTION =
  'Dokumentasi kegiatan dan kajian Darul Hikmah Sumedang dalam format video.';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | string[] | undefined): number {
  const n = Number(firstParam(value));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export async function generateMetadata(
  props: PageProps<'/video'>,
): Promise<Metadata> {
  const sp = await props.searchParams;
  const page = parsePage(sp.page);
  const canonical =
    page > 1 ? absoluteUrl(`/video?page=${page}`) : absoluteUrl('/video');
  const title = page > 1 ? `Video — Halaman ${page}` : 'Video';

  return {
    title,
    description: DESCRIPTION,
    alternates: {
      canonical,
      types: { 'application/rss+xml': absoluteUrl('/feed.xml') },
    },
    openGraph: {
      title,
      description: DESCRIPTION,
      type: 'website',
      url: canonical,
    },
  };
}

export default async function VideoPage(props: PageProps<'/video'>) {
  const sp = await props.searchParams;
  const page = parsePage(sp.page);
  const { items, meta } = await listVideos({ page });

  return (
    <Container className="py-8 sm:py-12 lg:py-16">
      <Breadcrumb
        items={[{ label: 'Beranda', href: '/' }, { label: 'Video' }]}
      />
      <div className="mt-5 mb-8 sm:mt-6 sm:mb-12">
        <Eyebrow size="md" className="mb-3">
          Video
        </Eyebrow>
        <h1 className="text-ink font-serif text-[32px] leading-[1.12] font-semibold tracking-[-0.01em] sm:text-[36px] lg:text-[44px] 2xl:text-[52px]">
          Video
        </h1>
        <p className="text-soft mt-4 max-w-[560px] text-[15px] leading-[1.7]">
          {DESCRIPTION}
        </p>
      </div>

      <VideoGrid videos={items} headingLevel="h2" preloadFirst={page === 1} />

      <div className="mt-14">
        <Pagination
          page={meta.page}
          totalPages={meta.total_pages}
          hrefFor={(n) => (n > 1 ? `/video?page=${n}` : '/video')}
        />
      </div>
    </Container>
  );
}
