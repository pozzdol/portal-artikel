'use client';

import { useSyncExternalStore } from 'react';

import { todayJakartaLabel } from '@/lib/format';

function subscribe() {
  // The label never changes after mount without a full reload, so there is
  // nothing to subscribe to; React only needs the two snapshots below.
  return () => {};
}

function getServerSnapshot() {
  return '';
}

/**
 * Renders '' on the server and during hydration (no `window`, so cached HTML
 * never shows a stale date), then swaps to the real label right after mount.
 * `useSyncExternalStore` is what makes that swap hydration-safe without
 * `suppressHydrationWarning`: React is told upfront that the client snapshot
 * may differ from the server one.
 */
export function TodayLabel() {
  const label = useSyncExternalStore(
    subscribe,
    todayJakartaLabel,
    getServerSnapshot,
  );

  return (
    <span className="text-meta hidden text-[12.5px] font-medium whitespace-nowrap 2xl:inline">
      {label}
    </span>
  );
}
