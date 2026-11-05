'use client';

/**
 * Банк → Приват24 → Карткові транзакції: корпоративні картки з окремого карткового API
 * («Автоклієнт», /api/corpcards). Це не виписка рахунків — інші ендпоінти й інші дані.
 * Лише читання: список карток із залишками та операції по картках за період, усе — з
 * експортом у CSV/JSON для майбутнього запису в базу й привʼязки до рейсів.
 * Технічний екран (текст авторський, у i18n EXCLUDE).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileJson,
  FileSpreadsheet,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useAuthGuard, useSessionUser } from '@/lib/useAuthGuard';
import type { PrivatCard, PrivatCardTransaction } from '@/shared/contracts';
import BankShell from './BankShell';
import { NO_DATA, count, dmy, dmyHm, localYmd, money } from '../model/format';
import {
  CARD_KIND_BADGE,
  CARD_KIND_LABEL,
  cardKind,
  cardTransactionsToCsv,
  cardsToCsv,
  filterCards,
  matchesKind,
  type CardKindFilter,
} from '../model/cards';
import { downloadText } from '../model/statements';
import { usePrivatCards } from '../model/usePrivatCards';

const CARD_PAGE = 30;
const TX_PAGE = 50;

const PERIODS = [
  { key: '7', label: '7 днів', days: 7 },
  { key: '30', label: '30 днів', days: 30 },
  { key: 'month', label: 'Цей місяць', days: 0 },
] as const;

const monthStart = () => `${localYmd().slice(0, 8)}01`;

export default function PrivatCardsView() {
  const { authenticated } = useAuthGuard();
  const { user, isGuest } = useSessionUser();
  const ready = authenticated && Boolean(user) && !isGuest;

  const { cards, cardsLoading, cardsError, loadCards, tx, txLoading, txError, loadTransactions } =
    usePrivatCards(ready);

  const [corp, setCorp] = useState<string | null>(null);
  /** За замовчуванням — лише діючі картки: закритих у банку в рази більше (640 проти 87). */
  const [kind, setKind] = useState<CardKindFilter>('active');
  const [query, setQuery] = useState('');
  const [cardPage, setCardPage] = useState(1);
  const [openCard, setOpenCard] = useState<string | null>(null);

  const [from, setFrom] = useState(() => localYmd(-7));
  const [to, setTo] = useState(() => localYmd());
  /** Картка (pan_key), для якої просимо виписку; null = усі корпорації. */
  const [picked, setPicked] = useState<PrivatCard | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [txQuery, setTxQuery] = useState('');

  const corporations = useMemo(() => (cards?.corporations ?? []).filter((c) => c.cards.length > 0), [cards]);

  const inCorp = useMemo(
    () => corporations.filter((c) => !corp || c.code === corp).flatMap((c) => c.cards),
    [corporations, corp],
  );
  const kindCounts = useMemo(() => {
    const n = { all: inCorp.length, active: 0, closed: 0, other: 0 };
    for (const c of inCorp) n[cardKind(c)] += 1;
    return n;
  }, [inCorp]);
  const allCards = useMemo(() => inCorp.filter((c) => matchesKind(c, kind)), [inCorp, kind]);
  const filtered = useMemo(() => filterCards(allCards, query), [allCards, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / CARD_PAGE));
  const safePage = Math.min(cardPage, pages);
  const visible = filtered.slice((safePage - 1) * CARD_PAGE, safePage * CARD_PAGE);

  const balances = useMemo(() => {
    const byCcy = new Map<string, { sum: number; n: number }>();
    for (const c of allCards) {
      if (c.balance === null) continue;
      const ccy = c.currency ?? 'UAH';
      const row = byCcy.get(ccy) ?? { sum: 0, n: 0 };
      row.sum += c.balance;
      row.n += 1;
      byCcy.set(ccy, row);
    }
    return [...byCcy.entries()].map(([currency, v]) => ({ currency, sum: Math.round(v.sum * 100) / 100, n: v.n }));
  }, [allCards]);
  const active = allCards.filter((c) => c.last_transaction_at).length;

  const txItems = useMemo(() => {
    const q = txQuery.trim().toLowerCase();
    const items = tx?.items ?? [];
    if (!q) return items;
    return items.filter((t) =>
      [t.description, t.details, t.card, t.card_holder, t.mcc, t.approval].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [tx, txQuery]);
  const txPages = Math.max(1, Math.ceil(txItems.length / TX_PAGE));
  const txSafe = Math.min(txPage, txPages);
  const txVisible = txItems.slice((txSafe - 1) * TX_PAGE, txSafe * TX_PAGE);

  useEffect(() => setCardPage(1), [corp, query, kind]);

  const runTx = (force = false) => {
    setTxPage(1);
    void loadTransactions({ from, to, card: picked?.pan_key ?? undefined }, force);
  };

  const pickPeriod = (p: (typeof PERIODS)[number]) => {
    setFrom(p.days ? localYmd(-p.days) : monthStart());
    setTo(localYmd());
  };

  if (!authenticated) return null;

  const actions = (
    <button onClick={() => loadCards(true)} disabled={!ready || cardsLoading} className="btn btn-ghost" title="Перечитати список карток з банку">
      <RefreshCw className={`h-3.5 w-3.5 ${cardsLoading ? 'animate-spin' : ''}`} /> Оновити картки
    </button>
  );

  return (
    <BankShell
      title="Приват24 · Карткові транзакції"
      subtitle="ПриватБанк · корпоративні картки (картковий API «Автоклієнта») — картки, залишки й операції по картках"
      status={cards ? <span className="badge badge-accent">{count(cards.cards_total)} карток</span> : null}
      actions={actions}
    >
      {isGuest && (
        <section className="glass-panel flex flex-col items-center justify-center gap-3 p-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-panel bg-warn/10 text-warn">
            <Lock className="h-5 w-5" />
          </span>
          <h2 className="text-sm font-semibold text-txt-primary">Банківські дані недоступні для гостя</h2>
          <p className="max-w-md text-2xs leading-relaxed text-txt-secondary">
            Це фінансові дані компанії. Увійдіть під робочим обліковим записом, щоб їх побачити.
          </p>
        </section>
      )}

      {ready && (
        <>
          {/* ── картки ─────────────────────────────────────────────────── */}
          {cardsError && (
            <div className="glass-panel flex items-start gap-2 border-danger/30 p-3 text-2xs text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{cardsError}</span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="stat">
              <span className="micro-label flex items-center gap-1.5">
                <CreditCard className="h-3 w-3" /> Картки
              </span>
              <span className="mt-1 block text-xl font-semibold tabular text-accent">
                {cards ? count(allCards.length) : NO_DATA}
              </span>
              <span className="mt-0.5 block text-2xs text-txt-muted">
                {cards ? `з операціями в історії: ${count(active)}` : ''}
              </span>
            </div>
            {balances.map((b) => (
              <div key={b.currency} className="stat">
                <span className="micro-label">Залишок на картках · {b.currency}</span>
                <span className="mt-1 block text-lg font-semibold tabular text-txt-primary">{money(b.sum, b.currency)}</span>
                <span className="mt-0.5 block text-2xs text-txt-muted">по {count(b.n)} картках</span>
              </div>
            ))}
          </div>

          <div className="glass-panel overflow-hidden p-0">
            <div className="hairline-b flex flex-wrap items-center gap-2 px-4 py-3">
              <h3 className="mr-auto text-sm font-semibold text-txt-primary">
                Список карток
                {cards && (
                  <span className="ml-2 text-2xs font-normal text-txt-muted">
                    {filtered.length === allCards.length ? count(allCards.length) : `${count(filtered.length)} з ${count(allCards.length)}`}
                  </span>
                )}
              </h3>

              <div className="segmented" role="group" aria-label="Стан картки">
                {(
                  [
                    ['active', 'Діючі'],
                    ['closed', 'Закриті'],
                    ['other', 'Інші'],
                    ['all', 'Усі'],
                  ] as [CardKindFilter, string][]
                )
                  // «Інші» ховаємо, поки таких карток немає, — інакше це порожня кнопка.
                  .filter(([k]) => k !== 'other' || kindCounts.other > 0 || kind === 'other')
                  .map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={kind === k}
                      onClick={() => setKind(k)}
                      className={`segmented-item ${kind === k ? 'segmented-item-active text-accent' : ''}`}
                      title={k === 'active' ? 'Стан 1 — діюча' : k === 'closed' ? 'Стан 9 — закрита' : k === 'other' ? 'Решта кодів стану (0 тощо)' : undefined}
                    >
                      {label} · {count(kindCounts[k])}
                    </button>
                  ))}
              </div>

              {corporations.length > 1 && (
                <div className="segmented">
                  <button type="button" aria-pressed={!corp} onClick={() => setCorp(null)} className={`segmented-item ${!corp ? 'segmented-item-active text-accent' : ''}`}>
                    Усі
                  </button>
                  {corporations.map((c) => (
                    <button
                      key={`${c.type}-${c.code}`}
                      type="button"
                      aria-pressed={corp === c.code}
                      onClick={() => setCorp(c.code)}
                      className={`segmented-item ${corp === c.code ? 'segmented-item-active text-accent' : ''}`}
                      title={`${c.type} · ${c.code}`}
                    >
                      {c.code} · {count(c.cards.filter((x) => matchesKind(x, kind)).length)}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-txt-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Власник, номер картки…"
                  className="field h-8 w-[14rem] pl-7 text-2xs"
                  aria-label="Пошук по картках"
                />
              </div>

              <button onClick={() => downloadText(`privat24_cards_${localYmd()}.csv`, 'text/csv', cardsToCsv(filtered))} disabled={filtered.length === 0} className="btn btn-ghost h-8 px-2.5 text-2xs" title="Усі поля карток у CSV">
                <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
              </button>
              <button onClick={() => downloadText(`privat24_cards_${localYmd()}.json`, 'application/json', JSON.stringify(filtered, null, 2))} disabled={filtered.length === 0} className="btn btn-ghost h-8 px-2.5 text-2xs" title="Усі поля карток у JSON">
                <FileJson className="h-3.5 w-3.5" /> JSON
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="w-8" />
                    <th>Картка</th>
                    <th>Власник</th>
                    <th className="text-right">Залишок</th>
                    <th className="text-right">Ліміт</th>
                    <th>Остання операція</th>
                    <th>Стан</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cardsLoading && !cards ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-2xs text-txt-muted">
                        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin text-accent" />
                        Завантажую картки з банку…
                      </td>
                    </tr>
                  ) : visible.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-2xs text-txt-muted">
                        {cards ? 'Карток не знайдено' : cardsError ? 'Список карток не отримано' : NO_DATA}
                      </td>
                    </tr>
                  ) : (
                    visible.map((c) => {
                      const key = c.pan_key ?? c.pan_masked ?? '';
                      const open = openCard === key;
                      const selected = picked?.pan_key === c.pan_key;
                      return (
                        <React.Fragment key={key}>
                          <tr className={`cursor-pointer ${open ? 'bg-accent/5' : ''}`} onClick={() => setOpenCard(open ? null : key)}>
                            <td>
                              <ChevronDown className={`h-3.5 w-3.5 text-txt-muted transition-transform ${open ? '' : '-rotate-90'}`} />
                            </td>
                            <td className="whitespace-nowrap font-mono text-2xs text-txt-primary">
                              {c.pan_masked ?? NO_DATA}
                              {c.is_main && <span className="badge badge-accent ml-2">основна</span>}
                            </td>
                            <td className="max-w-[260px] truncate text-txt-secondary" title={c.holder_name ?? undefined}>
                              {c.holder_name ?? NO_DATA}
                            </td>
                            <td className="whitespace-nowrap text-right tabular font-semibold text-txt-primary">{money(c.balance, c.currency)}</td>
                            <td className="whitespace-nowrap text-right tabular text-txt-muted">{c.credit_limit ? money(c.credit_limit, c.currency) : NO_DATA}</td>
                            <td className="whitespace-nowrap text-2xs text-txt-muted">{dmyHm(c.last_transaction_at)}</td>
                            <td>
                              <span className={`badge ${CARD_KIND_BADGE[cardKind(c)]}`} title={`Код стану в банку: ${c.state ?? NO_DATA}`}>
                                {CARD_KIND_LABEL[cardKind(c)]}
                                {cardKind(c) === 'other' && ` ${c.state ?? ''}`}
                              </span>
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                disabled={!c.pan_key}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPicked(selected ? null : c);
                                }}
                                className={`btn h-7 px-2 text-micro ${selected ? 'btn-primary' : 'btn-ghost'}`}
                                title="Брати операції лише цієї картки"
                              >
                                {selected ? 'Вибрано' : 'Операції'}
                              </button>
                            </td>
                          </tr>
                          {open && (
                            <tr className="bg-surface-inset/40">
                              <td />
                              <td colSpan={7} className="py-3">
                                <CardDetails card={c} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="hairline-t flex items-center justify-between px-4 py-2.5 text-2xs text-txt-muted">
                <span className="tabular">
                  {(safePage - 1) * CARD_PAGE + 1}–{Math.min(safePage * CARD_PAGE, filtered.length)} з {count(filtered.length)}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCardPage(safePage - 1)} disabled={safePage <= 1} className="btn btn-ghost h-7 px-2" aria-label="Попередня сторінка">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="tabular px-1">
                    {safePage} / {pages}
                  </span>
                  <button onClick={() => setCardPage(safePage + 1)} disabled={safePage >= pages} className="btn btn-ghost h-7 px-2" aria-label="Наступна сторінка">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── операції по картках ────────────────────────────────────── */}
          <div className="glass-panel space-y-3 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <h3 className="text-sm font-semibold text-txt-primary">Операції по картках</h3>
                <p className="mt-0.5 text-2xs text-txt-muted">
                  Окремий запит до банку — {picked ? `лише картка ${picked.pan_masked}` : 'усі корпорації з картками'}
                </p>
              </div>
              {picked && (
                <button onClick={() => setPicked(null)} className="btn btn-ghost h-7 px-2 text-micro">
                  <X className="h-3 w-3" /> Усі картки
                </button>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <div className="segmented">
                  {PERIODS.map((p) => (
                    <button key={p.key} type="button" onClick={() => pickPeriod(p)} className="segmented-item">
                      {p.label}
                    </button>
                  ))}
                </div>
                <span className="flex items-center gap-1 text-2xs text-txt-muted">
                  <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="field h-8 w-[8.5rem] px-2 py-1 text-2xs" aria-label="Період від" />
                  –
                  <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="field h-8 w-[8.5rem] px-2 py-1 text-2xs" aria-label="Період до" />
                </span>
                <button onClick={() => runTx()} disabled={txLoading || !from || !to} className="btn btn-primary">
                  {txLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarRange className="h-3.5 w-3.5" />}
                  Завантажити операції
                </button>
              </div>
            </div>

            {txLoading && (
              <p className="flex items-center gap-2 text-2xs text-accent">
                <Loader2 className="h-3 w-3 animate-spin" />
                Чекаю відповідь банку — виписка по картках може йти до хвилини і довше.
              </p>
            )}

            {txError && (
              <div className="flex items-start gap-2 rounded-field border border-danger/30 bg-danger/5 p-3 text-2xs text-danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{txError}</span>
              </div>
            )}

            {tx && tx.errors.length > 0 && (
              <div className="flex items-start gap-2 rounded-field border border-warn/30 bg-warn/10 p-3 text-2xs text-txt-secondary">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                <span>
                  Банк не віддав частину корпорацій, решту показано:{' '}
                  {tx.errors.map((e) => `${e.corp ?? '?'} (${e.message})`).join('; ')}
                </span>
              </div>
            )}

            {tx && (
              <>
                {tx.summary.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {tx.summary.map((s) => (
                      <div key={s.currency} className="stat">
                        <span className="micro-label flex items-center justify-between">
                          <span>Рух за період · {s.currency}</span>
                          <span className="tabular">{count(s.count)} оп.</span>
                        </span>
                        <span className="mt-1 block text-lg font-semibold tabular text-txt-primary">{money(s.net, s.currency)}</span>
                        <span className="mt-0.5 flex items-center gap-3 text-2xs text-txt-muted">
                          <span className="flex items-center gap-1 text-accent">
                            <ArrowDownLeft className="h-3 w-3" /> {money(s.credit, s.currency)}
                          </span>
                          <span className="flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" /> {money(s.debit, s.currency)}
                          </span>
                          {s.fee > 0 && <span>комісії {money(s.fee, s.currency)}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto text-2xs text-txt-muted">
                    {count(txItems.length)} операцій · {dmy(tx.start_date)} – {dmy(tx.end_date)}
                  </span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-txt-muted" />
                    <input type="search" value={txQuery} onChange={(e) => { setTxQuery(e.target.value); setTxPage(1); }} placeholder="Опис, MCC, картка…" className="field h-8 w-[13rem] pl-7 text-2xs" aria-label="Пошук по операціях" />
                  </div>
                  <button onClick={() => downloadText(`privat24_card_tx_${tx.start_date}_${tx.end_date}.csv`, 'text/csv', cardTransactionsToCsv(txItems))} disabled={txItems.length === 0} className="btn btn-ghost h-8 px-2.5 text-2xs">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
                  </button>
                  <button onClick={() => downloadText(`privat24_card_tx_${tx.start_date}_${tx.end_date}.json`, 'application/json', JSON.stringify(txItems, null, 2))} disabled={txItems.length === 0} className="btn btn-ghost h-8 px-2.5 text-2xs">
                    <FileJson className="h-3.5 w-3.5" /> JSON
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Дата</th>
                        <th>Картка</th>
                        <th>Опис</th>
                        <th>MCC</th>
                        <th className="text-right">Сума</th>
                        <th className="text-right">Комісія</th>
                        <th className="text-right">Залишок</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txVisible.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-2xs text-txt-muted">
                            За цей період операцій немає
                          </td>
                        </tr>
                      ) : (
                        txVisible.map((t) => <CardTxRow key={t.id || `${t.datetime}-${t.amount}-${t.card}`} t={t} />)
                      )}
                    </tbody>
                  </table>
                </div>

                {txPages > 1 && (
                  <div className="flex items-center justify-between text-2xs text-txt-muted">
                    <span className="tabular">
                      {(txSafe - 1) * TX_PAGE + 1}–{Math.min(txSafe * TX_PAGE, txItems.length)} з {count(txItems.length)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setTxPage(txSafe - 1)} disabled={txSafe <= 1} className="btn btn-ghost h-7 px-2" aria-label="Попередня сторінка">
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="tabular px-1">
                        {txSafe} / {txPages}
                      </span>
                      <button onClick={() => setTxPage(txSafe + 1)} disabled={txSafe >= txPages} className="btn btn-ghost h-7 px-2" aria-label="Наступна сторінка">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {!tx && !txLoading && !txError && (
              <p className="text-2xs text-txt-muted">Оберіть період і натисніть «Завантажити операції» — вони тягнуться окремо від списку карток.</p>
            )}
          </div>

          <div className="glass-panel flex items-start gap-2 p-4 text-2xs leading-relaxed text-txt-secondary">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-txt-muted" />
            <span>
              Картковий API банку — окремий від виписки рахунків (<code>/api/corpcards/v2</code>, запити POST). Список
              карток іде з <code>cards/list</code>, операції — з <code>corp/statements</code> (по корпорації) або{' '}
              <code>card/statements</code> (по одній картці, з оборотами за період). Нічого не змінюється в банку.
              Експорт містить усі поля, які віддав банк. Кеш на бекенді — 1 хв.
            </span>
          </div>
        </>
      )}
    </BankShell>
  );
}

/* ── рядок операції ──────────────────────────────────────────────────────── */

function CardTxRow({ t }: { t: PrivatCardTransaction }) {
  const credit = t.direction === 'credit';
  const Arrow = credit ? ArrowDownLeft : ArrowUpRight;
  return (
    <tr>
      <td className="whitespace-nowrap text-txt-secondary">{t.datetime && !t.datetime.endsWith('T00:00:00') ? dmyHm(t.datetime) : dmy(t.date ?? t.datetime)}</td>
      <td className="whitespace-nowrap">
        <span className="block font-mono text-2xs text-txt-primary">{t.card ?? NO_DATA}</span>
        {t.card_holder && <span className="block max-w-[180px] truncate text-micro text-txt-muted">{t.card_holder}</span>}
      </td>
      <td className="max-w-[360px]">
        <span className="block truncate text-txt-secondary" title={[t.description, t.details].filter(Boolean).join(' · ') || undefined}>
          {t.description ?? t.details ?? NO_DATA}
        </span>
      </td>
      <td className="font-mono text-2xs text-txt-muted">{t.mcc ?? NO_DATA}</td>
      <td className={`whitespace-nowrap text-right tabular font-semibold ${credit ? 'text-accent' : 'text-txt-primary'}`}>
        <span className="inline-flex items-center gap-1">
          <Arrow className="h-3 w-3" />
          {credit ? '+' : '−'}
          {money(t.amount, t.currency)}
        </span>
        {t.original_currency && t.original_currency !== t.currency && t.original_amount !== null && (
          <span className="block text-micro font-normal text-txt-muted">{money(Math.abs(t.original_amount), t.original_currency)}</span>
        )}
      </td>
      <td className="whitespace-nowrap text-right tabular text-txt-muted">{t.fee ? money(t.fee, t.currency) : NO_DATA}</td>
      <td className="whitespace-nowrap text-right tabular text-txt-muted">{money(t.rest, t.currency)}</td>
    </tr>
  );
}

/* ── деталі картки ───────────────────────────────────────────────────────── */

function CardDetails({ card }: { card: PrivatCard }) {
  const rows: [string, React.ReactNode][] = [
    ['Номер (маска)', card.pan_masked],
    ['Ключ картки (pan_key)', card.pan_key],
    ['IBAN', card.iban],
    ['Власник', card.holder_name],
    ['ІПН власника', card.holder_inn],
    ['ID клієнта', card.holder_client_id],
    ['Валюта', card.currency],
    ['Код валюти', card.currency_code],
    ['Залишок', money(card.balance, card.currency)],
    ['Кредитний ліміт', card.credit_limit === null ? null : money(card.credit_limit, card.currency)],
    ['Стан', `${CARD_KIND_LABEL[cardKind(card)]} (код ${card.state ?? NO_DATA} / ${card.state_text ?? NO_DATA})`],
    ['Тип картки', card.card_type],
    ['Діє до', card.expires],
    ['Остання операція', dmyHm(card.last_transaction_at)],
    ['Відкрита', dmy(card.opened_at)],
    ['Аліас', card.card_alias],
    ['Назва', card.card_name],
    ['Основна / додаткова', `${card.is_main === null ? NO_DATA : card.is_main ? 'так' : 'ні'} / ${card.is_additional === null ? NO_DATA : card.is_additional ? 'так' : 'ні'}`],
    ['Гаманець', card.purse],
    ['Договір', card.contract_ref],
    ['Тип договору', card.contract_type],
    ['Група', card.group_id],
    ['Корпорація', card.corp_code],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-0.5 text-2xs md:grid-cols-2 xl:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-2">
          <dt className="w-44 shrink-0 text-txt-muted">{label}</dt>
          <dd className="min-w-0 break-all font-medium text-txt-primary">{value === null || value === undefined || value === '' ? NO_DATA : value}</dd>
        </div>
      ))}
    </dl>
  );
}
