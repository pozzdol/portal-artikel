import type { SearchHit } from '@/lib/api/types';
import { ArticleCard } from '@/components/cards/ArticleCard';

type SearchResultsProps = {
  items: SearchHit[];
};

/** Search hit list: `ArticleCard variant="search"` with the highlighted title/snippet. */
export function SearchResults({ items }: SearchResultsProps) {
  return (
    <ul className="flex max-w-[820px] flex-col gap-8 sm:gap-10">
      {items.map((item) => (
        <li
          key={item.id}
          className="border-line border-b pb-8 last:border-b-0 sm:pb-10"
        >
          <ArticleCard
            article={item}
            variant="search"
            highlightHtml={item.highlight}
            headingLevel="h2"
          />
        </li>
      ))}
    </ul>
  );
}
