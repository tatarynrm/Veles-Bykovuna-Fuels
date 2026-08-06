'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Прогрес прокрутки крізь елемент: 0 — верх елемента щойно торкнувся верху
 * вікна, 1 — його низ дійшов до низу вікна.
 *
 * Свідомо НЕ на ScrollTrigger.pin. Той кешує межі на момент створення, а
 * тригери тут створюються після динамічного імпорту — тобто вже після
 * події `load`, коли автооновлення GSAP їм не дістається. Варто шрифтам
 * доверстати сторінку, як закешовані координати лишаються від старого
 * layout, і секція закріплюється, але скраб мовчить.
 *
 * Тут геометрія читається з getBoundingClientRect на кожному кадрі скролу,
 * тож кешувати нічого — будь-який зсув сторінки враховується автоматично.
 * Закріплення робить CSS `position: sticky`, а не JS.
 *
 * Значення віддається колбеком, а не станом: споживач сам вирішує, коли це
 * має спричинити перемальовування (зазвичай — раз на цілу «сходинку»).
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  onProgress: (progress: number) => void,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      // Скільки сторінка може проїхати, поки елемент лишається на екрані.
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) {
        onProgress(0);
        return;
      }
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      onProgress(progress);
    };

    // Події скролу приходять частіше за кадри — зайві виміри лише гріють
    // головний потік і провокують layout thrashing.
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [ref, onProgress]);
}
