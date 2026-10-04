'use client';

import Image from 'next/image';
import { CheckIcon, InfoIcon } from 'lucide-react';

import { Button } from '@/components/ui/shadcn/button';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import type { MediaItem } from '@/lib/api/admin/types';
import { cn } from '@/lib/cn';

export type MediaGridProps = {
  items: MediaItem[];
  selectedIds?: readonly number[];
  onSelect: (item: MediaItem) => void;
  /** Shows a detail button on each tile. */
  onOpen?: (item: MediaItem) => void;
  isLoading?: boolean;
  /** Skeleton tile count while loading with no items. */
  skeletonCount?: number;
  className?: string;
};

const GRID =
  'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

export function MediaGrid({
  items,
  selectedIds,
  onSelect,
  onOpen,
  isLoading,
  skeletonCount = 10,
  className,
}: MediaGridProps) {
  if (isLoading && items.length === 0) {
    return (
      <div className={cn(GRID, className)} aria-busy="true">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  const selected = new Set(selectedIds ?? []);

  return (
    <ul
      className={cn(
        GRID,
        isLoading && 'opacity-60 transition-opacity',
        className,
      )}
      aria-busy={isLoading || undefined}
    >
      {items.map((item) => {
        const isSelected = selected.has(item.id);
        const dims =
          item.width && item.height ? `${item.width}×${item.height}` : null;
        return (
          <li
            key={item.id}
            className="group/tile relative flex min-w-0 flex-col gap-1.5"
          >
            <button
              type="button"
              onClick={() => onSelect(item)}
              aria-pressed={selectedIds ? isSelected : undefined}
              aria-label={`${isSelected ? 'Batalkan pilihan' : 'Pilih'} ${item.original_name}`}
              className={cn(
                'border-line bg-muted relative block aspect-square w-full overflow-hidden border outline-none',
                'focus-visible:ring-ring/50 focus-visible:ring-3',
                isSelected
                  ? 'border-gold ring-gold ring-2'
                  : 'hover:border-foreground/40',
              )}
            >
              <Image
                src={item.url}
                alt={item.alt_text ?? ''}
                fill
                sizes="(min-width: 1024px) 200px, (min-width: 640px) 33vw, 50vw"
                className="object-cover"
                unoptimized={item.mime_type === 'image/gif'}
              />
              {isSelected && (
                <span className="bg-gold text-on-gold absolute top-1.5 left-1.5 flex size-6 items-center justify-center">
                  <CheckIcon className="size-4" aria-hidden />
                </span>
              )}
            </button>
            {onOpen && (
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                className="absolute top-1.5 right-1.5 shadow-xs sm:opacity-0 sm:group-hover/tile:opacity-100 sm:focus-visible:opacity-100"
                onClick={() => onOpen(item)}
                aria-label={`Detail ${item.original_name}`}
              >
                <InfoIcon />
              </Button>
            )}
            <div className="flex min-w-0 items-baseline justify-between gap-2 text-xs">
              <span className="truncate" title={item.original_name}>
                {item.original_name}
              </span>
              {dims && (
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {dims}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
