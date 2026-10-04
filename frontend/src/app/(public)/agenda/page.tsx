import type { Metadata } from 'next';

import { AgendaTabs, type AgendaTab } from '@/components/agenda/AgendaTabs';
import { EventList } from '@/components/agenda/EventList';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Container } from '@/components/ui/Container';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { MonthCalendar } from '@/components/ui/MonthCalendar';
import { Pagination } from '@/components/ui/Pagination';
import { listEvents } from '@/lib/api/queries';
import { dateTimeAttr, shiftMonth } from '@/lib/format';
import { absoluteUrl } from '@/lib/site-url';

export async function generateMetadata(): Promise<Metadata> {
  const canonical = absoluteUrl('/agenda');
  const description =
    'Jadwal kajian, rapat, dan acara alumni Darul Hikmah Sumedang.';
  return {
    title: 'Agenda',
    description,
    // Single canonical for every tab/bulan/page combination: `/agenda` is one
    // calendar view, not distinct paginated content (Issue 12 follow-up).
    alternates: {
      canonical,
      types: { 'application/rss+xml': absoluteUrl('/feed.xml') },
    },
    openGraph: {
      title: 'Agenda',
      description,
      type: 'website',
      url: canonical,
    },
  };
}

const PER_PAGE = 12;
const CALENDAR_PER_PAGE = 50;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeTab(value: string | string[] | undefined): AgendaTab {
  return firstParam(value) === 'selesai' ? 'selesai' : 'mendatang';
}

function normalizeMonth(value: string | string[] | undefined): string {
  const raw = firstParam(value);
  return raw && /^\d{4}-\d{2}$/.test(raw) ? raw : currentMonthJakarta();
}

function parsePage(value: string | string[] | undefined): number {
  const n = Number(firstParam(value));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** "YYYY-MM" for the current date in Jakarta, derived from the already-tested `dateTimeAttr`. */
function currentMonthJakarta(): string {
  return dateTimeAttr(new Date().toISOString()).slice(0, 7);
}

function agendaHref({
  tab,
  month,
  page,
}: {
  tab: AgendaTab;
  month: string;
  page?: number;
}): string {
  const params = new URLSearchParams();
  if (tab !== 'mendatang') params.set('tab', tab);
  params.set('bulan', month);
  if (page && page > 1) params.set('page', String(page));
  return `/agenda?${params.toString()}`;
}

type CalendarEvent = { id: number; slug: string; starts_at: string };

/** Id of the earliest event whose start time has not passed yet, or undefined if none. */
function findNextEventId(events: CalendarEvent[]): number | undefined {
  const nowMs = Date.now();
  const upcoming = events
    .filter((event) => new Date(event.starts_at).getTime() >= nowMs)
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  return upcoming[0]?.id;
}

/** One calendar-day entry per distinct day-of-month, keyed by the Jakarta day number. */
function buildCalendarDays(
  events: CalendarEvent[],
  nextEventId: number | undefined,
): { day: number; slug: string; isNext?: boolean }[] {
  const dayMap = new Map<
    number,
    { day: number; slug: string; isNext?: boolean }
  >();
  for (const event of events) {
    const day = Number(dateTimeAttr(event.starts_at).slice(8, 10));
    if (!dayMap.has(day) || event.id === nextEventId) {
      dayMap.set(day, {
        day,
        slug: event.slug,
        isNext: event.id === nextEventId,
      });
    }
  }
  return [...dayMap.values()];
}

export default async function AgendaPage(props: PageProps<'/agenda'>) {
  const sp = await props.searchParams;
  const tab = normalizeTab(sp.tab);
  const month = normalizeMonth(sp.bulan);
  const page = parsePage(sp.page);
  const when = tab === 'selesai' ? 'past' : 'upcoming';

  const [list, calendarList] = await Promise.all([
    listEvents({ when, page, per_page: PER_PAGE }),
    listEvents({ month, per_page: CALENDAR_PER_PAGE }),
  ]);

  const nextEventId = findNextEventId(calendarList.items);
  const calendarDays = buildCalendarDays(calendarList.items, nextEventId);

  return (
    <Container className="py-14">
      <Breadcrumb
        items={[{ label: 'Beranda', href: '/' }, { label: 'Agenda' }]}
      />
      <div className="mt-6 mb-10">
        <Eyebrow size="md" className="mb-3">
          Agenda
        </Eyebrow>
        <h1 className="text-ink font-serif text-[36px] leading-[1.12] font-semibold tracking-[-0.01em] lg:text-[52px]">
          Agenda
        </h1>
        <p className="text-soft mt-4 max-w-[560px] text-[15px] leading-[1.7]">
          Jadwal kajian, rapat, dan acara alumni Darul Hikmah Sumedang.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1fr_340px]">
        <div>
          <AgendaTabs
            active={tab}
            hrefFor={(t) => agendaHref({ tab: t, month })}
          />
          <EventList
            events={list.items}
            emptyMessage={
              tab === 'selesai'
                ? 'Belum ada agenda yang selesai.'
                : 'Belum ada agenda mendatang.'
            }
            headingLevel="h2"
          />
          <div className="mt-10">
            <Pagination
              page={list.meta.page}
              totalPages={list.meta.total_pages}
              hrefFor={(n) => agendaHref({ tab, month, page: n })}
            />
          </div>
        </div>
        <div>
          <MonthCalendar
            month={month}
            days={calendarDays}
            nav={{
              prevHref: agendaHref({ tab, month: shiftMonth(month, -1) }),
              nextHref: agendaHref({ tab, month: shiftMonth(month, 1) }),
            }}
          />
        </div>
      </div>
    </Container>
  );
}
