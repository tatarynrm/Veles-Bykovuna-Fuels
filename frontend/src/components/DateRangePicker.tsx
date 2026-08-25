'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, Check } from 'lucide-react';
import { t } from '@/lib/i18n';

export interface DateRange {
  preset: string;
  dateFrom: string;
  dateTo: string;
}

interface DateRangePickerProps {
  onDateChange: (range: DateRange) => void;
  currentRange: DateRange;
}

const toYmd = (d: Date) => d.toISOString().slice(0, 10);
const shift = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * Дефолтний діапазон для всіх сторінок — СЬОГОДНІ. Швидко вантажиться і не тягне
 * тисячі рядків Shell за весь період на першому відкритті. Збігається з пресетом
 * 'TODAY' у списку, тож пункт одразу підсвічений.
 */
export const todayRange = (): DateRange => {
  const today = toYmd(new Date());
  return { preset: 'TODAY', dateFrom: today, dateTo: today };
};

/** Людяний підпис періоду (для лоадера/бейджів). Викликати на місці рендеру. */
export const rangeLabel = (range: DateRange): string => {
  switch (range.preset) {
    case 'ALL':
      return t('ui.allAvailableData');
    case 'TODAY':
      return t('common.today');
    case 'LAST_7':
      return t('ui.last7Days');
    case 'LAST_30':
      return t('ui.last30Days');
    case 'THIS_MONTH':
      return t('ui.currentMonth');
    default:
      return range.dateFrom || range.dateTo
        ? `${range.dateFrom || '…'} — ${range.dateTo || '…'}`
        : t('ui.customPeriod');
  }
};

/** Чи діапазон «важкий» (весь період або довший за 31 день) — для показу лоадера. */
export const isHeavyRange = (range: DateRange): boolean => {
  if (range.preset === 'ALL' || (!range.dateFrom && !range.dateTo)) return true;
  if (range.dateFrom && range.dateTo) {
    const span = (new Date(range.dateTo).getTime() - new Date(range.dateFrom).getTime()) / 86400000;
    return span > 31;
  }
  return false;
};

export default function DateRangePicker({ onDateChange, currentRange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(currentRange.dateFrom);
  const [customTo, setCustomTo] = useState(currentRange.dateTo);
  const ref = useRef<HTMLDivElement>(null);

  // Presets are relative to today — they used to be frozen to a hardcoded month.
  const presets = useMemo(() => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return [
      { id: 'ALL', label: t('ui.allAvailableData'), dateFrom: '', dateTo: '' },
      { id: 'TODAY', label: t('common.today'), dateFrom: toYmd(today), dateTo: toYmd(today) },
      { id: 'LAST_7', label: t('ui.last7Days'), dateFrom: toYmd(shift(-6)), dateTo: toYmd(today) },
      { id: 'LAST_30', label: t('ui.last30Days'), dateFrom: toYmd(shift(-29)), dateTo: toYmd(today) },
      { id: 'THIS_MONTH', label: t('ui.currentMonth'), dateFrom: toYmd(monthStart), dateTo: toYmd(today) },
    ];
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const activeLabel =
    presets.find((p) => p.id === currentRange.preset)?.label ??
    (currentRange.dateFrom || currentRange.dateTo
      ? `${currentRange.dateFrom || '…'} — ${currentRange.dateTo || '…'}`
      : t('ui.customPeriod'));

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="btn btn-ghost"
      >
        <CalendarDays className="h-3.5 w-3.5 text-accent" />
        <span className="max-w-[168px] truncate">{activeLabel}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-txt-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="glass-float animate-pop absolute right-0 z-50 mt-2 w-72 rounded-card p-3">
          <p className="micro-label px-1 pb-2">{t('ui.dataPeriod')}</p>

          <div className="space-y-0.5">
            {presets.map((p) => {
              const selected = currentRange.preset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onDateChange({ preset: p.id, dateFrom: p.dateFrom, dateTo: p.dateTo });
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-control px-2.5 py-2 text-xs transition-colors ${
                    selected
                      ? 'bg-accent-soft font-semibold text-accent'
                      : 'text-txt-secondary hover:bg-surface-hover hover:text-txt-primary'
                  }`}
                >
                  <span>{p.label}</span>
                  {selected && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>

          <div className="hairline-t mt-3 space-y-2 pt-3">
            <p className="micro-label px-1">{t('ui.customPeriod')}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-micro text-txt-muted">{t('ui.fromDate')}</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="field field-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-micro text-txt-muted">{t('ui.toDate')}</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="field field-sm"
                />
              </label>
            </div>

            <button
              onClick={() => {
                onDateChange({ preset: 'CUSTOM', dateFrom: customFrom, dateTo: customTo });
                setIsOpen(false);
              }}
              className="btn btn-primary w-full"
            >
              {t('ui.applyFilter')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
