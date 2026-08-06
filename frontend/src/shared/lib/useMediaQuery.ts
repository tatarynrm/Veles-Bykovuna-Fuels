'use client';

import { useEffect, useState } from 'react';

/**
 * Повертає false до монтування — на сервері ширини вікна не існує, і будь-яке
 * інше припущення дало б розбіжність із першим клієнтським кадром.
 *
 * Тому компоненти, що залежать від цього хука, мусять мати робочий вигляд
 * саме у «false»-стані: мобільна розкладка як типова, десктопна — як
 * покращення після монтування.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
