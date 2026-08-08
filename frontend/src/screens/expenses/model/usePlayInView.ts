'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Тримає відео всередині контейнера програними лише поки контейнер видно.
 *
 * На сторінці три ролики по 720p одночасно; браузер не зупиняє ті, що поїхали
 * за межі екрана, і вони далі декодуються — на ноутбуці це відразу чути
 * кулером. Обсервер із нульовим порогом вимикає їх рівно тоді, коли секція
 * пішла з в'юпорта.
 *
 * `play()` повертає проміс, який відхиляється, якщо елемент прибрали або
 * автовідтворення заборонене; ловимо мовчки — це не помилка застосунку.
 */
export function usePlayInView(scope: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = scope.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const videos = root.querySelectorAll('video');
        videos.forEach(video => {
          if (entry.isIntersecting) void video.play().catch(() => {});
          else video.pause();
        });
      },
      { threshold: 0 },
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [scope]);
}
