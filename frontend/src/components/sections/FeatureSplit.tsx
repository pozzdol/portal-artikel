import Link from 'next/link';

import { ArticleCard } from '@/components/cards/ArticleCard';
import { ArticleMeta } from '@/components/ui/ArticleMeta';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ImageBox } from '@/components/ui/ImageBox';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type {
  FeatureSplitConfig,
  FeatureSplitData,
  SectionProps,
} from '@/lib/sections/types';

import { SectionShell } from './SectionShell';

/**
 * "Opini": one large featured piece (custom eyebrow from `featured_label`,
 * not the article's category) beside a stack of `ArticleCard` variant="thumb-row".
 */
export function FeatureSplitSection({
  id,
  config,
  data,
  padTop,
  isFirst,
}: SectionProps<FeatureSplitConfig, FeatureSplitData>) {
  if (!data.featured) return null;

  const headingId = config.anchor_id
    ? `${config.anchor_id}-h2`
    : `section-${id}-h2`;
  const featured = data.featured;

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
        title={config.title ?? 'Opini'}
        eyebrow={config.eyebrow}
        moreLink={config.more_link}
      />
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
        <article>
          <Link href={featured.url} tabIndex={-1} aria-hidden="true">
            <ImageBox
              media={featured.cover}
              ratio="16/9"
              sizes="(min-width: 1024px) 58vw, 100vw"
              alt={featured.title}
              className="mb-[22px]"
            />
          </Link>
          <Eyebrow size="sm" className="mb-2.5">
            {config.featured_label}
          </Eyebrow>
          <h3 className="text-ink mb-3.5 font-serif text-[30px] leading-[1.25] font-semibold">
            <Link href={featured.url} className="hover:underline">
              {featured.title}
            </Link>
          </h3>
          {featured.excerpt ? (
            <p className="text-soft mb-3.5 text-[15px] leading-[1.7]">
              {featured.excerpt}
            </p>
          ) : null}
          {config.show_author_title ? (
            <ArticleMeta author={featured.author} variant="author-title" />
          ) : null}
        </article>
        <ul className="flex flex-col gap-[26px]">
          {data.items.map((item, i) => (
            <li
              key={item.id}
              className={
                i < data.items.length - 1
                  ? 'border-line border-b pb-[26px]'
                  : undefined
              }
            >
              <ArticleCard
                article={item}
                variant="thumb-row"
                headingLevel="h3"
              />
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
