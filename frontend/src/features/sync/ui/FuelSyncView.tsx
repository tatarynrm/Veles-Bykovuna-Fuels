'use client';

/**
 * Синхронізація транзакцій паливних карток OKKO / Shell → Oracle
 * (P_API_TRUCK_PAY.save_transaction → TZ_TRANS): крон щодня о 09:00 і 15:00 + ручний запуск (останні дні, період або все).
 * Показує прохід по місячних вікнах: скільки отримано від вендора, пропущено, нових.
 * Опитує GET /api/fuel-sync/:vendor раз на 20 с, під час проходу — раз на 5 с.
 * Технічний ops-екран (текст авторський, у i18n EXCLUDE).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Circle,
  Clock,
  DownloadCloud,
  History,
  Info,
  Loader2,
  Play,
  RefreshCw,
  Timer,
} from 'lucide-react';
import { useAuthGuard, useSessionUser } from '@/lib/useAuthGuard';
import { apiSend } from '@/lib/api';
import { GuestBanner } from '@/components/GuestLock';
import SyncShell from './SyncShell';
import { SYNC_POLL_MS, usePolledStatus } from '../model/usePolledStatus';
import type {
  FuelSyncMode,
  FuelSyncStatus,
  FuelSyncWindow,
  FuelVendorKey,
  VehicleSyncStatus,
} from '../model/types';

const NO_DATA = '—';
const RUNNING_POLL_MS = 5_000;

const VENDOR: Record<FuelVendorKey, { title: string; subtitle: string; flag: string }> = {
  okko: {
    title: 'Синхронізація OKKO',
    subtitle: 'Транзакції паливних карток OKKO → Oracle, таблиця TZ_TRANS · крон щодня о 09:00 і 15:00, або вручну',
    flag: 'OKKO_SYNC_ENABLED',
  },
  shell: {
    title: 'Синхронізація Shell',
    subtitle: 'Продажі й збори Shell (суми в EUR, як у рахунку) → Oracle, таблиця TZ_TRANS · крон щодня о 09:00 і 15:00, або вручну',
    flag: 'SHELL_SYNC_ENABLED',
  },
};

const WINDOW_STATUS: Record<VehicleSyncStatus, { label: string; badge: string; Icon: typeof Circle }> = {
  pending: { label: 'у черзі', badge: 'badge-neutral', Icon: Circle },
  active: { label: 'обробка', badge: 'badge-warn', Icon: Loader2 },
  done: { label: 'готово', badge: 'badge-success', Icon: CheckCircle2 },
  error: { label: 'помилка', badge: 'badge-danger', Icon: AlertTriangle },
};

/** "2025-01-01" → "01.01.2025". */
const dmy = (ymd: string | null | undefined) => (ymd ? ymd.split('-').reverse().join('.') : NO_DATA);

