import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import type { SitePayload } from '@/lib/api/types';

type AnnouncementItem = SitePayload['announcements'][number];

export function AnnouncementBar({ items }: { items: AnnouncementItem[] }) {
  if (!items.length) return null;

  return (
    <div className="bg-ink-surface text-on-ink dark:border-line py-[9px] text-[12.5px] leading-none font-medium tracking-[0.02em] dark:border-b">
      <Container className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-center">
        {items.map((item, index) => (
          <span key={item.id} className="flex items-center gap-2.5">
            {index > 0 ? (
              <span aria-hidden="true" className="text-gold">
                •
              </span>
            ) : null}
            {item.link_url ? (
              <Link href={item.link_url} className="hover:underline">
                {item.body}
              </Link>
            ) : (
              <span>{item.body}</span>
            )}
          </span>
        ))}
      </Container>
    </div>
  );
}
