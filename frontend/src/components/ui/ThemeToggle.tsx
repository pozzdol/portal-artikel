'use client';

import { useLayoutEffect, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/cn';

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains('dark');
}

function getServerSnapshot() {
  return false;
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // React Strict Mode remounts in dev can wipe the class the inline anti-flash
  // script set before hydration; re-apply the stored preference so the toggle
  // never desyncs from what the user actually picked (no-op in production).
  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)',
      ).matches;
      const shouldBeDark = stored === 'dark' || (!stored && prefersDark);
      document.documentElement.classList.toggle('dark', shouldBeDark);
    } catch {
      // localStorage may be unavailable (private mode, disabled storage); ignore.
    }
  }, []);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      // localStorage may be unavailable (private mode, disabled storage); ignore.
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? 'Mode terang' : 'Mode gelap'}
      className={cn(
        'border-line size-11 rounded-[8px] bg-transparent shadow-none hover:bg-transparent lg:size-9 dark:bg-transparent dark:hover:bg-transparent',
      )}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={isDark ? 'text-gold' : 'text-ink'}
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </Button>
  );
}