const dateTime = (iso: string | null | undefined) => {
  if (!iso) return NO_DATA;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? NO_DATA
    : d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const clock = (iso: string | null) => {
  if (!iso) return NO_DATA;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? NO_DATA
    : d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const duration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 90 ? `${s} с` : `${Math.floor(s / 60)} хв ${s % 60} с`;
};

const n = (value: number) => value.toLocaleString('uk-UA');

/** Місцева дата у форматі для <input type="date">, зі зсувом у днях. */
const localYmd = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const sumWindows = (
  windows: FuelSyncWindow[],
  key: 'fetched' | 'skipped' | 'alreadyStored' | 'sent' | 'inserted' | 'failed',
) =>
  windows.reduce((total, w) => total + w[key], 0);

export default function FuelSyncView({ vendor }: { vendor: FuelVendorKey }) {
  const { authenticated } = useAuthGuard();
  const { isGuest } = useSessionUser();
  const [pollMs, setPollMs] = useState(SYNC_POLL_MS);
  const { data: s, error, refresh } = usePolledStatus<FuelSyncStatus>(`/api/fuel-sync/${vendor}`, authenticated, pollMs);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [starting, setStarting] = useState(false);
  // Період для ручного запуску: за замовчуванням — той самий тиждень, що бере крон.
  const [to, setTo] = useState(() => localYmd());
  const [from, setFrom] = useState(() => localYmd(-7));
  const activeRowRef = useRef<HTMLTableRowElement>(null);

  const running = Boolean(s?.running);
  const activeFrom = s?.windows.find((w) => w.status === 'active')?.from;

  // Під час проходу оновлюємося частіше, щоб було видно рух по вікнах.
  useEffect(() => {
    setPollMs(running ? RUNNING_POLL_MS : SYNC_POLL_MS);
  }, [running]);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeFrom]);

  if (!authenticated) return null;

  const meta = VENDOR[vendor];
  const windows = s?.windows ?? [];
  const last = s?.lastRun ?? null;
  const inserted = sumWindows(windows, 'inserted');
  // «Вже в базі» = пропущені до надсилання (звірка за id) + ті, що процедура впізнала як дубль.
  const existing = sumWindows(windows, 'alreadyStored') + sumWindows(windows, 'sent') - inserted;
  const skipped = sumWindows(windows, 'skipped');
  const failed = sumWindows(windows, 'failed');
  const pct = s && s.windowsTotal > 0 ? Math.round((s.windowsDone / s.windowsTotal) * 100) : 0;
  const canRun = Boolean(s?.enabled && s.oracleConfigured && !running && !starting && !isGuest);

  const start = async (mode: FuelSyncMode) => {
    if (!s) return;
    if (
      mode === 'full' &&
      !window.confirm(
        `Перечитати всі транзакції з ${dmy(s.config.startDate)} і передати в Oracle?
` +
          'Рядки, що вже є в TZ_TRANS, пропускаються.',
      )
    ) {
      return;
    }
    const body =
      mode === 'period' ? { from, to } : mode === 'full' ? { full: true } : {};
    setStarting(true);
    try {
      const res = await apiSend<{ started: boolean; message: string }>('POST', `/api/fuel-sync/${vendor}/run`, body);
      setNotice({ ok: res.started, text: res.message });
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message ?? 'Не вдалося запустити синхронізацію' });
    } finally {
      setStarting(false);
      refresh();
    }
  };
  const statusChip = s ? (
    <span className={`badge ${!s.enabled ? 'badge-neutral' : running ? 'badge-warn' : 'badge-success'}`}>
      {!s.enabled ? 'вимкнено' : running ? 'працює' : 'очікує'}
    </span>
  ) : null;

  const actions = (
    <>
      <span className="flex items-center gap-1 text-2xs text-txt-muted">
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
          className="field h-8 w-[8.5rem] px-2 py-1 text-2xs"
          aria-label="Період від"
        />
        –
        <input
          type="date"
          value={to}
          min={from}
          onChange={(e) => setTo(e.target.value)}
          className="field h-8 w-[8.5rem] px-2 py-1 text-2xs"
          aria-label="Період до"
        />
      </span>
      <button onClick={() => start('period')} disabled={!canRun || !from || !to} className="btn btn-ghost">
        <CalendarRange className="h-3.5 w-3.5" /> За період
      </button>
      <button onClick={() => start('full')} disabled={!canRun} className="btn btn-ghost">
        <History className="h-3.5 w-3.5" /> Повністю з {s ? dmy(s.config.startDate) : NO_DATA}
      </button>
      <button onClick={() => start('recent')} disabled={!canRun} className="btn btn-primary">
        {running || starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        {running ? 'Триває…' : `Останні ${s?.config.lookbackDays ?? 7} дн.`}
      </button>
    </>
  );
  return (
    <SyncShell title={meta.title} subtitle={meta.subtitle} status={statusChip} actions={actions}>
      {isGuest && <GuestBanner />}

      {error && (
        <div className="glass-panel flex items-center gap-2 border-danger/30 p-3 text-2xs text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div
          className={`glass-panel flex items-center gap-2 p-3 text-2xs ${
            notice.ok ? 'border-accent/30 text-accent' : 'border-danger/30 text-danger'
          }`}
        >
          {notice.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      {s && !s.enabled && (
        <div className="glass-panel flex items-start gap-2 p-4 text-2xs text-txt-secondary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <span>
            Синхронізацію вимкнено — вона пише в живу базу. Щоб увімкнути, задайте{' '}
            <code>{meta.flag}=true</code> у <code>backend/.env</code> і перезапустіть бекенд. Перший раз
            запустіть кнопкою «Повністю з {dmy(s.config.startDate)}», далі крон підтримує дані сам.
          </span>
        </div>
      )}

      {s?.enabled && !s.oracleConfigured && (
        <div className="glass-panel flex items-start gap-2 p-4 text-2xs text-txt-secondary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <span>
            Oracle не налаштовано. Задайте <code>ORACLE_USER</code> / <code>ORACLE_PASSWORD</code> /{' '}
            <code>ORACLE_CONNECT_STRING</code> у <code>backend/.env</code>.
          </span>
        </div>
      )}

      {!running && last && !last.ok && (
        <div className="glass-panel flex items-start gap-2 border-danger/30 p-3 text-2xs text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Останній прохід ({dateTime(last.at)}) зупинився з помилкою: {last.error}. Наступний запуск продовжить з
            того ж місця.
          </span>
        </div>
      )}

      {/* ── зведення ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat">
          <span className="micro-label flex items-center gap-1.5">
            <DownloadCloud className="h-3 w-3" /> Нових у TZ_TRANS
          </span>
          <span className="mt-1 block text-xl font-semibold tabular text-accent">{s ? n(inserted) : NO_DATA}</span>
          <span className="mt-0.5 block text-2xs text-txt-muted">
            {s && windows.length ? `вже були ${n(existing)} · пропущено ${n(skipped)}` : ''}
            {failed ? ` · помилок ${n(failed)}` : ''}
          </span>
        </div>
        <div className="stat">
          <span className="micro-label flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Останній прохід
          </span>
          <span className="mt-1 block text-sm font-semibold text-txt-primary">
            {running ? `триває з ${clock(s?.startedAt ?? null)}` : last ? dateTime(last.at) : NO_DATA}
          </span>
          <span className="mt-0.5 block text-2xs text-txt-muted">
            {last && !running
              ? `${last.ok ? 'успішно' : 'з помилкою'} · ${duration(last.durationMs)} · ${
                  last.trigger === 'cron' ? 'крон' : 'вручну'
                }`
              : ''}
          </span>
        </div>
        <div className="stat">
          <span className="micro-label flex items-center gap-1.5">
            <CalendarRange className="h-3 w-3" /> Період
          </span>
          <span className="mt-1 block text-sm font-semibold text-txt-primary">
            {s?.period ? `${dmy(s.period.from)} – ${dmy(s.period.to)}` : NO_DATA}
          </span>
          <span className="mt-0.5 block text-2xs text-txt-muted">
            {s?.mode === 'full'
              ? `повністю з ${dmy(s.config.startDate)}`
              : s?.mode === 'period'
                ? 'вибраний період'
                : s?.mode === 'recent'
                  ? `останні ${s.config.lookbackDays} дн.`
                  : ''}
          </span>
        </div>
        <div className="stat">
          <span className="micro-label flex items-center gap-1.5">
            <Timer className="h-3 w-3" /> Розклад
          </span>
          <span className="mt-1 block text-sm font-semibold text-txt-primary">{s ? s.config.cronLabel : NO_DATA}</span>
          <span className="mt-0.5 block text-2xs text-txt-muted">
            {s ? (s.nextRunAt ? `наступний ${dateTime(s.nextRunAt)}` : 'крон не активний') : ''}
          </span>
        </div>
      </div>

      {/* ── прогрес проходу ──────────────────────────────────────────────── */}
      <div className="glass-panel p-4">
        <div className="mb-2 flex items-center justify-between text-2xs text-txt-muted">
          <span className="micro-label">Прогрес проходу</span>
          <span className="tabular">
            {s ? `${s.windowsDone}/${s.windowsTotal} вікон · ${pct}%` : NO_DATA}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-inset">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        {running && activeFrom && (
          <p className="mt-2 flex items-center gap-1.5 text-2xs text-accent">
            <Loader2 className="h-3 w-3 animate-spin" />
            Зараз: {dmy(activeFrom)} – {dmy(s?.windows.find((w) => w.status === 'active')?.to)}
          </p>
        )}
      </div>

      {/* ── вікна проходу ────────────────────────────────────────────────── */}
      <div className="glass-panel overflow-hidden p-0">
        <div className="hairline-b flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-txt-primary">Вікна періоду</h3>
          <button onClick={refresh} className="btn btn-ghost h-7 px-2 text-micro">
            <RefreshCw className="h-3 w-3" /> Оновити
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Період</th>
                <th>Статус</th>
                <th className="text-right">Отримано</th>
                <th className="text-right">Пропущено</th>
                <th className="text-right">Нових</th>
                <th className="text-right">Вже в базі</th>
                <th className="text-right">Помилок</th>
                <th>Час</th>
              </tr>
            </thead>
            <tbody>
              {!s || windows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-2xs text-txt-muted">
                    {s ? 'Від старту сервісу ще не було жодного проходу' : 'Завантаження…'}
                  </td>
                </tr>
              ) : (
                windows.map((w) => {
                  const status = WINDOW_STATUS[w.status];
                  const Icon = status.Icon;
                  const isActive = w.status === 'active';
                  const touched = w.status === 'done' || w.status === 'error';
                  return (
                    <tr key={w.from} ref={isActive ? activeRowRef : undefined} className={isActive ? 'bg-accent/5' : ''}>
                      <td className="whitespace-nowrap font-medium text-txt-primary">
                        {dmy(w.from)} – {dmy(w.to)}
                      </td>
                      <td>
                        <span className={`badge ${status.badge} inline-flex items-center gap-1`}>
                          <Icon className={`h-3 w-3 ${isActive ? 'animate-spin' : ''}`} />
                          {status.label}
                        </span>
                        {w.error && (
                          <span className="mt-0.5 block max-w-[260px] truncate text-2xs text-danger" title={w.error}>
                            {w.error}
                          </span>
                        )}
                      </td>
                      <td className="text-right tabular text-txt-secondary">{touched ? n(w.fetched) : NO_DATA}</td>
                      <td className="text-right tabular text-txt-muted">{touched ? n(w.skipped) : NO_DATA}</td>
                      <td className="text-right tabular font-semibold text-accent">{touched ? n(w.inserted) : NO_DATA}</td>
                      <td className="text-right tabular text-txt-secondary">
                        {touched ? n(w.alreadyStored + w.sent - w.inserted) : NO_DATA}
                      </td>
                      <td className={`text-right tabular ${w.failed ? 'font-semibold text-danger' : 'text-txt-muted'}`}>
                        {touched ? n(w.failed) : NO_DATA}
                      </td>
                      <td className="text-2xs text-txt-muted">{clock(w.at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {s && (
        <div className="glass-panel flex items-start gap-2 p-4 text-2xs leading-relaxed text-txt-secondary">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-txt-muted" />
          <span>
            Запис — процедурою <code>{s.config.procedure}</code>: вона лише додає нові рядки (дубль визначається за{' '}
            <code>cctrans</code>) і не оновлює наявні, тож повторний запуск безпечний. «Запустити» перечитує дні від
            останньої записаної дати із запасом {s.config.lookbackDays} дн., «Повністю» — все з{' '}
            {dmy(s.config.startDate)}. Запит до вендора — вікнами по {s.config.windowDays} дн. Не записуються:{' '}
            {s.config.skippedLabel}.
            <br />
            Розклад, період і вмикання — у файлі <code>{s.config.configFile}</code>: правите просто на
            сервері, зміни підхоплюються без перезапуску.
          </span>
        </div>
      )}
    </SyncShell>
  );
}
