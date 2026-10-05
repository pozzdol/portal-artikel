import Link from 'next/link';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/shadcn/badge';
import { cn } from '@/lib/cn';

type TagChipProps = {
  href?: string;
  children: ReactNode;
  className?: string;
};

const chipClass =
  'h-auto w-fit rounded-full border-line min-h-11 items-center px-4 text-[13px] font-medium lg:min-h-0 lg:px-3.5 lg:py-1.5 lg:text-[12.5px] text-ink normal-case transition-colors hover:border-ink [a]:hover:bg-transparent [a]:hover:text-ink';

/** Pill-shaped tag/category chip, optionally linked. */
export function TagChip({ href, children, className }: TagChipProps) {
  if (href) {
    return (
      <Badge asChild variant="outline" className={cn(chipClass, className)}>
        <Link href={href}>{children}</Link>
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn(chipClass, className)}>
      {children}
    </Badge>
  );
}
