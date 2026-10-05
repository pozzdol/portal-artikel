import Link from 'next/link';
import type { ElementType } from 'react';

import type { EventCard } from '@/lib/api/types';
import { dayMonthParts, formatTimeWIB } from '@/lib/format';

type EventRowProps = {
  event: EventCard;
  showSummary?: boolean;
  /** 'h2' when this is the page's primary listing (no other heading between
   *  the page h1 and the row); 'h3' (default) under a section h2. */
  headingLevel?: 'h2' | 'h3';
};

/** Agenda list row: gold day/month block + title + time/location, optional summary. */
export function EventRow({ event, showSummary, headingLevel }: EventRowProps) {
  const { day, month } = dayMonthParts(event.starts_at);
  const HeadingTag = (headingLevel ?? 'h3') as ElementType;

  return (
    <Link
      href={event.url}
      className="border-line flex gap-4 border-b py-4 sm:gap-6 sm:py-5"
    >
      <div className="w-16 flex-none text-center">
        <div className="text-gold-strong font-serif text-[26px] leading-none font-bold">
          {day}
        </div>
        <div className="text-faint mt-1 text-[12px] font-semibold uppercase">
          {month}
        </div>
      </div>
      <div>
        <HeadingTag className="text-ink mb-1.5 font-serif text-[18px] font-semibold sm:text-[20px]">
          {event.title}
        </HeadingTag>
        <div className="text-soft text-[13px] font-medium">
          {event.is_all_day ? 'Sepanjang hari' : formatTimeWIB(event.starts_at)}{' '}
          · {event.location_name}
        </div>
        {showSummary && event.summary ? (
          <p className="text-soft mt-2 text-[14px] leading-[1.6]">
            {event.summary}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
