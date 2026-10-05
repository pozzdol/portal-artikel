import Link from 'next/link';

import { WidgetHeading } from '@/components/ui/WidgetHeading';
import type { ArticleCard } from '@/lib/api/types';

/** Sidebar widget: numbered list of the most-read articles. */
export function PopularWidget({ items }: { items: ArticleCard[] }) {
  return (
    <div>
      <WidgetHeading>Artikel Populer</WidgetHeading>
      <div className="flex flex-col gap-4">
        {items.map((article, i) => (
          <Link
            key={article.id}
            href={article.url}
            className="flex min-h-11 items-start gap-3.5 hover:underline"
          >
            <span className="text-gold-strong min-w-[26px] font-serif text-[26px] leading-none font-semibold">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="text-ink text-[14px] leading-[1.4] font-medium">
              {article.title}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
