'use client';

import { useEffect, type RefObject } from 'react';

export interface GsapBundle {
  gsap: typeof import('gsap')['gsap'];
  ScrollTrigger: typeof import('gsap/ScrollTrigger')['ScrollTrigger'];
}

/**
 * GSAP + ScrollTrigger під клієнтські компоненти Next.js.
 *
 * Імпорт динамічний навмисно: ScrollTrigger під час імпорту чіпає `window`,
 * а клієнтські компоненти в App Router усе одно рендеряться на сервері —
 * статичний імпорт валить SSR.
 *
 * Уся анімація створюється всередині `gsap.context()`, прив'язаного до scope:
 * тоді `revert()` на розмонтуванні прибирає і твіни, і всі інлайн-стилі, які
 * GSAP лишив на елементах. Без цього при поверненні на сторінку через
 * клієнтську навігацію елементи лишалися з opacity:0 від попереднього візиту.
 */
export function useGsap(
  setup: (bundle: GsapBundle) => void,
  scope: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
) {
  useEffect(() => {
    // Той, хто просив менше руху, не має отримувати ще й скрабінг по скролу.
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let cancelled = false;
    let ctx: { revert: () => void } | undefined;
    let observer: ResizeObserver | undefined;
    let debounce = 0;

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled || !scope.current) return;

      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(() => setup({ gsap, ScrollTrigger }), scope.current);

      /*
        Межі треба перерахувати після того, як сторінка усталилась, і одного
        виклику тут недостатньо.

        ScrollTrigger сам оновлюється на 'load', але через динамічний імпорт
        тригери створюються ВЖЕ ПІСЛЯ цієї події, тож автооновлення їм не
        дістається. А одразу після створення розміри ще неправильні: доки
        не завантажився Unbounded, заголовки нижчі, і закріплена секція
        «стоїть» на кількасот пікселів вище, ніж насправді. Тригер лишався
        з координатами, у які користувач ніколи не потрапляв, — секція
        закріплювалась, але скраб не рухався.
      */
      const refresh = () => { if (!cancelled) ScrollTrigger.refresh(); };

      document.fonts?.ready.then(refresh).catch(() => {});
      requestAnimationFrame(() => requestAnimationFrame(refresh));

      // Ліниві зображення, відео та зміна висоти вікна теж зсувають межі.
      observer = new ResizeObserver(() => {
        window.clearTimeout(debounce);
        debounce = window.setTimeout(refresh, 180);
      });
      observer.observe(document.body);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
      observer?.disconnect();
      ctx?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
