import { EventRow } from '@/components/cards/EventRow';
import { MonthCalendar } from '@/components/ui/MonthCalendar';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { cn } from '@/lib/cn';
import type {
  AgendaCalendarConfig,
  AgendaCalendarData,
  SectionProps,
} from '@/lib/sections/types';

import { SectionShell } from './SectionShell';

/** "Agenda": upcoming-event list beside an optional `MonthCalendar`. */
export function AgendaCalendarSection({
  id,
  config,
  data,
  padTop,
  isFirst,
}: SectionProps<AgendaCalendarConfig, AgendaCalendarData>) {
  if (data.items.length === 0) return null;

  const headingId = config.anchor_id
    ? `${config.anchor_id}-h2`
    : `section-${id}-h2`;
  const showCalendar = config.show_calendar && data.calendar !== null;

  return (
    <SectionShell
      anchorId={config.anchor_id}
      background={config.background}
      padTop={padTop}
      isFirst={isFirst}
      ariaLabelledBy={headingId}
    >
      <SectionHeading
        id={headingId}
        title={config.title ?? 'Agenda'}
        eyebrow={config.eyebrow}
        moreLink={config.more_link}
      />
      <div
        className={cn(
          'grid gap-14',
          showCalendar && 'lg:grid-cols-[1fr_340px]',
        )}
      >
        <div className="flex flex-col">
          {data.items.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
        {showCalendar && data.calendar ? (
          <MonthCalendar
            month={data.calendar.month}
            days={data.calendar.days_with_events.map((d) => ({
              day: d.day,
              slug: d.slug,
              isNext: d.is_next,
            }))}
          />
        ) : null}
      </div>
    </SectionShell>
  );
}
