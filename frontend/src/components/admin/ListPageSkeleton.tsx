import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { cn } from '@/lib/cn';

export type ListPageSkeletonProps = {
  rows?: number;
  columns?: number;
  className?: string;
};

/** Placeholder shown while a list page's first fetch is in flight. */
export function ListPageSkeleton({
  rows = 8,
  columns = 4,
  className,
}: ListPageSkeletonProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)} aria-hidden="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="border-line overflow-hidden rounded-none border">
        <div className="border-line flex items-center gap-4 border-b px-4 py-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="border-line flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
          >
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
