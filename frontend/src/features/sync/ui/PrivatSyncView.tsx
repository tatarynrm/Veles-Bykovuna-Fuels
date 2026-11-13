'use client';

/**
 * Синхронізація транзакцій ПриватБанку → Oracle (P_BANK.AddBankV → BANKV): кроном за розкладом
 * плюс ручний запуск і «пробний прохід» (нічого не записує, показує, що пішло б у процедуру).
 * Показує стан ОСТАННЬОГО проходу — як і сторінка Нової Пошти: прогресу по рядках немає.
 * Опитує GET /api/privat/sync-status раз на 20 с, під час проходу — раз на 5 с.
 * Банківські дані гостю недоступні (сервер віддає 403), тож гість бачить заглушку.
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
  FlaskConical,
  Info,
  Loader2,
  Play,
  RefreshCw,
  Timer,
} from 'lucide-react';
import { useAuthGuard, useSessionUser } from '@/lib/useAuthGuard';
import { apiSend } from '@/lib/api';
import { GuestBlockedPanel } from '@/components/GuestLock';
import SyncShell from './SyncShell';
import { SYNC_POLL_MS, usePolledStatus } from '../model/usePolledStatus';
import type { PrivatSyncRun, PrivatSyncStatus, VehicleSyncStatus } from '../model/types';

const NO_DATA = '—';
const RUNNING_POLL_MS = 5_000;
/** Довший за це період перед записом просить підтвердження: це десятки вікон і живий запис у БД. */
const CONFIRM_DAYS = 31;

const WINDOW_STATUS: Record<VehicleSyncStatus, { label: string; badge: string; Icon: typeof Circle }> = {
  pending: { label: 'у черзі', badge: 'badge-neutral', Icon: Circle },
  active: { label: 'обробка', badge: 'badge-warn', Icon: Loader2 },
  done: { label: 'готово', badge: 'badge-success', Icon: CheckCircle2 },
  error: { label: 'помилка', badge: 'badge-danger', Icon: AlertTriangle },
};

/** Місцева дата для <input type="date">, зі зсувом у днях. */
const localYmd = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const daysIn = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/** "2026-11-11" → "11.11.2026". */
const dmy = (ymd: string | null | undefined) => (ymd ? ymd.split('-').reverse().join('.') : NO_DATA);

