import type { Metadata } from 'next';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Container } from '@/components/ui/Container';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ImageBox } from '@/components/ui/ImageBox';
import { JsonLd } from '@/components/ui/JsonLd';
import { Prose } from '@/components/ui/Prose';
import { getAlumni } from '@/lib/api/queries';
import { absoluteUrl } from '@/lib/site-url';

export async function generateMetadata(
  props: PageProps<'/tokoh/[slug]'>,
): Promise<Metadata> {
  const { slug } = await props.params;
  const person = await getAlumni(slug);
  const title = person.seo.title ?? person.name;
  const description = person.seo.description ?? person.short_bio;
  const canonical = absoluteUrl(person.url);

  return {
    title,
    description,
    alternates: {
      canonical,
      types: { 'application/rss+xml': absoluteUrl('/feed.xml') },
    },
    openGraph: {
      title,
      description,
      type: 'profile',
      url: canonical,
      ...(person.photo ? { images: [absoluteUrl(person.photo.url)] } : {}),
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function TokohDetailPage(
  props: PageProps<'/tokoh/[slug]'>,
) {
  const { slug } = await props.params;
  const person = await getAlumni(slug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    jobTitle: person.role_title,
    description: person.short_bio,
    image: person.photo ? absoluteUrl(person.photo.url) : undefined,
    url: absoluteUrl(person.url),
  };

  return (
    <Container className="py-8 sm:py-12 lg:py-16">
      <JsonLd data={jsonLd} />
      <Breadcrumb
        items={[
          { label: 'Beranda', href: '/' },
          { label: 'Tokoh Alumni', href: '/tokoh' },
          { label: person.name },
        ]}
      />
      <div className="mt-8 grid gap-8 md:grid-cols-[240px_1fr] lg:grid-cols-[320px_1fr] lg:gap-12">
        <ImageBox
          media={person.photo}
          ratio="3/4"
          sizes="(min-width:1024px) 320px, (min-width:768px) 240px, 280px"
          className="mx-auto w-full max-w-[280px] md:max-w-none"
          alt={person.name}
          preload
        />
        <div>
          <Eyebrow size="md" className="mb-3">
            {person.role_title}
          </Eyebrow>
          <h1 className="text-ink font-serif text-[32px] leading-[1.12] font-semibold tracking-[-0.01em] sm:text-[36px] lg:text-[44px] 2xl:text-[52px]">
            {person.name}
          </h1>
          {person.class_year ? (
            <div className="text-meta mt-3 text-[13.5px] font-medium">
              Angkatan {person.class_year}
            </div>
          ) : null}
          <p className="text-soft mt-5 max-w-prose text-[17px] leading-[1.7] font-medium">
            {person.short_bio}
          </p>
          <div className="mt-8 max-w-prose">
            <Prose html={person.story_html} />
          </div>
        </div>
      </div>
    </Container>
  );
}

// ISR for all paths at runtime: nothing prebuilt, each slug cached on first visit (Next 16 generateStaticParams docs).
export function generateStaticParams() {
  return [];
}
