import type { VideoCard as VideoCardData } from '@/lib/api/types';
import { VideoCard } from '@/components/cards/VideoCard';

type VideoGridProps = {
  videos: VideoCardData[];
  emptyMessage?: string;
  /** 'h2' when rendered directly under the page h1 (the `/video` listing);
   *  omit when a section h2 already precedes it (the detail page's "Video
   *  lainnya" block). */
  headingLevel?: 'h2' | 'h3';
  /** True to preload the first card's thumbnail (the `/video` listing's LCP
   *  element on page 1 only — never set on paginated or nested usages). */
  preloadFirst?: boolean;
};

/** 3-column video grid used by `/video` and the "Video lainnya" block of the detail page. */
export function VideoGrid({
  videos,
  emptyMessage = 'Belum ada video.',
  headingLevel,
  preloadFirst,
}: VideoGridProps) {
  if (videos.length === 0) {
    return <p className="text-faint py-10 text-[14px]">{emptyMessage}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-10 lg:grid-cols-3">
      {videos.map((video, i) => (
        <VideoCard
          key={video.id}
          video={video}
          size="sm"
          headingLevel={headingLevel}
          preload={preloadFirst && i === 0}
        />
      ))}
    </div>
  );
}
