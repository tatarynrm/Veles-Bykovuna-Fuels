'use client';

import React, { useCallback, useState } from 'react';
import {
  Command,
  Droplets,
  Gauge,
  Receipt,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import PageShell, { AuthGate } from '@/components/PageShell';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { formatCurrency } from '@/lib/format';
import {
  COMMAND_PALETTE_EVENT,
  GaugeRing,
  MetricTile,
  NumberTicker,
  PriceTicker,
  ShimmerButton,
  Sparkline,
} from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * Showcase for the shared UI primitives.
 *
 * Layout note: sections are plain wrappers, never glass — every panel below is
 * itself a `.glass-panel`, and stacking two backdrop-filters turns both to mud.
 */
export default function UiKitPage() {
  const { authenticated } = useAuthGuard();
  const [seed, setSeed] = useState(7);
  const [busy, setBusy] = useState(false);

  /** Reshuffles every demo series so the tickers and sparklines re-animate. */
  const reroll = useCallback(() => {
    setBusy(true);
    setSeed((s) => s + 13);
    window.setTimeout(() => setBusy(false), 700);
  }, []);

  if (!authenticated) return <AuthGate />;

  const spend = series(seed, 14, 240_000, 60_000);
  const volume = series(seed + 1, 14, 9_400, 1_800);
  const idle = series(seed + 2, 14, 42, 14);

  const openPalette = () => window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT));

  return (
    <PageShell
      title="UI Kit"
      subtitle={t('uikit.velesERPComponentLibrary')}
      onRefresh={reroll}
      isRefreshing={busy}
      actions={
        <ShimmerButton icon={Command} onClick={openPalette} kbd="⌘K">
          <span className="hidden sm:inline">{t('uikit.palette')}</span>
        </ShimmerButton>
      }
    >
      <div className="space-y-8 pb-8">
        {/* ── Command palette ───────────────────────────────────────────── */}
        <Section
          icon={Command}
          title={t('common.commandPalette')}
          note={t('uikit.globalAvailableEveryPage')}
        >
          <div className="glass-panel flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="space-y-3">
              <p className="text-xs text-txt-secondary">
                {t('uikit.press')} <span className="kbd">Ctrl</span> <span className="kbd">K</span> {t('uikit.or')}{' '}
                <span className="kbd">⌘</span> <span className="kbd">K</span> {t('uikit.macosAnywhereApp')}
              </p>
              <ul className="space-y-1.5 text-2xs text-txt-muted">
                <li>{t('uikit.fuzzySearchTlgFinds')}</li>
                <li>{t('uikit.latinAliasesCardsAnalytics')}</li>
                <li>{t('uikit.remembersLast4Commands')}</li>
                <li>
                  <span className="kbd">↑</span> <span className="kbd">↓</span>{' '}
                  <span className="kbd">Home</span> <span className="kbd">End</span> {t('uikit.navigation')}{' '}
                  <span className="kbd">⏎</span> {t('uikit.run')} <span className="kbd">Esc</span> {t('uikit.close')}
                </li>
                <li>{t('uikit.refreshDataTriggersReal')}</li>
              </ul>
            </div>
            <ShimmerButton icon={Command} onClick={openPalette} className="shrink-0 self-start">
              {t('uikit.openPalette')}
            </ShimmerButton>
          </div>
        </Section>

        {/* ── Metric tiles ──────────────────────────────────────────────── */}
        <Section
          icon={TrendingUp}
          title="MetricTile"
          note={t('uikit.numbertickerSparklineDeltaOne')}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              index={0}
              label={t('uikit.spendingPeriod')}
              value={spend[spend.length - 1]}
              format={formatCurrency}
              delta={pctChange(spend)}
              invertDelta
              trend={spend}
              icon={Wallet}
              meta={t('uikit.risingSpendingShownRed')}
            />
            <MetricTile
              index={1}
              label={t('common.fuelVolume')}
              value={volume[volume.length - 1]}
              unit={t('unit.litre')}
              delta={pctChange(volume)}
              trend={volume}
              tone="info"
              icon={Droplets}
              meta={t('uikit.combinedOKKOShell')}
            />
            <MetricTile
              index={2}
              label={t('common.idling')}
              value={idle[idle.length - 1]}
              unit={t('common.h')}
              decimals={1}
              delta={pctChange(idle)}
              invertDelta
              trend={idle}
              tone="warn"
              icon={Gauge}
              meta={t('uikit.ruptelaTelematics')}
            />
            <MetricTile
              index={3}
              label={t('common.transactions')}
              value={1284}
              delta={0}
              icon={Receipt}
              meta={t('uikit.noTrendTileRenders')}
            />
          </div>
        </Section>

        {/* ── Gauges ────────────────────────────────────────────────────── */}
        <Section
          icon={Gauge}
          title="GaugeRing"
          note={t('uikit.toneQuotAutoQuot')}
        >
          <div className="glass-panel flex flex-wrap items-center justify-center gap-8 p-6 sm:justify-start">
            <GaugeRing value={78} label={t('uikit.fleetAvailability')} />
            <GaugeRing value={34} label={t('uikit.cardLimit')} />
            <GaugeRing value={12} label={t('uikit.tankLevel')} />
            <GaugeRing value={92} tone="info" label={t('uikit.gpsCoverage')} size={110} thickness={8} />
          </div>
        </Section>

        {/* ── Sparklines ────────────────────────────────────────────────── */}
        <Section icon={Sparkles} title="Sparkline" note={t('uikit.pureSVGNoDependencies')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                { tone: 'accent', label: t('uikit.growth'), data: spend },
                { tone: 'warn', label: t('uikit.volatility'), data: idle },
                { tone: 'danger', label: t('uikit.decline'), data: [...volume].reverse() },
              ] as const
            ).map(({ tone, label, data }) => (
              <div key={label} className="glass-panel p-4">
                <p className="micro-label">{label}</p>
                <Sparkline data={data} tone={tone} height={48} className="mt-3" />
              </div>
            ))}
            <div className="glass-panel p-4">
              <p className="micro-label">{t('uikit.emptyState')}</p>
              <Sparkline data={[]} height={48} className="mt-3" />
            </div>
          </div>
        </Section>

        {/* ── Number tickers ────────────────────────────────────────────── */}
        <Section
          icon={TrendingUp}
          title="NumberTicker"
          note={t('uikit.startsViewportReAnimates')}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <TickerCard label={t('common.totalSpending')}>
              <NumberTicker value={sum(spend)} format={formatCurrency} />
            </TickerCard>
            <TickerCard label={t('uikit.litres')}>
              <NumberTicker value={sum(volume)} />
              <span className="ml-1 text-sm font-medium text-txt-muted">{t('unit.litre')}</span>
            </TickerCard>
            <TickerCard label={t('uikit.averagePrice')}>
              <NumberTicker value={sum(spend) / sum(volume)} decimals={2} />
              <span className="ml-1 text-sm font-medium text-txt-muted">{t('uikit.uahL')}</span>
            </TickerCard>
            <TickerCard label={t('uikit.activeCards')}>
              <NumberTicker value={47} />
            </TickerCard>
          </div>
          <p className="mt-3 text-2xs text-txt-muted">
            {t('uikit.pressRefreshHeaderEvery')}
          </p>
        </Section>

        {/* ── Price ticker ──────────────────────────────────────────────── */}
        <Section
          icon={Droplets}
          title="Marquee / PriceTicker"
          note={t('uikit.pausesHoverDirectionChange')}
        >
          <div className="glass-panel overflow-hidden">
            <PriceTicker items={PRICES} />
          </div>
        </Section>

        {/* ── Buttons ───────────────────────────────────────────────────── */}
        <Section
          icon={Sparkles}
          title="ShimmerButton"
          note={t('uikit.shimmerOnlyHoverFocus')}
        >
          <div className="glass-panel flex flex-wrap items-center gap-3 p-5">
            <ShimmerButton icon={Command}>{t('uikit.primaryAction')}</ShimmerButton>
            <ShimmerButton tone="ghost" icon={Receipt}>
              {t('uikit.secondary')}
            </ShimmerButton>
            <ShimmerButton tone="warn" icon={Gauge}>
              {t('uikit.telematics')}
            </ShimmerButton>
            <ShimmerButton loading>{t('common.loading')}</ShimmerButton>
            <ShimmerButton disabled>{t('uikit.unavailable')}</ShimmerButton>
          </div>
        </Section>
      </div>
    </PageShell>
  );
}

