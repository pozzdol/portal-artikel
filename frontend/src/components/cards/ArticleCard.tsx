import Link from 'next/link';
import type { ElementType } from 'react';

import type { ArticleCard as ArticleCardData } from '@/lib/api/types';
import { formatDateLong, formatDateShort } from '@/lib/format';
import { ArticleMeta } from '@/components/ui/ArticleMeta';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { FixedImage, ImageBox } from '@/components/ui/ImageBox';

export type ArticleCardVariant =
  | 'hero'
  | 'grid'
  | 'grid-compact'
  | 'list-row'
  | 'thumb-row'
  | 'trending'
  | 'timeline'
  | 'listing-hero'
  | 'search';

type ArticleCardProps = {
  article: ArticleCardData;
  variant: ArticleCardVariant;
  index?: number;
  showExcerpt?: boolean;
  showAuthor?: boolean;
  showReadingTime?: boolean;
  imageRatio?: '4/3' | '16/9' | '1/1';
  categoryLabel?: 'leaf' | 'parent';
  headingLevel?: 'h2' | 'h3';
  preload?: boolean;
  /** Sanitized `<mark>`-only HTML fragment from search highlighting (variant="search" only). */
  highlightHtml?: string;
};

const GRID_SIZES = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw';

function categoryText(
  article: ArticleCardData,
  categoryLabel: 'leaf' | 'parent',
) {
  if (categoryLabel === 'parent' && article.category.parent) {
    return article.category.parent.name;
  }
  return article.category.name;
}

/**
 * Article teaser card. `variant` selects one of the design's nine card
 * treatments; measurements are taken directly from the home page reference.
 */
