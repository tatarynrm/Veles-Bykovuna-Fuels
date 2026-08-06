'use client';

import React from 'react';
import { motion } from 'framer-motion';
import AnimatedCounter from '@/shared/ui/AnimatedCounter';
import { fadeUp, staggerParent, VIEWPORT } from '@/shared/lib/motion';
import { useSectionSound } from '@/features/sound';
import { t } from '@/lib/i18n';

/**
 * Кожна цифра тут перевіряється по коду, а не «приблизно з голови»:
 * три вендорські сервіси, десять словників локалізації, десять провайдерів
 * підкладок у налаштуваннях карти й мінімальний інтервал опитування
 * живого треку. Маркетинг, який не збігається з застосунком, ламається
 * на першому ж демо.
 *
 * `suffixKey` — ключ одиниці; t() ставиться в місці рендеру.
 */
const STATS = [
  { to: 3,  suffixKey: '',                   label: 'landing.statApis',      tone: 'var(--accent)' },
  { to: 10, suffixKey: '',                   label: 'landing.statLanguages', tone: 'var(--info)' },
  { to: 10, suffixKey: '',                   label: 'landing.statBasemaps',  tone: 'var(--warn)' },
  { to: 3,  suffixKey: 'unit.secondsShort',  label: 'landing.statInterval',  tone: 'var(--accent)' },
];

export default function StatsBand() {
  const ref = useSectionSound<HTMLElement>();

  return (
    <section
      ref={ref}
      className="border-y"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <motion.div
        variants={staggerParent(0.08)}
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        className="mx-auto grid max-w-4xl grid-cols-2 md:grid-cols-4"
      >
        {STATS.map(s => (
          <motion.div
            key={s.label}
            variants={fadeUp}
            /*
              Роздільник не після останньої комірки РЯДУ, а ряд залежить від
              брейкпоінта. Інлайн-стиль так не вміє: він не знає про медіа-
              запити, і на двох колонках друга комірка отримувала зайву рамку
              по краю сітки.
            */
            className="flex flex-col items-center gap-2 border-r px-4 py-10 text-center [&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r md:[&:nth-child(4n)]:border-r-0"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <AnimatedCounter
              to={s.to}
              suffix={s.suffixKey ? ` ${t(s.suffixKey)}` : ''}
              className="font-display text-4xl sm:text-5xl"
              style={{ color: s.tone }}
            />
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t(s.label)}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
