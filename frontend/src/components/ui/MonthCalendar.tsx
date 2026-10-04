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

const WEEKDAY_LABELS = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];

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
    <div className={cn('border-line bg-muted border p-6', className)}>
      <div className="mb-4 flex items-center justify-between">
        {nav ? (
          <Link
            href={nav.prevHref}
            aria-label="Bulan sebelumnya"
            className="text-faint hover:text-ink px-1 text-[13px]"
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
            className="text-faint hover:text-ink px-1 text-[13px]"
          >
            ›
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      <div className="text-faint mb-2 grid grid-cols-7 gap-x-1.5 gap-y-1.5 text-center text-[11px] font-medium">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={`${label}-${i}`}>{label}</span>
        ))}
      </div>
      <div className="text-body grid grid-cols-7 gap-x-1.5 gap-y-1.5 text-center text-[12.5px]">
        {weeks.flatMap((week, wi) =>
          week.map((day, di) => {
            if (day === null)
              return <span key={`${wi}-${di}`} aria-hidden="true" />;
            const meta = dayMap.get(day);
            const cellClasses = cn(
              'flex h-[21px] w-[21px] items-center justify-center justify-self-center rounded-full',
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
    </div>
  );
}
