import type { ArticleDetail } from '@/lib/api/types';
import { formatDateLong } from '@/lib/format';
import { WidgetHeading } from '@/components/ui/WidgetHeading';

/**
 * Small info box shown on activity/Yayasan articles that carry an event date
 * ("Tanggal kegiatan · Lokasi", doc 06 §5 item 6). Renders nothing otherwise.
 */
export function EventInfoBox({ article }: { article: ArticleDetail }) {
  if (!article.event_date) return null;

  return (
    <div className="border-line bg-muted mb-10 border p-5">
      <WidgetHeading as="h2" boxed>
        Info Kegiatan
      </WidgetHeading>
      <div className="text-ink text-[15px] font-medium">
        {formatDateLong(article.event_date)}
        {article.event_location ? ` · ${article.event_location}` : null}
      </div>
    </div>
  );
}
