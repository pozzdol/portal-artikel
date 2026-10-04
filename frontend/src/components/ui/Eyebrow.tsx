import type { ElementType, ReactNode } from 'react';

import { cn } from '@/lib/cn';

type EyebrowProps = {
  children: ReactNode;
  size?: 'xs' | 'sm' | 'md';
  as?: 'span' | 'p';
  className?: string;
};

const SIZE_CLASSES: Record<NonNullable<EyebrowProps['size']>, string> = {
  xs: 'text-[10.5px] tracking-[0.1em]',
  sm: 'text-[11px] tracking-[0.1em]',
  md: 'text-[12px] tracking-[0.12em]',
};

/** Bold uppercase gold label used above headings and category tags. */
export function Eyebrow({
  children,
  size = 'md',
  as = 'span',
  className,
}: EyebrowProps) {
  const Component = as as ElementType;
  return (
    <Component
      className={cn(
        'text-gold-strong inline-block font-bold uppercase',
        SIZE_CLASSES[size],
        className,
      )}
    >
      {children}
    </Component>
  );
}
