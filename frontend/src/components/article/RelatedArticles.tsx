import type { ArticleCard as ArticleCardData } from '@/lib/api/types';
import { ArticleCard } from '@/components/cards/ArticleCard';
import { WidgetHeading } from '@/components/ui/WidgetHeading';

/** "Artikel terkait" grid of 4 compact cards (doc 06 §5 item 10). Renders nothing when empty. */
export function RelatedArticles({ items }: { items: ArticleCardData[] }) {
  if (!items.length) return null;

  return (
    <section className="mb-12">
      <WidgetHeading as="h2">Artikel Terkait</WidgetHeading>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <ArticleCard key={item.id} article={item} variant="grid-compact" />
        ))}
      </div>
    </section>
  );
}
