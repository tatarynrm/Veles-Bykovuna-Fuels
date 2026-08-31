'use client';

/**
 * Спільні візуалізації руху посилки Нової Пошти:
 *  - DeliveryStepper — горизонтальний «графік», де зараз посилка (за StatusCode/StateId).
 *  - MovementTimeline — вертикальна історія руху (найновіше згори).
 * Використовується і на сторінці відстеження, і в розкритому рядку відправлень.
 */

import React from 'react';
import { Package, Truck, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import {
  NO_DATA,
  trackingPhase,
  DELIVERY_PHASES,
  type NovaPoshtaTrackingHistoryEntry,
  type TrackingPhase,
} from '@/lib/novaposhta';

const PHASE_LABEL: Record<TrackingPhase, string> = {
  created: 'nova.phaseCreated',
  in_transit: 'nova.phaseInTransit',
  arrived: 'nova.phaseArrived',
  delivered: 'nova.phaseDelivered',
  problem: 'nova.phaseProblem',
};

const PHASE_ICON: Record<TrackingPhase, React.ElementType> = {
  created: Package,
  in_transit: Truck,
  arrived: MapPin,
  delivered: CheckCircle2,
  problem: AlertCircle,
};

/**
 * Горизонтальний графік фаз доставки — «де зараз посилка».
 * `compact` — тільки крапки + лінія (без підписів) для рядка таблиці.
 */
export function DeliveryStepper({
  code,
  compact = false,
}: {
  code: string | null;
  compact?: boolean;
}) {
  const phase = trackingPhase(code);

  // Проблемні статуси (відмова, знищено, не знайдено) не лягають на лінійку.
  if (phase === 'problem') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-control bg-warn/10 px-2 py-1 text-micro text-warn">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>{t('nova.phaseProblem')}</span>
      </div>
    );
  }

  const current = DELIVERY_PHASES.indexOf(phase);

  if (compact) {
    return (
      <div className="flex items-center" title={t(PHASE_LABEL[phase])}>
        {DELIVERY_PHASES.map((p, i) => {
          const Icon = PHASE_ICON[p];
          const done = i <= current;
          const isCurrent = i === current;
          return (
            <React.Fragment key={p}>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  done
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-bdr-subtle bg-surface-inset text-txt-muted'
                } ${isCurrent ? 'ring-2 ring-accent/30' : ''}`}
              >
                <Icon className="h-3 w-3" />
              </span>
              {i < DELIVERY_PHASES.length - 1 && (
                <span
                  className={`h-0.5 w-4 ${i < current ? 'bg-accent' : 'bg-bdr-subtle'}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center">
      {DELIVERY_PHASES.map((p, i) => {
        const Icon = PHASE_ICON[p];
        const done = i <= current;
        const isCurrent = i === current;
        return (
          <React.Fragment key={p}>
            <div className="flex flex-col items-center gap-1 text-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                  done
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-bdr-subtle bg-surface-inset text-txt-muted'
                } ${isCurrent ? 'ring-2 ring-accent/30' : ''}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className={`text-micro ${done ? 'font-medium text-txt-primary' : 'text-txt-muted'}`}>
                {t(PHASE_LABEL[p])}
              </span>
            </div>
            {i < DELIVERY_PHASES.length - 1 && (
              <span
                className={`mx-1 mb-4 h-0.5 flex-1 rounded-full ${
                  i < current ? 'bg-accent' : 'bg-bdr-subtle'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** Вертикальна історія руху (найновіше згори). НП віддає від найстарішого. */
export function MovementTimeline({ entries }: { entries: NovaPoshtaTrackingHistoryEntry[] }) {
  const ordered = [...entries].reverse();
  return (
    <ol className="glass-inset space-y-0 p-3">
      {ordered.map((e, i) => {
        const isLatest = i === 0;
        return (
          <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
            <div className="flex flex-col items-center">
              <span
                className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                  isLatest ? 'bg-accent' : 'bg-bdr-strong'
                }`}
              />
              {i < ordered.length - 1 && <span className="mt-0.5 w-px flex-1 bg-bdr-subtle" />}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <p className={`text-2xs ${isLatest ? 'font-semibold text-txt-primary' : 'text-txt-secondary'}`}>
                {e.status ?? NO_DATA}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-micro text-txt-muted">
                <span className="tabular">{e.datetime ? formatDateTime(e.datetime) : NO_DATA}</span>
                {(e.city || e.warehouse) && (
                  <span>· {[e.city, e.warehouse].filter(Boolean).join(' · ')}</span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
