import type {
  PrivatCurrencySummary,
  PrivatTransaction,
} from '@/shared/contracts';

/** Не проводять гроші: сторновані (t) та забраковані (n). */
const NON_POSTED = new Set(['t', 'n']);

export type DirectionFilter = 'all' | 'credit' | 'debit';

export interface TxFilter {
  account: string | null;
  direction: DirectionFilter;
  query: string;
}

/** Рядок для пошуку: контрагент, коди, призначення, номери документів. */
const haystack = (tx: PrivatTransaction) =>
  [
    tx.counterparty.name,
    tx.counterparty.code,
    tx.counterparty.account,
    tx.purpose,
    tx.doc_number,
    tx.ref,
    tx.id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export function filterTransactions(items: PrivatTransaction[], f: TxFilter): PrivatTransaction[] {
  const q = f.query.trim().toLowerCase();
  return items.filter(
    (tx) =>
      (!f.account || tx.account === f.account) &&
      (f.direction === 'all' || tx.direction === f.direction) &&
      (!q || haystack(tx).includes(q)),
  );
}

/**
 * Підсумки по валютах для того, що зараз на екрані (бекенд рахує те саме для всієї
 * виписки, але фільтр по рахунку/пошук діє на клієнті, тож рахуємо тут).
 */
export function summarizeByCurrency(items: PrivatTransaction[]): PrivatCurrencySummary[] {
  const byCcy = new Map<string, PrivatCurrencySummary>();
  for (const tx of items) {
    const currency = tx.currency ?? '—';
    let row = byCcy.get(currency);
    if (!row) {
      row = { currency, count: 0, debit: 0, credit: 0, net: 0 };
      byCcy.set(currency, row);
    }
    row.count += 1;
    if ((tx.status && NON_POSTED.has(tx.status.toLowerCase())) || tx.amount === null) continue;
    if (tx.direction === 'debit') row.debit += tx.amount;
    else if (tx.direction === 'credit') row.credit += tx.amount;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return [...byCcy.values()]
    .map((r) => ({ ...r, debit: round(r.debit), credit: round(r.credit), net: round(r.credit - r.debit) }))
    .sort((a, b) => (a.currency === 'UAH' ? -1 : b.currency === 'UAH' ? 1 : a.currency.localeCompare(b.currency)));
}

/* ── експорт: усе, що віддав банк, у плоскому вигляді ─────────────────────── */

const CSV_COLUMNS: [string, (tx: PrivatTransaction) => unknown][] = [
  ['id', (t) => t.id],
  ['ref', (t) => t.ref],
  ['refn', (t) => t.refn],
  ['datetime', (t) => t.datetime],
  ['date', (t) => t.date],
  ['date_client', (t) => t.date_client],
  ['account', (t) => t.account],
  ['currency', (t) => t.currency],
  ['direction', (t) => t.direction],
  ['amount', (t) => t.amount],
  ['amount_signed', (t) => t.amount_signed],
  ['amount_uah', (t) => t.amount_uah],
  ['status', (t) => t.status],
  ['status_label', (t) => t.status_label],
  ['real_flag', (t) => t.real_flag],
  ['doc_number', (t) => t.doc_number],
  ['doc_type', (t) => t.doc_type],
  ['purpose', (t) => t.purpose],
  ['counterparty_code', (t) => t.counterparty.code],
  ['counterparty_name', (t) => t.counterparty.name],
  ['counterparty_account', (t) => t.counterparty.account],
  ['counterparty_mfo', (t) => t.counterparty.mfo],
  ['counterparty_bank', (t) => t.counterparty.bank_name],
  ['counterparty_bank_city', (t) => t.counterparty.bank_city],
  ['me_code', (t) => t.me.code],
  ['me_name', (t) => t.me.name],
  ['me_mfo', (t) => t.me.mfo],
  ['me_bank', (t) => t.me.bank_name],
  ['payment_pack_ref', (t) => t.payment_pack_ref],
  ['technical_id', (t) => t.technical_id],
  ['bank_row_id', (t) => t.bank_row_id],
  ['uetr', (t) => t.uetr],
  ['ultimate', (t) => t.ultimate],
  ['struct_code', (t) => t.struct_code],
  ['struct_type', (t) => t.struct_type],
  ['struct_category', (t) => t.struct_category],
];

export const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV з `;` та BOM — так його без плясок відкриває український Excel. */
export function transactionsToCsv(items: PrivatTransaction[]): string {
  const head = CSV_COLUMNS.map(([name]) => name).join(';');
  const rows = items.map((tx) => CSV_COLUMNS.map(([, get]) => csvCell(get(tx))).join(';'));
  return `﻿${[head, ...rows].join('\r\n')}`;
}

export function downloadText(filename: string, mime: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Дати браузеру почати завантаження, перш ніж відпускати URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
