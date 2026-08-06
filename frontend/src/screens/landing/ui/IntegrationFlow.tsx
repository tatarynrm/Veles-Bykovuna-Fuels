'use client';

import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import SectionHeading from '@/shared/ui/SectionHeading';
import { fadeUp, staggerParent, VIEWPORT, EASE_ENTER } from '@/shared/lib/motion';
import { useSectionSound } from '@/features/sound';
import IntegrationGraph from './IntegrationGraph';
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

/** У `sub` лежить КЛЮЧ — масив рівня модуля, t() ставиться в місці рендеру. */
const VENDORS = [
  { name: 'OKKO',    sub: 'landing.vendorOkkoSub',    color: 'var(--accent)', border: 'rgb(var(--accent-rgb) / 0.38)' },
  { name: 'Shell',   sub: 'landing.vendorShellSub',   color: 'var(--warn)',   border: 'rgb(var(--warn-rgb) / 0.38)' },
  { name: 'Ruptela', sub: 'landing.vendorRuptelaSub', color: 'var(--info)',   border: 'rgb(var(--info-rgb) / 0.38)' },
];

/**
 * Вузол схеми. `name` — власна назва вендора, однакова в усіх мовах;
 * `subKey` — КЛЮЧ i18n, t() стоїть у місці рендеру.
 * i18n-ignore-props: name
 */
interface DiagramNode {
  name: string;
  subKey: string;
  x: number;
  y: number;
  w: number;
  /** Звідки картка «прилітає»: нижні піднімаються, верхні опускаються. */
  from: number;
  color: string;
}

/**
 * Геометрія схеми. Дві розкладки замість одної масштабованої: viewBox 600 на
 * ширині телефона стискає підпис у 13px до ~7px — формально видно, фактично
 * не читається. Вертикальна версія тримає той самий масштаб тексту, що й
 * панорамна, бо її viewBox приблизно дорівнює ширині екрана.
 */
interface DiagramLayout {
  viewBox: string;
  /** Ядро: центр і радіус, плюс радіус пульсуючого кільця навколо. */
  core: { x: number; y: number; r: number; halo: number };
  nodes: Record<'okko' | 'shell' | 'ruptela', DiagramNode>;
  /** Звʼязки в порядку появи; `d` — той самий шлях і для лінії, і для пакета. */
  paths: { d: string; color: string; delay: number }[];
}

const WIDE_DIAGRAM: DiagramLayout = {
  viewBox: '0 0 600 335',
  core: { x: 300, y: 160, r: 55, halo: 64 },
  nodes: {
    okko:    { name: 'OKKO',    subKey: 'landing.nodeOkkoSub',    x: 30,  y: 36,  w: 160, from: 12,  color: C.accent },
    shell:   { name: 'Shell',   subKey: 'landing.nodeShellSub',   x: 410, y: 36,  w: 160, from: 12,  color: C.warn },
    ruptela: { name: 'Ruptela', subKey: 'landing.nodeRuptelaSub', x: 210, y: 252, w: 180, from: -12, color: C.info },
  },
  paths: [
    { d: 'M 110 68 C 185 68 205 158 292 158', color: C.accent, delay: 0.25 },
    { d: 'M 490 68 C 415 68 395 158 308 158', color: C.warn,   delay: 0.45 },
    { d: 'M 300 264 L 300 175',               color: C.info,   delay: 0.65 },
  ],
};

/**
 * Вертикальна версія: два вендори вгорі поруч, ядро посередині, телематика
 * знизу. Ширина картки 158 у viewBox 360 — дві такі з проміжком якраз
 * заповнюють рядок, і «OKKO · паливні картки» не переноситься.
 */
const NARROW_DIAGRAM: DiagramLayout = {
  viewBox: '0 0 360 404',
  core: { x: 180, y: 202, r: 50, halo: 60 },
  nodes: {
    okko:    { name: 'OKKO',    subKey: 'landing.nodeOkkoSub',    x: 8,   y: 20,  w: 158, from: 12,  color: C.accent },
    shell:   { name: 'Shell',   subKey: 'landing.nodeShellSub',   x: 194, y: 20,  w: 158, from: 12,  color: C.warn },
    ruptela: { name: 'Ruptela', subKey: 'landing.nodeRuptelaSub', x: 95,  y: 326, w: 170, from: -12, color: C.info },
  },
  paths: [
    { d: 'M 87 84 C 87 134 118 152 134 168',   color: C.accent, delay: 0.25 },
    { d: 'M 273 84 C 273 134 242 152 226 168', color: C.warn,   delay: 0.45 },
    { d: 'M 180 326 L 180 254',                color: C.info,   delay: 0.65 },
  ],
};

