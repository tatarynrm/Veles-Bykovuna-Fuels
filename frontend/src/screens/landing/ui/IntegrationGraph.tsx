'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import {
  INTEGRATIONS,
  CATEGORY_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  type Integration,
} from '@/shared/config/integrations';
import { EASE_ENTER } from '@/shared/lib/motion';
import { plural, t } from '@/lib/i18n';

/**
 * Граф інтеграцій — «сховище звʼязків» у дусі graph view з Obsidian.
 *
 * Навіщо саме граф. Список інтеграцій уже є на /integrations і читається як
 * таблиця: рівні рядки, однакова вага. Але продуктова теза інша — підключених
 * вендорів троє, а решта каталогу вже описана й чекає адаптера. Це відношення
 * «ядро — гілки — те, що ще не прокладено» таблицею не показати, а графом —
 * видно з одного погляду: три яскраві лінії з пакетами даних і хмара
 * пунктирних, які ще мовчать.
 *
 * Три речі, на яких тримається впізнаваний вигляд Obsidian:
 *   • вузол = коло + підпис ПІД ним, а не всередині;
 *   • звʼязки тонкі й майже прозорі, поки нічого не вибрано;
 *   • наведення гасить усе, крім вузла та його сусідів, — саме цей контраст
 *     і читається як «граф», а не як інфографіка.
 *
 * Дані беруться з `shared/config/integrations.ts`, а не дублюються тут:
 * лічильник у підписі й статуси вузлів так не розʼїжджаються з каталогом.
 * У ORBIT лежать лише назви; якщо запис зникне з каталогу, вузол просто не
 * намалюється (див. `filter` нижче), а не впаде.
 *
 * Розкладка навмисно статична. Силовий алгоритм щокадру рахував би позиції
 * на головному потоці заради ефекту, який тут не потрібен: граф маленький і
 * не змінюється. «Життя» дають рухомі пакети даних на живих звʼязках —
 * той самий приймач `flow-dot`, що й на схемі вище, тож і на reduced-motion
 * вони глушаться тим самим правилом у globals.css.
 *
 * Розкладок дві — панорамна для широких екранів і вертикальна для телефона.
 * Координати вузлів лежать у WIDE_LAYOUT / NARROW_LAYOUT, а не в самих
 * записах: один список вузлів, дві геометрії.
 */

/** Підключені вендори. `sub` — КЛЮЧ i18n, t() стоїть у місці рендеру. */
const HUBS = [
  { id: 'okko',    name: 'OKKO',    sub: 'landing.nodeOkkoSub',    tone: 'var(--accent)' },
  { id: 'shell',   name: 'Shell',   sub: 'landing.nodeShellSub',   tone: 'var(--warn)' },
  { id: 'ruptela', name: 'Ruptela', sub: 'landing.nodeRuptelaSub', tone: 'var(--info)' },
] as const;

type HubId = (typeof HUBS)[number]['id'] | 'core';

/**
 * Кандидати з каталогу, розкидані навколо «свого» хаба.
 *
 * `short` — окремий короткий підпис: у графі текст не переноситься, і повне
 * «Ruptela Routing & Tasking» або «ПриватБанк «Автоклієнт»» налазить на сусідів.
 * Обидва поля — власні назви вендорів, вони однакові в усіх мовах; `name` ще й
 * є ключем пошуку в каталозі та в розкладках, тож переклад його розірвав би.
 * i18n-ignore-props: name, short
 */
