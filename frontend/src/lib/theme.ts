'use client';

import { useSyncExternalStore } from 'react';

/**
 * Theme helpers shared by the public site and /admin. The source of truth is
 * the `dark` class on <html> (set before hydration by the anti-flash script in
 * app/layout.tsx) plus the `theme` key in localStorage ('light' | 'dark';
 * absent = follow the OS preference). Same contract as ThemeToggle.
 */
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains('dark');
}

function getServerSnapshot(): boolean {
  return false;
}

/** Reactive `true` while <html> carries the `dark` class. */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Apply a theme and persist it (storage failures are ignored). */
export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage may be unavailable (private mode, disabled storage); ignore.
  }
}

/**
 * Re-apply the stored preference (or the OS preference when none is stored).
 * Mirrors the anti-flash script; useful after React Strict Mode remounts.
 */
export function applyStoredTheme(): void {
  let shouldBeDark = false;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;
    shouldBeDark = stored === 'dark' || (!stored && prefersDark);
  } catch {
    // localStorage/matchMedia may be unavailable; keep the current class.
    return;
  }
  document.documentElement.classList.toggle('dark', shouldBeDark);
}