const dateTime = (iso: string | null | undefined) => {
  if (!iso) return NO_DATA;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? NO_DATA
    : d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const clock = (iso: string | null) => {
  if (!iso) return NO_DATA;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? NO_DATA : d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const duration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 90 ? `${s} с` : `${Math.floor(s / 60)} хв ${s % 60} с`;
};

const n = (value: number) => value.toLocaleString('uk-UA');
const sum = (value: number) => value.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PrivatSyncView() {
  const { authenticated } = useAuthGuard();
  const { isGuest } = useSessionUser();
  const [pollMs, setPollMs] = useState(SYNC_POLL_MS);
  const { data: s, error, refresh } = usePolledStatus<PrivatSyncStatus>(
    '/api/privat/sync-status',
    authenticated && !isGuest,
    pollMs,
  );
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [starting, setStarting] = useState<'run' | 'period' | 'dry' | null>(null);
  // Період для ручного запуску: за замовчуванням — сьогодні.
  const [from, setFrom] = useState(() => localYmd());
  const [to, setTo] = useState(() => localYmd());
  const activeRowRef = useRef<HTMLTableRowElement>(null);

  const running = Boolean(s?.running);
  const activeFrom = s?.windows.find((w) => w.status === 'active')?.from;

  // Під час проходу оновлюємося частіше, щоб одразу побачити результат.
  useEffect(() => {
    setPollMs(running ? RUNNING_POLL_MS : SYNC_POLL_MS);
  }, [running]);

  // Таблиця вікон сама прокручується до того, що зараз у роботі.
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeFrom]);

  if (!authenticated) return null;

  const meta = {
    title: 'Синхронізація ПриватБанку',
    subtitle: 'Транзакції рахунків → Oracle (P_BANK.AddBankV, таблиця BANKV) · кроном за розкладом, або вручну',
  };

  if (isGuest) {
    return (
      <SyncShell {...meta}>
        <GuestBlockedPanel
          title="Лише для співробітників"
          description="Банківські виписки компанії недоступні для гостьового входу."
        />
      </SyncShell>
    );
  }

  const last = s?.lastRun ?? null;
  const canRun = Boolean(s?.enabled && s.oracleConfigured && s.bankConfigured && !running && !starting);
  // Пробний прохід нічого не пише, тож не потребує ні прапорця, ні Oracle.
  const canDry = Boolean(s?.bankConfigured && !running && !starting);

  const chosenDays = from && to && from <= to ? daysIn(from, to) : 0;
  const windowDays = s?.config.windowDays ?? 7;
  const chosenWindows = Math.ceil(chosenDays / windowDays);

  /**
   * `recent` — сьогодні + кілька попередніх днів (як крон); `period` — вибраний діапазон, який іде
   * вікнами по черзі; `dry` — пробний прохід за вибраний діапазон (нічого не записує).
   */
  const start = async (kind: 'run' | 'period' | 'dry') => {
    if (
      kind === 'period' &&
      chosenDays > CONFIRM_DAYS &&
      !window.confirm(
        `Передати в Oracle всі проведені транзакції ПриватБанку за ${dmy(from)} – ${dmy(to)} ` +
          `(${n(chosenDays)} дн., ${n(chosenWindows)} вікон по черзі)?\n` +
          'Те, що вже є в BANKV, пропускається.',
      )
    ) {
      return;
    }
    setStarting(kind);
    try {
      const body = kind === 'run' ? {} : kind === 'dry' ? { dryRun: true, from, to } : { from, to };
      const res = await apiSend<{ started: boolean; message: string }>('POST', '/api/privat/sync', body);
      setNotice({ ok: res.started, text: res.message });
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message ?? 'Не вдалося запустити синхронізацію' });
    } finally {
      setStarting(null);
      refresh();
    }
  };

  const statusChip = s ? (
    <span className={`badge ${!s.enabled ? 'badge-neutral' : running ? 'badge-warn' : 'badge-success'}`}>
      {!s.enabled ? 'вимкнено' : running ? 'працює' : 'очікує'}
    </span>
  ) : null;

  const periodOk = chosenDays > 0 && chosenDays <= (s?.config.maxPeriodDays ?? 1100);
  const windows = s?.windows ?? [];
  const activeWindow = windows.find((w) => w.status === 'active');
  const pct = s && s.windowsTotal > 0 ? Math.round((s.windowsDone / s.windowsTotal) * 100) : 0;
  const dryShown = Boolean(last?.dryRun);

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
          max={localYmd()}
          onChange={(e) => setTo(e.target.value)}
          className="field h-8 w-[8.5rem] px-2 py-1 text-2xs"
          aria-label="Період до"
        />
      </span>
      <button
        onClick={() => start('dry')}
        disabled={!canDry || !periodOk}
        className="btn btn-ghost"
        title="Нічого не записує: показує, що пішло б у Oracle за вибраний період"
      >
        {starting === 'dry' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
        Пробний прохід
      </button>
      <button
        onClick={() => start('period')}
        disabled={!canRun || !periodOk}
        className="btn btn-ghost"
        title={chosenWindows > 1 ? `${n(chosenWindows)} вікон по ${windowDays} дн., по черзі від найстарішого` : undefined}
      >
        {starting === 'period' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarRange className="h-3.5 w-3.5" />}
        За період
      </button>
      <button onClick={() => start('run')} disabled={!canRun} className="btn btn-primary">
        {running || starting === 'run' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        {running ? 'Триває…' : 'Запустити зараз'}
      </button>
    </>
  );

  return (
    <SyncShell {...meta} status={statusChip} actions={actions}>
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
            Запис у базу вимкнено — він пише в живу таблицю. Щоб увімкнути, задайте <code>privat.enabled: true</code> у{' '}
            <code>{s.config.configFile}</code> (зміни підхоплюються без перезапуску). «Пробний прохід» працює й так.
          </span>
        </div>
      )}

      {s && !s.bankConfigured && (
        <div className="glass-panel flex items-start gap-2 p-4 text-2xs text-txt-secondary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <span>
            ПриватБанк не налаштовано. Задайте <code>PRIVAT_BANK_API_KEY</code> у <code>backend/.env</code>.
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

      {running && (
        <div className="glass-panel space-y-2 border-warn/30 p-4">
          <div className="flex items-center justify-between text-2xs text-warn">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              Триває прохід, запущено о {clock(s?.startedAt ?? null)}
              {s?.period ? ` · ${dmy(s.period.from)} – ${dmy(s.period.to)}` : ''}
            </span>
            <span className="tabular">
              {s ? `${s.windowsDone}/${s.windowsTotal} вікон · ${pct}%` : ''}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-inset">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          {activeWindow && (
            <p className="text-2xs text-txt-muted">
              Зараз: {dmy(activeWindow.from)} – {dmy(activeWindow.to)}
            </p>
          )}
        </div>
      )}

      {/* ── зведення ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat">
          <span className="micro-label flex items-center gap-1.5">
            <DownloadCloud className="h-3 w-3" /> {last?.dryRun ? 'Пішло б у BANKV' : 'Нових у BANKV'}
          </span>
          <span className="mt-1 block text-xl font-semibold tabular text-accent">
            {last ? n(last.dryRun ? last.sent : last.inserted) : NO_DATA}
          </span>
          <span className="mt-0.5 block text-2xs text-txt-muted">
            {last ? `вже були ${n(last.alreadyStored)} · пропущено ${n(last.skipped)}${last.failed ? ` · помилок ${n(last.failed)}` : ''}` : ''}
          </span>
        </div>
        <div className="stat">
          <span className="micro-label flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Останній прохід
          </span>
          <span className="mt-1 block text-sm font-semibold text-txt-primary">{last ? dateTime(last.at) : NO_DATA}</span>
          <span className="mt-0.5 block text-2xs text-txt-muted">
            {last ? `${last.ok ? 'успішно' : 'з помилкою'} · ${duration(last.durationMs)} · ${last.trigger === 'cron' ? 'крон' : 'вручну'}${last.dryRun ? ' · пробний' : ''}` : ''}
          </span>
        </div>
        <div className="stat">
          <span className="micro-label flex items-center gap-1.5">
            <CalendarRange className="h-3 w-3" /> Період
          </span>
          <span className="mt-1 block text-sm font-semibold text-txt-primary">
            {last ? (last.from === last.to ? dmy(last.from) : `${dmy(last.from)} – ${dmy(last.to)}`) : NO_DATA}
          </span>
          <span className="mt-0.5 block text-2xs text-txt-muted">
            {last
              ? last.windowsTotal > 1
                ? `${last.windowsDone}/${last.windowsTotal} вікон${last.mode === 'period' ? ' · вибраний період' : ''}`
                : last.mode === 'period'
                  ? 'вибраний період'
                  : s && s.config.lookbackDays > 0
                    ? `сьогодні + ${s.config.lookbackDays} попер. дн.`
                    : 'лише сьогодні'
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

      {/* ── вікна проходу: йдуть чергою, від найстарішого ────────────────── */}
      {windows.length > 1 && (
        <div className="glass-panel overflow-hidden p-0">
          <div className="hairline-b flex items-center justify-between px-4 py-3">
            <h3 className="text-sm font-semibold text-txt-primary">Вікна періоду</h3>
            <span className="text-2xs text-txt-muted">
              по {s?.config.windowDays ?? 7} дн., по черзі від найстарішого
            </span>
          </div>
          <div className="max-h-[22rem] overflow-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Період</th>
                  <th>Статус</th>
                  <th className="text-right">Отримано</th>
                  <th className="text-right">Пропущено</th>
                  <th className="text-right">{dryShown ? 'Пішло б' : 'Нових'}</th>
                  <th className="text-right">Вже в базі</th>
                  <th className="text-right">Помилок</th>
                  <th>Час</th>
                </tr>
              </thead>
              <tbody>
                {windows.map((w) => {
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
                          <span className="mt-0.5 block max-w-[320px] truncate text-2xs text-danger" title={w.error}>
                            {w.error}
                          </span>
                        )}
                      </td>
                      <td className="text-right tabular text-txt-secondary">{touched ? n(w.fetched) : NO_DATA}</td>
                      <td className="text-right tabular text-txt-muted">{touched ? n(w.skipped) : NO_DATA}</td>
                      <td className="text-right tabular font-semibold text-accent">
                        {touched ? n(dryShown ? w.sent : w.inserted) : NO_DATA}
                      </td>
                      <td className="text-right tabular text-txt-secondary">{touched ? n(w.alreadyStored) : NO_DATA}</td>
                      <td className={`text-right tabular ${w.failed ? 'font-semibold text-danger' : 'text-txt-muted'}`}>
                        {touched ? n(w.failed) : NO_DATA}
                      </td>
                      <td className="text-2xs text-txt-muted">{clock(w.at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── останній прохід ──────────────────────────────────────────────── */}
      <div className="glass-panel overflow-hidden p-0">
        <div className="hairline-b flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-txt-primary">Останній прохід</h3>
          <button onClick={refresh} className="btn btn-ghost h-7 px-2 text-micro">
            <RefreshCw className="h-3 w-3" /> Оновити
          </button>
        </div>

        {!s ? (
          <p className="py-8 text-center text-2xs text-txt-muted">Завантаження…</p>
        ) : !last ? (
          <p className="py-8 text-center text-2xs text-txt-muted">
            Від старту сервісу ще не було жодного проходу. Натисніть «Запустити зараз» або дочекайтесь розкладу.
          </p>
        ) : (
          <LastRun run={last} />
        )}
      </div>

      {s && (
        <div className="glass-panel flex items-start gap-2 p-4 text-2xs leading-relaxed text-txt-secondary">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-txt-muted" />
          <span>
            Запис — процедурою <code>{s.config.procedure}</code>: вона лише додає нові рядки (дубль визначає за ID банку)
            і не оновлює наявні, тож повторний запуск безпечний. Пишуться лише проведені операції; напрямок у процедуру
            йде за змістом: надходження — <code>1</code> (прихід), списання — <code>2</code> (розхід). Вибраний період
            ділиться на вікна по {s.config.windowDays} дн., які йдуть по черзі від найстарішого; якщо вікно впало, прохід
            зупиняється, а наступний запуск продовжить із нього (до {n(s.config.maxPeriodDays)} дн. за раз). «Запустити
            зараз» і крон беруть сьогодні + {s.config.lookbackDays} попередніх дн. Розклад і вмикання — у файлі{' '}
            <code>{s.config.configFile}</code>, зміни підхоплюються без перезапуску.
          </span>
        </div>
      )}
    </SyncShell>
  );
}

function LastRun({ run }: { run: PrivatSyncRun }) {
  const cells: { label: string; value: number; tone?: string }[] = [
    { label: 'Отримано з банку', value: run.fetched },
    { label: 'Пропущено', value: run.skipped },
    { label: 'Вже в базі', value: run.alreadyStored },
    { label: run.dryRun ? 'Пішло б у процедуру' : 'Передано процедурі', value: run.sent },
    { label: 'Нових у BANKV', value: run.inserted, tone: 'font-semibold text-accent' },
    { label: 'Помилок', value: run.failed, tone: run.failed ? 'font-semibold text-danger' : '' },
  ];
  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2 text-2xs">
        {run.ok ? (
          <span className="badge badge-success inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Успішно
          </span>
        ) : (
          <span className="badge badge-danger inline-flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Помилка
          </span>
        )}
        {run.dryRun && <span className="badge badge-warn">пробний прохід — нічого не записано</span>}
        <span className="text-txt-muted">
          {dateTime(run.at)} · {run.trigger === 'cron' ? 'крон' : 'вручну'}
        </span>
      </div>

      {run.error && <div className="glass-inset border-danger/30 p-3 text-2xs text-danger">{run.error}</div>}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-2xs sm:grid-cols-3 lg:grid-cols-6">
        {cells.map((c) => (
          <div key={c.label}>
            <dt className="micro-label">{c.label}</dt>
            <dd className={`mt-0.5 tabular text-txt-primary ${c.tone ?? ''}`}>{n(c.value)}</dd>
          </div>
        ))}
      </dl>

      {run.errors.length > 0 && (
        <div>
          <p className="micro-label mb-1">Помилки процедури (перші {run.errors.length})</p>
          <ul className="glass-inset space-y-1 p-3 text-2xs text-danger">
            {run.errors.map((e) => (
              <li key={e} className="break-all">
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {run.sample && run.sample.length > 0 && (
        <div>
          <p className="micro-label mb-1">Зразок: так рядки підуть у AddBankV (перші {run.sample.length})</p>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Час документа</th>
                  <th>pDk</th>
                  <th className="text-right">Сума</th>
                  <th className="text-right">Сума, грн</th>
                  <th>Контрагент</th>
                  <th>Призначення</th>
                </tr>
              </thead>
              <tbody>
                {run.sample.map((r) => (
                  <tr key={r.bank_trans_id}>
                    <td className="whitespace-nowrap text-txt-secondary">{r.doc_date.replace('T', ' ')}</td>
                    <td>
                      <span className={`badge ${r.dk === '1' ? 'badge-success' : 'badge-neutral'}`}>
                        {r.dk} · {r.dk === '1' ? 'прихід' : 'розхід'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-right tabular">
                      {sum(r.suma)} {r.valut_idnt ?? ''}
                    </td>
                    <td className="whitespace-nowrap text-right tabular text-txt-secondary">
                      {r.suma_uah === null ? NO_DATA : sum(r.suma_uah)}
                    </td>
                    <td className="max-w-[16rem] truncate text-txt-secondary" title={r.ur_name ?? ''}>
                      {r.ur_name ?? NO_DATA}
                    </td>
                    <td className="max-w-[22rem] truncate text-txt-muted" title={r.prizn ?? ''}>
                      {r.prizn ?? NO_DATA}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