/* ── helpers ──────────────────────────────────────────────────────────── */

const PRICES = [
  { station: 'uikit.okkoChernivtsi1', fuel: 'uikit.dieselPreloff', price: 54.99, delta: 0.35 },
  { station: 'uikit.okkoKitsman', fuel: 'A-95 Pulls', price: 57.4, delta: -0.12 },
  { station: 'uikit.shellKhotyn', fuel: 'V-Power Diesel', price: 59.15, delta: 0.08 },
  { station: 'uikit.okkoStorozhynets', fuel: 'uikit.lpg', price: 27.8, delta: -0.4 },
  { station: 'uikit.shellNovoselytsia', fuel: 'FuelSave 95', price: 56.2, delta: 0 },
  { station: 'uikit.okkoVyzhnytsia', fuel: 'uikit.dieselEuro', price: 53.6, delta: 0.21 },
];

/** Deterministic pseudo-series, so the showcase renders without a backend call. */
function series(seed: number, length = 14, base = 100, swing = 26): number[] {
  let x = Math.abs(seed) + 1;
  return Array.from({ length }, (_, i) => {
    x = (x * 1103515245 + 12345) % 2147483648;
    const noise = (x / 2147483648 - 0.5) * swing;
    return Math.round((base + noise + i * (swing / 8)) * 100) / 100;
  });
}

const sum = (data: number[]) => data.reduce((a, b) => a + b, 0);

/** Percent change between the first and last point of a series. */
function pctChange(data: number[]): number | undefined {
  if (data.length < 2 || data[0] === 0) return undefined;
  return ((data[data.length - 1] - data[0]) / Math.abs(data[0])) * 100;
}

function TickerCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel p-4">
      <p className="micro-label">{label}</p>
      <p className="stat mt-2 truncate text-xl">{children}</p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  note,
  children,
}: {
  icon: React.ElementType;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rise">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field bg-accent-soft text-accent">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-txt-primary">{title}</h2>
          {note && <p className="mt-0.5 text-2xs text-txt-muted">{note}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
