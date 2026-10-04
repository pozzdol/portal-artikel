import Link from 'next/link';
import type { ReactNode } from 'react';

import type { AuthorRef } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import {
  dateTimeAttr,
  formatDateLong,
  readingLabel,
  readingShort,
} from '@/lib/format';

type ArticleMetaVariant =
  'hero' | 'card' | 'compact' | 'date-minutes' | 'author-title';

type ArticleMetaProps = {
  author?: AuthorRef;
  publishedAt?: string | null;
  readingMinutes?: number;
  variant: ArticleMetaVariant;
  linkAuthor?: boolean;
  className?: string;
};

function AuthorName({
  author,
  linkAuthor,
  className,
}: {
  author: AuthorRef;
  linkAuthor?: boolean;
  className?: string;
}): ReactNode {
  if (linkAuthor) {
    return (
      <Link
        href={`/penulis/${author.slug}`}
        className={cn('hover:underline', className)}
      >
        {author.display_name}
      </Link>
    );
  }
  return <span className={className}>{author.display_name}</span>;
}

/**
 * Article byline/meta row. Five variants match the design's different contexts:
 * hero (article title meta), card (grid cards), compact (thumb/list rows),
 * date-minutes (grid-compact cards, no author), author-title (opinion bylines).
 */
export function ArticleMeta({
  author,
  publishedAt,
  readingMinutes,
  variant,
  linkAuthor,
  className,
}: ArticleMetaProps) {
  if (variant === 'hero') {
    return (
      <div
        className={cn(
          'text-meta flex flex-wrap items-center gap-4 text-[13.5px] font-medium',
          className,
        )}
      >
        {author ? (
          <AuthorName
            author={author}
            linkAuthor={linkAuthor}
            className="text-ink font-semibold"
          />
        ) : null}
        {author && publishedAt ? <span aria-hidden="true">•</span> : null}
        {publishedAt ? (
          <time dateTime={dateTimeAttr(publishedAt)}>
            {formatDateLong(publishedAt)}
          </time>
        ) : null}
        {publishedAt && readingMinutes ? (
          <span aria-hidden="true">•</span>
        ) : null}
        {readingMinutes ? <span>{readingLabel(readingMinutes)}</span> : null}
      </div>
    );
  }

  if (variant === 'author-title') {
    return (
      <div className={cn('text-faint text-[12.5px] font-medium', className)}>
        {author ? <AuthorName author={author} linkAuthor={linkAuthor} /> : null}
        {author?.title ? <span> · {author.title}</span> : null}
      </div>
    );
  }

  if (variant === 'date-minutes') {
    const reading = readingMinutes ? readingShort(readingMinutes) : null;
    return (
      <div className={cn('text-faint text-[11.5px] font-medium', className)}>
        {publishedAt ? (
          <time dateTime={dateTimeAttr(publishedAt)}>
            {formatDateLong(publishedAt)}
          </time>
        ) : null}
        {publishedAt && reading ? ' · ' : null}
        {reading}
      </div>
    );
  }

  const reading = readingMinutes
    ? variant === 'compact'
      ? readingShort(readingMinutes)
      : readingLabel(readingMinutes)
    : null;
  return (
    <div
      className={cn(
        'text-faint font-medium',
        variant === 'compact' ? 'text-[12px]' : 'text-[12.5px]',
        className,
      )}
    >
      {author ? <AuthorName author={author} linkAuthor={linkAuthor} /> : null}
      {author && reading ? ' · ' : null}
      {reading}
    </div>
  );
}
