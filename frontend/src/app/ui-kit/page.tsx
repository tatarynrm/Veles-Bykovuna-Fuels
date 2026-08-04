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
      subtitle="Бібліотека компонентів VELES ERP — патерни 21st.dev на токенах Aurora Glass"
      onRefresh={reroll}
      isRefreshing={busy}
      actions={
        <ShimmerButton icon={Command} onClick={openPalette} kbd="⌘K">
          <span className="hidden sm:inline">Палітра</span>
        </ShimmerButton>
      }
    >
      <div className="space-y-8 pb-8">
        {/* ── Command palette ───────────────────────────────────────────── */}
        <Section
          icon={Command}
          title="Командна палітра"
          note="Глобальна — доступна на будь-якій сторінці, окрім /login"
        >
          <div className="glass-panel flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="space-y-3">
              <p className="text-xs text-txt-secondary">
                Натисніть <span className="kbd">Ctrl</span> <span className="kbd">K</span> (або{' '}
                <span className="kbd">⌘</span> <span className="kbd">K</span> на macOS) будь-де в
                застосунку.
              </p>
              <ul className="space-y-1.5 text-2xs text-txt-muted">
                <li>Нечіткий пошук: «жтр» знаходить «Журнал транзакцій»</li>
                <li>Латинські аліаси: «cards», «analytics», «logout»</li>
                <li>Запамʼятовує 4 останні команди в блоці «Нещодавні»</li>
                <li>
                  <span className="kbd">↑</span> <span className="kbd">↓</span>{' '}
                  <span className="kbd">Home</span> <span className="kbd">End</span> навігація,{' '}
                  <span className="kbd">⏎</span> виконати, <span className="kbd">Esc</span> закрити
                </li>
                <li>Дія «Оновити дані» викликає справжній refresh поточної сторінки</li>
              </ul>
            </div>
            <ShimmerButton icon={Command} onClick={openPalette} className="shrink-0 self-start">
              Відкрити палітру
            </ShimmerButton>
          </div>
        </Section>

        {/* ── Metric tiles ──────────────────────────────────────────────── */}
        <Section
          icon={TrendingUp}
          title="MetricTile"
          note="NumberTicker + Sparkline + дельта в одній плитці"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              index={0}
              label="Витрати за період"
              value={spend[spend.length - 1]}
              format={formatCurrency}
              delta={pctChange(spend)}
              invertDelta
              trend={spend}
              icon={Wallet}
              meta="Зростання витрат позначається червоним — invertDelta"
            />
            <MetricTile
              index={1}
              label="Обʼєм пального"
              value={volume[volume.length - 1]}
              unit="л"
              delta={pctChange(volume)}
              trend={volume}
              tone="info"
              icon={Droplets}
              meta="Сумарно по OKKO та Shell"
            />
            <MetricTile
              index={2}
              label="Холостий хід"
              value={idle[idle.length - 1]}
              unit="год"
              decimals={1}
              delta={pctChange(idle)}
              invertDelta
              trend={idle}
              tone="warn"
              icon={Gauge}
              meta="Телематика Ruptela"
            />
            <MetricTile
              index={3}
              label="Транзакцій"
              value={1284}
              delta={0}
              icon={Receipt}
              meta="Без тренду — плитка рендериться без Sparkline"
            />
          </div>
        </Section>

        {/* ── Gauges ────────────────────────────────────────────────────── */}
        <Section
          icon={Gauge}
          title="GaugeRing"
          note="tone=&quot;auto&quot;: нижче 20% — критично, нижче 45% — увага"
        >
          <div className="glass-panel flex flex-wrap items-center justify-center gap-8 p-6 sm:justify-start">
            <GaugeRing value={78} label="Готовність парку" />
            <GaugeRing value={34} label="Ліміт по картці" />
            <GaugeRing value={12} label="Запас у баку" />
            <GaugeRing value={92} tone="info" label="Покриття GPS" size={110} thickness={8} />
          </div>
        </Section>

        {/* ── Sparklines ────────────────────────────────────────────────── */}
        <Section icon={Sparkles} title="Sparkline" note="Чистий SVG, без залежностей">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                { tone: 'accent', label: 'Зростання', data: spend },
                { tone: 'warn', label: 'Волатильність', data: idle },
                { tone: 'danger', label: 'Спад', data: [...volume].reverse() },
              ] as const
            ).map(({ tone, label, data }) => (
              <div key={label} className="glass-panel p-4">
                <p className="micro-label">{label}</p>
                <Sparkline data={data} tone={tone} height={48} className="mt-3" />
              </div>
            ))}
            <div className="glass-panel p-4">
              <p className="micro-label">Порожній стан</p>
              <Sparkline data={[]} height={48} className="mt-3" />
            </div>
          </div>
        </Section>

        {/* ── Number tickers ────────────────────────────────────────────── */}
        <Section
          icon={TrendingUp}
          title="NumberTicker"
          note="Стартує у вʼюпорті, переанімовує з поточного значення при зміні"
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <TickerCard label="Загальні витрати">
              <NumberTicker value={sum(spend)} format={formatCurrency} />
            </TickerCard>
            <TickerCard label="Літрів">
              <NumberTicker value={sum(volume)} />
              <span className="ml-1 text-sm font-medium text-txt-muted">л</span>
            </TickerCard>
            <TickerCard label="Середня ціна">
              <NumberTicker value={sum(spend) / sum(volume)} decimals={2} />
              <span className="ml-1 text-sm font-medium text-txt-muted">₴/л</span>
            </TickerCard>
            <TickerCard label="Активних карток">
              <NumberTicker value={47} />
            </TickerCard>
          </div>
          <p className="mt-3 text-2xs text-txt-muted">
            Натисніть «Оновити» у шапці — усі значення перерахуються з анімацією.
          </p>
        </Section>

        {/* ── Price ticker ──────────────────────────────────────────────── */}
        <Section
          icon={Droplets}
          title="Marquee / PriceTicker"
          note="Пауза при наведенні; напрямок зміни дублюється стрілкою, не лише кольором"
        >
          <div className="glass-panel overflow-hidden">
            <PriceTicker items={PRICES} />
          </div>
        </Section>

        {/* ── Buttons ───────────────────────────────────────────────────── */}
        <Section
          icon={Sparkles}
          title="ShimmerButton"
          note="Проблиск лише на hover/focus — постійна анімація в цьому продукті означає «живі дані»"
        >
          <div className="glass-panel flex flex-wrap items-center gap-3 p-5">
            <ShimmerButton icon={Command}>Основна дія</ShimmerButton>
            <ShimmerButton tone="ghost" icon={Receipt}>
              Другорядна
            </ShimmerButton>
            <ShimmerButton tone="warn" icon={Gauge}>
              Телематика
            </ShimmerButton>
            <ShimmerButton loading>Завантаження</ShimmerButton>
            <ShimmerButton disabled>Недоступно</ShimmerButton>
          </div>
        </Section>
      </div>
    </PageShell>
  );
}

/* ── helpers ──────────────────────────────────────────────────────────── */

const PRICES = [
  { station: 'ОККО Чернівці-1', fuel: 'ДП Preloff', price: 54.99, delta: 0.35 },
  { station: 'ОККО Кіцмань', fuel: 'A-95 Pulls', price: 57.4, delta: -0.12 },
  { station: 'Shell Хотин', fuel: 'V-Power Diesel', price: 59.15, delta: 0.08 },
  { station: 'ОККО Сторожинець', fuel: 'ГАЗ', price: 27.8, delta: -0.4 },
  { station: 'Shell Новоселиця', fuel: 'FuelSave 95', price: 56.2, delta: 0 },
  { station: 'ОККО Вижниця', fuel: 'ДП Евро', price: 53.6, delta: 0.21 },
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
