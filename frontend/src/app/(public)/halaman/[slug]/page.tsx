import type { Metadata } from 'next';

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

  return (
    <Container className="py-14">
      <Breadcrumb
        items={[{ label: 'Beranda', href: '/' }, { label: page.title }]}
      />
      <div className="mx-auto mt-6 max-w-[720px]">
        <h1 className="text-ink font-serif text-[36px] leading-[1.12] font-semibold tracking-[-0.01em] lg:text-[52px]">
          {page.title}
        </h1>
        <div className="mt-9">
          <Prose html={page.content_html} />
        </div>
      </div>
    </Container>
  );
}

// ISR for all paths at runtime: nothing prebuilt, each slug cached on first visit (Next 16 generateStaticParams docs).
export function generateStaticParams() {
  return [];
}
