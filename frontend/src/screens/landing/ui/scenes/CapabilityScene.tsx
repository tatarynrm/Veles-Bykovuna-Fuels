'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { usePrefersReducedMotion } from '@/shared/lib/usePrefersReducedMotion';
import type { CapabilityId } from '@/shared/config/capabilities';

/*
  Інфографіка для слайдів секції можливостей.

  Колір акценту приходить пропом і ставиться в `color` на кореневому <svg>,
  а діти малюються через `currentColor`. Це не примха: var() чинний лише в
  CSS-властивостях, тож fill="var(--accent)" в атрибуті SVG просто не
  спрацював би. Нейтральні частини беруть змінні через prop `style`, де
  var() працює.

  Анімація йде лише коли слайд активний, і скидається, коли він іде з
  екрана, — інакше на сторінці постійно крутилося б дванадцять сцен.
*/

const VB = { w: 420, h: 320 };
const FONT = 'Manrope, system-ui';

const MUTED = { fill: 'var(--text-muted)' } as const;
const TEXT = { fill: 'var(--text-primary)' } as const;
const INSET = { fill: 'var(--surface-inset)' } as const;
const LINE = { stroke: 'var(--border-subtle)' } as const;

interface SceneProps {
  active: boolean;
  reduced: boolean;
}

/** Спільна обгортка: тримає viewBox, колір і скидання анімації. */
function Stage({
  children, tone, active, reduced,
}: { children: React.ReactNode; tone: string } & SceneProps) {
  return (
    <svg
      viewBox={`0 0 ${VB.w} ${VB.h}`}
      className="h-auto w-full"
      style={{ color: tone, overflow: 'visible' }}
      role="presentation"
    >
      {/*
        key прив'язаний до активності: коли слайд повертається, React монтує
        піддерево наново, і сцена програється з початку, а не лишається
        застиглою в кінцевому стані.
      */}
      <motion.g
        key={active ? 'on' : 'off'}
        initial={reduced ? false : 'hidden'}
        animate={active || reduced ? 'show' : 'hidden'}
      >
        {children}
      </motion.g>
    </svg>
  );
}

const rise = (delay = 0, dur = 0.5): Variants => ({
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { delay, duration: dur, ease: [0.22, 1, 0.36, 1] } },
});

const draw = (delay = 0, dur = 1.1): Variants => ({
  hidden: { pathLength: 0, opacity: 0 },
  show: { pathLength: 1, opacity: 1, transition: { delay, duration: dur, ease: 'easeInOut' } },
});

