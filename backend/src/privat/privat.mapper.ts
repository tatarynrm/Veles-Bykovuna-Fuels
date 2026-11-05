/**
 * Pure mapping for the PrivatBank «Автоклієнт» (Приват24 для бізнесу) statements API.
 * No axios/Nest dependency, so it is unit-tested in isolation (privat.mapper.spec.ts).
 *
 * Wire facts that shape this file:
 *  - Field names are UPPERCASE (`SUM`, `TRANTYPE`, `AUT_CNTR_NAM`) on transactions and
 *    camelCase on balances (`balanceIn`, `nameACC`). Both are mapped to snake_case.
 *  - Money arrives as **strings** («1234.56»); a missing/blank value becomes `null`,
 *    never `0` — "no amount" and "zero" are different things in a bank statement.
 *  - Dates come as `DD.MM.YYYY` (+ `HH:MM[:SS]`); they are normalised to ISO. The bank
 *    speaks Kyiv wall-clock, so datetimes are emitted **without a zone** on purpose.
 *  - One payment instruction is identified by `REF` + `REFN` (the vendor says so); that
 *    concatenation is the stable `id` to dedupe on and, later, to key a DB row.
 */

/* ── normalized shapes ───────────────────────────────────────────────────── */

export type PrivatDirection = 'debit' | 'credit';

export interface PrivatParty {
  /** ЄДРПОУ / ІПН. */
  code: string | null;
  mfo: string | null;
  account: string | null;
  name: string | null;
  bank_name: string | null;
  bank_city: string | null;
}

export interface PrivatUltimate {
  nceo: string | null;
  document: string | null;
  name: string | null;
  country_code: string | null;
}

export interface PrivatTransaction {
  /** `REF` + `REFN` — unique per payment instruction. */
  id: string;
  ref: string | null;
  refn: string | null;
  /** Our account number the movement belongs to (`AUT_MY_ACC`). */
  account: string | null;
  currency: string | null;
  /** Amount in the account currency, always positive; direction says which way. */
  amount: number | null;
  /** UAH equivalent (`SUM_E`). */
  amount_uah: number | null;
  /** `debit` = money left our account (TRANTYPE D), `credit` = money came in (C). */
  direction: PrivatDirection | null;
  /** Signed amount: credit positive, debit negative — ready for summing. */
  amount_signed: number | null;
  /** Payment purpose text (`OSND`). */
  purpose: string | null;
  doc_number: string | null;
  doc_type: string | null;
  /** Operation day (`DAT_OD`), ISO `YYYY-MM-DD`. */
  date: string | null;
  /** Date the client booked it (`DAT_KL`), ISO. */
  date_client: string | null;
  /** Operation date+time (`DATE_TIME_DAT_OD_TIM_P`), ISO without zone. */
  datetime: string | null;
  time: string | null;
  /** `PR_PR`: p — проводиться, t — сторнована, r — проведена, n — забракована. */
  status: string | null;
  status_label: string | null;
  /** `FL_REAL` as sent: «ознака реальності проведення» (r, i). The vendor gives no legend. */
  real_flag: string | null;
  me: PrivatParty;
  counterparty: PrivatParty;
  /** Set only for payments created through the API (`DLR`). */
  payment_pack_ref: string | null;
  technical_id: string | null;
  bank_row_id: string | null;
  uetr: string | null;
  ultimate: string | null;
  payer_ultimate: PrivatUltimate;
  recipient_ultimate: PrivatUltimate;
  /** Tax-payment attributes. */
  struct_code: string | null;
  struct_type: string | null;
  struct_category: string | null;
}

export interface PrivatBalance {
  account: string | null;
  name: string | null;
  currency: string | null;
  balance_in: number | null;
  balance_in_uah: number | null;
  balance_out: number | null;
  balance_out_uah: number | null;
  turnover_debit: number | null;
  turnover_debit_uah: number | null;
  turnover_credit: number | null;
  turnover_credit_uah: number | null;
  /** Date of the last movement (`dpd`), ISO. */
  last_movement: string | null;
  state: string | null;
  account_type: string | null;
  branch: string | null;
  branch_id: string | null;
  flmn: string | null;
  opened_at: string | null;
  opened_at_system: string | null;
  closed_at: string | null;
  is_final: boolean | null;
}

export interface PrivatCurrencySummary {
  currency: string;
  count: number;
  debit: number;
  credit: number;
  net: number;
}

/* ── primitives ──────────────────────────────────────────────────────────── */

const blank = (v: unknown): v is null | undefined | '' =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** Trimmed string, or `null` when the field is absent/blank. */
export function str(v: unknown): string | null {
  if (blank(v)) return null;
  return String(v).trim();
}

