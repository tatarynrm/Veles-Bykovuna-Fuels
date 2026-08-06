'use client';

import { useEffect, useState } from 'react';

export const HERO_VIDEOS = ['/videos/1fstVideo.mp4', '/videos/SecondVideo.mp4'] as const;

/**
 * Перемикає кадр hero-відео по колу.
 *
 * Обидва відео змонтовані одночасно й перекриваються прозорістю, а не
 * підмінюють `src`: заміна джерела дає чорний кадр на час завантаження,
 * а перехресне згасання лишається плавним.
 */
export function useHeroVideos(intervalMs = 9000) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setIndex(i => (i + 1) % HERO_VIDEOS.length),
      intervalMs,
    );
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return index;
}
