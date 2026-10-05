import { CalendarDays, Clock3, MapPin } from 'lucide-react';
import type { Metadata } from 'next';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Container } from '@/components/ui/Container';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ImageBox } from '@/components/ui/ImageBox';
import { JsonLd } from '@/components/ui/JsonLd';
import { Prose } from '@/components/ui/Prose';
import { getEvent, getSite } from '@/lib/api/queries';
import { formatDateWeekday, formatTimeWIB } from '@/lib/format';
import { absoluteUrl } from '@/lib/site-url';

export async function generateMetadata(
  props: PageProps<'/agenda/[slug]'>,
): Promise<Metadata> {
  const { slug } = await props.params;
  const event = await getEvent(slug);
  const title = event.seo.title ?? event.title;
  const description = event.seo.description ?? event.summary ?? undefined;
  const canonical = absoluteUrl(event.url);

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
      type: 'website',
      url: canonical,
      ...(event.cover ? { images: [absoluteUrl(event.cover.url)] } : {}),
    },
    twitter: { card: 'summary_large_image' },
  };
}

/** "05.00 WIB" or "05.00–07.00 WIB" when an end time is known. */
function timeRange(
  startsAt: string,
  endsAt: string | null,
  isAllDay: boolean,
): string {
  if (isAllDay) return 'Sepanjang hari';
  if (!endsAt) return formatTimeWIB(startsAt);
  return `${formatTimeWIB(startsAt).replace(' WIB', '')}–${formatTimeWIB(endsAt)}`;
}

export default async function AgendaDetailPage(
  props: PageProps<'/agenda/[slug]'>,
) {
  const { slug } = await props.params;
  const [event, site] = await Promise.all([getEvent(slug), getSite()]);
  const identity = site.settings['site.identity'];
  const siteName = identity?.name ?? 'ALMAIDAH';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    startDate: event.starts_at,
    endDate: event.ends_at ?? undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: event.location_name,
      ...(event.location_address
        ? {
            address: {
              '@type': 'PostalAddress',
              streetAddress: event.location_address,
            },
          }
        : {}),
    },
    organizer: {
      '@type': 'Organization',
      name: siteName,
      url: absoluteUrl('/'),
    },
    image: event.cover ? [absoluteUrl(event.cover.url)] : undefined,
    description: event.summary ?? undefined,
    url: absoluteUrl(event.url),
  };

  return (
    <Container className="py-8 sm:py-12 lg:py-16">
      <JsonLd data={jsonLd} />
      <div className="mx-auto max-w-[840px]">
        <Breadcrumb
          items={[
            { label: 'Beranda', href: '/' },
            { label: 'Agenda', href: '/agenda' },
            { label: event.title },
          ]}
        />
        <div className="mt-5 sm:mt-6" />
        <Eyebrow size="md" className="mb-3">
          Agenda
        </Eyebrow>
        <h1 className="text-ink font-serif text-[32px] leading-[1.12] font-semibold tracking-[-0.01em] sm:text-[36px] lg:text-[44px] 2xl:text-[52px]">
          {event.title}
        </h1>
        <div className="text-meta mt-5 flex flex-col gap-2 text-[13.5px] font-medium sm:flex-row sm:flex-wrap sm:gap-x-5">
          <span className="inline-flex items-center gap-2">
            <CalendarDays
              className="text-gold-strong size-4"
              aria-hidden="true"
            />
            {formatDateWeekday(event.starts_at)}
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock3 className="text-gold-strong size-4" aria-hidden="true" />
            {timeRange(event.starts_at, event.ends_at, event.is_all_day)}
          </span>
          <span className="inline-flex items-center gap-2">
            <MapPin className="text-gold-strong size-4" aria-hidden="true" />
            {event.location_name}
          </span>
        </div>

        {event.cover ? (
          <ImageBox
            media={event.cover}
            ratio="16/9"
            sizes="(min-width: 1024px) 840px, 100vw"
            alt={event.title}
            preload
            className="mt-9"
          />
        ) : null}

        <div className="mt-9">
          <Prose html={event.description_html} />
        </div>

        <div className="border-line bg-muted mt-9 border p-6">
          <div className="text-ink text-[12px] font-bold tracking-[0.12em] uppercase">
            Lokasi
          </div>
          <p className="text-ink mt-2 text-[15px] leading-[1.7]">
            {event.location_name}
          </p>
          {event.location_address ? (
            <p className="text-soft mt-1 text-[14px] leading-[1.6]">
              {event.location_address}
            </p>
          ) : null}
          {event.maps_url ? (
            <a
              href={event.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border-gold text-ink mt-3 inline-flex min-h-11 items-center border-b pb-0.5 text-[12.5px] font-semibold lg:min-h-0"
            >
              Buka di Google Maps ↗
            </a>
          ) : null}
        </div>

        {event.registration_url ? (
          <a
            href={event.registration_url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gold text-on-gold mt-9 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] px-[28px] py-[14px] text-[14px] font-semibold sm:w-auto"
          >
            Daftar
          </a>
        ) : null}
      </div>
    </Container>
  );
}

// ISR for all paths at runtime: nothing prebuilt, each slug cached on first visit (Next 16 generateStaticParams docs).
export function generateStaticParams() {
  return [];
}
