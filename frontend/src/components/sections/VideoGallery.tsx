import { VideoCard } from '@/components/cards/VideoCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type {
  SectionProps,
  VideoGalleryConfig,
  VideoGalleryData,
} from '@/lib/sections/types';

import { SectionShell } from './SectionShell';

/** "Video": either a featured 3-column layout (first item large) or an even grid. */
export function VideoGallerySection({
  id,
  config,
  data,
  padTop,
  isFirst,
}: SectionProps<VideoGalleryConfig, VideoGalleryData>) {
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
        title={config.title ?? 'Video'}
        eyebrow={config.eyebrow}
        moreLink={config.more_link}
      />
      {config.layout === 'feature' ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr] lg:gap-7 sm:[&>*:first-child]:col-span-2 lg:[&>*:first-child]:col-span-1">
          {data.items.map((video, i) => (
            <VideoCard
              key={video.id}
              video={video}
              size={i === 0 ? 'lg' : 'sm'}
              headingLevel="h3"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
          {data.items.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              size="sm"
              headingLevel="h3"
            />
          ))}
        </div>
      )}
    </SectionShell>
  );
}
