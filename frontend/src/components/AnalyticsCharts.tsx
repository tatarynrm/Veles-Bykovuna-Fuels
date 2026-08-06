'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp, Droplets, PieChart, BarChart3 } from 'lucide-react';
import ExportDropdown from './ExportDropdown';
import { EmptyState } from './Skeletons';
import { useTheme } from '@/context/ThemeContext';
import { formatCompact, formatCurrency, formatNumber } from '@/lib/format';
import { t } from '@/lib/i18n';

interface AnalyticsChartsProps {
  fuelBreakdown: any[];
  spendingTrends: any[];
}

/**
 * Reads live token values so charts follow the active theme.
 * The viz-* categorical slots are palette-validated per theme in globals.css —
 * never substitute ad-hoc colors here.
 */
function useChartPalette() {
  const { theme, mounted } = useTheme();
  const [palette, setPalette] = useState({
    accent: '#10B981',
    warn: '#F5A524',
    grid: 'rgba(255,255,255,0.07)',
    axis: '#6B7688',
    muted: '#6B7688',
    okko1: '#1FB155',
    okko2: '#047857',
    shell1: '#D97706',
    shell2: '#9C4A0B',
  });

  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) =>
      css.getPropertyValue(name).trim() || fallback;

    setPalette({
      accent: read('--accent', '#10B981'),
      warn: read('--warn', '#F5A524'),
      grid: read('--border-subtle', 'rgba(255,255,255,0.07)'),
      axis: read('--text-muted', '#6B7688'),
      muted: read('--text-muted', '#6B7688'),
      okko1: read('--viz-okko-1', '#1FB155'),
      okko2: read('--viz-okko-2', '#047857'),
      shell1: read('--viz-shell-1', '#D97706'),
      shell2: read('--viz-shell-2', '#9C4A0B'),
    });
  }, [theme, mounted]);

  return palette;
}

/** "2026-06-08" → "08.06" for axis ticks; anything unexpected passes through. */
function shortDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(value)
    ? `${value.slice(8, 10)}.${value.slice(5, 7)}`
    : value;
}

function GlassTooltip({
  active,
  payload,
  label,
  formatter,
  totalRow,
}: any) {
  if (!active || !payload?.length) return null;
  const sum = payload.reduce((acc: number, e: any) => acc + (Number(e.value) || 0), 0);
  return (
    <div className="glass-float rounded-field px-3 py-2 text-2xs">
      <p className="mb-1 font-medium text-txt-primary">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="flex items-center gap-2 text-txt-secondary">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: entry.color || entry.fill }}
          />
          <span>{entry.name}:</span>
          <span className="stat text-txt-primary">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </p>
      ))}
      {totalRow && payload.length > 1 && (
        <p className="hairline-t mt-1 flex items-center gap-2 pt-1 text-txt-secondary">
          <span className="h-1.5 w-1.5" />
          <span>{t('common.totalColon')}</span>
          <span className="stat text-txt-primary">
            {formatter ? formatter(sum) : sum}
          </span>
        </p>
      )}
    </div>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  subtitle,
  tone = 'accent',
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  tone?: 'accent' | 'info' | 'warn';
  children?: React.ReactNode;
}) {
  const toneClass =
    tone === 'info'
      ? 'bg-[var(--info-soft)] text-[var(--info)]'
      : tone === 'warn'
        ? 'bg-[var(--warn-soft)] text-warn'
        : 'bg-accent-soft text-accent';

  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-field ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-txt-primary">{title}</h3>
          <p className="mt-0.5 text-2xs text-txt-muted">{subtitle}</p>
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   1. Динаміка витрат — інтерактивний area chart зі stat-вкладками серій
   ══════════════════════════════════════════════════════════════════════════ */

type TrendView = 'compare' | 'total' | 'okko' | 'shell';

function StatTab({
  active,
  activeBorder,
  onClick,
  dots,
  label,
  value,
}: {
  active: boolean;
  activeBorder: string;
  onClick: () => void;
  dots: string[];
  label: string;
  value: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`glass-inset glass-inset-hover p-3 text-left transition-colors ${
        active ? activeBorder : ''
      }`}
    >
      <span className="micro-label flex items-center gap-1.5">
        <span className="flex items-center gap-0.5">
          {dots.map((d, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: d }} />
          ))}
        </span>
        {label}
      </span>
      <span className="stat mt-1 block text-sm">{value}</span>
    </button>
  );
}

