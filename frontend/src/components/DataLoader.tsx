'use client';

import React from 'react';
import { CalendarRange } from 'lucide-react';
import { t } from '@/lib/i18n';

interface DataLoaderProps {
  /** Підпис вибраного періоду (напр. «Весь доступний період»). */
  periodLabel?: string;
  /** Заголовок стану завантаження. */
  message?: string;
  /** Пояснення під заголовком. */
  hint?: string;
}

/**
 * Брендований лоадер у стилі Aurora Glass. Показуємо його замість скелета для
 * «важких» діапазонів (весь період / >31 дня): такий запит до Shell тягне тисячі
 * рядків і триває десятки секунд, тож користувачу потрібен зрозумілий, живий стан
 * очікування з назвою періоду, а не статичний каркас таблиці.
 */
export default function DataLoader({ periodLabel, message, hint }: DataLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="glass-panel rise flex flex-col items-center justify-center gap-6 px-6 py-16 text-center"
    >
      {/* Календар в акцентному колі + обертовий ободок = «вантажимо дані за період». */}
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-accent/20 border-t-accent motion-safe:animate-spin" />
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
          <CalendarRange className="h-5 w-5" />
        </span>
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-semibold text-txt-primary">{message || t('ui.loadingData')}</h3>
        {periodLabel && (
          <div className="flex justify-center">
            <span className="badge badge-accent">{periodLabel}</span>
          </div>
        )}
        <p className="mx-auto max-w-sm text-2xs text-txt-muted">{hint || t('ui.loadingDataHint')}</p>
      </div>

      {/* Індетермінований прогрес: акцентний відрізок пробігає доріжкою. */}
      <div className="relative h-1 w-full max-w-[280px] overflow-hidden rounded-full bg-surface-inset">
        <span
          className="absolute top-0 h-full w-2/5 rounded-full bg-accent motion-reduce:hidden"
          style={{ animation: 'sweep 1.3s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
        />
        {/* Для reduced-motion — статична смужка замість анімації. */}
        <span className="absolute inset-y-0 left-0 hidden w-1/3 rounded-full bg-accent/50 motion-reduce:block" />
      </div>
    </div>
  );
}
