import Image from 'next/image';

import type { ArticleDetail } from '@/lib/api/types';
import { ArticleMeta } from '@/components/ui/ArticleMeta';
import { Eyebrow } from '@/components/ui/Eyebrow';

/** Eyebrow + H1 + excerpt + byline row (doc 06 §5 items 2–3). */
export function ArticleHeader({ article }: { article: ArticleDetail }) {
  return (
    <header className="mb-8">
      <Eyebrow size="md" className="mb-3.5">
        {article.category.name}
      </Eyebrow>
      <h1 className="text-ink mb-5 font-serif text-[30px] leading-[1.15] font-semibold tracking-[-0.01em] text-balance sm:text-[36px] lg:text-[44px] xl:text-[48px]">
        {article.title}
      </h1>
      {article.excerpt ? (
        <p className="text-body mb-[26px] max-w-[640px] text-[16px] leading-[1.7] sm:text-[17px]">
          {article.excerpt}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="border-line bg-muted relative h-8 w-8 flex-none overflow-hidden rounded-full border">
          {article.author.avatar ? (
            <Image
              src={article.author.avatar.url}
              alt={article.author.avatar.alt ?? article.author.display_name}
              fill
              sizes="32px"
              className="object-cover"
            />
          ) : null}
        </div>
        <ArticleMeta
          author={article.author}
          publishedAt={article.published_at}
          readingMinutes={article.reading_minutes}
          variant="hero"
          linkAuthor
        />
      </div>
    </header>
  );
}
