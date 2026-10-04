import Link from 'next/link';

import { WidgetHeading } from '@/components/ui/WidgetHeading';
import type { CategoryWidgetItem } from '@/lib/api/types';

/** Sidebar widget: top-level categories with their article counts. */
export function CategoriesWidget({ items }: { items: CategoryWidgetItem[] }) {
  return (
    <div>
      <WidgetHeading>Kategori</WidgetHeading>
      <div className="flex flex-col gap-2.5 text-[14px] font-medium">
        {items.map((category) => (
          <Link
            key={category.slug}
            href={category.url}
            className="text-ink flex items-center justify-between"
          >
            <span>{category.name}</span>
            <span className="text-ghost">{category.article_count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
