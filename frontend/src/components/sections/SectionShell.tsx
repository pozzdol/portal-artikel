import type { ReactNode } from 'react';

import { Container } from '@/components/ui/Container';
import { cn } from '@/lib/cn';
import type { SectionBackground } from '@/lib/sections/types';

type SectionShellProps = {
  anchorId?: string;
  background?: SectionBackground;
  /** True when the section rendered immediately before this one was full-bleed ink. */
  padTop: boolean;
  /** True for the first section actually rendered on the page (the hero). */
  isFirst: boolean;
  ariaLabelledBy?: string;
  ariaLabel?: string;
  /** Skip the inner `Container` when a section needs edge-to-edge width. */
  fullBleed?: boolean;
  /** Explicit vertical padding classes, overriding the default rhythm below. */
  py?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Shared homepage section wrapper: anchor id, aria labelling, the
 * paper/muted/ink background split, and the vertical rhythm (56/72/88px bottom
 * padding between paper/muted sections, plus the same extra top padding when the
 * previous section was ink, since ink sections carry no bottom margin of
 * their own). Pass `py` to opt out of that default — the hero, breaking
 * ticker, quote and newsletter sections each use their own fixed padding.
 */
export function SectionShell({
  anchorId,
  background = 'paper',
  padTop,
  isFirst,
  ariaLabelledBy,
  ariaLabel,
  fullBleed,
  py,
  className,
  children,
}: SectionShellProps) {
  const defaultPy = isFirst
    ? 'pt-5 pb-12 sm:pt-7 sm:pb-[72px]'
    : cn(
        'pb-14 sm:pb-[72px] lg:pb-[88px]',
        padTop && 'pt-14 sm:pt-[72px] lg:pt-[88px]',
      );
  const padding = py ?? defaultPy;
  const bgClass =
    background === 'ink'
      ? 'bg-ink-surface text-on-ink dark:border-y dark:border-line'
      : background === 'muted'
        ? 'bg-muted'
        : undefined;

  return (
    <section
      id={anchorId}
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      className={cn(bgClass, className)}
    >
      {fullBleed ? (
        <div className={padding}>{children}</div>
      ) : (
        <Container className={padding}>{children}</Container>
      )}
    </section>
  );
}
