'use client';

import React from 'react';

/**
 * Єдиний логотип застосунку: шеврон-«V» із протектора + напис
 * «VELES ERP / VELES BUKOVYNA FUELS». Один компонент на всі місця — бічну
 * панель, екран входу і заставку після входу, — щоб бренд усюди виглядав
 * однаково.
 *
 * Напис зроблено звичайним HTML, а не <text> усередині SVG. Так було раніше, і
 * саме через це на заставці читалось «ELES BUKOVYN»: рядок при letter-spacing
 * не вміщався у viewBox шириною 220 і обрізався з обох боків. HTML-текст
 * переносить цю відповідальність на верстку, заразом даючи той самий шрифт, що
 * й решта інтерфейсу, і кольори з токенів теми.
 *
 * Кольори — тільки токени (`text-accent`, `text-txt-primary`, `text-txt-muted`)
 * і `currentColor` у самому знаку. Жорсткий `#ECF1F8`, який тут стояв, робив
 * назву майже невидимою на світлій темі.
 */

type LogoLayout = 'stacked' | 'inline';

interface VelesLogoProps {
  /** Ширина знака в px (для `stacked` — ширина всього блоку). */
  size?: number;
  /** `stacked` — знак над написом (вхід, заставка); `inline` — знак ліворуч (панель). */
  layout?: LogoLayout;
  /** Лише знак, без напису — для згорнутої бічної рейки. */
  markOnly?: boolean;
  className?: string;
}

/** Шеврон із поперечками протектора. Малюється поточним кольором тексту. */
function Mark({ width }: { width: number }) {
  return (
    <svg
      width={width}
      height={Math.round(width * 0.72)}
      viewBox="0 0 220 158"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="text-accent"
    >
      <defs>
        <radialGradient id="veles-glow" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <filter id="veles-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="110" cy="68" rx="90" ry="70" fill="url(#veles-glow)" />

      {/* Розмите свічення під знаком і чіткий контур поверх нього */}
      <path
        d="M18 12 L85 138 L110 98 L135 138 L202 12"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
        filter="url(#veles-soft)"
      />
      <path
        d="M18 12 L85 138 L110 98 L135 138 L202 12"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Поперечки протектора */}
      {[
        [28, 30, 50],
        [39, 52, 62],
        [52, 76, 74],
        [63, 98, 83],
      ].map(([x1, y, x2]) => (
        <line
          key={`l-${y}`}
          x1={x1}
          y1={y}
          x2={x2}
          y2={y}
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.45"
        />
      ))}
      {[
        [137, 98, 157],
        [148, 76, 168],
        [159, 52, 181],
        [170, 30, 192],
      ].map(([x1, y, x2]) => (
        <line
          key={`r-${y}`}
          x1={x1}
          y1={y}
          x2={x2}
          y2={y}
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.45"
        />
      ))}

      <line
        x1="18"
        y1="150"
        x2="202"
        y2="150"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

/**
 * Напис. Обидва рядки — великими літерами; назва компанії ніколи не
 * скорочується, бо саме її обрізав старий SVG-варіант.
 */
function Wordmark({ layout }: { layout: LogoLayout }) {
  const stacked = layout === 'stacked';
  return (
    <div className={stacked ? 'text-center' : 'min-w-0 text-left leading-tight'}>
      <p
        className={`font-semibold uppercase tracking-tight text-txt-primary ${
          stacked ? 'text-lg tracking-[0.08em]' : 'text-sm'
        }`}
      >
        VELES <span className="text-accent">ERP</span>
      </p>
      {/* nowrap + дрібніший кегль: у бічній рейці на назву лишається ~140 px,
          і при більшому розмірі вона розповзалась на два рядки. */}
      <p
        className={`font-medium uppercase text-txt-muted ${
          stacked
            ? 'mt-1 text-2xs tracking-[0.24em]'
            : 'whitespace-nowrap text-[9px] leading-[1.35] tracking-[0.06em]'
        }`}
      >
        VELES BUKOVYNA FUELS
      </p>
    </div>
  );
}

export default function VelesLogo({
  size = 200,
  layout = 'stacked',
  markOnly = false,
  className = '',
}: VelesLogoProps) {
  if (markOnly) {
    return (
      <span className={`inline-flex items-center justify-center ${className}`}>
        <Mark width={size} />
      </span>
    );
  }

  if (layout === 'inline') {
    return (
      <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
        <Mark width={size} />
        <Wordmark layout="inline" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex flex-col items-center ${className}`}
      style={{ width: size }}
    >
      <Mark width={size} />
      <span className="mt-3 block w-full">
        <Wordmark layout="stacked" />
      </span>
    </span>
  );
}
