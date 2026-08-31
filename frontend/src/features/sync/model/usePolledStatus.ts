'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

/** Інтервал опитування online-статусу синхронізацій. */
export const SYNC_POLL_MS = 20_000;

/**
 * Опитує GET-ендпоінт кожні `intervalMs` (за замовчуванням 20 с). Це технічні
 * ops-екрани, тож стан рухається повільно — щосекунди дивитися немає сенсу.
 * `refresh()` тягне свіжі дані одразу (кнопка «Оновити»).
 */
export function usePolledStatus<T>(
  path: string,
  enabled: boolean,
  intervalMs: number = SYNC_POLL_MS,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await apiGet<T>(path);
      setData(res);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Не вдалося отримати статус');
    }
  }, [path]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [enabled, refresh, intervalMs]);

  return { data, error, refresh };
}
