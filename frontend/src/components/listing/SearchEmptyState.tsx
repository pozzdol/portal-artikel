import type { ArticleCard as ArticleCardData, TagItem } from '@/lib/api/types';
import { ArticleCard } from '@/components/cards/ArticleCard';
import { TagChip } from '@/components/ui/TagChip';
import { WidgetHeading } from '@/components/ui/WidgetHeading';

type SearchEmptyStateProps = {
  tags: TagItem[];
  articles: ArticleCardData[];
  /** True when a query was typed but had no hits; false for the bare `/cari` page. */
  noResults: boolean;
};

/** Shown on `/cari` with no query, or a query with zero hits: popular tags + latest articles. */
export function SearchEmptyState({
  tags,
  articles,
  noResults,
}: SearchEmptyStateProps) {
  return (
    <div className="flex flex-col gap-14">
      {noResults ? (
        <p className="text-soft text-[15px] leading-[1.7]">
          Tidak ada hasil yang cocok. Coba kata kunci lain, atau lihat topik
          populer dan artikel terbaru di bawah ini.
        </p>
      ) : null}
      {tags.length > 0 ? (
        <section>
          <WidgetHeading as="h2" className="mb-4">
            Tag Populer
          </WidgetHeading>
          <div className="flex flex-wrap gap-2.5">
            {tags.map((tag) => (
              <TagChip key={tag.id} href={`/tag/${tag.slug}`}>
                {tag.name}
              </TagChip>
            ))}
          </div>
        </section>
      ) : null}
      {articles.length > 0 ? (
        <section>
          <WidgetHeading as="h2" className="mb-6">
            Artikel Terbaru
          </WidgetHeading>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3 lg:gap-10">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                variant="grid-compact"
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
