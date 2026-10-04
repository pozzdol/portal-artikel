import type { ElementType, ReactNode } from 'react';

import { cn } from '@/lib/cn';

type ContainerProps = {
  as?: 'div' | 'section' | 'main' | 'header' | 'footer' | 'nav';
  className?: string;
  children: ReactNode;
};

/**
 * Shared page-width wrapper: centers content and applies the site's
 * horizontal gutters (20px on mobile, 40px from `lg` up).
 */
export function Container({ as = 'div', className, children }: ContainerProps) {
  const Component = as as ElementType;
  return (
    <Component
      className={cn('mx-auto w-full max-w-[1320px] px-5 lg:px-10', className)}
    >
      {children}
    </Component>
  );
}
