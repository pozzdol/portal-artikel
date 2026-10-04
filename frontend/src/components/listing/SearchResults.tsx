import type { SearchHit } from '@/lib/api/types';
import { ArticleCard } from '@/components/cards/ArticleCard';

type SearchResultsProps = {
  items: SearchHit[];
};

/** Search hit list: `ArticleCard variant="search"` with the highlighted title/snippet. */
export function SearchResults({ items }: SearchResultsProps) {
  return (
    <ul className="flex flex-col gap-10">
      {items.map((item) => (
        <li
          key={item.id}
          className="border-line border-b pb-10 last:border-b-0"
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
