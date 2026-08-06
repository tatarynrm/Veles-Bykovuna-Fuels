'use client';

import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import SectionHeading from '@/shared/ui/SectionHeading';
import { fadeUp, staggerParent, VIEWPORT, EASE_ENTER } from '@/shared/lib/motion';
import { useSectionSound } from '@/features/sound';
import { t } from '@/lib/i18n';

/**
 * Кольори тут беруться не з CSS-змінних, а константами: значення потрапляють
 * в атрибути SVG (`stroke`, `fill`), а не в CSS-властивості, тож `var()`
 * у них не розкривається. Це свідомий дубль — тримати його треба поруч із
 * палітрою в globals.css.
 */
const C = {
  accent: '#10B981',
  warn: '#F5A524',
  info: '#5B9DF9',
  glass: 'rgba(18,24,36,0.72)',
  text: '#ECF1F8',
};

const PATHS = [
  { d: 'M 110 68 C 185 68 205 158 292 158', color: C.accent, delay: 0.25 },
  { d: 'M 490 68 C 415 68 395 158 308 158', color: C.warn,   delay: 0.45 },
  { d: 'M 300 264 L 300 175',               color: C.info,   delay: 0.65 },
];

const VENDORS = [
  { name: 'OKKO',    sub: 'Паливні картки ERP',  color: 'var(--accent)', border: 'rgb(var(--accent-rgb) / 0.38)' },
  { name: 'Shell',   sub: 'Mobility B2B API',    color: 'var(--warn)',   border: 'rgb(var(--warn-rgb) / 0.38)' },
  { name: 'Ruptela', sub: 'fm-track Telematics', color: 'var(--info)',   border: 'rgb(var(--info-rgb) / 0.38)' },
];

function Diagram() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20%' });

  return (
    <div ref={ref} className="mx-auto max-w-2xl select-none">
      <svg viewBox="0 0 600 335" className="h-auto w-full" style={{ overflow: 'visible' }} aria-hidden>
        {PATHS.map(p => (
          <motion.path
            key={p.d}
            d={p.d}
            stroke={p.color}
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="5 4"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={inView ? { pathLength: 1, opacity: 0.65 } : {}}
            transition={{ duration: 1.3, delay: p.delay, ease: 'easeInOut' }}
          />
        ))}

        {/*
          Пакети даних, що біжать до ядра.

          Рух заданий CSS-анімацією, а не Framer Motion: `offset-distance` не
          входить у типи анімованих властивостей motion-компонентів, і обхід
          через приведення типу ламав перевірку. CSS-варіант ще й дешевший —
          `offset-path` анімується композитором, поза головним потоком.
        */}
        {inView && PATHS.map(p => (
          <circle
            key={`dot-${p.d}`}
            r="3.5"
            fill={p.color}
            style={{
              offsetPath: `path("${p.d}")`,
              animation: `flow-dot 3s ${p.delay + 1.1}s linear infinite`,
            }}
          />
        ))}

        {[
          { x: 30,  y: 36,  w: 160, label: 'OKKO',    sub: 'Паливні картки',  color: C.accent },
          { x: 410, y: 36,  w: 160, label: 'Shell',   sub: 'Mobility B2B',    color: C.warn },
          { x: 210, y: 252, w: 180, label: 'Ruptela', sub: 'Телематика флоту', color: C.info },
        ].map((node, i) => (
          <motion.g
            key={node.label}
            initial={{ opacity: 0, y: node.y > 200 ? -12 : 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: i * 0.15 }}
          >
            <rect
              x={node.x} y={node.y} width={node.w} height="64" rx="14"
              fill={C.glass} stroke={node.color} strokeOpacity="0.38" strokeWidth="1"
            />
            <text x={node.x + node.w / 2} y={node.y + 27} textAnchor="middle"
              fill={C.text} fontSize="13" fontWeight="600" fontFamily="Manrope, system-ui">
              {node.label}
            </text>
            <text x={node.x + node.w / 2} y={node.y + 47} textAnchor="middle"
              fill={node.color} fontSize="10" fontFamily="Manrope, system-ui">
              {node.sub}
            </text>
          </motion.g>
        ))}

        {inView && (
          <motion.circle
            cx="300" cy="160" r="64" fill="none" stroke={C.accent} strokeWidth="0.5"
            animate={{ opacity: [0.12, 0.3, 0.12], scale: [0.9, 1.08, 0.9] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '300px 160px' }}
          />
        )}

        <motion.g
          initial={{ opacity: 0, scale: 0.6 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.6, ease: EASE_ENTER }}
          style={{ transformOrigin: '300px 160px' }}
        >
          <circle cx="300" cy="160" r="55" fill="rgba(12,17,26,0.9)" stroke={C.accent} strokeOpacity="0.4" strokeWidth="1.5" />
          <text x="300" y="155" textAnchor="middle" fill={C.text} fontSize="15" fontWeight="700"
            fontFamily="Unbounded, Manrope, system-ui" letterSpacing="-0.6">VELES</text>
          <text x="300" y="174" textAnchor="middle" fill={C.accent} fontSize="10" fontFamily="Manrope, system-ui">
            ERP Platform
          </text>
        </motion.g>
      </svg>
    </div>
  );
}

export default function IntegrationFlow() {
  const ref = useSectionSound<HTMLElement>();

  return (
    <section ref={ref} className="px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          eyebrow={t('landing.architectureEyebrow')}
          title={t('landing.architectureTitle')}
          description={t('landing.architectureLead')}
          accent="warn"
          className="mb-16"
        />

        <Diagram />

        <motion.div
          variants={staggerParent(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-10 grid gap-4 sm:grid-cols-3"
        >
          {VENDORS.map(v => (
            <motion.div
              key={v.name}
              variants={fadeUp}
              className="glass-inset rounded-xl p-4 text-center"
              style={{ border: `1px solid ${v.border}` }}
            >
              <p className="mb-1 text-sm font-semibold" style={{ color: v.color }}>{v.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{v.sub}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
