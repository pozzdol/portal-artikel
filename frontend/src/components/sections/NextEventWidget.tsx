import Link from 'next/link';

import { WidgetHeading } from '@/components/ui/WidgetHeading';
import type { EventCard } from '@/lib/api/types';
import { formatDateWeekday } from '@/lib/format';

/** Sidebar widget: muted box promoting the next upcoming event. */
export function NextEventWidget({ event }: { event: EventCard }) {
  return (
    <div className="border-line bg-muted border p-5">
      <WidgetHeading boxed>Agenda Terdekat</WidgetHeading>
      <Link href={event.url} className="block">
        <div className="text-ink mb-1 font-serif text-[15px] font-semibold">
          {event.title}
        </div>
        <div className="text-meta text-[12.5px] font-medium">
          {formatDateWeekday(event.starts_at)} · {event.location_name}
        </div>
      </Link>
    </div>
  );
}