const pop = (delay = 0): Variants => ({
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: { delay, duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
});

/** Пульсація, що не спиняється, поки слайд активний. */
const breathe = (delay = 0): Variants => ({
  hidden: { opacity: 0 },
  show: {
    opacity: [0.25, 0.75, 0.25],
    transition: { delay, duration: 2.6, repeat: Infinity, ease: 'easeInOut' },
  },
});

/* ── 1. Паливні картки ─────────────────────────────────────────────── */
function FuelCards({ active, reduced }: SceneProps) {
  const rows = [
    { site: 'OKKO · Чернівці', litres: '420 л', sum: '₴23 940' },
    { site: 'Shell · Rzeszów', litres: '310 л', sum: '₴21 700' },
    { site: 'OKKO · Львів', litres: '380 л', sum: '₴21 660' },
  ];
  return (
    <>
      <motion.g variants={rise(0)}>
        <rect x="24" y="26" width="176" height="108" rx="14" style={INSET} />
        <rect x="24" y="26" width="176" height="108" rx="14" fill="none" stroke="currentColor" strokeOpacity="0.4" />
        <rect x="42" y="56" width="26" height="20" rx="4" fill="currentColor" fillOpacity="0.75" />
        {[0, 1, 2, 3].map(i => (
          <motion.rect
            key={i} x={42 + i * 38} y="96" width="26" height="5" rx="2.5"
            style={MUTED} variants={pop(0.25 + i * 0.08)}
          />
        ))}
        <text x="42" y="122" fontSize="9" fontFamily={FONT} style={MUTED}>VELES · ПАЛИВНА КАРТКА</text>
      </motion.g>

      {rows.map((r, i) => (
        <motion.g key={r.site} variants={rise(0.5 + i * 0.22, 0.45)}>
          <rect x="222" y={30 + i * 40} width="176" height="32" rx="8" style={INSET} />
          <rect x="222" y={30 + i * 40} width="176" height="32" rx="8" fill="none" {...LINE} />
          <circle cx="238" cy={46 + i * 40} r="3" fill="currentColor" />
          <text x="250" y={44 + i * 40} fontSize="9" fontFamily={FONT} style={TEXT}>{r.site}</text>
          <text x="250" y={56 + i * 40} fontSize="8" fontFamily={FONT} style={MUTED}>{r.litres}</text>
          <text x="388" y={51 + i * 40} fontSize="10" fontFamily={FONT} textAnchor="end" style={TEXT}>{r.sum}</text>
        </motion.g>
      ))}

      <motion.path
        d="M 200 80 L 222 80" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"
        variants={draw(0.35, 0.5)} fill="none"
      />

      <motion.g variants={rise(1.2, 0.5)}>
        <text x="24" y="176" fontSize="10" fontFamily={FONT} style={MUTED}>ЗА МІСЯЦЬ</text>
        <text x="24" y="208" fontSize="30" fontFamily={FONT} fontWeight="600" style={TEXT}>₴2 841 300</text>
        <text x="24" y="232" fontSize="9" fontFamily={FONT} fill="currentColor">3 291 транзакція · дві мережі</text>
      </motion.g>

      <motion.g variants={rise(1.45, 0.5)}>
        <rect x="24" y="252" width="374" height="44" rx="10" style={INSET} />
        {['OKKO', 'Shell'].map((brand, i) => (
          <g key={brand}>
            <rect
              x={40 + i * 190} y={266} width={i === 0 ? 150 : 120} height="16" rx="8"
              fill="currentColor" fillOpacity={i === 0 ? 0.75 : 0.35}
            />
            <text x={40 + i * 190} y={262} fontSize="8" fontFamily={FONT} style={MUTED}>{brand}</text>
          </g>
        ))}
      </motion.g>
    </>
  );
}

/* ── 2. Аналітика ──────────────────────────────────────────────────── */
function Analytics({ active, reduced }: SceneProps) {
  const bars = [58, 92, 74, 118, 96, 140, 112, 158];
  return (
    <>
      <motion.g variants={rise(0)}>
        <text x="24" y="34" fontSize="10" fontFamily={FONT} style={MUTED}>ВИТРАТИ ПО ТИЖНЯХ</text>
      </motion.g>

      {[0, 1, 2, 3].map(i => (
        <motion.line
          key={i} x1="24" x2="396" y1={80 + i * 44} y2={80 + i * 44}
          {...LINE} variants={draw(0.1 + i * 0.05, 0.6)}
        />
      ))}

      {bars.map((h, i) => (
        <motion.rect
          key={i}
          x={38 + i * 46} width="26" rx="5"
          y={252 - h} height={h}
          fill="currentColor" fillOpacity={0.65}
          variants={{
            hidden: { scaleY: 0, opacity: 0 },
            show: {
              scaleY: 1, opacity: 1,
              transition: { delay: 0.3 + i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
            },
          }}
          style={{ transformOrigin: `0px 252px` }}
        />
      ))}

      <motion.path
        d="M 51 194 L 97 160 L 143 178 L 189 134 L 235 156 L 281 112 L 327 140 L 373 94"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        variants={draw(0.95, 1.2)}
      />
      {bars.map((h, i) => (
        <motion.circle
          key={i} cx={51 + i * 46} cy={252 - h - 4} r="3.5"
          fill="var(--bg-page)" stroke="currentColor" strokeWidth="1.6"
          variants={pop(1.15 + i * 0.06)}
        />
      ))}

      <motion.g variants={rise(1.7, 0.45)}>
        <line x1="24" x2="396" y1="272" y2="272" {...LINE} />
        <text x="24" y="292" fontSize="9" fontFamily={FONT} style={MUTED}>Тиж. 1</text>
        <text x="396" y="292" fontSize="9" fontFamily={FONT} textAnchor="end" fill="currentColor">Тиж. 8</text>
      </motion.g>
    </>
  );
}

/* ── 3. Телематика ─────────────────────────────────────────────────── */
function Telematics({ active, reduced }: SceneProps) {
  const gauges = [
    { label: 'ПАЛЬНЕ', value: '68%', frac: 0.68, cx: 90 },
    { label: 'ОБЕРТИ', value: '1 450', frac: 0.42, cx: 210 },
    { label: 'ОХОЛОДЖ.', value: '84°', frac: 0.72, cx: 330 },
  ];
  const R = 34;
  const CIRC = Math.PI * R; //半 arc

  return (
    <>
      {/* Силует тягача */}
      <motion.g variants={rise(0)}>
        <path
          d="M 40 96 L 40 52 L 128 52 L 148 78 L 196 78 L 196 96 Z"
          style={INSET} stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5"
        />
        <rect x="204" y="40" width="176" height="56" rx="6" style={INSET} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
        {[68, 168, 246, 330].map(cx => (
          <circle key={cx} cx={cx} cy="104" r="11" style={INSET} stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" />
        ))}
        <motion.circle cx="52" cy="62" r="4" fill="currentColor" variants={breathe(0.6)} />
      </motion.g>

      <motion.line x1="24" x2="396" y1="134" y2="134" {...LINE} variants={draw(0.4, 0.6)} />

      {gauges.map((g, i) => (
        <motion.g key={g.label} variants={rise(0.55 + i * 0.15, 0.45)}>
          <path
            d={`M ${g.cx - R} 214 A ${R} ${R} 0 0 1 ${g.cx + R} 214`}
            fill="none" stroke="var(--surface-hover)" strokeWidth="7" strokeLinecap="round"
          />
          <motion.path
            d={`M ${g.cx - R} 214 A ${R} ${R} 0 0 1 ${g.cx + R} 214`}
            fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={CIRC}
            variants={{
              hidden: { strokeDashoffset: CIRC },
              show: {
                strokeDashoffset: CIRC * (1 - g.frac),
                transition: { delay: 0.75 + i * 0.15, duration: 1, ease: [0.22, 1, 0.36, 1] },
              },
            }}
          />
          <text x={g.cx} y="206" fontSize="15" fontFamily={FONT} fontWeight="600" textAnchor="middle" style={TEXT}>
            {g.value}
          </text>
          <text x={g.cx} y="236" fontSize="8" fontFamily={FONT} textAnchor="middle" style={MUTED}>
            {g.label}
          </text>
        </motion.g>
      ))}

      <motion.g variants={rise(1.5, 0.45)}>
        <rect x="24" y="258" width="372" height="40" rx="10" style={INSET} />
        <text x="40" y="274" fontSize="8" fontFamily={FONT} style={MUTED}>МОТОГОДИНИ</text>
        <text x="40" y="290" fontSize="12" fontFamily={FONT} style={TEXT}>18 402 год</text>
        <text x="240" y="274" fontSize="8" fontFamily={FONT} style={MUTED}>ЗАПАЛЮВАННЯ</text>
        <text x="240" y="290" fontSize="12" fontFamily={FONT} fill="currentColor">увімкнено</text>
      </motion.g>
    </>
  );
}

/* ── 4. Живий трек ─────────────────────────────────────────────────── */
const TRACK_PATH =
  'M 40 250 C 96 250 104 176 152 168 C 202 160 214 214 262 206 C 312 198 322 106 380 96';

function LiveTrack({ active, reduced }: SceneProps) {
  return (
    <>
      {[0, 1, 2, 3, 4].map(i => (
        <motion.line key={`v${i}`} x1={40 + i * 85} x2={40 + i * 85} y1="28" y2="292" {...LINE} variants={draw(i * 0.04, 0.5)} />
      ))}
      {[0, 1, 2, 3].map(i => (
        <motion.line key={`h${i}`} x1="24" x2="396" y1={60 + i * 78} y2={60 + i * 78} {...LINE} variants={draw(0.1 + i * 0.04, 0.5)} />
      ))}

      <motion.path d={TRACK_PATH} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="8" strokeLinecap="round" variants={draw(0.3, 1.4)} />
      <motion.path d={TRACK_PATH} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" variants={draw(0.35, 1.4)} />

      {/* Машина йде треком. offset-path — це CSS, тож анімація теж CSS:
          Framer Motion такі властивості не інтерполює. */}
      {active && !reduced && (
        <circle
          r="7" fill="currentColor"
          style={{
            offsetPath: `path("${TRACK_PATH}")`,
            animation: 'flow-dot 4.5s 1.4s linear infinite',
          }}
        />
      )}

      <motion.circle cx="40" cy="250" r="5" fill="var(--bg-page)" stroke="currentColor" strokeWidth="2" variants={pop(0.4)} />
      <motion.circle cx="380" cy="96" r="12" fill="none" stroke="currentColor" variants={breathe(1.5)} />
      <motion.circle cx="380" cy="96" r="5" fill="currentColor" variants={pop(1.5)} />

      <motion.g variants={rise(1.7, 0.45)}>
        <rect x="24" y="256" width="150" height="42" rx="10" style={INSET} />
        <text x="40" y="272" fontSize="8" fontFamily={FONT} style={MUTED}>ІНТЕРВАЛ</text>
        <text x="40" y="289" fontSize="13" fontFamily={FONT} fill="currentColor">3 с</text>
        <rect x="186" y="256" width="210" height="42" rx="10" style={INSET} />
        <text x="202" y="272" fontSize="8" fontFamily={FONT} style={MUTED}>ШВИДКІСТЬ · НАПРЯМОК</text>
        <text x="202" y="289" fontSize="13" fontFamily={FONT} style={TEXT}>74 км/год · Пд-Зх</text>
      </motion.g>
    </>
  );
}

/* ── 5. Рейси ──────────────────────────────────────────────────────── */
function Trips({ active, reduced }: SceneProps) {
  const stops = [
    { x: 60, y: 86, label: 'Чернівці', tag: 'Завантаження' },
    { x: 210, y: 156, label: 'Львів', tag: 'Проміжна' },
    { x: 356, y: 106, label: 'Rzeszów', tag: 'Розвантаження' },
  ];
  return (
    <>
      <motion.path
        d="M 60 86 C 120 86 150 156 210 156 C 270 156 296 106 356 106"
        fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4"
        variants={draw(0.25, 1.3)}
      />
      {stops.map((s, i) => (
        <motion.g key={s.label} variants={pop(0.5 + i * 0.28)}>
          <circle cx={s.x} cy={s.y} r="14" style={INSET} stroke="currentColor" strokeWidth="2" />
          <circle cx={s.x} cy={s.y} r="5" fill="currentColor" />
          <text x={s.x} y={s.y + 34} fontSize="11" fontFamily={FONT} textAnchor="middle" style={TEXT}>{s.label}</text>
          <text x={s.x} y={s.y + 48} fontSize="8" fontFamily={FONT} textAnchor="middle" style={MUTED}>{s.tag}</text>
        </motion.g>
      ))}

      <motion.g variants={rise(1.4, 0.5)}>
        <rect x="24" y="228" width="372" height="70" rx="12" style={INSET} />
        <text x="42" y="252" fontSize="9" fontFamily={FONT} style={MUTED}>РЕЙС</text>
        <text x="42" y="270" fontSize="12" fontFamily={FONT} style={TEXT}>UA-1183 · 22 т</text>
        <text x="42" y="288" fontSize="9" fontFamily={FONT} fill="currentColor">Водій призначений</text>
        <rect x="250" y="246" width="128" height="34" rx="8" fill="currentColor" fillOpacity="0.14" />
        <text x="314" y="267" fontSize="10" fontFamily={FONT} textAnchor="middle" fill="currentColor">У ДОРОЗІ</text>
      </motion.g>
    </>
  );
}

/* ── 6. Єдина модель даних ─────────────────────────────────────────── */
function DataModel({ active, reduced }: SceneProps) {
  const inputs = [
    { y: 44, label: 'OKKO', note: 'копійки · мл' },
    { y: 122, label: 'Shell', note: 'YYYYMMDD' },
    { y: 200, label: 'Ruptela', note: 'CAN-поля' },
  ];
  return (
    <>
      {inputs.map((n, i) => (
        <motion.g key={n.label} variants={rise(i * 0.15, 0.45)}>
          <rect x="20" y={n.y} width="118" height="52" rx={i === 0 ? 12 : i === 1 ? 4 : 26} style={INSET} stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" />
          <text x="79" y={n.y + 24} fontSize="11" fontFamily={FONT} textAnchor="middle" style={TEXT}>{n.label}</text>
          <text x="79" y={n.y + 39} fontSize="8" fontFamily={FONT} textAnchor="middle" style={MUTED}>{n.note}</text>
        </motion.g>
      ))}

      {inputs.map((n, i) => (
        <motion.path
          key={i}
          d={`M 138 ${n.y + 26} C 176 ${n.y + 26} 186 160 214 160`}
          fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.55"
          variants={draw(0.4 + i * 0.12, 0.8)}
        />
      ))}

      <motion.g variants={pop(1.05)}>
        <circle cx="228" cy="160" r="16" style={INSET} stroke="currentColor" strokeWidth="2" />
        <text x="228" y="164" fontSize="10" fontFamily={FONT} textAnchor="middle" fill="currentColor">=</text>
      </motion.g>

      {[0, 1, 2, 3].map(i => (
        <motion.g key={i} variants={rise(1.25 + i * 0.12, 0.4)}>
          <rect x="266" y={96 + i * 44} width="132" height="34" rx="8" style={INSET} stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />
          <circle cx="284" cy={113 + i * 44} r="3.5" fill="currentColor" />
          <rect x="296" y={109 + i * 44} width="56" height="4" rx="2" style={MUTED} />
          <rect x="296" y={117 + i * 44} width="34" height="4" rx="2" style={MUTED} />
        </motion.g>
      ))}

      <motion.text x="332" y="82" fontSize="9" fontFamily={FONT} textAnchor="middle" style={MUTED} variants={rise(1.2, 0.4)}>
        ОДНА СХЕМА
      </motion.text>
    </>
  );
}

/* ── 7. Експорт ────────────────────────────────────────────────────── */
function Export({ active, reduced }: SceneProps) {
  return (
    <>
      <motion.g variants={rise(0)}>
        <rect x="24" y="30" width="176" height="150" rx="12" style={INSET} stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />
        <text x="42" y="52" fontSize="9" fontFamily={FONT} style={MUTED}>ТАБЛИЦЯ НА ЕКРАНІ</text>
        {[0, 1, 2, 3, 4].map(i => (
          <motion.g key={i} variants={rise(0.2 + i * 0.08, 0.35)}>
            <line x1="42" x2="182" y1={70 + i * 22} y2={70 + i * 22} {...LINE} />
            <rect x="42" y={76 + i * 22} width="52" height="5" rx="2.5" style={MUTED} />
            <rect x="132" y={76 + i * 22} width="50" height="5" rx="2.5" fill="currentColor" fillOpacity="0.6" />
          </motion.g>
        ))}
      </motion.g>

      {[
        { x: 236, label: 'XLSX', delay: 0.9 },
        { x: 236, label: 'PDF', delay: 1.15, y: 116 },
      ].map(sheet => (
        <motion.g
          key={sheet.label}
          variants={{
            hidden: { opacity: 0, x: -40, rotate: -6 },
            show: {
              opacity: 1, x: 0, rotate: 0,
              transition: { delay: sheet.delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
            },
          }}
        >
          <rect x={sheet.x} y={sheet.y ?? 34} width="160" height="98" rx="12" style={INSET} stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
          <rect x={sheet.x + 18} y={(sheet.y ?? 34) + 20} width="60" height="18" rx="6" fill="currentColor" fillOpacity="0.18" />
          <text x={sheet.x + 48} y={(sheet.y ?? 34) + 33} fontSize="10" fontFamily={FONT} textAnchor="middle" fill="currentColor">{sheet.label}</text>
          {[0, 1, 2].map(i => (
            <rect key={i} x={sheet.x + 18} y={(sheet.y ?? 34) + 52 + i * 14} width={124 - i * 26} height="5" rx="2.5" style={MUTED} />
          ))}
        </motion.g>
      ))}

      <motion.g variants={rise(1.5, 0.45)}>
        <rect x="24" y="238" width="372" height="58" rx="12" style={INSET} />
        {['Валюта', 'Обʼєм', 'Дата'].map((label, i) => (
          <g key={label}>
            <text x={48 + i * 124} y="262" fontSize="8" fontFamily={FONT} style={MUTED}>{label.toUpperCase()}</text>
            <text x={48 + i * 124} y="280" fontSize="11" fontFamily={FONT} fill="currentColor">
              {['₴ 0,00', '0,0 л', '01.03.26'][i]}
            </text>
          </g>
        ))}
      </motion.g>
    </>
  );
}

/* ── 8. Ролі ───────────────────────────────────────────────────────── */
function Roles({ active, reduced }: SceneProps) {
  const rows = [
    { method: 'GET', path: '/api/transactions', ok: true },
    { method: 'GET', path: '/api/ruptela/trips', ok: true },
    { method: 'POST', path: '/api/ruptela/trips', ok: false },
    { method: 'DELETE', path: '/api/ruptela/trips/1', ok: false },
  ];
  return (
    <>
      <motion.g variants={pop(0)}>
        <path
          d="M 84 34 L 138 54 L 138 106 C 138 140 112 158 84 168 C 56 158 30 140 30 106 L 30 54 Z"
          style={INSET} stroke="currentColor" strokeWidth="2"
        />
        <motion.path
          d="M 60 100 L 76 116 L 110 78"
          fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          variants={draw(0.45, 0.6)}
        />
      </motion.g>
      <motion.text x="84" y="196" fontSize="10" fontFamily={FONT} textAnchor="middle" fill="currentColor" variants={rise(0.6, 0.4)}>
        ГІСТЬ
      </motion.text>
      <motion.text x="84" y="212" fontSize="8" fontFamily={FONT} textAnchor="middle" style={MUTED} variants={rise(0.65, 0.4)}>
        лише читання
      </motion.text>

      {rows.map((r, i) => (
        <motion.g key={r.path} variants={rise(0.5 + i * 0.18, 0.42)}>
          <rect x="170" y={34 + i * 46} width="228" height="36" rx="9" style={INSET} {...LINE} />
          <text x="186" y={51 + i * 46} fontSize="9" fontFamily={FONT} style={r.ok ? { fill: 'var(--accent)' } : { fill: 'var(--danger)' }}>
            {r.method}
          </text>
          <text x="186" y={63 + i * 46} fontSize="8" fontFamily={FONT} style={MUTED}>{r.path}</text>
          <text
            x="382" y={57 + i * 46} fontSize="10" fontFamily={FONT} textAnchor="end"
            style={r.ok ? { fill: 'var(--accent)' } : { fill: 'var(--danger)' }}
          >
            {r.ok ? '200' : '403'}
          </text>
        </motion.g>
      ))}

      <motion.text x="284" y="246" fontSize="9" fontFamily={FONT} textAnchor="middle" style={MUTED} variants={rise(1.3, 0.4)}>
        заборона стоїть на сервері, не в інтерфейсі
      </motion.text>
    </>
  );
}

/* ── 9. Кеш ────────────────────────────────────────────────────────── */
function Cache({ active, reduced }: SceneProps) {
  return (
    <>
      <motion.g variants={rise(0)}>
        <text x="24" y="34" fontSize="9" fontFamily={FONT} style={MUTED}>ПЕРШИЙ КАДР</text>
        <rect x="24" y="46" width="176" height="120" rx="12" style={INSET} {...LINE} />
        {[0, 1, 2, 3].map(i => (
          <motion.rect
            key={i} x="42" y={68 + i * 26} width={140 - i * 22} height="10" rx="5"
            fill="currentColor"
            variants={{
              hidden: { opacity: 0.15 },
              show: {
                opacity: [0.15, 0.5, 0.15],
                transition: { duration: 1.4, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' },
              },
            }}
          />
        ))}
        <text x="112" y="186" fontSize="9" fontFamily={FONT} textAnchor="middle" style={MUTED}>без кешу — скелетон</text>
      </motion.g>

      <motion.g variants={rise(0.5, 0.5)}>
        <text x="220" y="34" fontSize="9" fontFamily={FONT} style={MUTED}>З КЕШЕМ</text>
        <rect x="220" y="46" width="176" height="120" rx="12" style={INSET} stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
        <text x="238" y="76" fontSize="8" fontFamily={FONT} style={MUTED}>ВИТРАТИ</text>
        <text x="238" y="98" fontSize="19" fontFamily={FONT} fontWeight="600" style={TEXT}>₴2.84M</text>
        {[0, 1].map(i => (
          <rect key={i} x="238" y={114 + i * 18} width={128 - i * 40} height="7" rx="3.5" fill="currentColor" fillOpacity={0.5 - i * 0.2} />
        ))}
        <text x="308" y="186" fontSize="9" fontFamily={FONT} textAnchor="middle" fill="currentColor">намальовано одразу</text>
      </motion.g>

      <motion.g variants={rise(1, 0.5)}>
        <rect x="24" y="212" width="372" height="84" rx="12" style={INSET} />
        {[
          { t: '< 30 с', d: 'мережі немає взагалі' },
          { t: '< 12 год', d: 'кеш зараз, свіже у фоні' },
          { t: '> 12 год', d: 'звичайний запит' },
        ].map((s, i) => (
          <g key={s.t}>
            <circle cx={62 + i * 124} cy="240" r="4" fill="currentColor" fillOpacity={1 - i * 0.3} />
            <text x={62 + i * 124} y="266" fontSize="11" fontFamily={FONT} textAnchor="middle" style={TEXT}>{s.t}</text>
            <text x={62 + i * 124} y="282" fontSize="7.5" fontFamily={FONT} textAnchor="middle" style={MUTED}>{s.d}</text>
          </g>
        ))}
      </motion.g>
    </>
  );
}

/* ── 10. Карти ─────────────────────────────────────────────────────── */
function Maps({ active, reduced }: SceneProps) {
  const layers = [
    { y: 176, label: 'Супутник', op: 0.18 },
    { y: 138, label: 'Топографія', op: 0.3 },
    { y: 100, label: 'Вулиці', op: 0.55 },
    { y: 62, label: 'Підписи', op: 0.85 },
  ];
  return (
    <>
      {layers.map((l, i) => (
        <motion.g
          key={l.label}
          variants={{
            hidden: { opacity: 0, y: 24 },
            show: {
              opacity: 1, y: 0,
              transition: { delay: i * 0.16, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
            },
          }}
        >
          <path
            d={`M 96 ${l.y} L 250 ${l.y - 32} L 366 ${l.y + 4} L 212 ${l.y + 36} Z`}
            fill="currentColor" fillOpacity={l.op}
            stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.2"
          />
          <text x="24" y={l.y + 6} fontSize="9" fontFamily={FONT} style={i === 3 ? { fill: 'currentColor' } : MUTED}>
            {l.label}
          </text>
        </motion.g>
      ))}

      <motion.g variants={rise(0.9, 0.5)}>
        <rect x="24" y="236" width="372" height="62" rx="12" style={INSET} />
        {['Прозорість', 'Сірість', 'Яскравість'].map((label, i) => (
          <g key={label}>
            <text x={44 + i * 124} y="258" fontSize="8" fontFamily={FONT} style={MUTED}>{label.toUpperCase()}</text>
            <rect x={44 + i * 124} y="270" width="92" height="5" rx="2.5" fill="var(--surface-hover)" />
            <motion.rect
              x={44 + i * 124} y="270" height="5" rx="2.5" fill="currentColor"
              variants={{
                hidden: { width: 0 },
                show: {
                  width: [58, 74, 40][i],
                  transition: { delay: 1.1 + i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
                },
              }}
            />
          </g>
        ))}
      </motion.g>
    </>
  );
}

/* ── 11. Мови ──────────────────────────────────────────────────────── */
const I18N_WORDS = [
  { code: 'UA', word: 'Паливні картки' },
  { code: 'EN', word: 'Fuel cards' },
  { code: 'PL', word: 'Karty paliwowe' },
  { code: 'DE', word: 'Tankkarten' },
];

function I18nScene({ active, reduced }: SceneProps) {
  return (
    <>
      <motion.text x="24" y="40" fontSize="9" fontFamily={FONT} style={MUTED} variants={rise(0)}>
        ОДИН КЛЮЧ · ЧОТИРИ СЛОВНИКИ
      </motion.text>
      <motion.text x="24" y="66" fontSize="11" fontFamily={FONT} fill="currentColor" variants={rise(0.1)}>
        common.fuelCards
      </motion.text>

      {I18N_WORDS.map((w, i) => (
        <motion.g key={w.code} variants={rise(0.3 + i * 0.16, 0.45)}>
          <rect x="24" y={90 + i * 46} width="372" height="38" rx="10" style={INSET} {...LINE} />
          <rect x="38" y={102 + i * 46} width="30" height="16" rx="5" fill="currentColor" fillOpacity="0.16" />
          <text x="53" y={114 + i * 46} fontSize="9" fontFamily={FONT} textAnchor="middle" fill="currentColor">{w.code}</text>
          <text x="82" y={114 + i * 46} fontSize="12" fontFamily={FONT} style={TEXT}>{w.word}</text>
        </motion.g>
      ))}

      <motion.g variants={rise(1.1, 0.45)}>
        <rect x="24" y="278" width="372" height="1" style={{ fill: 'var(--border-subtle)' }} />
        <text x="24" y="302" fontSize="8.5" fontFamily={FONT} style={MUTED}>
          пропущений переклад показує українську, а не назву ключа
        </text>
      </motion.g>
    </>
  );
}

/* ── 12. Командна палітра ──────────────────────────────────────────── */
const PALETTE_ROWS = ['Транзакції', 'Телематика · флот', 'Тема: темна', 'Тепловий звіт'];

function Palette({ active, reduced }: SceneProps) {
  return (
    <>
      <motion.g variants={rise(0)}>
        <rect x="34" y="42" width="352" height="232" rx="16" style={INSET} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
        <line x1="34" x2="386" y1="94" y2="94" {...LINE} />
        <text x="58" y="76" fontSize="13" fontFamily={FONT} style={TEXT}>те</text>
        <motion.rect
          x="82" y="62" width="2" height="18" fill="currentColor"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: [1, 0, 1], transition: { duration: 1.1, repeat: Infinity } },
          }}
        />
        <rect x="330" y="60" width="40" height="20" rx="6" fill="currentColor" fillOpacity="0.14" />
        <text x="350" y="74" fontSize="9" fontFamily={FONT} textAnchor="middle" fill="currentColor">⌘K</text>
      </motion.g>

      {PALETTE_ROWS.map((row, i) => (
        <motion.g
          key={row}
          variants={{
            hidden: { opacity: 0, x: -16 },
            show: {
              opacity: 1, x: 0,
              transition: { delay: 0.45 + i * 0.16, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
            },
          }}
        >
          {i === 0 && <rect x="46" y={106 + i * 40} width="328" height="34" rx="9" fill="currentColor" fillOpacity="0.12" />}
          <circle cx="68" cy={123 + i * 40} r="3.5" fill="currentColor" fillOpacity={i === 0 ? 1 : 0.45} />
          <text x="84" y={127 + i * 40} fontSize="11" fontFamily={FONT} style={i === 0 ? { fill: 'var(--text-primary)' } : MUTED}>
            {row}
          </text>
        </motion.g>
      ))}

      <motion.text x="210" y="300" fontSize="8.5" fontFamily={FONT} textAnchor="middle" style={MUTED} variants={rise(1.2, 0.4)}>
        до відкриття не малює нічого
      </motion.text>
    </>
  );
}

/* ── Диспетчер ─────────────────────────────────────────────────────── */
const SCENES: Record<CapabilityId, React.ComponentType<SceneProps>> = {
  'fuel-cards': FuelCards,
  analytics: Analytics,
  telematics: Telematics,
  'live-track': LiveTrack,
  trips: Trips,
  'data-model': DataModel,
  export: Export,
  roles: Roles,
  cache: Cache,
  maps: Maps,
  i18n: I18nScene,
  palette: Palette,
};

export default function CapabilityScene({
  id, active, tone,
}: {
  id: CapabilityId;
  active: boolean;
  tone: string;
}) {
  const reduced = usePrefersReducedMotion();
  const Scene = SCENES[id];

  return (
    <Stage tone={tone} active={active} reduced={reduced}>
      <Scene active={active} reduced={reduced} />
    </Stage>
  );
}
