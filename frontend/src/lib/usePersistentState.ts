'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useState that survives a page reload via localStorage.
 *
 * Hydration-safe: the first render always uses `initial` (matching SSR), the
 * stored value is applied in an effect right after mount. Writes are debounced
 * so typing into a draft does not hammer storage.
 *
 * Never use for credentials — that is why /login does not use this hook.
 */
export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
  options: { debounceMs?: number } = {},
): [T, (next: T | ((prev: T) => T)) => void, { clear: () => void; restored: boolean }] {
  const { debounceMs = 300 } = options;
  const [value, setValue] = useState<T>(initial);
  /** True when a stored value was actually found and applied. */
  const [restored, setRestored] = useState(false);
  const hydratedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  // Restore once after mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        setValue(JSON.parse(raw) as T);
        setRestored(true);
      }
    } catch {
      /* corrupted or unavailable storage — keep the initial value */
    }
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persist on change (debounced), but never before restoration ran —
  // otherwise the initial value would instantly overwrite the stored draft.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* quota/private mode — persistence is best-effort */
      }
    }, debounceMs);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [key, value, debounceMs]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setRestored(false);
  }, [key]);

  return [value, setValue, { clear, restored }];
}
