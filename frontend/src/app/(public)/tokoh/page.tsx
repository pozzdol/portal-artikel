import type { Metadata } from 'next';

import { PersonCard } from '@/components/cards/PersonCard';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Container } from '@/components/ui/Container';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Pagination } from '@/components/ui/Pagination';
import { listAlumni } from '@/lib/api/queries';
import { absoluteUrl } from '@/lib/site-url';

const DESCRIPTION =
  'Kisah dan jejak alumni Darul Hikmah Sumedang di berbagai bidang.';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | string[] | undefined): number {
  const n = Number(firstParam(value));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export async function generateMetadata(
  props: PageProps<'/tokoh'>,
): Promise<Metadata> {
  const sp = await props.searchParams;
  const page = parsePage(sp.page);
  const canonical =
    page > 1 ? absoluteUrl(`/tokoh?page=${page}`) : absoluteUrl('/tokoh');
  const title = page > 1 ? `Tokoh Alumni — Halaman ${page}` : 'Tokoh Alumni';

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

export default async function TokohPage(props: PageProps<'/tokoh'>) {
  const sp = await props.searchParams;
  const page = parsePage(sp.page);
  const { items, meta } = await listAlumni({ page });

  return (
    <Container className="py-14">
      <Breadcrumb
        items={[{ label: 'Beranda', href: '/' }, { label: 'Tokoh Alumni' }]}
      />
      <div className="mt-6 mb-12">
        <Eyebrow size="md" className="mb-3">
          Tokoh Alumni
        </Eyebrow>
        <h1 className="text-ink font-serif text-[36px] leading-[1.12] font-semibold tracking-[-0.01em] lg:text-[52px]">
          Tokoh Alumni
        </h1>
        <p className="text-soft mt-4 max-w-[560px] text-[15px] leading-[1.7]">
          {DESCRIPTION}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-faint py-10 text-[14px]">
          Belum ada profil tokoh alumni.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((person) => (
            <PersonCard key={person.id} person={person} headingLevel="h2" />
          ))}
        </div>
      )}

      <div className="mt-14">
        <Pagination
          page={meta.page}
          totalPages={meta.total_pages}
          hrefFor={(n) => (n > 1 ? `/tokoh?page=${n}` : '/tokoh')}
        />
      </div>
    </Container>
  );
}