function SpendingTrendChart({
  data,
  palette,
}: {
  data: any[];
  palette: ReturnType<typeof useChartPalette>;
}) {
  const totals = useMemo(
    () =>
      data.reduce(
        (acc, d) => ({
          spend: acc.spend + (d.spend || 0),
          okko: acc.okko + (d.okkoSpend || 0),
          shell: acc.shell + (d.shellSpend || 0),
        }),
        { spend: 0, okko: 0, shell: 0 },
      ),
    [data],
  );
  const hasBothBrands = totals.okko > 0 && totals.shell > 0;

  const [view, setView] = useState<TrendView>('total');
  // Comparison is the richest default, but only after the user's own choice is respected.
  const userPicked = useRef(false);
  useEffect(() => {
    if (!userPicked.current) setView(hasBothBrands ? 'compare' : 'total');
  }, [hasBothBrands]);

  const pick = (v: TrendView) => {
    userPicked.current = true;
    setView(v);
  };

  const axisProps = {
    stroke: palette.axis,
    fontSize: 11,
    tickLine: false,
    axisLine: false,
  } as const;

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTab
          active={view === 'compare'}
          activeBorder="border-accent/50"
          onClick={() => pick('compare')}
          dots={[palette.accent, palette.warn]}
          label={t('analytics.comparison')}
          value="OKKO + Shell"
        />
        <StatTab
          active={view === 'total'}
          activeBorder="border-accent/50"
          onClick={() => pick('total')}
          dots={[palette.accent]}
          label={t('analytics.total')}
          value={`${formatCompact(totals.spend)} ₴`}
        />
        <StatTab
          active={view === 'okko'}
          activeBorder="border-accent/50"
          onClick={() => pick('okko')}
          dots={[palette.accent]}
          label="OKKO"
          value={`${formatCompact(totals.okko)} ₴`}
        />
        <StatTab
          active={view === 'shell'}
          activeBorder="border-warn/50"
          onClick={() => pick('shell')}
          dots={[palette.warn]}
          label="Shell"
          value={`${formatCompact(totals.shell)} ₴`}
        />
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="vizFillAccent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.accent} stopOpacity={0.3} />
                <stop offset="100%" stopColor={palette.accent} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="vizFillWarn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.warn} stopOpacity={0.3} />
                <stop offset="100%" stopColor={palette.warn} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke={palette.grid} vertical={false} />
            <XAxis
              dataKey="date"
              {...axisProps}
              tickMargin={10}
              minTickGap={24}
              tickFormatter={shortDate}
            />
            <YAxis {...axisProps} width={72} tickFormatter={(v) => formatCompact(v)} />
            <Tooltip
              content={
                <GlassTooltip formatter={(v: number) => formatCurrency(v)} totalRow />
              }
              cursor={{ stroke: palette.axis, strokeWidth: 1, strokeDasharray: '4 4' }}
            />

            {view === 'compare' ? (
              <>
                <Area
                  type="monotone"
                  dataKey="okkoSpend"
                  name="OKKO"
                  stackId="brand"
                  stroke={palette.accent}
                  strokeWidth={2}
                  fill="url(#vizFillAccent)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="shellSpend"
                  name="Shell"
                  stackId="brand"
                  stroke={palette.warn}
                  strokeWidth={2}
                  fill="url(#vizFillWarn)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
              </>
            ) : (
              <Area
                type="monotone"
                dataKey={view === 'okko' ? 'okkoSpend' : view === 'shell' ? 'shellSpend' : 'spend'}
                name={view === 'okko' ? 'OKKO' : view === 'shell' ? 'Shell' : t('analytics.spending')}
                stroke={view === 'shell' ? palette.warn : palette.accent}
                strokeWidth={2}
                fill={view === 'shell' ? 'url(#vizFillWarn)' : 'url(#vizFillAccent)'}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   2. Обсяги пального — горизонтальні бари з крос-підсвіткою
   ══════════════════════════════════════════════════════════════════════════ */

function VolumeTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="glass-float rounded-field px-3 py-2 text-2xs">
      <p className="mb-1 font-medium text-txt-primary">{item.product}</p>
      <p className="text-txt-secondary">
        {t('analytics.volumeColon')} <span className="stat text-txt-primary">{formatNumber(item.volume)} {t('unit.litre')}</span>
      </p>
      <p className="text-txt-secondary">
        {t('analytics.spendingColon')} <span className="stat text-txt-primary">{formatCurrency(item.spend)}</span>
      </p>
      <p className="text-txt-secondary">
        {t('analytics.refuellingsColon')} <span className="stat text-txt-primary">{formatNumber(item.count)}</span>
      </p>
    </div>
  );
}

function FuelVolumeChart({
  data,
  palette,
}: {
  data: any[];
  palette: ReturnType<typeof useChartPalette>;
}) {
  const [hot, setHot] = useState<number | null>(null);

  const rows = useMemo(
    () => [...data].sort((a, b) => (b.volume || 0) - (a.volume || 0)),
    [data],
  );
  const brands = new Set(rows.map((r) => (r.brand === 'Shell' ? 'Shell' : 'OKKO')));

  return (
    <>
      {brands.size > 1 && (
        <div className="mb-3 flex items-center gap-4 text-2xs text-txt-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: palette.accent }} />
            OKKO
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: palette.warn }} />
            Shell
          </span>
        </div>
      )}

      <div className="w-full" style={{ height: Math.max(200, rows.length * 46 + 20) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 0, right: 64, left: 0, bottom: 0 }}
            barCategoryGap={10}
          >
            <CartesianGrid strokeDasharray="4 4" stroke={palette.grid} horizontal={false} />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="product"
              stroke={palette.axis}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={148}
              tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)}
            />
            <Tooltip content={<VolumeTooltip />} cursor={{ fill: palette.grid }} />
            <Bar
              dataKey="volume"
              name='tx.volume'
              radius={[0, 6, 6, 0]}
              maxBarSize={26}
              onMouseLeave={() => setHot(null)}
            >
              {rows.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.brand === 'Shell' ? palette.warn : palette.accent}
                  fillOpacity={hot === null || hot === i ? 1 : 0.3}
                  style={{ transition: 'fill-opacity 0.2s' }}
                  onMouseEnter={() => setHot(i)}
                />
              ))}
              <LabelList
                dataKey="volume"
                position="right"
                fill={palette.axis}
                fontSize={10}
                formatter={(v: number) => t('common.l', { v0: formatCompact(v) })}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Структура витрат — донат з центральним підсумком і крос-підсвіткою
   легенди (за мотивами Sectors Donut, 21st.dev)
   ══════════════════════════════════════════════════════════════════════════ */