export function ArticleCard({
  article,
  variant,
  index,
  showExcerpt,
  showAuthor,
  showReadingTime,
  imageRatio,
  categoryLabel,
  headingLevel,
  preload,
  highlightHtml,
}: ArticleCardProps) {
  // The hero shows the level-1 parent category (falls back to the leaf when
  // there is no parent, in `categoryText`); every other variant shows the
  // leaf category, unless the caller asks for something else explicitly.
  const effectiveCategoryLabel =
    categoryLabel ?? (variant === 'hero' ? 'parent' : 'leaf');
  const category = categoryText(article, effectiveCategoryLabel);
  const excerptOn = showExcerpt ?? true;
  const authorOn = showAuthor ?? true;
  const readingOn = showReadingTime ?? true;

  if (variant === 'hero') {
    return (
      <article>
        <Link href={article.url} tabIndex={-1} aria-hidden="true">
          <ImageBox
            media={article.cover}
            ratio="16/9"
            sizes="(min-width: 1024px) 66vw, 100vw"
            alt={article.title}
            className="mb-6"
            preload={preload ?? true}
            fallbackLabel={`Foto utama — ${article.title}`}
          />
        </Link>
        <Eyebrow size="md" className="mb-3.5">
          {category}
        </Eyebrow>
        <h1 className="text-ink mb-5 font-serif text-[36px] leading-[1.12] font-semibold tracking-[-0.01em] text-balance lg:text-[52px]">
          <Link href={article.url} className="hover:underline">
            {article.title}
          </Link>
        </h1>
        {article.excerpt ? (
          <p className="text-body mb-[26px] max-w-[640px] text-[17px] leading-[1.7]">
            {article.excerpt}
          </p>
        ) : null}
        <ArticleMeta
          author={article.author}
          publishedAt={article.published_at}
          readingMinutes={article.reading_minutes}
          variant="hero"
        />
      </article>
    );
  }

  if (variant === 'grid') {
    const HeadingTag = (headingLevel ?? 'h3') as ElementType;
    return (
      <Link href={article.url} className="group block">
        <ImageBox
          media={article.cover}
          ratio={imageRatio ?? '4/3'}
          sizes={GRID_SIZES}
          alt={article.title}
          className="mb-[18px]"
          preload={preload}
        />
        <Eyebrow size="sm" className="mb-2">
          {category}
        </Eyebrow>
        <HeadingTag className="text-ink mb-2.5 font-serif text-[22px] leading-[1.3] font-semibold group-hover:underline">
          {article.title}
        </HeadingTag>
        {excerptOn && article.excerpt ? (
          <p className="text-soft mb-3.5 text-[14px] leading-[1.6]">
            {article.excerpt}
          </p>
        ) : null}
        <ArticleMeta
          author={authorOn ? article.author : undefined}
          readingMinutes={readingOn ? article.reading_minutes : undefined}
          variant="card"
        />
      </Link>
    );
  }

  if (variant === 'grid-compact') {
    const HeadingTag = (headingLevel ?? 'h3') as ElementType;
    return (
      <Link href={article.url} className="group block">
        <ImageBox
          media={article.cover}
          ratio={imageRatio ?? '4/3'}
          sizes={GRID_SIZES}
          alt={article.title}
          className="mb-4"
          imgClassName="transition-transform duration-200 group-hover:scale-[1.03]"
          preload={preload}
        />
        <Eyebrow size="xs" className="mb-2">
          {category}
        </Eyebrow>
        <HeadingTag className="text-ink mb-2 font-serif text-[18px] leading-[1.35] font-semibold group-hover:underline">
          {article.title}
        </HeadingTag>
        <ArticleMeta
          publishedAt={article.published_at}
          readingMinutes={readingOn ? article.reading_minutes : undefined}
          variant="date-minutes"
        />
      </Link>
    );
  }

  if (variant === 'list-row') {
    const HeadingTag = (headingLevel ?? 'h3') as ElementType;
    return (
      <Link
        href={article.url}
        className="border-line flex items-start justify-between gap-6 border-b py-[18px]"
      >
        <div>
          <Eyebrow size="xs">{category}</Eyebrow>
          <HeadingTag className="text-ink mt-1.5 font-serif text-[19px] font-semibold">
            {article.title}
          </HeadingTag>
        </div>
        {article.published_at ? (
          <span className="text-faint pt-1 text-[12.5px] font-medium whitespace-nowrap">
            {formatDateShort(article.published_at)}
          </span>
        ) : null}
      </Link>
    );
  }

  if (variant === 'thumb-row') {
    const HeadingTag = (headingLevel ?? 'h3') as ElementType;
    return (
      <Link href={article.url} className="group flex gap-4">
        <FixedImage media={article.cover} size={96} alt={article.title} />
        <div className="min-w-0">
          <HeadingTag className="text-ink mb-1.5 font-serif text-[18px] leading-[1.3] font-semibold group-hover:underline">
            {article.title}
          </HeadingTag>
          <ArticleMeta
            author={authorOn ? article.author : undefined}
            readingMinutes={readingOn ? article.reading_minutes : undefined}
            variant="compact"
          />
        </div>
      </Link>
    );
  }

  if (variant === 'trending') {
    return (
      <Link href={article.url} className="flex items-start gap-3.5">
        <span className="text-gold-strong min-w-[26px] font-serif text-[26px] leading-none font-semibold">
          {String(index ?? 1).padStart(2, '0')}
        </span>
        <div className="flex items-start gap-3">
          <FixedImage media={article.cover} size={64} alt={article.title} />
          <p className="text-ink text-[14px] leading-[1.4] font-medium">
            {article.title}
          </p>
        </div>
      </Link>
    );
  }

  if (variant === 'timeline') {
    const HeadingTag = (headingLevel ?? 'h3') as ElementType;
    return (
      <Link
        href={article.url}
        className="grid grid-cols-[160px_1fr] items-center gap-7"
      >
        <ImageBox
          media={article.cover}
          ratio="4/3"
          sizes="160px"
          alt={article.title}
        />
        <div>
          <div className="text-faint mb-1.5 text-[12.5px] font-medium">
            {article.event_date ? formatDateLong(article.event_date) : null}
            {article.event_date && article.event_location ? ' · ' : null}
            {article.event_location}
          </div>
          <HeadingTag className="text-ink mb-2 font-serif text-[22px] font-semibold">
            {article.title}
          </HeadingTag>
          {excerptOn && article.excerpt ? (
            <p className="text-soft text-[14px] leading-[1.6]">
              {article.excerpt}
            </p>
          ) : null}
        </div>
      </Link>
    );
  }

  if (variant === 'listing-hero') {
    const HeadingTag = (headingLevel ?? 'h2') as ElementType;
    return (
      <Link href={article.url} className="group block">
        <ImageBox
          media={article.cover}
          ratio="16/9"
          sizes="(min-width: 1024px) 66vw, 100vw"
          alt={article.title}
          className="mb-[22px]"
          preload={preload}
        />
        <Eyebrow size="sm" className="mb-2.5">
          {category}
        </Eyebrow>
        <HeadingTag className="text-ink mb-3.5 font-serif text-[30px] leading-[1.25] font-semibold group-hover:underline">
          {article.title}
        </HeadingTag>
        {article.excerpt ? (
          <p className="text-soft mb-3.5 text-[15px] leading-[1.7]">
            {article.excerpt}
          </p>
        ) : null}
        <ArticleMeta author={article.author} variant="author-title" />
      </Link>
    );
  }

  // variant === 'search'
  const HeadingTag = (headingLevel ?? 'h3') as ElementType;
  return (
    <Link href={article.url} className="group block">
      <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
        <ImageBox
          media={article.cover}
          ratio="4/3"
          sizes="220px"
          alt={article.title}
        />
        <div>
          <Eyebrow size="sm" className="mb-2">
            {category}
          </Eyebrow>
          <HeadingTag className="text-ink mb-2 font-serif text-[22px] leading-[1.3] font-semibold group-hover:underline">
            {article.title}
          </HeadingTag>
          {highlightHtml ? (
            // Backend snippet: escaped text with only <mark> tags.
            <p
              className="text-soft mb-3 text-[14px] leading-[1.6]"
              dangerouslySetInnerHTML={{ __html: highlightHtml }}
            />
          ) : article.excerpt ? (
            <p className="text-soft mb-3 text-[14px] leading-[1.6]">
              {article.excerpt}
            </p>
          ) : null}
          <ArticleMeta
            author={authorOn ? article.author : undefined}
            publishedAt={article.published_at}
            readingMinutes={readingOn ? article.reading_minutes : undefined}
            variant="card"
          />
        </div>
      </div>
    </Link>
  );
}
