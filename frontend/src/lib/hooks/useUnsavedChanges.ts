import { useCallback, useEffect } from 'react';

export const UNSAVED_MESSAGE =
  'Perubahan belum disimpan. Tinggalkan halaman ini?';

/**
 * Warns before closing/reloading the tab while `dirty` (beforeunload; the
 * browser shows its own text). In-app navigation is not intercepted — call
 * the returned `confirmLeave()` before programmatic navigation / Cancel.
 */
export function useUnsavedChanges(
  dirty: boolean,
  message: string = UNSAVED_MESSAGE,
) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers need returnValue set.
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, message]);

  /** true when it is fine to leave (clean form or user confirmed). */
  const confirmLeave = useCallback(
    () => !dirty || window.confirm(message),
    [dirty, message],
  );
  return { confirmLeave };
}
