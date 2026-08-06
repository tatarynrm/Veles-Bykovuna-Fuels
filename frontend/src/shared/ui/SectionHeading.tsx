'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { fadeUp, staggerParent, VIEWPORT } from '../lib/motion';

type Accent = 'accent' | 'warn' | 'info';

const ACCENT_VAR: Record<Accent, string> = {
  accent: 'var(--accent)',
  warn: 'var(--warn)',
  info: 'var(--info)',
};

interface Props {
  /** Мітка над заголовком — завжди капсом, це micro-label. */
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Колір мітки. amber зарезервовано за телематикою — див. дизайн-систему. */
  accent?: Accent;
  align?: 'center' | 'left';
  className?: string;
}

/** Спільна шапка секції: мітка → заголовок → опис, з каскадною появою. */
export default function SectionHeading({
  eyebrow,
  title,
  description,
  accent = 'accent',
  align = 'center',
  className = '',
}: Props) {
  const centered = align === 'center';

  return (
    <motion.div
      variants={staggerParent(0.08)}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
      className={`${centered ? 'text-center mx-auto' : ''} ${className}`}
    >
      {eyebrow && (
        <motion.p
          variants={fadeUp}
          className="micro-label mb-3"
          style={{ color: ACCENT_VAR[accent] }}
        >
          {eyebrow}
        </motion.p>
      )}

      <motion.h2
        variants={fadeUp}
        className="font-display text-[28px] leading-[1.15] sm:text-[34px]"
      >
        {title}
      </motion.h2>

      {description && (
        <motion.p
          variants={fadeUp}
          className={`mt-4 text-sm leading-relaxed ${centered ? 'mx-auto max-w-xl' : 'max-w-xl'}`}
          style={{ color: 'var(--text-secondary)' }}
        >
          {description}
        </motion.p>
      )}
    </motion.div>
  );
}
