'use client';

import React, { useId, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

export type SparkTone = 'accent' | 'warn' | 'danger' | 'info' | 'muted';

export interface SparklineProps {
  data: number[];
  tone?: SparkTone;
  /** Rendered height in px; width always fills the container. */
  height?: number;
  /** Fills the area under the curve with a fading tint. */
  area?: boolean;
  /** Dot on the final point — reads as "this is where we are now". */
  showLast?: boolean;
  /** Describes the trend for screen readers. */
  label?: string;
  className?: string;
}

const toneVar: Record<SparkTone, string> = {
  accent: 'var(--accent)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  info: 'var(--info)',
  muted: 'var(--text-muted)',
};

const VIEW_W = 100;

/**
 * Dependency-free trend line for KPI tiles and table rows.
 *
 * Draws in a 100-wide viewBox stretched to the container, so the stroke needs
 * `vector-effect="non-scaling-stroke"` to stay 1.5px at any width. The end dot is
 * a positioned element rather than a <circle>, which the same stretch would
 * squash into an ellipse.
 */
export default function Sparkline({
  data,
  tone = 'accent',
  height = 36,
  area = true,
  showLast = true,
  label,
  className,
}: SparklineProps) {
  // useId() yields ":r0:" — the colons are invalid inside url(#…), so strip them.
  const gradientId = `spark-${useId().replace(/:/g, '')}`;
  const color = toneVar[tone];

  const geometry = useMemo(() => {
    const clean = data.filter((n) => Number.isFinite(n));
    if (clean.length < 2) return null;

    const min = Math.min(...clean);
    const max = Math.max(...clean);
    const pad = 3;
    const span = max - min || 1;
    const usable = height - pad * 2;

    const points = clean.map((v, i) => ({
      x: (i / (clean.length - 1)) * VIEW_W,
      y: height - pad - ((v - min) / span) * usable,
    }));

    // Catmull-Rom control points → cubic bezier, for a curve that reads as a
    // trend rather than a saw blade.
    let line = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] ?? points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      line += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }

    const last = points[points.length - 1];
    return {
      line,
      fill: `${line} L ${VIEW_W} ${height} L 0 ${height} Z`,
      lastX: (last.x / VIEW_W) * 100,
      lastY: (last.y / height) * 100,
      delta: clean[clean.length - 1] - clean[0],
    };
  }, [data, height]);

  if (!geometry) {
    return (
      <div
        className={cn('flex items-center', className)}
        style={{ height }}
        role="img"
        aria-label={t('ui.notEnoughDataDraw')}
      >
        <span className="h-px w-full border-t border-dashed border-bdr-subtle" />
      </div>
    );
  }

  const trend = geometry.delta === 0 ? t('ui.unchanged') : geometry.delta > 0 ? t('ui.rising') : t('ui.falling');

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${VIEW_W} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="block overflow-visible"
      >
        {area && (
          <>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.26" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={geometry.fill} fill={`url(#${gradientId})`} />
          </>
        )}
        <path
          d={geometry.line}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {showLast && (
        <span
          className="pointer-events-none absolute h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${geometry.lastX}%`,
            top: `${geometry.lastY}%`,
            background: color,
            boxShadow: `0 0 0 2px var(--bg-page)`,
          }}
        />
      )}

      <span className="sr-only">{label ?? t('ui.trendOverPoints', { v0: data.length, v1: trend })}</span>
    </div>
  );
}
