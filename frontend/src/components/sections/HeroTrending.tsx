import Link from 'next/link';

import { ArticleCard } from '@/components/cards/ArticleCard';
import { WidgetHeading } from '@/components/ui/WidgetHeading';
import type {
  HeroTrendingConfig,
  HeroTrendingData,
} from '@/lib/sections/types';
import type { SectionProps } from '@/lib/sections/types';

import { SectionShell } from './SectionShell';

/**
 * Opening hero: a single featured/latest/manual article as the page's `h1`,
 * paired with a numbered "trending" list. Registry `isEmpty` guarantees
 * `data.hero` is set by the time this renders.
 */
export function HeroTrendingSection({
  config,
  data,
  padTop,
  isFirst,
}: SectionProps<HeroTrendingConfig, HeroTrendingData>) {
  const hero = data.hero;
  if (!hero) return null;

  return (
    <SectionShell
      background={config.background ?? 'paper'}
      padTop={padTop}
      isFirst={isFirst}
      ariaLabel={config.eyebrow || config.title || 'Sorotan utama'}
    >
      <div className="grid items-start gap-10 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_340px] lg:gap-14 xl:grid-cols-[1fr_380px]">
        <ArticleCard article={hero} variant="hero" preload />

        {data.trending.length > 0 ? (
          <aside aria-label={config.trending_title || 'Trending'}>
            <WidgetHeading as="h2">{config.trending_title}</WidgetHeading>
            <div className="flex flex-col gap-4 lg:gap-5">
              {data.trending
                .slice(0, config.trending_limit)
                .map((article, i) =>
                  config.show_thumbnails ? (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      variant="trending"
                      index={i + 1}
                    />
                  ) : (
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
                  ),
                )}
            </div>
          </aside>
        ) : null}
      </div>
    </SectionShell>
  );
}
