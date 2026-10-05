import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Container } from '@/components/ui/Container';
import { Prose } from '@/components/ui/Prose';
import { getPage } from '@/lib/api/queries';
import { absoluteUrl } from '@/lib/site-url';

export async function generateMetadata(
  props: PageProps<'/halaman/[slug]'>,
): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await getPage(slug);
  const title = page.seo.title ?? page.title;
  const description = page.seo.description ?? undefined;
  const canonical = absoluteUrl(`/halaman/${page.slug}`);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: 'website', url: canonical },
  };
}

export default async function StaticPage(props: PageProps<'/halaman/[slug]'>) {
  const { slug } = await props.params;
  const page = await getPage(slug);
  // A page without any text gets a framed empty state with an exit link.
  const isEmpty = page.content_html.replace(/<[^>]*>/g, '').trim() === '';

  return (
    <Container className="py-8 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-prose">
        <Breadcrumb
          items={[{ label: 'Beranda', href: '/' }, { label: page.title }]}
        />
        <h1 className="text-ink mt-5 font-serif text-[32px] leading-[1.12] font-semibold tracking-[-0.01em] sm:mt-6 sm:text-[36px] lg:text-[44px] 2xl:text-[52px]">
          {page.title}
        </h1>
        {isEmpty ? (
          <div className="border-line bg-muted mt-9 border p-6 sm:p-8">
            <p className="text-soft text-[15px] leading-[1.7]">
              Konten halaman ini belum tersedia.
            </p>
            <Link
              href="/"
              className="border-gold text-ink mt-5 inline-flex min-h-11 items-center border-b pb-0.5 text-[13px] font-semibold lg:min-h-0"
            >
              Kembali ke beranda
            </Link>
          </div>
        ) : (
          <div className="mt-9">
            <Prose html={page.content_html} />
          </div>
        )}
      </div>
    </Container>
  );
}

// ISR for all paths at runtime: nothing prebuilt, each slug cached on first visit (Next 16 generateStaticParams docs).
export function generateStaticParams() {
  return [];
}
