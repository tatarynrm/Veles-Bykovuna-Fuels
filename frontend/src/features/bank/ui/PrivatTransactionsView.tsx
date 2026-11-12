'use client';

/**
 * Банк → Приват24: виписка з «Автоклієнта» (Приват24 для бізнесу), лише читання.
 * Тягнемо всі операції за період і залишки по рахунках; нічого не пишемо ні в банк, ні в Oracle —
 * це підготовка даних для майбутнього збереження в базу й привʼязки до рейсів.
 * Технічний екран (текст авторський, у i18n EXCLUDE).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileJson,
  FileSpreadsheet,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import { useAuthGuard, useSessionUser } from '@/lib/useAuthGuard';
import type { PrivatBalance, PrivatTransaction } from '@/shared/contracts';
import BankShell from './BankShell';
import { NO_DATA, count, dmy, dmyHm, localYmd, money, shortIban } from '../model/format';
import { usePrivatStatements, type PrivatRequest } from '../model/usePrivatStatements';
import {
  downloadText,
  filterTransactions,
  summarizeByCurrency,
  transactionsToCsv,
  type DirectionFilter,
} from '../model/statements';

const PAGE_SIZE = 50;

type PresetKey = 'today' | '7' | '30' | 'month' | '90' | 'custom';

const PRESETS: { key: Exclude<PresetKey, 'custom'>; label: string }[] = [
  { key: 'today', label: 'Сьогодні' },
  { key: '7', label: '7 днів' },
  { key: '30', label: '30 днів' },
  { key: 'month', label: 'Цей місяць' },
  { key: '90', label: '90 днів' },
];

const STATUS_BADGE: Record<string, string> = {
  r: 'badge-success',
  p: 'badge-warn',
  t: 'badge-neutral',
  n: 'badge-danger',
};

const monthStart = () => `${localYmd().slice(0, 8)}01`;

/**
 * Діапазон для пресету. «Сьогодні» — виписка за період `сьогодні..сьогодні`, а НЕ проміжна
 * (interim): проміжна віддає «від попереднього операційного дня до сьогодні», тобто разом із
 * вчорашніми операціями (на живих даних 138 вчорашніх із 187), а за період — лише сьогоднішні,
 * з тією самою останньою операцією.
 */
function presetRequest(key: Exclude<PresetKey, 'custom'>): PrivatRequest {
  const to = localYmd();
  switch (key) {
    case 'today':
      return { scope: 'period', from: to, to };
    case '7':
      return { scope: 'period', from: localYmd(-7), to };
    case '30':
      return { scope: 'period', from: localYmd(-30), to };
    case '90':
      return { scope: 'period', from: localYmd(-90), to };
    case 'month':
      return { scope: 'period', from: monthStart(), to };
  }
}

