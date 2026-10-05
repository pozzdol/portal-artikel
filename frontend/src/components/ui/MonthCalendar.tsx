import Link from 'next/link';

import { cn } from '@/lib/cn';
import { calendarGrid, formatMonthYear } from '@/lib/format';

type CalendarDayMeta = {
  day: number;
  slug?: string;
  isNext?: boolean;
};

type MonthCalendarProps = {
  month: string;
  days: CalendarDayMeta[];
  title?: string;
  nav?: { prevHref: string; nextHref: string };
  className?: string;
};

const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** Muted month-grid box used by the Agenda calendar; next event gold, other event days ink. */
export function MonthCalendar({
  month,
  days,
  title,
  nav,
  className,
}: MonthCalendarProps) {
  const { weeks } = calendarGrid(month);
  const dayMap = new Map(days.map((d) => [d.day, d]));

  return (
    <div className={cn('border-line bg-muted border p-4 sm:p-6', className)}>
      <div className="mb-4 flex items-center justify-between">
        {nav ? (
          <Link
            href={nav.prevHref}
            aria-label="Bulan sebelumnya"
            className="text-faint hover:text-ink flex size-11 items-center justify-center text-[18px] lg:size-9"
          >
            ‹
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="text-ink text-center font-serif text-[16px] font-semibold">
          {title ?? formatMonthYear(month)}
        </div>
        {nav ? (
          <Link
            href={nav.nextHref}
            aria-label="Bulan berikutnya"
            className="text-faint hover:text-ink flex size-11 items-center justify-center text-[18px] lg:size-9"
          >
            ›
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      <div className="text-faint mb-2 grid grid-cols-7 gap-x-0.5 gap-y-1.5 text-center text-[12px] font-medium sm:gap-x-1.5">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={`${label}-${i}`}>{label}</span>
        ))}
      </div>
      <div className="text-body grid grid-cols-7 gap-x-0.5 gap-y-1.5 text-center text-[13px] sm:gap-x-1.5">
        {weeks.flatMap((week, wi) =>
          week.map((day, di) => {
            if (day === null)
              return <span key={`${wi}-${di}`} aria-hidden="true" />;
            const meta = dayMap.get(day);
            const cellClasses = cn(
              'flex size-9 items-center justify-center justify-self-center rounded-full text-[13px] lg:size-8',
              meta?.isNext && 'bg-gold font-bold text-on-gold',
              meta && !meta.isNext && 'bg-ink font-bold text-paper',
            );
            if (meta?.slug) {
              return (
                <Link
                  key={`${wi}-${di}`}
                  href={`/agenda/${meta.slug}`}
                  className={cellClasses}
                >
                  {day}
                </Link>
              );
            }
            return (
              <span key={`${wi}-${di}`} className={cellClasses}>
                {day}
              </span>
            );
          }),
        )}
      </div>
      {days.length > 0 ? (
        <ul className="text-meta mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="bg-gold size-2.5 rounded-full"
            />
            Agenda terdekat
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="bg-ink size-2.5 rounded-full" />
            Agenda lain
          </li>
        </ul>
      ) : null}
    </div>
  );
}
