import type { ReactNode } from 'react';

import { ArticleCard } from '@/components/cards/ArticleCard';
import type {
  LatestWithSidebarConfig,
  LatestWithSidebarData,
  SectionProps,
  SidebarWidget,
} from '@/lib/sections/types';

import { CategoriesWidget } from './CategoriesWidget';
import { NextEventWidget } from './NextEventWidget';
import { PopularWidget } from './PopularWidget';
import { SectionShell } from './SectionShell';
import { TagsWidget } from './TagsWidget';

function renderWidget(
  key: SidebarWidget,
  widgets: LatestWithSidebarData['widgets'],
): ReactNode {
  switch (key) {
    case 'popular':
      return widgets.popular && widgets.popular.length > 0 ? (
        <PopularWidget key={key} items={widgets.popular} />
      ) : null;
    case 'categories':
      return widgets.categories && widgets.categories.length > 0 ? (
        <CategoriesWidget key={key} items={widgets.categories} />
      ) : null;
    case 'tags':
      return widgets.tags && widgets.tags.length > 0 ? (
        <TagsWidget key={key} items={widgets.tags} />
      ) : null;
    case 'next_event':
      return widgets.next_event ? (
        <NextEventWidget key={key} event={widgets.next_event} />
      ) : null;
    default:
      return null;
  }
}

/** Latest-articles list paired with a sidebar of configurable widgets. */
export function LatestWithSidebarSection({
  id,
  config,
  data,
  padTop,
  isFirst,
}: SectionProps<LatestWithSidebarConfig, LatestWithSidebarData>) {
  const headingId = `latest-sidebar-heading-${id}`;

  return (
    <SectionShell
      anchorId={config.anchor_id}
      background={config.background ?? 'paper'}
      padTop={padTop}
      isFirst={isFirst}
      ariaLabelledBy={headingId}
    >
      <div className="grid items-start gap-10 lg:grid-cols-[1fr_340px] lg:gap-14">
        <div>
          <h2
            id={headingId}
            className="border-line text-ink mb-7 border-b pb-4 font-serif text-[28px] font-semibold"
          >
            {config.list_title}
          </h2>
          <div className="flex flex-col">
            {data.items.slice(0, config.limit).map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                variant="list-row"
              />
            ))}
          </div>
        </div>
        <aside className="flex flex-col gap-9 self-start lg:sticky lg:top-28">
          {config.widgets.map((key) => renderWidget(key, data.widgets))}
        </aside>
      </div>
    </SectionShell>
  );
}