interface DonutSegment {
  label: string;
  spend: number;
  volume: number;
  count: number;
  color: string;
}

const DONUT_R = 70;
const DONUT_STROKE = 18;
const DONUT_C = 2 * Math.PI * DONUT_R;

function SpendDonut({
  data,
  palette,
}: {
  data: any[];
  palette: ReturnType<typeof useChartPalette>;
}) {
  const [hot, setHot] = useState<number | null>(null);

  const { segments, total } = useMemo(() => {
    const total = data.reduce((sum, i) => sum + (i.spend || 0), 0);
    const byBrand = (isShell: boolean) =>
      data
        .filter((i) => (i.brand === 'Shell') === isShell)
        .sort((a, b) => (b.spend || 0) - (a.spend || 0));

    const okko = byBrand(false);
    const shell = byBrand(true);
    // Дві валідовані сходинки на бренд; хвіст обох брендів згортається в «Інші»,
    // бо більше розрізнюваних категоріальних кольорів палітра не має.
    const okkoColors = [palette.okko1, palette.okko2];
    const shellColors = [palette.shell1, palette.shell2];

    const segments: DonutSegment[] = [
      ...okko.slice(0, 2).map((i, idx) => ({
        label: i.product,
        spend: i.spend || 0,
        volume: i.volume || 0,
        count: i.count || 0,
        color: okkoColors[idx],
      })),
      ...shell.slice(0, 2).map((i, idx) => ({
        label: i.product,
        spend: i.spend || 0,
        volume: i.volume || 0,
        count: i.count || 0,
        color: shellColors[idx],
      })),
    ];

    const rest = [...okko.slice(2), ...shell.slice(2)];
    if (rest.length > 0) {
      segments.push({
        label: t('analytics.other', { v0: rest.length }),
        spend: rest.reduce((s, i) => s + (i.spend || 0), 0),
        volume: rest.reduce((s, i) => s + (i.volume || 0), 0),
        count: rest.reduce((s, i) => s + (i.count || 0), 0),
        color: palette.muted,
      });
    }

    return { segments: segments.filter((s) => s.spend > 0), total };
  }, [data, palette]);

  let acc = 0;
  const arcs = segments.map((s) => {
    const start = acc;
    const pct = total > 0 ? (s.spend / total) * 100 : 0;
    acc += pct;
    return { ...s, start, pct };
  });

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative h-44 w-44 shrink-0">
        <svg width="176" height="176" viewBox="0 0 176 176" className="-rotate-90">
          {arcs.map((a, i) => (
            <circle
              key={a.label}
              cx={88}
              cy={88}
              r={DONUT_R}
              fill="none"
              stroke={a.color}
              strokeWidth={hot === i ? DONUT_STROKE + 3 : DONUT_STROKE}
              strokeDasharray={`${Math.max((a.pct / 100) * DONUT_C - 2.5, 0.1)} ${DONUT_C}`}
              strokeDashoffset={-((a.start / 100) * DONUT_C)}
              onMouseEnter={() => setHot(i)}
              onMouseLeave={() => setHot(null)}
              style={{
                opacity: hot === null || hot === i ? 1 : 0.25,
                transition: 'opacity 0.25s var(--ease-state), stroke-width 0.2s var(--ease-state)',
                animation: `viz-arc-in 0.5s var(--ease-enter) ${i * 70}ms both`,
              }}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="stat text-base">{formatCompact(total)} ₴</span>
          <span className="micro-label mt-0.5">{t('analytics.inThePeriod')}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 self-stretch justify-center">
        {arcs.map((a, i) => (
          <button
            key={a.label}
            type="button"
            onMouseEnter={() => setHot(i)}
            onMouseLeave={() => setHot(null)}
            onFocus={() => setHot(i)}
            onBlur={() => setHot(null)}
            title={t('analytics.lRefuellings', { v0: a.label, v1: formatNumber(a.volume), v2: formatNumber(a.count) })}
            className={`flex w-full items-center gap-2.5 rounded-field px-2 py-1.5 text-left transition-opacity duration-200 ${
              hot !== null && hot !== i ? 'opacity-35' : ''
            }`}
          >
            <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: a.color }} />
            <span className="min-w-0 flex-1 truncate text-2xs text-txt-secondary">
              {a.label}
            </span>
            <span className="stat shrink-0 text-2xs">{formatCurrency(a.spend)}</span>
            <span className="tabular w-11 shrink-0 text-right text-2xs text-txt-muted">
              {a.pct.toFixed(1)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

export default function AnalyticsCharts({
  fuelBreakdown,
  spendingTrends,
}: AnalyticsChartsProps) {
  const palette = useChartPalette();

  return (
    <div className="space-y-5">
      {/* ── Spending trend ── */}
      <section className="glass-panel p-5 sm:p-6">
        <PanelHeader
          icon={TrendingUp}
          title={t('analytics.fuelSpendingTrend')}
          subtitle={t('analytics.dailyCompanySpendingOver')}
        >
          <ExportDropdown
            data={() => spendingTrends}
            options={{
              filename: `spending_trends_${new Date().toISOString().slice(0, 10)}`,
              title: t('analytics.fuelSpendingTrend'),
              subtitle: t('common.velesBukovynaLLC'),
              columns: [
                { label: t('analytics.date'), key: 'date', type: 'string' },
                { label: t('analytics.spendingUAH'), key: 'spend', type: 'currency' },
                { label: t('analytics.okkoUAH'), key: 'okkoSpend', type: 'currency' },
                { label: 'Shell (₴)', key: 'shellSpend', type: 'currency' },
              ],
            }}
            buttonText={t('common.export')}
          />
        </PanelHeader>

        {spendingTrends.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title={t('analytics.noDataForPeriod')}
            hint={t('analytics.pickAnotherDateRange')}
          />
        ) : (
          <SpendingTrendChart data={spendingTrends} palette={palette} />
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* ── Volume by fuel type ── */}
        <section className="glass-panel p-5 sm:p-6">
          <PanelHeader
            icon={Droplets}
            title={t('analytics.breakdownFuelType')}
            subtitle={t('analytics.fuelVolumesDispensedLitres')}
            tone="info"
          >
            <ExportDropdown
              data={() => fuelBreakdown}
              options={{
                filename: `fuel_breakdown_${new Date().toISOString().slice(0, 10)}`,
                title: t('analytics.breakdownFuelType'),
                subtitle: t('common.velesBukovynaLLC'),
                columns: [
                  { label: t('analytics.fuelType'), key: 'product', type: 'string' },
                  { label: t('common.volumeL'), key: 'volume', type: 'number' },
                  { label: t('analytics.spendingUAH'), key: 'spend', type: 'currency' },
                  { label: t('analytics.numberOfRefuellings'), key: 'count', type: 'number' },
                ],
              }}
              buttonText={t('common.export')}
            />
          </PanelHeader>

          {fuelBreakdown.length === 0 ? (
            <EmptyState icon={Droplets} title={t('analytics.noRefuellingsPeriod')} />
          ) : (
            <FuelVolumeChart data={fuelBreakdown} palette={palette} />
          )}
        </section>

        {/* ── Spend share donut ── */}
        <section className="glass-panel p-5 sm:p-6">
          <PanelHeader
            icon={PieChart}
            title={t('analytics.spendingMixProduct')}
            subtitle={t('analytics.eachFuelGradeS')}
            tone="warn"
          />

          {fuelBreakdown.length === 0 ? (
            <EmptyState icon={PieChart} title={t('analytics.noDataBreakDown')} />
          ) : (
            <SpendDonut data={fuelBreakdown} palette={palette} />
          )}
        </section>
      </div>
    </div>
  );
}
