'use client';

import { useEffect, useRef, useState } from 'react';

interface Options {
  /** Кінцеве значення. */
  to: number;
  /** Запускати лише коли true — зазвичай прив'язано до появи у в'юпорті. */
  active: boolean;
  duration?: number;
  /** Скільки знаків після коми тримати під час анімації. */
  decimals?: number;
  /** Викликається на кожній «сходинці» — сюди зручно вішати звук. */
  onStep?: (value: number) => void;
}

/**
 * Лічильник на requestAnimationFrame.
 *
 * Не на CSS і не на Framer Motion, бо потрібне саме числове значення на
 * кожному кадрі: його форматує Intl, і воно ж керує звуковими засічками.
 *
 * Крива — ease-out cubic: числа швидко набирають масу й м'яко зупиняються,
 * інакше лінійний відлік читається як таймер, а не як «підрахунок».
 */
export function useCountUp({
  to,
  active,
  duration = 1800,
  decimals = 0,
  onStep,
}: Options): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);
  // Колбек тримаємо в ref, щоб його заміна не перезапускала анімацію.
  const stepRef = useRef(onStep);
  stepRef.current = onStep;

  useEffect(() => {
    if (!active) return;

    const factor = 10 ** decimals;
    let lastEmitted = -1;
    const started = performance.now();

    const tick = (now: number) => {
      const p = Math.min((now - started) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(to * eased * factor) / factor;

      setValue(next);
      if (next !== lastEmitted) {
        lastEmitted = next;
        stepRef.current?.(next);
      }

      if (p < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [to, active, duration, decimals]);

  return value;
}
