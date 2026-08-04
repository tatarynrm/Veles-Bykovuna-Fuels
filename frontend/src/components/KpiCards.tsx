'use client';

import React from 'react';
import { Wallet, Droplets, CreditCard, Store, Receipt, Percent } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/format';

interface Summary {
  totalContracts: number;
  totalBalanceUah: number;
  totalCards: number;
  activeCards: number;
  totalMerchantsAZS: number;
  totalTransactions: number;
  totalSpendUah: number;
  totalVolumeLiters: number;
  totalDiscountsUah: number;
}

interface KpiCardsProps {
  summary?: Summary | null;
}

type Tone = 'accent' | 'info' | 'warn' | 'neutral';

const toneClass: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent',
  info: 'bg-[var(--info-soft)] text-[var(--info)]',
  warn: 'bg-[var(--warn-soft)] text-warn',
  neutral: 'bg-surface-hover text-txt-secondary',
};

export default function KpiCards({ summary }: KpiCardsProps) {
  const activeRatio =
    summary && summary.totalCards > 0
      ? Math.round((summary.activeCards / summary.totalCards) * 100)
      : 0;

  const cards: Array<{
    label: string;
    value: string;
    meta: string;
    icon: React.ElementType;
    tone: Tone;
    progress?: number;
  }> = [
    {
      label: 'Загальні витрати',
      value: formatCurrency(summary?.totalSpendUah),
      meta: `${formatNumber(summary?.totalTransactions ?? 0)} операцій за період`,
      icon: Wallet,
      tone: 'accent',
    },
    {
      label: 'Обʼєм пального',
      value: `${formatNumber(summary?.totalVolumeLiters)} л`,
      meta:
        summary && summary.totalVolumeLiters > 0
          ? `Середня ціна ${formatCurrency(summary.totalSpendUah / summary.totalVolumeLiters)}/л`
          : 'Дані за період відсутні',
      icon: Droplets,
      tone: 'info',
    },
    {
      label: 'Паливні картки',
      value: `${formatNumber(summary?.activeCards)} / ${formatNumber(summary?.totalCards)}`,
      meta: `${activeRatio}% активних у реєстрі`,
      icon: CreditCard,
      tone: 'accent',
      progress: activeRatio,
    },
    {
      label: 'Мережа АЗК',
      value: formatNumber(summary?.totalMerchantsAZS),
      meta: `${formatNumber(summary?.totalContracts)} активних договорів`,
      icon: Store,
      tone: 'warn',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <article
            key={card.label}
            className="glass-panel glass-hover rise relative overflow-hidden p-5"
            style={{ '--d': `${i * 45}ms` } as React.CSSProperties}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="micro-label">{card.label}</span>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-field ${toneClass[card.tone]}`}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>

            <p className="stat mt-3 text-2xl sm:text-[26px]">{card.value}</p>

            {card.progress !== undefined && (
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-hover">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-700 ease-enter"
                  style={{ width: `${card.progress}%` }}
                />
              </div>
            )}

            <p className="mt-2.5 text-2xs text-txt-muted">{card.meta}</p>
          </article>
        );
      })}
    </div>
  );
}

/** Compact secondary metrics row used under the main KPI grid. */
export function KpiSecondary({ summary }: KpiCardsProps) {
  if (!summary) return null;

  const items = [
    {
      label: 'Знижки за період',
      value: formatCurrency(summary.totalDiscountsUah),
      icon: Percent,
    },
    {
      label: 'Баланс договорів',
      value: formatCurrency(summary.totalBalanceUah),
      icon: Wallet,
    },
    {
      label: 'Транзакцій',
      value: formatNumber(summary.totalTransactions),
      icon: Receipt,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="glass-panel flex items-center gap-3 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field bg-surface-hover text-txt-secondary">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="micro-label">{label}</p>
            <p className="stat mt-0.5 truncate text-sm">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
