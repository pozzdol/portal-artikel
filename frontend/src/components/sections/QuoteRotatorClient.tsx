'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

type Quote = { text: string; source: string | null };

type QuoteRotatorClientProps = {
  quotes: Quote[];
  intervalSeconds: number;
  order: 'sequential' | 'random';
};

/**
 * Rotates through `quotes` on a timer, fading each one in with `.quote-fade`
 * (globals.css; a no-op under `prefers-reduced-motion`). Pauses on
 * hover/focus. A single quote never rotates.
 */
export function QuoteRotatorClient({
  quotes,
  intervalSeconds,
  order,
}: QuoteRotatorClientProps) {
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (quotes.length <= 1) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;

    const id = setInterval(
      () => {
        if (pausedRef.current) return;
        setIndex((current) => {
          if (order === 'random') {
            if (quotes.length <= 1) return current;
            let next = current;
            while (next === current)
              next = Math.floor(Math.random() * quotes.length);
            return next;
          }
          return (current + 1) % quotes.length;
        });
      },
      Math.max(1, intervalSeconds) * 1000,
    );
    return () => clearInterval(id);
  }, [quotes.length, intervalSeconds, order]);

  const quote = quotes[index];
  if (!quote) return null;

  const style = {
    '--quote-fade-duration': `${Math.max(1, intervalSeconds)}s`,
  } as CSSProperties;

  return (
    <div
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      onFocus={() => {
        pausedRef.current = true;
      }}
      onBlur={() => {
        pausedRef.current = false;
      }}
    >
      <p
        key={index}
        aria-live="polite"
        className="quote-fade text-on-ink mb-6 font-serif text-[38px] leading-[1.5] italic"
        style={style}
      >
        {quote.text}
      </p>
      {quote.source ? (
        <span className="text-gold text-[13px] font-semibold tracking-[0.08em] uppercase">
          {quote.source}
        </span>
      ) : null}
    </div>
  );
}
