import { ArticleCard } from '@/components/cards/ArticleCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { cn } from '@/lib/cn';
import type {
  ArticleGridConfig,
  ArticleListData,
  SectionProps,
} from '@/lib/sections/types';

import { SectionShell } from './SectionShell';

const COLS_CLASS: Record<ArticleGridConfig['columns'], string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

const GAP_CLASS: Record<ArticleGridConfig['columns'], string> = {
  2: 'gap-6 sm:gap-8 lg:gap-10',
  3: 'gap-6 sm:gap-8 lg:gap-10',
  4: 'gap-6 sm:gap-8',
};

/** A titled grid of article cards ("Kajian Terbaru", "Berita Alumni", ...). */
export function ArticleGridSection({
  id,
  config,
  data,
  padTop,
  isFirst,
}: SectionProps<ArticleGridConfig, ArticleListData>) {
  const headingId = `article-grid-heading-${id}`;
  const variant = config.show_excerpt ? 'grid' : 'grid-compact';

  return (
    <SectionShell
      anchorId={config.anchor_id}
      background={config.background ?? 'paper'}
      padTop={padTop}
      isFirst={isFirst}
      ariaLabelledBy={config.title ? headingId : undefined}
    >
      {config.title ? (
        <SectionHeading
          id={headingId}
          title={config.title}
          eyebrow={config.eyebrow}
          moreLink={config.more_link}
          size="lg"
        />
      ) : null}
      <div
        className={cn(
          'grid grid-cols-1 sm:grid-cols-2',
          COLS_CLASS[config.columns],
          GAP_CLASS[config.columns],
        )}
      >
        {data.items.slice(0, config.limit).map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            variant={variant}
            showExcerpt={config.show_excerpt}
            showAuthor={config.show_author}
            showReadingTime={config.show_reading_time}
            imageRatio={config.image_ratio}
          />
        ))}
      </div>
    </SectionShell>
  );
}
