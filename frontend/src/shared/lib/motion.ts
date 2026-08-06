import type { Variants } from 'framer-motion';

/**
 * Ті самі криві, що в globals.css (--ease-enter / --ease-state). Тримати їх
 * у двох місцях доводиться тому, що Framer Motion рахує анімації в JS і до
 * CSS-змінних не має доступу; розбіжність тут одразу видно як «CSS-ховер
 * рухається інакше, ніж поява елемента».
 */
export const EASE_ENTER: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const EASE_STATE: [number, number, number, number] = [0.4, 0, 0.2, 1];

/** Тривалості з дизайн-системи: стан / поява / перекладка. */
export const DUR = { state: 0.15, enter: 0.22, layout: 0.3, slow: 0.55 } as const;

/** Спільний viewport для whileInView — секція вважається видимою трохи раніше. */
export const VIEWPORT = { once: true, margin: '-12% 0px -12% 0px' } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.slow, ease: EASE_ENTER } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.slow, ease: EASE_ENTER } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: { duration: DUR.slow, ease: EASE_ENTER } },
};

/**
 * Контейнер зі сходинкою. Каскад обрізаний на ~8 елементах
 * (`delayChildren` лишається, а `staggerChildren` малий), інакше нижні картки
 * сітки з'являються помітно пізніше, ніж користувач до них доскролив.
 */
export const staggerParent = (stagger = 0.07, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

/** Заголовок, що виїжджає з розмиття — використовується для hero-рядків. */
export const blurUp: Variants = {
  hidden: { opacity: 0, y: 40, filter: 'blur(10px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.75, ease: EASE_ENTER },
  },
};
