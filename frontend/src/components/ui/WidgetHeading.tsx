import type { ElementType, ReactNode } from 'react';

import { cn } from '@/lib/cn';

type WidgetHeadingProps = {
  children: ReactNode;
  as?: 'h2' | 'h3';
  boxed?: boolean;
  className?: string;
};

/** Small uppercase heading used for sidebar widgets ("Artikel Populer", "Kategori", ...). */
export function WidgetHeading({
  children,
  as = 'h2',
  boxed = false,
  className,
}: WidgetHeadingProps) {
  const Component = as as ElementType;
  return (
    <Component
      className={cn(
        'text-ink text-[12px] font-bold tracking-[0.12em] uppercase',
        boxed ? 'mb-3.5' : 'border-ink mb-4 border-b-2 pb-3',
        className,
      )}
    >
      {children}
    </Component>
  );
}