const ORBIT: { name: string; short: string; hub: HubId }[] = [
  // Паливо — навколо OKKO
  { name: 'WOG',                     short: 'WOG',        hub: 'okko' },
  { name: 'Укрнафта',                short: 'Укрнафта',   hub: 'okko' },
  { name: 'SOCAR sCard',             short: 'SOCAR',      hub: 'okko' },
  { name: 'AMIC Energy',             short: 'AMIC',       hub: 'okko' },
  { name: 'UPG',                     short: 'UPG',        hub: 'okko' },
  // Телематика й датчики — навколо Ruptela
  { name: 'flespi',                  short: 'flespi',     hub: 'ruptela' },
  { name: 'Wialon (Gurtam)',         short: 'Wialon',     hub: 'ruptela' },
  { name: 'Technoton DUT-E / DFM',   short: 'Technoton',  hub: 'ruptela' },
  { name: 'Omnicomm LLS / Escort',   short: 'Omnicomm',   hub: 'ruptela' },
  // Гроші й документи — навколо Shell
  { name: 'monobank Corporate',      short: 'monobank',   hub: 'shell' },
  { name: 'ПриватБанк «Автоклієнт»', short: 'ПриватБанк', hub: 'shell' },
  { name: 'Вчасно (ЕДО)',            short: 'Вчасно',     hub: 'shell' },
  { name: 'BAS ERP / 1С (OData)',    short: 'BAS ERP',    hub: 'shell' },
  // Те, що вішається просто на ядро
  { name: 'HERE Routing v8',         short: 'HERE',       hub: 'core' },
  { name: 'Power BI',                short: 'Power BI',   hub: 'core' },
  { name: 'Telegram Bot API',        short: 'Telegram',   hub: 'core' },
];

interface XY { x: number; y: number }

/** Геометрія графа: одна на широкий екран, одна на телефон. */
interface GraphLayout {
  viewBox: string;
  core: XY & { r: number };
  /** Радіуси декоративних орбіт-підказок. */
  rings: [number, number];
  hubs: Record<Exclude<HubId, 'core'>, XY>;
  /** Позиції вузлів-кандидатів за `name`. Немає позиції — вузол не малюється. */
  orbit: Record<string, XY>;
}

/** Панорамна розкладка (від `sm`): ядро в центрі, хмара навколо. */
const WIDE_LAYOUT: GraphLayout = {
  viewBox: '0 0 760 480',
  core: { x: 380, y: 240, r: 34 },
  rings: [128, 232],
  hubs: {
    okko:    { x: 278, y: 181 },
    shell:   { x: 482, y: 181 },
    ruptela: { x: 380, y: 358 },
  },
  orbit: {
    'WOG':                     { x: 94,  y: 338 },
    'Укрнафта':                { x: 55,  y: 274 },
    'SOCAR sCard':             { x: 57,  y: 199 },
    'AMIC Energy':             { x: 106, y: 131 },
    'UPG':                     { x: 196, y: 78 },
    'flespi':                  { x: 504, y: 421 },
    'Wialon (Gurtam)':         { x: 392, y: 435 },
    'Technoton DUT-E / DFM':   { x: 267, y: 423 },
    'Omnicomm LLS / Escort':   { x: 177, y: 394 },
    'monobank Corporate':      { x: 545, y: 71 },
    'ПриватБанк «Автоклієнт»': { x: 640, y: 120 },
    'Вчасно (ЕДО)':            { x: 697, y: 186 },
    'BAS ERP / 1С (OData)':    { x: 708, y: 260 },
    'HERE Routing v8':         { x: 671, y: 331 },
    'Power BI':                { x: 256, y: 59 },
    'Telegram Bot API':        { x: 368, y: 45 },
  },
};

/**
 * Вертикальна розкладка для телефона: вища й вужча, вузли розставлені заново
 * по краях, щоб підписи не злипалися. viewBox 420 на ширині ~360–430px дає
 * масштаб близький до 1:1 — шрифти ті самі, що й у панорамній версії.
 */
const NARROW_LAYOUT: GraphLayout = {
  viewBox: '0 0 420 620',
  core: { x: 210, y: 306, r: 30 },
  rings: [108, 200],
  hubs: {
    okko:    { x: 118, y: 192 },
    shell:   { x: 302, y: 192 },
    ruptela: { x: 210, y: 452 },
  },
  orbit: {
    'UPG':                     { x: 62,  y: 74 },
    'AMIC Energy':             { x: 36,  y: 148 },
    'SOCAR sCard':             { x: 30,  y: 224 },
    'Укрнафта':                { x: 36,  y: 300 },
    'WOG':                     { x: 64,  y: 372 },
    'Omnicomm LLS / Escort':   { x: 76,  y: 470 },
    'Technoton DUT-E / DFM':   { x: 142, y: 540 },
    'Wialon (Gurtam)':         { x: 240, y: 552 },
    'flespi':                  { x: 330, y: 514 },
    'monobank Corporate':      { x: 284, y: 44 },
    'ПриватБанк «Автоклієнт»': { x: 360, y: 74 },
    'Вчасно (ЕДО)':            { x: 388, y: 150 },
    'BAS ERP / 1С (OData)':    { x: 392, y: 226 },
    'HERE Routing v8':         { x: 382, y: 300 },
    'Power BI':                { x: 136, y: 44 },
    'Telegram Bot API':        { x: 210, y: 28 },
  },
};