/** «1 234,56» / «1234.56» / 1234.56 → number; blank or garbage → null. */
export function money(v: unknown): number | null {
  if (blank(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const flag = (v: unknown): boolean | null => {
  if (blank(v)) return null;
  const s = String(v).trim().toUpperCase();
  if (s === 'Y' || s === 'TRUE' || s === '1') return true;
  if (s === 'N' || s === 'FALSE' || s === '0') return false;
  return null;
};

const pad = (n: string | number, len = 2) => String(n).padStart(len, '0');

/**
 * Bank date → ISO `YYYY-MM-DD`. Accepts `DD.MM.YYYY`, `DD-MM-YYYY`, `YYYY-MM-DD`,
 * with or without a trailing time. Anything else is `null`, not a guess.
 */
export function toIsoDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  let m = /^(\d{2})[.\-/](\d{2})[.\-/](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** Bank datetime → ISO `YYYY-MM-DDTHH:MM:SS` (no zone — Kyiv wall-clock). */
export function toIsoDateTime(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const date = toIsoDate(s);
  if (!date) return null;
  const t = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
  return t ? `${date}T${pad(t[1])}:${t[2]}:${t[3] ?? '00'}` : `${date}T00:00:00`;
}

/** ISO `YYYY-MM-DD` (from the date pickers) → the bank's `DD-MM-YYYY`. */
export function isoToBankDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Некоректна дата: ${iso}`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/* ── dictionaries ────────────────────────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  p: 'Проводиться',
  t: 'Сторнована',
  r: 'Проведена',
  n: 'Забракована',
};

/** Statuses that never moved money: reversed (t) and rejected (n). */
const NON_POSTED = new Set(['t', 'n']);

export const statusLabel = (code: string | null): string | null =>
  code ? (STATUS_LABELS[code.toLowerCase()] ?? code) : null;

/* ── row mappers ─────────────────────────────────────────────────────────── */

type Row = Record<string, unknown>;

const party = (r: Row, prefix: 'AUT_MY' | 'AUT_CNTR'): PrivatParty => ({
  code: str(r[`${prefix}_CRF`]),
  mfo: str(r[`${prefix}_MFO`]),
  account: str(r[`${prefix}_ACC`]),
  name: str(r[`${prefix}_NAM`]),
  bank_name: str(r[`${prefix}_MFO_NAME`]),
  bank_city: str(r[`${prefix}_MFO_CITY`]),
});

const ultimate = (r: Row, prefix: 'PAYER_ULTMT' | 'RECIPIENT_ULTMT'): PrivatUltimate => ({
  nceo: str(r[`${prefix}_NCEO`]),
  document: str(r[`${prefix}_DOC`]),
  name: str(r[`${prefix}_NAME`]),
  country_code: str(r[`${prefix}_COUNTRY_CODE`]),
});

export function mapTransaction(r: Row): PrivatTransaction {
  const ref = str(r.REF);
  const refn = str(r.REFN);
  const type = str(r.TRANTYPE)?.toUpperCase();
  const direction: PrivatDirection | null = type === 'D' ? 'debit' : type === 'C' ? 'credit' : null;
  const amount = money(r.SUM);
  const status = str(r.PR_PR);

  return {
    id: `${ref ?? ''}${refn ?? ''}`,
    ref,
    refn,
    account: str(r.AUT_MY_ACC),
    currency: str(r.CCY),
    amount,
    amount_uah: money(r.SUM_E),
    direction,
    amount_signed:
      amount === null || direction === null ? null : direction === 'credit' ? amount : -amount,
    purpose: str(r.OSND),
    doc_number: str(r.NUM_DOC),
    doc_type: str(r.DOC_TYP),
    date: toIsoDate(r.DAT_OD),
    date_client: toIsoDate(r.DAT_KL),
    datetime: toIsoDateTime(r.DATE_TIME_DAT_OD_TIM_P) ?? toIsoDateTime(`${r.DAT_OD ?? ''} ${r.TIM_P ?? ''}`),
    time: str(r.TIM_P),
    status,
    status_label: statusLabel(status),
    real_flag: str(r.FL_REAL),
    me: party(r, 'AUT_MY'),
    counterparty: party(r, 'AUT_CNTR'),
    payment_pack_ref: str(r.DLR),
    technical_id: str(r.TECHNICAL_TRANSACTION_ID),
    bank_row_id: str(r.ID),
    uetr: str(r.UETR),
    ultimate: str(r.ULTMT),
    payer_ultimate: ultimate(r, 'PAYER_ULTMT'),
    recipient_ultimate: ultimate(r, 'RECIPIENT_ULTMT'),
    struct_code: str(r.STRUCT_CODE),
    struct_type: str(r.STRUCT_TYPE),
    struct_category: str(r.STRUCT_CATEGORY),
  };
}

export function mapBalance(r: Row): PrivatBalance {
  return {
    account: str(r.acc),
    name: str(r.nameACC),
    currency: str(r.currency),
    balance_in: money(r.balanceIn),
    balance_in_uah: money(r.balanceInEq),
    balance_out: money(r.balanceOut),
    balance_out_uah: money(r.balanceOutEq),
    turnover_debit: money(r.turnoverDebt),
    turnover_debit_uah: money(r.turnoverDebtEq),
    turnover_credit: money(r.turnoverCred),
    turnover_credit_uah: money(r.turnoverCredEq),
    last_movement: toIsoDate(r.dpd),
    state: str(r.state),
    account_type: str(r.atp),
    branch: str(r.brnm),
    branch_id: str(r.bgfIBrnm),
    flmn: str(r.flmn),
    opened_at: toIsoDate(r.date_open_acc_reg),
    opened_at_system: toIsoDate(r.date_open_acc_sys),
    closed_at: toIsoDate(r.date_close_acc),
    is_final: flag(r.is_final_bal),
  };
}

/* ── aggregation ─────────────────────────────────────────────────────────── */

/** Same payment can appear on two pages or in both interim and final feeds. */
export function dedupeTransactions(items: PrivatTransaction[]): PrivatTransaction[] {
  const seen = new Set<string>();
  const out: PrivatTransaction[] = [];
  for (const tx of items) {
    // A row with neither REF nor REFN has no identity — keep it rather than collapse them all.
    if (tx.id) {
      if (seen.has(tx.id)) continue;
      seen.add(tx.id);
    }
    out.push(tx);
  }
  return out;
}

/** Per-currency totals. Reversed (`t`) and rejected (`n`) payments never moved money, so they are not summed. */
export function summarize(items: PrivatTransaction[]): PrivatCurrencySummary[] {
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
  return [...byCcy.values()].map((r) => ({
    ...r,
    debit: round(r.debit),
    credit: round(r.credit),
    net: round(r.credit - r.debit),
  }));
}