function DiagramSvg({ layout, inView }: { layout: DiagramLayout; inView: boolean }) {
  const { core } = layout;
  const nodes = [layout.nodes.okko, layout.nodes.shell, layout.nodes.ruptela];

  return (
    <svg viewBox={layout.viewBox} className="h-auto w-full" style={{ overflow: 'visible' }} aria-hidden>
      {layout.paths.map(p => (
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
      {inView && layout.paths.map(p => (
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

      {nodes.map((node, i) => (
        <motion.g
          key={node.name}
          initial={{ opacity: 0, y: node.from }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: i * 0.15 }}
        >
          <rect
            x={node.x} y={node.y} width={node.w} height="64" rx="14"
            fill={C.glass} stroke={node.color} strokeOpacity="0.38" strokeWidth="1"
          />
          <text x={node.x + node.w / 2} y={node.y + 27} textAnchor="middle"
            fill={C.text} fontSize="13" fontWeight="600" fontFamily="Manrope, system-ui">
            {node.name}
          </text>
          <text x={node.x + node.w / 2} y={node.y + 47} textAnchor="middle"
            fill={node.color} fontSize="10" fontFamily="Manrope, system-ui">
            {t(node.subKey)}
          </text>
        </motion.g>
      ))}

      {inView && (
        <motion.circle
          cx={core.x} cy={core.y} r={core.halo} fill="none" stroke={C.accent} strokeWidth="0.5"
          animate={{ opacity: [0.12, 0.3, 0.12], scale: [0.9, 1.08, 0.9] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: `${core.x}px ${core.y}px` }}
        />
      )}

      <motion.g
        initial={{ opacity: 0, scale: 0.6 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.7, delay: 0.6, ease: EASE_ENTER }}
        style={{ transformOrigin: `${core.x}px ${core.y}px` }}
      >
        <circle cx={core.x} cy={core.y} r={core.r} fill="rgba(12,17,26,0.9)"
          stroke={C.accent} strokeOpacity="0.4" strokeWidth="1.5" />
        <text x={core.x} y={core.y - 5} textAnchor="middle" fill={C.text} fontSize="15" fontWeight="700"
          fontFamily="Unbounded, Manrope, system-ui" letterSpacing="-0.6">VELES</text>
        <text x={core.x} y={core.y + 14} textAnchor="middle" fill={C.accent} fontSize="10"
          fontFamily="Manrope, system-ui">
          ERP Platform
        </text>
      </motion.g>
    </svg>
  );
}

function Diagram() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20%' });

  /*
    Обидві розкладки в DOM, перемикає їх брейкпоінт — без вимірювання вікна,
    отже без стрибка після гідрації. Схема декоративна (`aria-hidden`), тож
    дубль у розмітці нічого не додає ні читалкам, ні порядку табуляції.
  */
  return (
    <div ref={ref} className="mx-auto max-w-2xl select-none">
      <div className="sm:hidden">
        <DiagramSvg layout={NARROW_DIAGRAM} inView={inView} />
      </div>
      <div className="hidden sm:block">
        <DiagramSvg layout={WIDE_DIAGRAM} inView={inView} />
      </div>
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
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t(v.sub)}</p>
            </motion.div>
          ))}
        </motion.div>

        {/*
          Другий поверх секції: схема вище відповідає на «як влаштовано те, що
          вже працює», граф нижче — на «а що з рештою ринку». Розділювач тут
          свідомий: без нього два SVG підряд читаються як одна каша.
        */}
        <div
          className="mx-auto mt-20 h-px w-24"
          style={{ background: 'var(--border-strong)' }}
          aria-hidden
        />

        <SectionHeading
          eyebrow={t('landing.graph.eyebrow')}
          title={t('landing.graph.title')}
          description={t('landing.graph.lead')}
          accent="info"
          className="mb-10 mt-10"
        />

        <IntegrationGraph />
      </div>
    </section>
  );
}