const CATALOGUE = new Map(INTEGRATIONS.map(i => [i.name, i]));

interface OrbitNode {
  name: string;
  short: string;
  hub: HubId;
  meta: Integration;
}

/** Опис вузла в рядку під графом — те, що в Obsidian показує прев'ю. */
interface Detail {
  title: string;
  meta: string;
  note: string;
  tone: string;
}

interface NodeInteractionProps {
  tabIndex: number;
  role: 'button';
  'aria-label': string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

export default function IntegrationGraph() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15%' });
  const [active, setActive] = useState<string | null>(null);

  const orbit = useMemo<OrbitNode[]>(
    () =>
      ORBIT.map(o => ({ ...o, meta: CATALOGUE.get(o.name)! })).filter(o => o.meta),
    [],
  );

  /** Сусіди активного вузла — усе інше гасне. */
  const lit = useMemo(() => {
    if (!active) return null;
    if (active === 'core') return new Set<string>(['core', ...HUBS.map(h => h.id)]);
    const hub = HUBS.find(h => h.id === active);
    if (hub) {
      return new Set<string>([
        'core',
        hub.id,
        ...orbit.filter(o => o.hub === hub.id).map(o => o.name),
      ]);
    }
    const node = orbit.find(o => o.name === active);
    return node ? new Set<string>([node.name, node.hub]) : null;
  }, [active, orbit]);

  const dim = (id: string) => (lit && !lit.has(id) ? 0.12 : 1);
  const linkDim = (a: string, b: string) =>
    lit && !(lit.has(a) && lit.has(b)) ? 0.08 : 1;

  const detail = useMemo<Detail | null>(() => {
    if (!active) return null;
    if (active === 'core') {
      return {
        title: 'VELES ERP',
        meta: t('landing.graph.core'),
        note: t('landing.graph.coreNote'),
        tone: 'var(--accent)',
      };
    }
    const hub = HUBS.find(h => h.id === active);
    if (hub) {
      return {
        title: hub.name,
        meta: t(hub.sub),
        note: t('landing.graph.liveLink'),
        tone: hub.tone,
      };
    }
    const node = orbit.find(o => o.name === active);
    if (!node) return null;
    return {
      title: node.name,
      meta: `${CATEGORY_LABEL[node.meta.category]} · ${STATUS_LABEL[node.meta.status]}`,
      note: t(node.meta.what),
      tone: STATUS_TONE[node.meta.status],
    };
  }, [active, orbit]);

  /** Кожен вузол — і мишею, і з клавіатури: граф не має бути тільки для курсора. */
  const nodeProps = (id: string, label: string): NodeInteractionProps => ({
    tabIndex: 0,
    role: 'button',
    'aria-label': label,
    onMouseEnter: () => setActive(id),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(id),
    onBlur: () => setActive(null),
  });

  const graphProps = { orbit, active, inView, dim, linkDim, nodeProps };

