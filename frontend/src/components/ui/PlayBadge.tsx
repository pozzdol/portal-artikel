import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/format';

type BadgeSize = 'lg' | 'sm';

type PlayBadgeProps = {
  size: BadgeSize;
};

/**
 * Centered play-button overlay for video thumbnails. Must be placed inside a
 * `relative` ancestor (the wrapping `<Link>`/`<div>` around the thumbnail).
 */
export function PlayBadge({ size }: PlayBadgeProps) {
  const circle = size === 'lg' ? 'h-[60px] w-[60px]' : 'h-[46px] w-[46px]';
  const triangle =
    size === 'lg'
      ? 'border-y-[9px] border-l-[15px] ml-[3px]'
      : 'border-y-[7px] border-l-[12px] ml-[2px]';

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        className={cn(
          'bg-ink-surface flex items-center justify-center rounded-full',
          circle,
        )}
      >
        <span
          className={cn(
            'block h-0 w-0 border-y-transparent border-l-[var(--on-ink)]',
            triangle,
          )}
        />
      </div>
    </div>
  );
}

type DurationBadgeProps = {
  seconds: number | null;
  size: BadgeSize;
};

/** Duration pill in the bottom-right corner of a video thumbnail. */
export function DurationBadge({ seconds, size }: DurationBadgeProps) {
  if (seconds === null) return null;
  return (
    <span
      className={cn(
        'bg-ink-surface text-on-ink pointer-events-none absolute rounded-[3px] font-semibold',
        size === 'lg'
          ? 'right-[10px] bottom-[10px] px-2 py-[3px] text-[11px]'
          : 'right-2 bottom-2 px-1.5 py-0.5 text-[10px]',
      )}
    >
      {formatDuration(seconds)}
    </span>
  );
}
