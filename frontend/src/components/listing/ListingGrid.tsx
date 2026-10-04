import type { ArticleCard as ArticleCardData } from '@/lib/api/types';
import { ArticleCard } from '@/components/cards/ArticleCard';

type ListingGridProps = {
  items: ArticleCardData[];
  /** Page 1 renders the first item as a large "listing-hero" card above the 3-column grid. */
  showHeroFirst: boolean;
  emptyLabel?: string;
};

/** Article listing body shared by category/tag/author pages: optional hero + 3-column grid. */
export function ListingGrid({
  items,
  showHeroFirst,
  emptyLabel,
}: ListingGridProps) {
  if (items.length === 0) {
    return (
      <p className="text-faint py-16 text-center text-[14px]">
        {emptyLabel ?? 'Belum ada artikel di sini.'}
      </p>
    );
  }

  const [hero, ...rest] = items;
  const gridItems = showHeroFirst ? rest : items;

  return (
    <div>
      {showHeroFirst && hero ? (
        <div className="border-line mb-16 border-b pb-16">
          <ArticleCard article={hero} variant="listing-hero" preload />
        </div>
      ) : null}
      {gridItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {gridItems.map((item) => (
            <ArticleCard
              key={item.id}
              article={item}
              variant="grid"
              // No hero above (page > 1, or a listing with no items to promote):
              // these cards sit directly under the page h1, so they must be h2
              // to avoid skipping a level (WCAG heading-order).
              headingLevel={showHeroFirst ? undefined : 'h2'}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
