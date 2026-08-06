'use client';

import { useMemo, useState } from 'react';
import {
  INTEGRATIONS, type Integration, type IntegrationCategory,
} from '@/shared/config/integrations';

export type CategoryFilter = IntegrationCategory | 'all';

/**
 * Фільтр каталогу інтеграцій.
 *
 * Категорії рахуються з самих даних, а не задані списком: якщо в конфігу
 * зʼявиться нова категорія, вкладка виникне сама, а порожньої вкладки
 * ніколи не буде.
 */
export function useIntegrationFilter() {
  const [category, setCategory] = useState<CategoryFilter>('all');

  const categories = useMemo(() => {
    const counts = new Map<IntegrationCategory, number>();
    INTEGRATIONS.forEach(i => counts.set(i.category, (counts.get(i.category) ?? 0) + 1));
    return Array.from(counts.entries());
  }, []);

  const items: Integration[] = useMemo(
    () => (category === 'all'
      ? INTEGRATIONS
      : INTEGRATIONS.filter(i => i.category === category)),
    [category],
  );

  const liveCount = useMemo(
    () => INTEGRATIONS.filter(i => i.status === 'live').length,
    [],
  );

  return { category, setCategory, categories, items, liveCount, total: INTEGRATIONS.length };
}
