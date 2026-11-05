/**
 * Pure mapping for the PrivatBank corporate-cards API (`/api/corpcards/v2/*`).
 * The «Картки» API is separate from the account statements (privat.mapper.ts): other
 * endpoints, POST bodies, PascalCase/camelCase mix, and a different date format.
 *
 * Wire facts (verified live, see privat-api.service.ts):
 *  - `cards/list` → `Data.JurData.CorpData[]` (one row per corporation/«проект»), each with
 *    a `PanData[]` of cards. `corpType`: FUEL, ACCKEY, CORP, UNDEF.
 *  - Card `Balance` is a number; `DateLastTran` is `YYYY-MM-DD HH:MM:SS`.
 *  - Statement rows carry `posted`/`valuedateValue` as `DD.MM.YYYY`, `valuedateId` as
 *    `YYYYMMDDT00:00:00`, `trandc` DB/CR, and amounts as strings or numbers.
 *  - Card numbers arrive masked («1234****6789=123456789») — the part after `=` is the
 *    bank's own card key, and is what `clientCard` needs; it is kept as `pan_key`.
 */

import { PrivatDirection, money, str, toIsoDate, toIsoDateTime } from './privat.mapper';

/* ── normalized shapes ───────────────────────────────────────────────────── */

export interface PrivatCard {
  /** Masked PAN as the bank sends it (`MaskedPanNumber`). */
  pan_masked: string | null;
  /** The bank's full `PanNumber` key — required as `clientCard` for per-card statements. */
  pan_key: string | null;
  iban: string | null;
  holder_name: string | null;
  holder_inn: string | null;
  holder_client_id: string | null;
  currency: string | null;
  currency_code: string | null;
  /** `PanState` numeric + `PanStateS` text, as sent. */
  state: string | null;
  state_text: string | null;
  expires: string | null;
  card_type: string | null;
  balance: number | null;
  credit_limit: number | null;
  last_transaction_at: string | null;
  purse: string | null;
  card_alias: string | null;
  card_name: string | null;
  is_main: boolean | null;
  is_additional: boolean | null;
  contract_ref: string | null;
  contract_type: string | null;
  group_id: string | null;
  opened_at: string | null;
  corp_code: string | null;
}

export interface PrivatCorporation {
  type: string | null;
  code: string | null;
  branch: string | null;
  jur_id: string | null;
  name: string | null;
  currency: string | null;
  currency_code: string | null;
  iban: string | null;
  main_card_masked: string | null;
  opened_at: string | null;
  cards_total: number;
  cards_shown: number;
  cards: PrivatCard[];
}

export interface PrivatCardStatementAccount {
  currency: string | null;
  card: string | null;
  name: string | null;
  account: string | null;
}

export interface PrivatCardTransaction {
  /** Stable key: `tranRef` + `idFront` (+ card), as the bank gives no single unique id. */
  id: string;
  id_front: string | null;
  tran_ref: string | null;
  approval: string | null;
  entry_type: string | null;
  code: string | null;
  mcc: string | null;
  /** Masked card the operation belongs to. */
  card: string | null;
  card_holder: string | null;
  account: PrivatCardStatementAccount;
  /** Operation amount in the card currency, positive; `direction` says which way. */
  amount: number | null;
  currency: string | null;
  amount_signed: number | null;
  direction: PrivatDirection | null;
  original_amount: number | null;
  original_currency: string | null;
  fee: number | null;
  discount: number | null;
  /** Balance after the operation; absent for «Ключ до рахунку» projects. */
  rest: number | null;
  description: string | null;
  details: string | null;
  country: string | null;
  linked: boolean | null;
  /** Operation date (`valuedateValue`), ISO. */
  date: string | null;
  /** Processing date (`posted`), ISO. */
  posted_date: string | null;
  /** `valuedateId` normalised to ISO date-time, when present. */
  datetime: string | null;
  /** Corporation the row was read under, for later joins. */
  corp_code: string | null;
  corp_type: string | null;
}

