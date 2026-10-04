'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';

import { cn } from '@/lib/cn';

type TickerItem = { text: string; href: string | null };

type MarqueeProps = {
  items: TickerItem[];
  speedSeconds: number;
};

/**
 * Infinite horizontal scroller for the breaking-news bar. The item list is
 * duplicated once so the CSS animation (`.marquee` in globals.css) loops
 * seamlessly; that same class already pauses on hover/focus and is disabled
 * under `prefers-reduced-motion`.
 */
export function Marquee({ items, speedSeconds }: MarqueeProps) {
  const loop = [...items, ...items];
  const style = {
    '--marquee-duration': `${Math.max(1, speedSeconds)}s`,
  } as CSSProperties;

  return (
    <div className="flex-1 overflow-hidden">
      <div
        className="marquee flex w-max gap-16 whitespace-nowrap"
        style={style}
      >
        {loop.map((item, i) => {
          const colorClass = i % 2 === 0 ? 'text-on-ink' : 'text-gold';
          const text = (
            <span className={cn('text-[14px] font-medium', colorClass)}>
              {item.text}
            </span>
          );
          return item.href ? (
            <Link
              key={`${item.text}-${i}`}
              href={item.href}
              className="hover:underline"
            >
              {text}
            </Link>
          ) : (
            <span key={`${item.text}-${i}`}>{text}</span>
          );
        })}
      </div>
    </div>
  );
}
