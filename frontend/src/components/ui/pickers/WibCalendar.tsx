'use client';

import * as React from 'react';
import { getDefaultClassNames } from 'react-day-picker';
import { id } from 'react-day-picker/locale';

import { Calendar } from '@/components/ui/shadcn/calendar';
import { cn } from '@/lib/cn';
import { WIB, formatWib } from '@/lib/datetime';

type CalendarProps = React.ComponentProps<typeof Calendar>;

const defaults = getDefaultClassNames();

/**
 * The shadcn Calendar pinned to ALMAIDAH conventions: Asia/Jakarta time zone,
 * Indonesian locale, weeks starting on Sunday, ink selected day and a short
 * gold rule under "today".
 */
export function WibCalendar({
  className,
  classNames,
  formatters,
  ...props
}: CalendarProps) {
  return (
    <Calendar
      timeZone={WIB}
      locale={id}
      weekStartsOn={0}
      className={cn('p-2 [--cell-size:--spacing(8.5)]', className)}
      formatters={{
        formatMonthDropdown: (date) => formatWib(date, 'LLL'),
        formatYearDropdown: (date) => formatWib(date, 'yyyy'),
        ...formatters,
      }}
      classNames={{
        caption_label: cn(
          'flex items-center gap-1 font-serif text-base font-semibold select-none [&>svg]:size-3.5 [&>svg]:text-muted-foreground',
          defaults.caption_label,
        ),
        weekday: cn(
          'flex-1 text-[0.72rem] font-medium text-muted-foreground select-none',
          defaults.weekday,
        ),
        dropdown_root: cn(
          'relative border border-transparent hover:border-line has-focus-visible:border-gold',
          defaults.dropdown_root,
        ),
        today: cn(
          'text-foreground [&>button]:font-semibold [&>button]:after:pointer-events-none [&>button]:after:absolute [&>button]:after:bottom-1 [&>button]:after:left-1/2 [&>button]:after:h-0.5 [&>button]:after:w-3 [&>button]:after:-translate-x-1/2 [&>button]:after:bg-gold',
          defaults.today,
        ),
        ...classNames,
      }}
      {...props}
    />
  );
}
