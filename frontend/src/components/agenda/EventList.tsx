import type { EventCard } from '@/lib/api/types';
import { EventRow } from '@/components/cards/EventRow';

type EventListProps = {
  events: EventCard[];
  emptyMessage: string;
  /** 'h2' when rendered directly under the page h1 (the `/agenda` listing);
   *  omit when a section h2 already precedes it (e.g. the homepage). */
  headingLevel?: 'h2' | 'h3';
};

/** Agenda list column: stacked `EventRow`s, or a quiet empty-state message. */
export function EventList({
  events,
  emptyMessage,
  headingLevel,
}: EventListProps) {
  if (events.length === 0) {
    return (
      <p className="border-line text-faint border-b py-10 text-[14px]">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div>
      {events.map((event) => (
        <EventRow
          key={event.id}
          event={event}
          showSummary
          headingLevel={headingLevel}
        />
      ))}
    </div>
  );
}
