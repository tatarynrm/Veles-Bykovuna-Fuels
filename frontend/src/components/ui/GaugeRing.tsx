'use client';

import React from 'react';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';
import NumberTicker from './NumberTicker';

export type GaugeTone = 'accent' | 'warn' | 'danger' | 'info' | 'auto';

export interface GaugeRingProps {
  value: number;
  max?: number;
  /** Outer diameter in px. */
  size?: number;
  thickness?: number;
  /** `auto` derives the colour from how full the ring is. */
  tone?: GaugeTone;
  /** Uppercase caption under the value. */
  label?: string;
  unit?: string;
  decimals?: number;
  className?: string;
}

const toneVar: Record<Exclude<GaugeTone, 'auto'>, string> = {
  accent: 'var(--accent)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  info: 'var(--info)',
};

function resolveTone(tone: GaugeTone, pct: number): Exclude<GaugeTone, 'auto'> {
  if (tone !== 'auto') return tone;
  if (pct < 20) return 'danger';
  if (pct < 45) return 'warn';
  return 'accent';
}

/**
 * Radial progress for a single bounded quantity — tank level, fleet readiness,
 * quota used. Colour never carries the meaning alone: the numeric value and the
 * caption both state it.
 */
export default function GaugeRing({
  value,
  max = 100,
  size = 132,
  thickness = 9,
  tone = 'auto',
  label,
  unit = '%',
  decimals = 0,
  className,
}: GaugeRingProps) {
  const safeMax = max || 1;
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
  const color = toneVar[resolveTone(tone, pct)];

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        (label ? `${label}: ` : '') +
        t('ui.gaugeValueOfMax', {
          value: value.toFixed(decimals),
          unit,
          max,
        })
      }
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-hover)"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.3s',
            filter: `drop-shadow(0 0 6px color-mix(in srgb, ${color} 40%, transparent))`,
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <p className="stat text-xl leading-none">
          <NumberTicker value={value} decimals={decimals} />
          <span className="ml-0.5 text-xs font-medium text-txt-muted">{unit}</span>
        </p>
        {label && <p className="micro-label mt-1 max-w-[80%] truncate text-center">{label}</p>}
      </div>
    </div>
  );
}
