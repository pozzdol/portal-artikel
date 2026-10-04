'use client';

import { useEffect, useRef } from 'react';

const VISIBLE_MS = 5000;

/**
 * Invisible marker that reports a view once the article has been on screen
 * for at least 5s (IntersectionObserver + timer), guarded per-tab by
 * sessionStorage so a reload/re-render doesn't double count (doc 06 §1.8).
 * Skipped entirely on the preview page.
 */
export function ViewTracker({ articleId }: { articleId: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const key = `viewed:${articleId}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // sessionStorage may be unavailable (private mode); proceed without the guard.
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (timer === null) {
            timer = setTimeout(() => {
              navigator.sendBeacon(`/api/v1/public/articles/${articleId}/view`);
              try {
                sessionStorage.setItem(key, '1');
              } catch {
                // ignore
              }
              observer.disconnect();
            }, VISIBLE_MS);
          }
        } else if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
    };
  }, [articleId]);

  return <div ref={ref} aria-hidden="true" />;
}
