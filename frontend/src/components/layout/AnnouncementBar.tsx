import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import type { SitePayload } from '@/lib/api/types';

type AnnouncementItem = SitePayload['announcements'][number];

export function AnnouncementBar({ items }: { items: AnnouncementItem[] }) {
  if (!items.length) return null;

  return (
    <div className="bg-ink-surface text-on-ink dark:border-line text-[12.5px] leading-[1.3] font-medium tracking-[0.02em] dark:border-b">
      <Container className="no-scrollbar flex flex-nowrap items-center justify-start gap-x-2.5 gap-y-1.5 overflow-x-auto text-center whitespace-nowrap sm:flex-wrap sm:justify-center sm:whitespace-normal">
        {items.map((item, index) => (
          <span key={item.id} className="flex shrink-0 items-center gap-2.5">
            {index > 0 ? (
              <span aria-hidden="true" className="text-gold">
                •
              </span>
            ) : null}
            {item.link_url ? (
              <Link
                href={item.link_url}
                className="inline-flex min-h-10 items-center hover:underline"
              >
                {item.body}
              </Link>
            ) : (
              <span className="inline-flex min-h-8 items-center">
                {item.body}
              </span>
            )}
          </span>
        ))}
      </Container>
    </div>
  );
}