export default function PrivatTransactionsView() {
  const { authenticated } = useAuthGuard();
  const { user, isGuest } = useSessionUser();
  const ready = authenticated && Boolean(user) && !isGuest;

  const { transactions, balances, loading, error, balanceError, load } = usePrivatStatements(ready);

  // За замовчуванням — сьогодні (було 7 днів).
  const [preset, setPreset] = useState<PresetKey>('today');
  const [from, setFrom] = useState(() => localYmd());
  const [to, setTo] = useState(() => localYmd());
  /** Що саме показано зараз — щоб підпис і експорт не залежали від полів, які вже встигли змінити. */
  const [shown, setShown] = useState<PrivatRequest | null>(null);

  const [account, setAccount] = useState<string | null>(null);
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const run = useCallback(
    (req: PrivatRequest, force = false) => {
      setShown(req);
      setPage(1);
      setOpen(new Set());
      void load(req, force);
    },
    [load],
  );

  // Перше завантаження — сьогодні.
  useEffect(() => {
    if (ready) run(presetRequest('today'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const pickPreset = (key: Exclude<PresetKey, 'custom'>) => {
    const req = presetRequest(key);
    setPreset(key);
    setFrom(req.from);
    setTo(req.to);
    run(req);
  };

  const items = transactions?.items ?? [];
  const filtered = useMemo(
    () => filterTransactions(items, { account, direction, query }),
    [items, account, direction, query],
  );
  const summary = useMemo(() => summarizeByCurrency(filtered), [filtered]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Рахунки: з залишків, а якщо їх не вдалося отримати — з тих, що трапились в операціях.
  const accounts = useMemo(() => {
    const seen = new Set<string>();
    const rows: PrivatBalance[] = [];
    for (const b of balances?.items ?? []) {
      if (!b.account || seen.has(b.account)) continue;
      seen.add(b.account);
      rows.push(b);
    }
    return rows.sort((a, b) =>
      a.currency === b.currency ? (a.account ?? '').localeCompare(b.account ?? '') : a.currency === 'UAH' ? -1 : b.currency === 'UAH' ? 1 : (a.currency ?? '').localeCompare(b.currency ?? ''),
    );
  }, [balances]);

  const toggleRow = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const periodLabel = shown
    ? shown.scope === 'interim'
      ? 'сьогодні (проміжна виписка)'
      : shown.from === shown.to
        ? dmy(shown.from)
        : `${dmy(shown.from)} – ${dmy(shown.to)}`
    : NO_DATA;
  const fileStem = `privat24_${shown?.scope === 'interim' ? 'today_' + localYmd() : `${shown?.from ?? ''}_${shown?.to ?? ''}`}`;

  if (!authenticated) return null;

  const statusChip = transactions ? <span className="badge badge-accent">{count(transactions.total)} операцій</span> : null;

  const actions = (
    <>
      <span className="flex items-center gap-1 text-2xs text-txt-muted">
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => {
            setFrom(e.target.value);
            setPreset('custom');
          }}
          className="field h-8 w-[8.5rem] px-2 py-1 text-2xs"
          aria-label="Період від"
        />
        –
        <input
          type="date"
          value={to}
          min={from}
          onChange={(e) => {
            setTo(e.target.value);
            setPreset('custom');
          }}
          className="field h-8 w-[8.5rem] px-2 py-1 text-2xs"
          aria-label="Період до"
        />
      </span>
      <button
        onClick={() => run({ scope: 'period', from, to })}
        disabled={!ready || loading || !from || !to}
        className="btn btn-primary"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarRange className="h-3.5 w-3.5" />}
        Показати
      </button>
      <button
        onClick={() => shown && run(shown, true)}
        disabled={!ready || loading || !shown}
        className="btn btn-ghost"
        title="Перечитати з банку, минаючи кеш"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Оновити
      </button>
    </>
  );

  return (
    <BankShell
      title="Приват24 · Транзакції"
      subtitle="ПриватБанк · виписка рахунків з «Автоклієнта» — усі операції за період (лише читання)"
      status={statusChip}
      actions={actions}
    >
      {isGuest && (
        <section className="glass-panel flex flex-col items-center justify-center gap-3 p-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-panel bg-warn/10 text-warn">
            <Lock className="h-5 w-5" />
          </span>
          <h2 className="text-sm font-semibold text-txt-primary">Банківські виписки недоступні для гостя</h2>
          <p className="max-w-md text-2xs leading-relaxed text-txt-secondary">
            Це фінансові дані компанії. Увійдіть під робочим обліковим записом, щоб їх побачити.
          </p>
        </section>
      )}

      {ready && (
        <>
          {/* ── швидкий вибір періоду ───────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="segmented">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => pickPreset(p.key)}
                  disabled={loading}
                  aria-pressed={preset === p.key}
                  className={`segmented-item ${preset === p.key ? 'segmented-item-active text-accent' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className="text-2xs text-txt-muted">Період: {periodLabel}</span>
          </div>

          {error && (
            <div className="glass-panel flex items-start gap-2 border-danger/30 p-3 text-2xs text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {transactions?.truncated && (
            <div className="glass-panel flex items-start gap-2 border-warn/30 p-3 text-2xs text-txt-secondary">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
              <span>
                Виписка обірвана на {count(transactions.pages)} сторінках (стеля <code>PRIVAT_BANK_MAX_PAGES</code>) —
                банк мав ще дані. Звузьте період або підніміть стелю в <code>backend/.env</code>.
              </span>
            </div>
          )}

          {/* ── рахунки ─────────────────────────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="micro-label flex items-center gap-1.5">
                <Wallet className="h-3 w-3" /> Рахунки · залишок на кінець останнього фінального дня
              </h3>
              {account && (
                <button onClick={() => setAccount(null)} className="btn btn-ghost h-6 px-2 text-micro">
                  Усі рахунки
                </button>
              )}
            </div>

            {balanceError && (
              <div className="glass-panel mb-2 flex items-start gap-2 border-danger/30 p-3 text-2xs text-danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Залишки: {balanceError}</span>
              </div>
            )}

            {loading && !balances ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-24 rounded-panel" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {accounts.map((b) => {
                  const active = account === b.account;
                  return (
                    <button
                      key={b.account}
                      type="button"
                      onClick={() => setAccount(active ? null : b.account)}
                      aria-pressed={active}
                      className={`stat text-left transition-colors ${active ? 'ring-1 ring-accent' : 'hover:bg-surface-hover'}`}
                    >
                      <span className="micro-label flex items-center justify-between gap-2">
                        <span className="truncate" title={b.name ?? undefined}>
                          {b.name ?? 'Рахунок'}
                        </span>
                        <span className="badge badge-neutral">{b.currency ?? NO_DATA}</span>
                      </span>
                      <span className="mt-1 block text-lg font-semibold tabular text-txt-primary">
                        {money(b.balance_out, b.currency)}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-micro text-txt-muted" title={b.account ?? undefined}>
                        {b.account}
                      </span>
                      <span className="mt-0.5 block text-2xs text-txt-muted">
                        {b.last_movement ? `рух. ${dmy(b.last_movement)}` : ''}
                        {b.state ? ` · стан ${b.state}` : ''}
                      </span>
                    </button>
                  );
                })}
                {!loading && accounts.length === 0 && !balanceError && (
                  <p className="text-2xs text-txt-muted">Банк не повернув жодного рахунку.</p>
                )}
              </div>
            )}
          </div>

          {/* ── підсумки за вибраним ────────────────────────────────────── */}
          {summary.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summary.map((s) => (
                <div key={s.currency} className="stat">
                  <span className="micro-label flex items-center justify-between">
                    <span>Рух за період · {s.currency}</span>
                    <span className="tabular">{count(s.count)} оп.</span>
                  </span>
                  <span className={`mt-1 block text-lg font-semibold tabular ${s.net < 0 ? 'text-txt-primary' : 'text-accent'}`}>
                    {s.net > 0 ? '+' : ''}
                    {money(s.net, s.currency)}
                  </span>
                  <span className="mt-0.5 flex items-center gap-3 text-2xs text-txt-muted">
                    <span className="flex items-center gap-1 text-accent">
                      <ArrowDownLeft className="h-3 w-3" /> {money(s.credit, s.currency)}
                    </span>
                    <span className="flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3" /> {money(s.debit, s.currency)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── операції ────────────────────────────────────────────────── */}
          <div className="glass-panel overflow-hidden p-0">
            <div className="hairline-b flex flex-wrap items-center gap-2 px-4 py-3">
              <h3 className="mr-auto text-sm font-semibold text-txt-primary">
                Операції
                {transactions && (
                  <span className="ml-2 text-2xs font-normal text-txt-muted">
                    {filtered.length === items.length
                      ? count(items.length)
                      : `${count(filtered.length)} з ${count(items.length)}`}
                    {' · '}
                    {count(transactions.pages)} стор. банку
                  </span>
                )}
              </h3>

              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-txt-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Контрагент, ЄДРПОУ, призначення…"
                  className="field h-8 w-[15rem] pl-7 text-2xs"
                  aria-label="Пошук по операціях"
                />
              </div>

              <div className="segmented">
                {(
                  [
                    ['all', 'Усі'],
                    ['credit', 'Надходження'],
                    ['debit', 'Списання'],
                  ] as [DirectionFilter, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={direction === key}
                    onClick={() => {
                      setDirection(key);
                      setPage(1);
                    }}
                    className={`segmented-item ${direction === key ? 'segmented-item-active text-accent' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => downloadText(`${fileStem}.csv`, 'text/csv', transactionsToCsv(filtered))}
                disabled={filtered.length === 0}
                className="btn btn-ghost h-8 px-2.5 text-2xs"
                title="Вивантажити те, що зараз у таблиці, у CSV (усі поля)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
              </button>
              <button
                onClick={() =>
                  downloadText(`${fileStem}.json`, 'application/json', JSON.stringify(filtered, null, 2))
                }
                disabled={filtered.length === 0}
                className="btn btn-ghost h-8 px-2.5 text-2xs"
                title="Вивантажити те, що зараз у таблиці, у JSON (усі поля)"
              >
                <FileJson className="h-3.5 w-3.5" /> JSON
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="w-8" />
                    <th>Дата</th>
                    <th>Рахунок</th>
                    <th>Контрагент</th>
                    <th>Призначення</th>
                    <th className="text-right">Сума</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !transactions ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-2xs text-txt-muted">
                        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin text-accent" />
                        Завантажую виписку з банку… Банк віддає не більше одного запиту на секунду, тож великі
                        періоди вантажаться довше.
                      </td>
                    </tr>
                  ) : visible.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-2xs text-txt-muted">
                        {transactions ? 'За цей період операцій немає' : error ? 'Виписку не отримано' : NO_DATA}
                      </td>
                    </tr>
                  ) : (
                    visible.map((tx) => (
                      <TxRow key={tx.id || `${tx.datetime}-${tx.doc_number}-${tx.amount}`} tx={tx} open={open.has(tx.id)} onToggle={() => toggleRow(tx.id)} />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="hairline-t flex items-center justify-between px-4 py-2.5 text-2xs text-txt-muted">
                <span className="tabular">
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} з {count(filtered.length)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(safePage - 1)}
                    disabled={safePage <= 1}
                    className="btn btn-ghost h-7 px-2"
                    aria-label="Попередня сторінка"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="tabular px-1">
                    {safePage} / {pages}
                  </span>
                  <button
                    onClick={() => setPage(safePage + 1)}
                    disabled={safePage >= pages}
                    className="btn btn-ghost h-7 px-2"
                    aria-label="Наступна сторінка"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="glass-panel flex items-start gap-2 p-4 text-2xs leading-relaxed text-txt-secondary">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-txt-muted" />
            <span>
              Дані читаються з API «Автоклієнт» (<code>/api/statements</code>) і нічого не змінюють у банку.
              Унікальна операція — <code>REF</code>+<code>REFN</code> (поле <code>id</code>); саме за ним
              ітимуть дублі при майбутньому запису в базу. «Сьогодні» — проміжна виписка (ще не фінальна),
              решта — за вибраний період. Підсумки не враховують сторновані (t) та забраковані (n) платежі.
              Експорт містить усі поля, які віддав банк. Кеш на бекенді — 1 хв.
            </span>
          </div>
        </>
      )}
    </BankShell>
  );
}

/* ── рядок операції + розгорнуті деталі ──────────────────────────────────── */

function TxRow({ tx, open, onToggle }: { tx: PrivatTransaction; open: boolean; onToggle: () => void }) {
  const credit = tx.direction === 'credit';
  const Arrow = credit ? ArrowDownLeft : ArrowUpRight;
  const status = tx.status?.toLowerCase() ?? '';
  return (
    <>
      <tr className={`cursor-pointer ${open ? 'bg-accent/5' : ''}`} onClick={onToggle}>
        <td>
          <ChevronDown className={`h-3.5 w-3.5 text-txt-muted transition-transform ${open ? '' : '-rotate-90'}`} />
        </td>
        <td className="whitespace-nowrap text-txt-secondary">{dmyHm(tx.datetime ?? tx.date)}</td>
        <td className="whitespace-nowrap font-mono text-2xs text-txt-muted" title={tx.account ?? undefined}>
          {shortIban(tx.account)}
        </td>
        <td className="max-w-[240px]">
          <span className="block truncate font-medium text-txt-primary" title={tx.counterparty.name ?? undefined}>
            {tx.counterparty.name ?? NO_DATA}
          </span>
          {tx.counterparty.code && <span className="block font-mono text-micro text-txt-muted">{tx.counterparty.code}</span>}
        </td>
        <td className="max-w-[360px]">
          <span className="block truncate text-txt-secondary" title={tx.purpose ?? undefined}>
            {tx.purpose ?? NO_DATA}
          </span>
        </td>
        <td className={`whitespace-nowrap text-right tabular font-semibold ${credit ? 'text-accent' : 'text-txt-primary'}`}>
          <span className="inline-flex items-center gap-1">
            <Arrow className="h-3 w-3" />
            {credit ? '+' : '−'}
            {money(tx.amount, tx.currency)}
          </span>
          {tx.currency && tx.currency !== 'UAH' && tx.amount_uah !== null && (
            <span className="block text-micro font-normal text-txt-muted">≈ {money(tx.amount_uah, 'UAH')}</span>
          )}
        </td>
        <td>
          <span className={`badge ${STATUS_BADGE[status] ?? 'badge-neutral'}`}>{tx.status_label ?? tx.status ?? NO_DATA}</span>
        </td>
      </tr>

      {open && (
        <tr className="bg-surface-inset/40">
          <td />
          <td colSpan={6} className="py-3">
            <TxDetails tx={tx} />
          </td>
        </tr>
      )}
    </>
  );
}

function TxDetails({ tx }: { tx: PrivatTransaction }) {
  const groups: { title: string; rows: [string, React.ReactNode][] }[] = [
    {
      title: 'Платіж',
      rows: [
        ['Ідентифікатор (REF+REFN)', tx.id],
        ['REF / REFN', `${tx.ref ?? NO_DATA} / ${tx.refn ?? NO_DATA}`],
        ['Номер документа', tx.doc_number],
        ['Тип документа', tx.doc_type],
        ['Дата операції', dmy(tx.date)],
        ['Дата клієнта', dmy(tx.date_client)],
        ['Час', tx.time],
        ['Сума в грн', money(tx.amount_uah, 'UAH')],
        ['Ознака реальності (FL_REAL)', tx.real_flag],
        ['ID у банку', tx.bank_row_id],
        ['Технічний ID', tx.technical_id],
        ['payment_pack_ref (DLR)', tx.payment_pack_ref],
        ['UETR', tx.uetr],
        ['Кінцевий (ULTMT)', tx.ultimate],
      ],
    },
    {
      title: 'Контрагент',
      rows: [
        ['Назва', tx.counterparty.name],
        ['ЄДРПОУ / ІПН', tx.counterparty.code],
        ['Рахунок', tx.counterparty.account],
        ['МФО', tx.counterparty.mfo],
        ['Банк', tx.counterparty.bank_name],
        ['Місто банку', tx.counterparty.bank_city],
      ],
    },
    {
      title: 'Наш рахунок',
      rows: [
        ['Назва', tx.me.name],
        ['ЄДРПОУ / ІПН', tx.me.code],
        ['Рахунок', tx.me.account],
        ['МФО', tx.me.mfo],
        ['Банк', tx.me.bank_name],
        ['Місто банку', tx.me.bank_city],
      ],
    },
  ];

  const ultimates: [string, PrivatTransaction['payer_ultimate']][] = [
    ['Кінцевий платник', tx.payer_ultimate],
    ['Кінцевий отримувач', tx.recipient_ultimate],
  ];
  const ultimateRows = ultimates.flatMap(([title, u]) =>
    u.name || u.nceo || u.document || u.country_code
      ? [{ title, rows: [['Назва', u.name], ['Код', u.nceo], ['Документ', u.document], ['Країна', u.country_code]] as [string, React.ReactNode][] }]
      : [],
  );
  if (tx.struct_code || tx.struct_type || tx.struct_category) {
    ultimateRows.push({
      title: 'Податковий платіж',
      rows: [
        ['Код', tx.struct_code],
        ['Тип', tx.struct_type],
        ['Категорія', tx.struct_category],
      ],
    });
  }

  return (
    <div className="space-y-3">
      {tx.purpose && (
        <p className="text-2xs leading-relaxed text-txt-secondary">
          <span className="micro-label mr-2">Призначення</span>
          {tx.purpose}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...groups, ...ultimateRows].map((g) => (
          <div key={g.title}>
            <p className="micro-label mb-1">{g.title}</p>
            <dl className="space-y-0.5 text-2xs">
              {g.rows.map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="w-40 shrink-0 text-txt-muted">{label}</dt>
                  <dd className="min-w-0 break-all font-medium text-txt-primary">
                    {value === null || value === undefined || value === '' ? NO_DATA : value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
