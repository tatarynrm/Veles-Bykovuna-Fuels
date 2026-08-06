'use client';

import React from 'react';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

export interface MarqueeProps {
  children: React.ReactNode;
  /** Seconds for one full loop. Higher = slower. */
  speed?: number;
  reverse?: boolean;
  pauseOnHover?: boolean;
  className?: string;
}

/**
 * Edge-masked scrolling strip for low-priority ambient data — current pump
 * prices, station status. Two identical tracks translate by -50% so the loop
 * is seamless; the duplicate is hidden from assistive tech.
 *
 * Under `prefers-reduced-motion` the CSS drops the duplicate track and turns the
 * container into a normal horizontal scroller, so no content becomes unreachable.
 */
export default function Marquee({
  children,
  speed = 44,
  reverse = false,
  pauseOnHover = true,
  className,
}: MarqueeProps) {
  const style = {
    '--marquee-duration': `${speed}s`,
    '--marquee-direction': reverse ? 'reverse' : 'normal',
  } as React.CSSProperties;

  return (
    <div
      className={cn('marquee', pauseOnHover && 'marquee-pause', className)}
      style={style}
    >
      <div className="marquee-track">{children}</div>
      <div className="marquee-track" aria-hidden="true">
        {children}
      </div>
    </div>
  );
}

export interface PriceTickerItem {
  station: string;
  fuel: string;
  price: number;
  /** Change vs the previous reading, in UAH. */
  delta?: number;
}

const priceFmt = new Intl.NumberFormat('uk-UA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Domain wrapper: a pump-price strip built on Marquee.
 * Direction of change is shown by an arrow glyph as well as colour.
 */
export function PriceTicker({ items, speed = 52 }: { items: PriceTickerItem[]; speed?: number }) {
  if (!items.length) {
    return (
      <p className="px-4 py-3 text-2xs text-txt-muted">
        {t('ui.fuelPricesHaveNot')}
      </p>
    );
  }

  return (
    <Marquee speed={speed}>
      {items.map((item, i) => {
        const up = (item.delta ?? 0) > 0;
        const down = (item.delta ?? 0) < 0;
        return (
          <div
            key={`${item.station}-${item.fuel}-${i}`}
            className="flex items-center gap-2.5 whitespace-nowrap px-4 py-2.5"
          >
            <span className="micro-label">{t(item.station)}</span>
            <span className="text-2xs font-medium text-txt-secondary">{t(item.fuel)}</span>
            <span className="stat text-xs">{priceFmt.format(item.price)} ₴</span>
            {item.delta !== undefined && item.delta !== 0 && (
              <span
                className="tabular text-[10px] font-semibold"
                style={{ color: up ? 'var(--danger)' : 'var(--accent)' }}
              >
                {up ? '▲' : down ? '▼' : '•'} {priceFmt.format(Math.abs(item.delta))}
              </span>
            )}
            <span className="ml-1 h-3 w-px bg-bdr-subtle" aria-hidden="true" />
          </div>
        );
      })}
    </Marquee>
  );
}