  return (
    <div ref={ref}>
      {/*
        Дві розкладки замість горизонтального скролу: панорамний viewBox 760
        на ширині телефона зменшував підписи до ~4px, а прокрутка вбік ховала
        дві третини графа. Обидві версії в DOM, перемикає їх CSS-брейкпоінт —
        без вимірювання вікна, отже без стрибка розкладки після гідрації;
        схована (`display: none`) не фокусується і не озвучується читалками.
      */}
      <div
        className="glass-inset relative overflow-hidden rounded-2xl px-2 py-4 sm:px-6"
        data-integration-graph
      >
        {/* Віньєтка: у graph view вузли на краях мають танути, а не обриватись. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 48%, transparent 45%, rgb(var(--accent-rgb) / 0.05) 62%, transparent 78%)',
          }}
        />

        <div className="relative sm:hidden">
          <GraphSvg layout={NARROW_LAYOUT} {...graphProps} />
        </div>
        <div className="relative hidden sm:block">
          <GraphSvg layout={WIDE_LAYOUT} {...graphProps} />
        </div>
      </div>

      {/*
        Рядок опису має фіксовану висоту: без неї сторінка сіпається щоразу,
        коли курсор проходить над вузлом.
      */}
      <div className="mt-4 flex min-h-[64px] items-start justify-between gap-4 px-1">
        {detail ? (
          <div>
            <p className="text-sm font-semibold" style={{ color: detail.tone }}>
              {detail.title}
            </p>
            <p className="micro-label mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {detail.meta}
            </p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {detail.note}
            </p>
          </div>
        ) : (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {t('landing.graph.hint')}
          </p>
        )}

        <Link
          href="/integrations"
          className="btn btn-ghost shrink-0 text-xs"
        >
          {plural(INTEGRATIONS.length, {
            one: 'landing.graph.ctaOne',
            few: 'landing.graph.ctaFew',
            many: 'landing.graph.ctaMany',
            other: 'landing.graph.ctaOther',
          })}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Легенда — ті самі підписи статусів, що й у каталозі на /integrations. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
        <span className="micro-label" style={{ color: 'var(--text-muted)' }}>
          {t('landing.graph.legendTitle')}
        </span>
        {(['live', 'available', 'partner', 'unclear'] as const).map(s => (
          <span key={s} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: STATUS_TONE[s], opacity: s === 'live' ? 1 : 0.55 }}
            />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Сам SVG: уся геометрія береться з `layout`, стан підсвітки — спільний з
 * батьком, тож обидві розкладки поводяться однаково.
 */
function GraphSvg({
  layout, orbit, active, inView, dim, linkDim, nodeProps,
}: {
  layout: GraphLayout;
  orbit: OrbitNode[];
  active: string | null;
  inView: boolean;
  dim: (id: string) => number;
  linkDim: (a: string, b: string) => number;
  nodeProps: (id: string, label: string) => NodeInteractionProps;
}) {
  const posOf = (id: HubId): XY => (id === 'core' ? layout.core : layout.hubs[id]);
  const core = layout.core;

  return (
    <svg viewBox={layout.viewBox} className="relative h-auto w-full select-none">
      <title>{t('landing.graph.svgTitle')}</title>

      {/* Орбіти-підказки: ледь помітні, лише щоб око зчитало «шари». */}
      {layout.rings.map(r => (
        <circle
          key={r}
          cx={core.x}
          cy={core.y}
          r={r}
          fill="none"
          style={{ stroke: 'var(--border-subtle)' }}
          strokeWidth="1"
        />
      ))}

      {/*
        Пунктирні звʼязки: описані, але ще не прокладені.

        Тут анімується лише прозорість. `pathLength` у Framer реалізовано
        через strokeDasharray/DashOffset — воно перетерло б сам пунктир,
        заради якого ці лінії й малюються інакше, ніж живі.
      */}
      {orbit.map((o, i) => {
        const p = layout.orbit[o.name];
        if (!p) return null;
        const h = posOf(o.hub);
        return (
          <motion.line
            key={`link-${o.name}`}
            x1={p.x} y1={p.y} x2={h.x} y2={h.y}
            strokeWidth="1"
            strokeDasharray="3 5"
            style={{ stroke: STATUS_TONE[o.meta.status] }}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 0.3 * linkDim(o.name, o.hub) } : {}}
            transition={{ duration: 0.7, delay: 0.5 + i * 0.04, ease: 'easeInOut' }}
          />
        );
      })}

      {/* ── Живі звʼязки: суцільні, з пакетом даних, що біжить у ядро ── */}
      {HUBS.map((h, i) => {
        const hp = layout.hubs[h.id];
        const d = `M ${hp.x} ${hp.y} L ${core.x} ${core.y}`;
        return (
          <g key={`live-${h.id}`}>
            <motion.path
              d={d}
              fill="none"
              strokeWidth="1.75"
              style={{ stroke: h.tone }}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={inView ? { pathLength: 1, opacity: 0.6 * linkDim(h.id, 'core') } : {}}
              transition={{ duration: 1, delay: 0.2 + i * 0.12, ease: 'easeInOut' }}
            />
            {inView && (
              <circle
                r="3.5"
                style={{
                  fill: h.tone,
                  offsetPath: `path("${d}")`,
                  animation: `flow-dot 2.6s ${1.1 + i * 0.5}s linear infinite`,
                  opacity: linkDim(h.id, 'core'),
                }}
              />
            )}
          </g>
        );
      })}

      {/* ── Вузли-кандидати ── */}
      {orbit.map((o, i) => {
        const p = layout.orbit[o.name];
        if (!p) return null;
        const tone = STATUS_TONE[o.meta.status];
        const r = o.meta.status === 'available' ? 8 : o.meta.status === 'partner' ? 7 : 6;
        return (
          <motion.g
            key={o.name}
            {...nodeProps(o.name, `${o.name} — ${STATUS_LABEL[o.meta.status]}`)}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={inView ? { opacity: dim(o.name), scale: 1 } : {}}
            transition={{ duration: 0.45, delay: 0.5 + i * 0.04, ease: EASE_ENTER }}
            style={{ cursor: 'pointer', transformOrigin: `${p.x}px ${p.y}px` }}
          >
            {/* Прозорий диск під вузлом: інакше в нього важко потрапити мишею. */}
            <circle cx={p.x} cy={p.y} r={20} fill="transparent" />
            <circle
              cx={p.x} cy={p.y} r={r}
              style={{ fill: tone, fillOpacity: active === o.name ? 0.95 : 0.55, stroke: tone }}
              strokeWidth="1.25"
            />
            <text
              x={p.x} y={p.y + r + 13}
              textAnchor="middle" fontSize="9.5"
              style={{ fill: active === o.name ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              {o.short}
            </text>
          </motion.g>
        );
      })}

      {/* ── Підключені вендори ── */}
      {HUBS.map((h, i) => {
        const hp = layout.hubs[h.id];
        return (
          <motion.g
            key={h.id}
            {...nodeProps(h.id, `${h.name} — ${STATUS_LABEL.live}`)}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={inView ? { opacity: dim(h.id), scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.25 + i * 0.1, ease: EASE_ENTER }}
            style={{ cursor: 'pointer', transformOrigin: `${hp.x}px ${hp.y}px` }}
          >
            <circle cx={hp.x} cy={hp.y} r={26} fill="transparent" />
            <circle
              cx={hp.x} cy={hp.y} r="15"
              style={{ fill: h.tone, fillOpacity: 0.18, stroke: h.tone }}
              strokeWidth="1.75"
            />
            <circle cx={hp.x} cy={hp.y} r="5" style={{ fill: h.tone }} />
            <text
              x={hp.x} y={hp.y + 31}
              textAnchor="middle" fontSize="12" fontWeight="600"
              style={{ fill: 'var(--text-primary)' }}
            >
              {h.name}
            </text>
          </motion.g>
        );
      })}

      {/* ── Ядро ── */}
      <motion.g
        {...nodeProps('core', `VELES ERP — ${t('landing.graph.core')}`)}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={inView ? { opacity: dim('core'), scale: 1 } : {}}
        transition={{ duration: 0.6, delay: 0.1, ease: EASE_ENTER }}
        style={{ cursor: 'pointer', transformOrigin: `${core.x}px ${core.y}px` }}
      >
        {inView && (
          <motion.circle
            cx={core.x} cy={core.y} r={core.r + 12}
            fill="none" strokeWidth="1"
            style={{ stroke: 'var(--accent)', transformOrigin: `${core.x}px ${core.y}px` }}
            animate={{ opacity: [0.1, 0.32, 0.1], scale: [0.92, 1.06, 0.92] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <circle
          cx={core.x} cy={core.y} r={core.r}
          style={{ fill: 'var(--surface-inset)', stroke: 'var(--accent)' }}
          strokeOpacity="0.5" strokeWidth="1.75"
        />
        <text
          x={core.x} y={core.y - 1}
          textAnchor="middle" fontSize="13" fontWeight="700"
          className="font-display"
          style={{ fill: 'var(--text-primary)' }}
        >
          VELES
        </text>
        <text
          x={core.x} y={core.y + 13}
          textAnchor="middle" fontSize="8.5"
          style={{ fill: 'var(--accent)' }}
        >
          ERP
        </text>
      </motion.g>
    </svg>
  );
}
