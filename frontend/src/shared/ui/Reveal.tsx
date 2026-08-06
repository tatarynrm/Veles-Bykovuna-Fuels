'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { fadeUp, VIEWPORT } from '../lib/motion';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  variants?: Variants;
  delay?: number;
  /** Тег обгортки — щоб не ламати семантику списків і секцій. */
  as?: 'div' | 'section' | 'li' | 'span';
  style?: React.CSSProperties;
}

/**
 * Поява при вході у в'юпорт. Обгортка існує тільки заради того, щоб не
 * повторювати `initial/whileInView/viewport` у кожному блоці — і щоб поріг
 * видимості був однаковий на всіх сторінках.
 */
export default function Reveal({
  children,
  className = '',
  variants = fadeUp,
  delay = 0,
  as = 'div',
  style,
}: RevealProps) {
  const Component = motion[as];
  return (
    <Component
      className={className}
      style={style}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
      transition={delay ? { delay } : undefined}
    >
      {children}
    </Component>
  );
}
