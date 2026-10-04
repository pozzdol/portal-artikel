import Link from 'next/link';

import { WidgetHeading } from '@/components/ui/WidgetHeading';
import type { ArticleCard } from '@/lib/api/types';

/** Sidebar widget: numbered list of the most-read articles. */
export function PopularWidget({ items }: { items: ArticleCard[] }) {
  return (
    <div>
      <WidgetHeading>Artikel Populer</WidgetHeading>
      <div className="flex flex-col gap-3">
        {items.map((article, i) => (
          <Link
            key={article.id}
            href={article.url}
            className="text-ink text-[14px] leading-[1.4] font-medium hover:underline"
          >
            {i + 1}. {article.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
