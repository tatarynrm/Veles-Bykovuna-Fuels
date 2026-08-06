'use client';

import React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import NumberTicker from './NumberTicker';
import Sparkline, { type SparkTone } from './Sparkline';
import { t } from '@/lib/i18n';

export interface MetricTileProps {
  label: string;
  value: number;
  /** Trailing unit rendered smaller than the value — "л", "₴", "%". */
  unit?: string;
  decimals?: number;
  /** Overrides the default grouping formatter (e.g. formatCurrency). */
  format?: (value: number) => string;
  /** Period-over-period change in percent. Sign drives the badge. */
  delta?: number;
  /** True when a rise is bad news — spend, downtime, idle hours. */
  invertDelta?: boolean;
  trend?: number[];
  tone?: SparkTone;
  icon?: React.ElementType;
  meta?: string;
  /** Stagger index inside a grid; 45ms apart. */
  index?: number;
  className?: string;
}

const pctFmt = new Intl.NumberFormat('uk-UA', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * The composed KPI tile: animated value, delta badge and trend curve in one
 * glass panel. Direction is carried by an arrow glyph as well as colour, and
 * `invertDelta` flips the good/bad reading for metrics where growth is a cost.
 */
export default function MetricTile({
  label,
  value,
  unit,
  decimals = 0,
  format,
  delta,
  invertDelta = false,
  trend,
  tone = 'accent',
  icon: Icon,
  meta,
  index = 0,
  className,
}: MetricTileProps) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const rising = hasDelta && delta! > 0;
  const flat = hasDelta && delta === 0;
  const good = invertDelta ? !rising : rising;

  const DeltaIcon = flat ? ArrowRight : rising ? ArrowUpRight : ArrowDownRight;
  const deltaClass = flat ? 'badge-neutral' : good ? 'badge-success' : 'badge-danger';

  return (
    <article
      className={cn('glass-panel glass-hover rise relative overflow-hidden p-5', className)}
      style={{ '--d': `${index * 45}ms` } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="micro-label">{label}</span>
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field bg-surface-hover text-txt-secondary">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="stat text-2xl sm:text-[26px]">
          <NumberTicker value={value} decimals={decimals} format={format} delay={index * 60} />
          {unit && <span className="ml-1 text-sm font-medium text-txt-muted">{unit}</span>}
        </p>

        {hasDelta && (
          <span className={cn('badge', deltaClass)}>
            <DeltaIcon className="h-3 w-3" aria-hidden="true" />
            {pctFmt.format(Math.abs(delta!))}%
          </span>
        )}
      </div>

      {trend && trend.length > 1 && (
        <div className="mt-4">
          <Sparkline
            data={trend}
            tone={flat ? 'muted' : good ? tone : 'danger'}
            height={38}
            label={t('ui.trendOverPeriods', { v0: label, v1: trend.length })}
          />
        </div>
      )}

      {meta && <p className="mt-2.5 text-2xs text-txt-muted">{meta}</p>}
    </article>
  );
}
