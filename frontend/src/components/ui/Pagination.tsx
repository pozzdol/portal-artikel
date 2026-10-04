import Link from 'next/link';

import { Button } from '@/components/ui/shadcn/button';
import {
  Pagination as PaginationRoot,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/shadcn/pagination';
import { cn } from '@/lib/cn';

type PaginationProps = {
  page: number;
  totalPages: number;
  hrefFor: (n: number) => string;
  className?: string;
};

const WINDOW_SIZE = 5;

/** Builds a 5-number sliding window around `page`, with edge numbers + ellipses. */
function buildPageWindow(
  page: number,
  totalPages: number,
): (number | 'ellipsis')[] {
  if (totalPages <= WINDOW_SIZE + 2) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const half = Math.floor(WINDOW_SIZE / 2);
  let start = Math.max(2, page - half);
  let end = Math.min(totalPages - 1, page + half);

  if (start <= 2) {
    start = 2;
    end = WINDOW_SIZE + 1;
  } else if (end >= totalPages - 1) {
    end = totalPages - 1;
    start = totalPages - WINDOW_SIZE;
  }

  const middle: number[] = [];
  for (let n = start; n <= end; n += 1) middle.push(n);

  const result: (number | 'ellipsis')[] = [1];
  if (start > 2) result.push('ellipsis');
  result.push(...middle);
  if (end < totalPages - 1) result.push('ellipsis');
  result.push(totalPages);
  return result;
}

// Outline-variant Button, stripped of the shadcn defaults that would show
// (bg-background/shadow-xs/hover:bg-muted) — only the border + radius stay.
const navButtonClass =
  'h-9 w-auto rounded-none border-line bg-transparent px-3.5 py-2 text-[13px] font-medium shadow-none hover:border-ink hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent';

const numberButtonClass =
  'h-9 w-9 rounded-none border-line bg-transparent p-0 text-[13px] font-medium shadow-none hover:border-ink hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent';

const activeNumberButtonClass =
  'border-ink bg-ink text-paper hover:border-ink hover:bg-ink hover:text-paper dark:bg-ink dark:hover:bg-ink';

/** Prev/next + numbered pagination, `hrefFor` builds each page's URL. */
export function Pagination({
  page,
  totalPages,
  hrefFor,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPageWindow(page, totalPages);

  return (
    <PaginationRoot
      aria-label="Paginasi"
      className={cn(
        'mx-0 w-auto flex-wrap items-center justify-center gap-2',
        className,
      )}
    >
      <PaginationContent className="flex-wrap gap-2">
        {page > 1 ? (
          <PaginationItem>
            <Button
              asChild
              variant="outline"
              size="default"
              className={navButtonClass}
            >
              <Link href={hrefFor(page - 1)} rel="prev">
                Sebelumnya
              </Link>
            </Button>
          </PaginationItem>
        ) : null}
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <span aria-hidden="true" className="text-faint px-1 text-[13px]">
                …
              </span>
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <Button
                asChild
                variant="outline"
                size="icon"
                className={cn(
                  numberButtonClass,
                  p === page && activeNumberButtonClass,
                )}
              >
                <Link
                  href={hrefFor(p)}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </Link>
              </Button>
            </PaginationItem>
          ),
        )}
        {page < totalPages ? (
          <PaginationItem>
            <Button
              asChild
              variant="outline"
              size="default"
              className={navButtonClass}
            >
              <Link href={hrefFor(page + 1)} rel="next">
                Berikutnya
              </Link>
            </Button>
          </PaginationItem>
        ) : null}
      </PaginationContent>
    </PaginationRoot>
  );
}
