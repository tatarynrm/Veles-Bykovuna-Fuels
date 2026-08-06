'use client';

import { useEffect, useRef } from 'react';
import { useSound } from './SoundContext';
import type { SoundName } from './engine';

interface Options {
  /** Який звук програти, коли секція доїхала. */
  sound?: SoundName;
  /** Частка висоти елемента у в'юпорті, після якої вважаємо «доїхав». */
  threshold?: number;
  /** Програти лише раз за життя компонента. */
  once?: boolean;
}

/**
 * Озвучує появу секції у в'юпорті.
 *
 * Спеціально на IntersectionObserver, а не на scroll-обробнику: браузер сам
 * рахує перетин поза головним потоком, тож звук не залежить від того,
 * наскільки завантажений рендер під час інерційної прокрутки.
 *
 * Звук навмисно НЕ грає при першому спрацюванні, якщо секція вже видима на
 * старті сторінки: інакше завантаження лендінгу зустрічало б користувача
 * акордом з двох-трьох «дзинь» одночасно.
 */
export function useSectionSound<T extends HTMLElement = HTMLDivElement>({
  sound = 'arrive',
  threshold = 0.35,
  once = true,
}: Options = {}) {
  const ref = useRef<T | null>(null);
  const { play } = useSound();
  const firedRef = useRef(false);
  const readyRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    // Секції, видимі одразу після завантаження, не озвучуємо — лише ті,
    // до яких користувач справді доскролив.
    const settle = window.setTimeout(() => { readyRef.current = true; }, 900);

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          if (!once) firedRef.current = false;
          return;
        }
        if (!readyRef.current || firedRef.current) return;
        firedRef.current = true;
        play(sound);
      },
      { threshold },
    );

    observer.observe(el);
    return () => {
      window.clearTimeout(settle);
      observer.disconnect();
    };
  }, [play, sound, threshold, once]);

  return ref;
}
