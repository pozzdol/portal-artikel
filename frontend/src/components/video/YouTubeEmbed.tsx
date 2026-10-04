'use client';

import { useState } from 'react';

import { ImageBox } from '@/components/ui/ImageBox';
import { PlayBadge } from '@/components/ui/PlayBadge';

type YouTubeEmbedProps = {
  /** youtube-nocookie.com embed URL from the API (`VideoDetail.embed_url`). */
  embedUrl: string;
  thumbnailUrl: string;
  title: string;
};

/**
 * Lite YouTube embed: renders only a thumbnail + play badge until clicked, so
 * the youtube-nocookie.com iframe (and its scripts/cookies) never loads until
 * the visitor asks for it.
 */
export function YouTubeEmbed({
  embedUrl,
  thumbnailUrl,
  title,
}: YouTubeEmbedProps) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="border-line bg-ink-surface relative aspect-[16/9] overflow-hidden border">
        <iframe
          src={`${embedUrl}?autoplay=1`}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  const thumbnail = {
    id: 0,
    url: thumbnailUrl,
    width: null,
    height: null,
    alt: null,
    caption: null,
  };

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Putar video: ${title}`}
      className="group relative block w-full"
    >
      <ImageBox
        media={thumbnail}
        ratio="16/9"
        sizes="(min-width: 1024px) 60vw, 100vw"
        alt={title}
        preload
      />
      <PlayBadge size="lg" />
    </button>
  );
}
