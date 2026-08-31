'use client';

/**
 * Статус синхронізації статусів Нової Пошти → Oracle (p_post.SetStatus).
 * Крон працює без per-item прогресу, тож показуємо стан ОСТАННЬОГО прогону:
 * коли, за яке вікно, скільки статусів зібрано і записано.
 * Опитує GET /api/novaposhta/sync-status раз на 20 с. Технічний ops-екран.
 */

import React from 'react';
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CalendarRange,
  PackageCheck,
  Database,
  Timer,
} from 'lucide-react';
import { useAuthGuard } from '@/lib/useAuthGuard';
import SyncShell from './SyncShell';
import { usePolledStatus } from '../model/usePolledStatus';
import type { NpSyncStatus } from '../model/types';

const NO_DATA = '—';

const dateTime = (iso: string | null) => {
  if (!iso) return NO_DATA;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? NO_DATA
    : d.toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
};

export default function NovaPoshtaSyncView() {
  const { authenticated } = useAuthGuard();
  const { data: s, error, refresh } = usePolledStatus<NpSyncStatus>(
    '/api/novaposhta/sync-status',
    authenticated,
  );

  if (!authenticated) return null;

  const last = s?.lastRun ?? null;

  const statusChip = s ? (
    <span
      className={`badge ${
        !s.enabled ? 'badge-neutral' : s.running ? 'badge-warn' : 'badge-success'
      }`}
    >
      {!s.enabled ? 'вимкнено' : s.running ? 'працює' : 'очікує'}
    </span>
  ) : null;

  return (
    <SyncShell
      title="Синхронізація Нової Пошти"
      subtitle="Статуси відправлень → Oracle (p_post.SetStatus), кроном кожні 3 год · оновлення раз на 20 с"
      status={statusChip}
    >
      {error && (
        <div className="glass-panel flex items-center gap-2 border-danger/30 p-3 text-2xs text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {s && !s.enabled && (
        <div className="glass-panel flex items-start gap-2 p-4 text-2xs text-txt-secondary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <span>
            Oracle не налаштовано — синхронізацію дат доставки вимкнено. Задайте{' '}
            <code>ORACLE_USER</code> / <code>ORACLE_PASSWORD</code> /{' '}
            <code>ORACLE_CONNECT_STRING</code> у <code>backend/.env</code>.
          </span>
        </div>
      )}

      {s?.running && (
        <div className="glass-panel flex items-center gap-2 border-warn/30 p-3 text-2xs text-warn">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <span>Триває прогін, запущено о {dateTime(s.startedAt)}…</span>
        </div>
      )}

      {/* ── зведення останнього прогону ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat">
          <span className="micro-label flex items-center gap-1.5">
            <PackageCheck className="h-3 w-3" /> Записано статусів
          </span>
          <span className="mt-1 block text-xl font-semibold tabular text-accent">
            {last ? last.written.toLocaleString('uk-UA') : NO_DATA}
          </span>
          <span className="mt-0.5 block text-2xs text-txt-muted">
            {last ? `зібрано ${last.collected.toLocaleString('uk-UA')}` : ''}
          </span>
        </div>
        <div className="stat">
          <span className="micro-label flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Останній прогін
          </span>
          <span className="mt-1 block text-sm font-semibold text-txt-primary">
            {last ? dateTime(last.at) : NO_DATA}
          </span>
          <span className="mt-0.5 block text-2xs text-txt-muted">
            {last ? `${Math.round(last.durationMs / 1000)}с` : ''}
          </span>
        </div>
        <div className="stat">
          <span className="micro-label flex items-center gap-1.5">
            <CalendarRange className="h-3 w-3" /> Вікно вибірки
          </span>
          <span className="mt-1 block text-sm font-semibold text-txt-primary">
            {last ? `${last.from} – ${last.to}` : NO_DATA}
          </span>
          <span className="mt-0.5 block text-2xs text-txt-muted">
            {s ? `${s.config.windowDays} днів` : ''}
          </span>
        </div>
        <div className="stat">
          <span className="micro-label flex items-center gap-1.5">
            <Timer className="h-3 w-3" /> Розклад
          </span>
          <span className="mt-1 block text-sm font-semibold text-txt-primary">
            {s ? s.config.cronLabel : NO_DATA}
          </span>
          <span className="mt-0.5 block font-mono text-micro text-txt-muted">
            {s ? s.config.cron : ''}
          </span>
        </div>
      </div>

      {/* ── деталі останнього прогону ────────────────────────────────────── */}
      <div className="glass-panel overflow-hidden p-0">
        <div className="hairline-b flex items-center justify-between px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-txt-primary">
            <Database className="h-4 w-4 text-accent" /> Останній прогон
          </h3>
          <button onClick={refresh} className="btn btn-ghost h-7 px-2 text-micro">
            <RefreshCw className="h-3 w-3" /> Оновити
          </button>
        </div>

        {!s ? (
          <p className="py-8 text-center text-2xs text-txt-muted">Завантаження…</p>
        ) : !last ? (
          <p className="py-8 text-center text-2xs text-txt-muted">
            Ще не було жодного прогону від старту сервісу. Перший — за ~10 с після запуску,
            далі кожні 3 год.
          </p>
        ) : (
          <div className="space-y-3 px-4 py-4">
            <div className="flex items-center gap-2 text-2xs">
              {last.ok ? (
                <span className="badge badge-success inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Успішно
                </span>
              ) : (
                <span className="badge badge-danger inline-flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Помилка
                </span>
              )}
              <span className="text-txt-muted">о {dateTime(last.at)}</span>
            </div>

            {last.error && (
              <div className="glass-inset border-danger/30 p-3 text-2xs text-danger">
                {last.error}
              </div>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-2xs sm:grid-cols-4">
              <div>
                <dt className="micro-label">Зібрано статусів</dt>
                <dd className="mt-0.5 tabular font-semibold text-txt-primary">
                  {last.collected.toLocaleString('uk-UA')}
                </dd>
              </div>
              <div>
                <dt className="micro-label">Записано в Oracle</dt>
                <dd className="mt-0.5 tabular font-semibold text-accent">
                  {last.written.toLocaleString('uk-UA')}
                </dd>
              </div>
              <div>
                <dt className="micro-label">Вікно</dt>
                <dd className="mt-0.5 text-txt-secondary">
                  {last.from} – {last.to}
                </dd>
              </div>
              <div>
                <dt className="micro-label">Тривалість</dt>
                <dd className="mt-0.5 text-txt-secondary">
                  {Math.round(last.durationMs / 1000)}с
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </SyncShell>
  );
}
