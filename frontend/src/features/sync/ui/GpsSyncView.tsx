'use client';

/**
 * Візуалізація фонової закачки GPS-історії з Ruptela у процедуру p_gps.AddGps.
 * Опитує GET /api/gps/progress раз на 20 с і показує, яку машину зараз обробляють
 * і скільки точок записано. Технічний ops-екран (текст авторський, у i18n EXCLUDE).
 */

import React, { useEffect, useRef } from 'react';
import {
  DownloadCloud,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Circle,
  Clock,
  Gauge,
  Truck,
  WifiOff,
} from 'lucide-react';
import { useAuthGuard } from '@/lib/useAuthGuard';
import SyncShell from './SyncShell';
import { usePolledStatus } from '../model/usePolledStatus';
import type { GpsProgress, VehicleSyncStatus } from '../model/types';

const NO_DATA = '—';

const clock = (iso: string | null) => {
  if (!iso) return NO_DATA;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? NO_DATA
    : d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const fromLabel = (iso: string | null) => {
  if (!iso) return NO_DATA;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? NO_DATA
    : d.toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
};

const STATUS_META: Record<VehicleSyncStatus, { label: string; badge: string; Icon: any }> = {
  pending: { label: 'у черзі', badge: 'badge-neutral', Icon: Circle },
  active: { label: 'обробка', badge: 'badge-warn', Icon: Loader2 },
  done: { label: 'готово', badge: 'badge-success', Icon: CheckCircle2 },
  error: { label: 'помилка', badge: 'badge-danger', Icon: AlertTriangle },
};

export default function GpsSyncView() {
  const { authenticated } = useAuthGuard();
  const { data: p, error, refresh } = usePolledStatus<GpsProgress>(
    '/api/gps/progress',
    authenticated,
  );
  const activeRowRef = useRef<HTMLTableRowElement>(null);

  // Тримаємо активну машину в полі зору.
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [p?.currentIdgps]);

  if (!authenticated) return null;

  const pct =
    p && p.vehiclesTotal > 0 ? Math.round((p.vehiclesDone / p.vehiclesTotal) * 100) : 0;

  const statusChip = p ? (
    <span
      className={`badge ${
        !p.enabled ? 'badge-neutral' : p.running ? 'badge-warn' : 'badge-success'
      }`}
    >
      {!p.enabled ? 'вимкнено' : p.running ? 'працює' : 'очікує'}
    </span>
  ) : null;

  return (
    <SyncShell
      title="Закачка GPS з Ruptela"
      subtitle="Фоновий запис координат у p_gps.AddGps — по одній машині, послідовно · оновлення раз на 20 с"
      status={statusChip}
    >
      {error && (
        <div className="glass-panel flex items-center gap-2 border-danger/30 p-3 text-2xs text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {p && !p.enabled && (
        <div className="glass-panel flex items-start gap-2 p-4 text-2xs text-txt-secondary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <span>
            Синхронізацію вимкнено. Увімкніть її у <code>backend/.env</code>:{' '}
            <code>GPS_SYNC_ENABLED=true</code> (і перезапустіть сервіс).
          </span>
        </div>
      )}

      {p?.cooldownUntil && (
        <div className="glass-panel flex items-center gap-2 border-warn/30 p-3 text-2xs text-warn">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            Немає зв'язку з Ruptela — пауза. Наступна спроба о {clock(p.cooldownUntil)}.
          </span>
        </div>
      )}

      {/* ── зведення ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat">
          <span className="micro-label flex items-center gap-1.5">
            <Truck className="h-3 w-3" /> Машин у циклі
          </span>
          <span className="mt-1 block text-xl font-semibold tabular text-txt-primary">
            {p ? `${p.vehiclesDone}/${p.vehiclesTotal}` : NO_DATA}
          </span>
        </div>
        <div className="stat">
          <span className="micro-label flex items-center gap-1.5">
            <DownloadCloud className="h-3 w-3" /> Точок за цикл
          </span>
          <span className="mt-1 block text-xl font-semibold tabular text-warn">
            {p ? p.totalWrittenThisCycle.toLocaleString('uk-UA') : NO_DATA}
          </span>
        </div>
        <div className="stat">
          <span className="micro-label flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Останній цикл
          </span>
          <span className="mt-1 block text-sm font-semibold text-txt-primary">
            {p?.lastCycle
              ? `${p.lastCycle.written} точок · ${Math.round(p.lastCycle.durationMs / 1000)}с`
              : NO_DATA}
          </span>
          <span className="mt-0.5 block text-2xs text-txt-muted">
            {p?.lastCycle ? clock(p.lastCycle.at) : ''}
          </span>
        </div>
        <div className="stat">
          <span className="micro-label flex items-center gap-1.5">
            <Gauge className="h-3 w-3" /> Параметри
          </span>
          <span className="mt-1 block text-2xs leading-relaxed text-txt-secondary">
            {p ? (
              <>
                TZ+{p.config.tzOffsetHours}год · старт {p.config.defaultStart}
                <br />
                ліміт {p.config.limit}/машину
              </>
            ) : (
              NO_DATA
            )}
          </span>
        </div>
      </div>

      {/* ── прогрес-бар циклу ────────────────────────────────────────────── */}
      <div className="glass-panel p-4">
        <div className="mb-2 flex items-center justify-between text-2xs text-txt-muted">
          <span className="micro-label">Прогрес циклу</span>
          <span className="tabular">{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-inset">
          <div
            className="h-full rounded-full bg-warn transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {p?.running && p.currentIdgps && (
          <p className="mt-2 flex items-center gap-1.5 text-2xs text-warn">
            <Loader2 className="h-3 w-3 animate-spin" />
            Зараз: {p.vehicles.find((v) => v.idgps === p.currentIdgps)?.dernom ?? p.currentIdgps}
          </p>
        )}
      </div>

      {/* ── таблиця машин ────────────────────────────────────────────────── */}
      <div className="glass-panel overflow-hidden p-0">
        <div className="hairline-b flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-txt-primary">Машини</h3>
          <button onClick={refresh} className="btn btn-ghost h-7 px-2 text-micro">
            <RefreshCw className="h-3 w-3" /> Оновити
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Машина</th>
                <th>ID Ruptela</th>
                <th>Статус</th>
                <th>Від дати</th>
                <th className="text-right">Отримано</th>
                <th className="text-right">Записано</th>
                <th>Час</th>
              </tr>
            </thead>
            <tbody>
              {!p || p.vehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-2xs text-txt-muted">
                    {p ? 'Ще не було жодного циклу' : 'Завантаження…'}
                  </td>
                </tr>
              ) : (
                p.vehicles.map((v) => {
                  const meta = STATUS_META[v.status];
                  const Icon = meta.Icon;
                  const isActive = v.status === 'active';
                  return (
                    <tr
                      key={v.idgps || v.kod}
                      ref={isActive ? activeRowRef : undefined}
                      className={isActive ? 'bg-warn/5' : ''}
                    >
                      <td className="font-medium text-txt-primary">{v.dernom || NO_DATA}</td>
                      <td className="font-mono text-2xs text-txt-muted">{v.idgps}</td>
                      <td>
                        <span className={`badge ${meta.badge} inline-flex items-center gap-1`}>
                          <Icon className={`h-3 w-3 ${isActive ? 'animate-spin' : ''}`} />
                          {meta.label}
                        </span>
                        {v.error && (
                          <span className="mt-0.5 block max-w-[220px] truncate text-2xs text-danger" title={v.error}>
                            {v.error}
                          </span>
                        )}
                      </td>
                      <td className="text-2xs text-txt-secondary">{fromLabel(v.from)}</td>
                      <td className="text-right tabular text-txt-secondary">
                        {v.fetched || (v.status === 'done' ? 0 : NO_DATA)}
                      </td>
                      <td className="text-right tabular font-semibold text-warn">
                        {v.written || (v.status === 'done' ? 0 : NO_DATA)}
                      </td>
                      <td className="text-2xs text-txt-muted">{clock(v.at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SyncShell>
  );
}