export interface PrivatCardSummary {
  account: string | null;
  card_main: string | null;
  holder_client_id: string | null;
  holder: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  debit: number | null;
  credit: number | null;
  fee: number | null;
  discount: number | null;
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

type Row = Record<string, unknown>;

const bool = (v: unknown): boolean | null => {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (['true', 'y', '1'].includes(s)) return true;
  if (['false', 'n', '0'].includes(s)) return false;
  return null;
};

/** `20070326T00:00:00` → ISO; also accepts anything `toIsoDateTime` does. */
export function compactToIso(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  return toIsoDateTime(s);
}

/** ISO `YYYY-MM-DD` → the cards API's `DD.MM.YYYY` (query-string dates). */
export function isoToCardDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Некоректна дата: ${iso}`);
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/* ── row mappers ─────────────────────────────────────────────────────────── */

export function mapCard(r: Row): PrivatCard {
  return {
    pan_masked: str(r.MaskedPanNumber),
    pan_key: str(r.PanNumber),
    iban: str(r.iban),
    holder_name: str(r.FioFiz),
    holder_inn: str(r.InnFiz),
    holder_client_id: str(r.ClientIdEkbFiz),
    currency: str(r.PanCcyS),
    currency_code: str(r.PanCcy),
    state: str(r.PanState),
    state_text: str(r.PanStateS),
    expires: str(r.PanExpDate),
    card_type: str(r.PanType),
    balance: money(r.Balance),
    credit_limit: money(r.credit_limit),
    last_transaction_at: toIsoDateTime(r.DateLastTran),
    purse: str(r.PanPurse),
    card_alias: str(r.cardAlias),
    card_name: str(r.card_name) ?? str(r.NameCard),
    is_main: bool(r.main),
    is_additional: bool(r.isAdd),
    contract_ref: str(r.refContract),
    contract_type: str(r.contractType),
    group_id: str(r.GroupID),
    opened_at: toIsoDate(r.openingDate),
    corp_code: str(r.PanCorpCode),
  };
}

export function mapCorporation(r: Row): PrivatCorporation {
  const pans = Array.isArray(r.PanData) ? (r.PanData as Row[]) : [];
  return {
    type: str(r.corpType),
    code: str(r.CorpCode),
    branch: str(r.Branch),
    jur_id: str(r.jurId),
    name: str(r.NameCard),
    currency: str(r.CorpCcyS),
    currency_code: str(r.CorpCcy),
    iban: str(r.iban),
    main_card_masked: str(r.MaskedMainCardNum),
    opened_at: toIsoDate(r.openingDate),
    cards_total: Number(r.cardsAmount) || pans.length,
    cards_shown: Number(r.cardsShown) || pans.length,
    cards: pans.map(mapCard),
  };
}

export function mapCardTransaction(
  r: Row,
  ctx: { card?: string | null; holder?: string | null; corpCode?: string | null; corpType?: string | null } = {},
): PrivatCardTransaction {
  const acc = (r.account && typeof r.account === 'object' ? r.account : {}) as Row;
  const dc = str(r.trandc)?.toUpperCase();
  const direction: PrivatDirection | null = dc === 'DB' ? 'debit' : dc === 'CR' ? 'credit' : null;
  const amount = money(r.amountAmt);
  const card = str(acc.card) ?? ctx.card ?? null;
  const idFront = str(r.idFront);
  const tranRef = str(r.tranRef);

  return {
    id: [tranRef, idFront, card].filter(Boolean).join('|'),
    id_front: idFront,
    tran_ref: tranRef,
    approval: str(r.approval),
    entry_type: str(r.entryType),
    code: str(r.code),
    mcc: str(r.mcc),
    card,
    card_holder: ctx.holder ?? null,
    account: {
      currency: str(acc.ccy),
      card: str(acc.card),
      name: str(acc.name),
      account: str(acc.acc),
    },
    amount: amount === null ? null : Math.abs(amount),
    currency: str(r.amountCcy) ?? str(acc.ccy),
    amount_signed:
      amount === null || direction === null
        ? null
        : direction === 'credit'
          ? Math.abs(amount)
          : -Math.abs(amount),
    direction,
    original_amount: money(r.originalAmt),
    original_currency: str(r.originalCcy),
    fee: money(r.fee),
    discount: money(r.discount),
    rest: money(r.rest),
    description: str(r.descr),
    details: str(r.details),
    country: str(r.country),
    linked: bool(r.linked),
    date: toIsoDate(r.valuedateValue) ?? toIsoDate(r.valuedateId),
    posted_date: toIsoDate(r.posted),
    datetime: compactToIso(r.valuedateId),
    corp_code: ctx.corpCode ?? null,
    corp_type: ctx.corpType ?? null,
  };
}

export function mapCardSummary(r: Row): PrivatCardSummary {
  return {
    account: str(r.acc),
    card_main: str(r.panmain),
    holder_client_id: str(r.holderClientId),
    holder: str(r.holderValue),
    opening_balance: money(r.brest),
    closing_balance: money(r.erest),
    debit: money(r.db),
    credit: money(r.cr),
    fee: money(r.fee),
    discount: money(r.discount),
  };
}

export interface PrivatCardCurrencySummary {
  currency: string;
  count: number;
  debit: number;
  credit: number;
  fee: number;
  net: number;
}

/** Per-currency totals of card operations (debit = spent, credit = refunds/top-ups). */
export function summarizeCardTransactions(items: PrivatCardTransaction[]): PrivatCardCurrencySummary[] {
  const byCcy = new Map<string, PrivatCardCurrencySummary>();
  for (const tx of items) {
    const currency = tx.currency ?? '—';
    let row = byCcy.get(currency);
    if (!row) {
      row = { currency, count: 0, debit: 0, credit: 0, fee: 0, net: 0 };
      byCcy.set(currency, row);
    }
    row.count += 1;
    if (tx.amount !== null) {
      if (tx.direction === 'debit') row.debit += tx.amount;
      else if (tx.direction === 'credit') row.credit += tx.amount;
    }
    if (tx.fee !== null) row.fee += tx.fee;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return [...byCcy.values()].map((r) => ({
    ...r,
    debit: round(r.debit),
    credit: round(r.credit),
    fee: round(r.fee),
    net: round(r.credit - r.debit),
  }));
}

/** Join key between a masked card number in a statement and in the card list: first 4 + last 4 digits. */
export function cardJoinKey(masked: string | null | undefined): string | null {
  if (!masked) return null;
  const head = /^(\d{4})/.exec(masked)?.[1];
  const tail = /(\d{4})(?:=|$)/.exec(masked.split('=')[0])?.[1];
  return head && tail ? `${head}${tail}` : null;
}

/** Same operation can be returned by both a corporation and a card query. */
export function dedupeCardTransactions(items: PrivatCardTransaction[]): PrivatCardTransaction[] {
  const seen = new Set<string>();
  const out: PrivatCardTransaction[] = [];
  for (const tx of items) {
    if (tx.id) {
      if (seen.has(tx.id)) continue;
      seen.add(tx.id);
    }
    out.push(tx);
  }
  return out;
}
