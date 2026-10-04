import Image from 'next/image';

import type { Media } from '@/lib/api/types';
import { cn } from '@/lib/cn';

type Ratio = '16/9' | '4/3' | '3/4' | '1/1';

type ImageBoxProps = {
  media: Media | null;
  ratio: Ratio;
  sizes: string;
  alt?: string;
  preload?: boolean;
  className?: string;
  fallbackLabel?: string;
  imgClassName?: string;
};

const RATIO_CLASS: Record<Ratio, string> = {
  '16/9': 'aspect-[16/9]',
  '4/3': 'aspect-[4/3]',
  '3/4': 'aspect-[3/4]',
  '1/1': 'aspect-[1/1]',
};

/**
 * Fixed-ratio image container. Renders `next/image` with `fill` + `object-cover`
 * when media is present, or a quiet placeholder box otherwise.
 */
export function ImageBox({
  media,
  ratio,
  sizes,
  alt,
  preload,
  className,
  fallbackLabel,
  imgClassName,
}: ImageBoxProps) {
  return (
    <div
      className={cn(
        'border-line bg-muted relative overflow-hidden border',
        RATIO_CLASS[ratio],
        className,
      )}
    >
      {media ? (
        <Image
          src={media.url}
          alt={alt ?? media.alt ?? ''}
          fill
          sizes={sizes}
          className={cn('object-cover', imgClassName)}
          preload={preload}
          fetchPriority={preload ? 'high' : undefined}
        />
      ) : fallbackLabel ? (
        <div className="text-ghost flex h-full w-full items-center justify-center px-4 text-center text-[13px]">
          {fallbackLabel}
        </div>
      ) : null}
    </div>
  );
}

type FixedImageSize = 64 | 96 | 38 | 46;

type FixedImageProps = {
  media: Media | null;
  size: FixedImageSize;
  alt?: string;
  className?: string;
  /** Adds a constant-light backing plate in dark mode (site logo on a dark
   * navbar/footer): keeps a dark-glyph logo legible without affecting light
   * mode at all. */
  plate?: boolean;
};

/** Square fixed-size image box for thumbnails, avatars, and the site logo. */
export function FixedImage({
  media,
  size,
  alt,
  className,
  plate,
}: FixedImageProps) {
  return (
    <div
      className={cn(
        'border-line bg-muted relative flex-none overflow-hidden border',
        plate && 'dark:bg-plate dark:p-[3px]',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {media ? (
        <Image
          src={media.url}
          alt={alt ?? media.alt ?? ''}
          fill
          sizes={`${size}px`}
          className="object-contain"
        />
      ) : null}
    </div>
  );
}
