'use client';

import { useEffect, useState } from 'react';

/**
 * Повертає false до монтування — SSR не знає про налаштування системи, і
 * повернути true означало б віддати статичну розмітку всім, включно з тими,
 * хто руху не забороняв.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(media.matches);
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
