import { ArticleCard } from '@/components/cards/ArticleCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type {
  ArticleListData,
  SectionProps,
  TimelineConfig,
} from '@/lib/sections/types';

import { SectionShell } from './SectionShell';

/**
 * Vertical timeline of foundation activities ("Kegiatan Yayasan"): a gold rail
 * with dot markers, each row reusing `ArticleCard` variant="timeline".
 */
export function TimelineSection({
  id,
  config,
  data,
  padTop,
  isFirst,
}: SectionProps<TimelineConfig, ArticleListData>) {
  if (data.items.length === 0) return null;

  const headingId = config.anchor_id
    ? `${config.anchor_id}-h2`
    : `section-${id}-h2`;

  return (
    <SectionShell
      anchorId={config.anchor_id}
      background={config.background}
      padTop={padTop}
      isFirst={isFirst}
      ariaLabelledBy={headingId}
    >
      <SectionHeading
        id={headingId}
        title={config.title ?? 'Kegiatan Yayasan'}
        eyebrow={config.eyebrow}
        moreLink={config.more_link}
        divider={false}
      />
      <div className="relative pl-8">
        <div
          className="bg-line absolute top-1.5 bottom-1.5 left-[5px] w-px"
          aria-hidden="true"
        />
        <ol className="flex flex-col">
          {data.items.map((article, i) => (
            <li
              key={article.id}
              className={
                i < data.items.length - 1 ? 'relative pb-11' : 'relative'
              }
            >
              <span
                className="bg-gold absolute top-1.5 -left-8 h-[11px] w-[11px] rounded-full"
                aria-hidden="true"
              />
              <ArticleCard
                article={article}
                variant="timeline"
                headingLevel="h3"
              />
            </li>
          ))}
        </ol>
      </div>
    </SectionShell>
  );
}
