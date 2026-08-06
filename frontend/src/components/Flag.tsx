import React from 'react';

/**
 * Прапорці країн інлайновим SVG.
 *
 * Емодзі тут не використовуються принципово: Windows не має гліфів для
 * регіональних індикаторів і показує 🇺🇦 як літери «UA» — поруч із кодом мови
 * кнопка перетворювалась на «UA UA». SVG виглядає однаково у всіх системах
 * і на будь-якому шрифті.
 *
 * Малюнки навмисно спрощені: у розмірі 20×14 деталі гербів усе одно
 * перетворюються на кашу, тому лишились тільки смуги й основні фігури —
 * прапор має читатися як мітка, а не як ілюстрація.
 */

interface FlagProps {
  /** Код країни ISO 3166-1 alpha-2. */
  region: string;
  className?: string;
  /** Ширина в пікселях; висота рахується за пропорцією 10:7. */
  size?: number;
}

/** Горизонтальні смуги однакової висоти — найпоширеніший випадок. */
function Horizontal({ colors }: { colors: string[] }) {
  const h = 14 / colors.length;
  return (
    <>
      {colors.map((c, i) => (
        <rect key={i} x="0" y={i * h} width="20" height={h} fill={c} />
      ))}
    </>
  );
}

/** Вертикальний триколор. */
function Vertical({ colors }: { colors: string[] }) {
  const w = 20 / colors.length;
  return (
    <>
      {colors.map((c, i) => (
        <rect key={i} x={i * w} y="0" width={w} height="14" fill={c} />
      ))}
    </>
  );
}

const FLAGS: Record<string, React.ReactNode> = {
  UA: <Horizontal colors={['#005BBB', '#FFD500']} />,
  PL: <Horizontal colors={['#FFFFFF', '#DC143C']} />,
  DE: <Horizontal colors={['#000000', '#DD0000', '#FFCE00']} />,
  RO: <Vertical colors={['#002B7F', '#FCD116', '#CE1126']} />,
  FR: <Vertical colors={['#002395', '#FFFFFF', '#ED2939']} />,
  HU: <Horizontal colors={['#CE2939', '#FFFFFF', '#477050']} />,

  // Прапор Великої Британії — спрощений «Юніон Джек»: діагоналі й хрест.
  GB: (
    <>
      <rect width="20" height="14" fill="#012169" />
      <path d="M0 0 L20 14 M20 0 L0 14" stroke="#FFFFFF" strokeWidth="2.8" />
      <path d="M0 0 L20 14 M20 0 L0 14" stroke="#C8102E" strokeWidth="1.4" />
      <path d="M10 0 V14 M0 7 H20" stroke="#FFFFFF" strokeWidth="4.6" />
      <path d="M10 0 V14 M0 7 H20" stroke="#C8102E" strokeWidth="2.6" />
    </>
  ),

  // Чехія і Словаччина — дві білі/сині/червоні смуги з клином біля древка.
  CZ: (
    <>
      <rect width="20" height="7" fill="#FFFFFF" />
      <rect y="7" width="20" height="7" fill="#D7141A" />
      <path d="M0 0 L9 7 L0 14 Z" fill="#11457E" />
    </>
  ),
  SK: (
    <>
      <Horizontal colors={['#FFFFFF', '#0B4EA2', '#EE1C25']} />
      {/* Спрощений щит: у цьому розмірі подвійний хрест не читається. */}
      <path d="M4 4 H9 V8.5 Q6.5 11 4 8.5 Z" fill="#EE1C25" stroke="#FFFFFF" strokeWidth="0.7" />
    </>
  ),

  ES: (
    <>
      <rect width="20" height="14" fill="#AA151B" />
      <rect y="3.5" width="20" height="7" fill="#F1BF00" />
    </>
  ),
};

export default function Flag({ region, className = '', size = 20 }: FlagProps) {
  const art = FLAGS[region.toUpperCase()];
  const height = Math.round((size * 14) / 20);

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 20 14"
      className={`flex-none rounded-[2px] ${className}`}
      // Тонка рамка потрібна білим прапорам: без неї Чехія і Франція
      // зливаються зі світлою темою.
      style={{ boxShadow: '0 0 0 1px rgb(0 0 0 / 0.12)' }}
      role="presentation"
      aria-hidden
    >
      {art ?? <rect width="20" height="14" fill="var(--surface-hover)" />}
    </svg>
  );
}
