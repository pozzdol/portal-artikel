import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';

// Per-browser autosave of unsent form drafts (localStorage). Best-effort:
// every storage access is wrapped because it may throw (private mode,
// blocked storage). Never the source of truth — the server is.

export const DRAFT_PREFIX = 'almaidah:draft:';

export type LocalDraft<T> = { value: T; savedAt: string };

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(DRAFT_PREFIX)) cb();
  };
  if (typeof window !== 'undefined')
    window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    if (typeof window !== 'undefined')
      window.removeEventListener('storage', onStorage);
  };
}

export function readDraftRaw(storageKey: string): string | null {
  try {
    return typeof localStorage === 'undefined'
      ? null
      : localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function writeDraft<T>(storageKey: string, value: T): void {
  try {
    const payload: LocalDraft<T> = { value, savedAt: new Date().toISOString() };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // quota / disabled storage: ignore
  }
  emit();
}

export function removeDraft(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
  emit();
}

export function parseDraft<T>(raw: string | null): LocalDraft<T> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as LocalDraft<T>;
    return v &&
      typeof v === 'object' &&
      'value' in v &&
      typeof v.savedAt === 'string'
      ? v
      : null;
  } catch {
    return null;
  }
}

/**
 * `key` e.g. 'article:new' or `article:${id}`; null disables the hook.
 * `save(value)` is debounced (default 1000 ms); `saveNow` writes at once.
 */
export function useLocalDraft<T>(
  key: string | null,
  opts: { debounceMs?: number } = {},
) {
  const debounceMs = opts.debounceMs ?? 1000;
  const storageKey = key ? DRAFT_PREFIX + key : null;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const raw = useSyncExternalStore(
    subscribe,
    () => (storageKey ? readDraftRaw(storageKey) : null),
    () => null,
  );
  const draft = useMemo(() => parseDraft<T>(raw), [raw]);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const saveNow = useCallback(
    (value: T) => {
      cancel();
      if (storageKey) writeDraft(storageKey, value);
    },
    [storageKey, cancel],
  );

  const save = useCallback(
    (value: T) => {
      if (!storageKey) return;
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        writeDraft(storageKey, value);
      }, debounceMs);
    },
    [storageKey, debounceMs, cancel],
  );

  const clear = useCallback(() => {
    cancel();
    if (storageKey) removeDraft(storageKey);
  }, [storageKey, cancel]);

  useEffect(() => cancel, [cancel]);

  return { draft, save, saveNow, clear };
}
