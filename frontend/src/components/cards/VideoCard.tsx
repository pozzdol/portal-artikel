import Link from 'next/link';
import type { ElementType } from 'react';

import type { VideoCard as VideoCardData } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { formatCompactNumber, formatDateLong } from '@/lib/format';
import { ImageBox } from '@/components/ui/ImageBox';
import { DurationBadge, PlayBadge } from '@/components/ui/PlayBadge';

type VideoCardProps = {
  video: VideoCardData;
  size: 'lg' | 'sm';
  headingLevel?: 'h2' | 'h3';
  /** True for the single above-the-fold thumbnail (first card of `/video`):
   *  preloads it and marks it `fetchPriority="high"` for LCP. */
  preload?: boolean;
};

/** Video teaser card: 16:9 thumbnail with play/duration badges, title, view count. */
export function VideoCard({
  video,
  size,
  headingLevel = 'h3',
  preload,
}: VideoCardProps) {
  const HeadingTag = headingLevel as ElementType;
  const thumbnail = {
    id: 0,
    url: video.thumbnail_url,
    width: null,
    height: null,
    alt: null,
    caption: null,
  };

  return (
    <div>
      <Link href={video.url} className="group relative block">
        <ImageBox
          media={thumbnail}
          ratio="16/9"
          sizes={
            size === 'lg'
              ? '(min-width: 1024px) 45vw, 100vw'
              : '(min-width: 1024px) 22vw, 50vw'
          }
          alt={video.title}
          preload={preload}
        />
        <PlayBadge size={size} />
        <DurationBadge seconds={video.duration_seconds} size={size} />
      </Link>
      <HeadingTag
        className={cn(
          'text-ink mb-1.5 font-serif leading-[1.3] font-semibold',
          size === 'lg'
            ? 'mt-3.5 text-[18px] sm:text-[20px]'
            : 'mt-3 text-[16px]',
        )}
      >
        <Link href={video.url} className="hover:underline">
          {video.title}
        </Link>
      </HeadingTag>
      <div className={cn('text-faint font-medium', 'text-[12.5px]')}>
        {video.view_count !== null
          ? `${formatCompactNumber(video.view_count)} ditonton`
          : null}
        {video.view_count !== null && size === 'lg'
          ? ` · ${formatDateLong(video.published_at)}`
          : null}
      </div>
    </div>
  );
}
