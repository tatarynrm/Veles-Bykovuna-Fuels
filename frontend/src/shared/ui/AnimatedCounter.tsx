'use client';

import React, { useRef } from 'react';
import { useInView } from 'framer-motion';
import { useCountUp } from '../lib/useCountUp';

interface Props {
  to: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Дає споживачеві озвучити відлік — сам shared про звук нічого не знає. */
  onStep?: (value: number) => void;
  /** Форматувати за локаллю (розділювачі тисяч). */
  localized?: boolean;
}

/**
 * Число, що набігає при появі у в'юпорті.
 *
 * `useInView` тут, а не в useCountUp: хук лишається чистим і придатним для
 * випадків, коли старт визначає не в'юпорт, а прогрес скролу.
 */
export default function AnimatedCounter({
  to,
  suffix = '',
  prefix = '',
  decimals = 0,
  duration,
  className = '',
  style,
  onStep,
  localized = false,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15%' });
  const value = useCountUp({ to, active: inView, decimals, duration, onStep });

  const text = localized
    ? value.toLocaleString('uk-UA', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : value.toFixed(decimals);

  return (
    <span
      ref={ref}
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', ...style }}
    >
      {prefix}{text}{suffix}
    </span>
  );
}
