/**
 * PrivatBank statements — normalized shapes, mirroring
 * `backend/src/privat/privat.mapper.ts` and `privat-api.service.ts`.
 * Pure types; a shape change is a two-file edit (see shared/contracts/index.ts).
 */

export type PrivatDirection = 'debit' | 'credit';
export type PrivatScope = 'period' | 'interim' | 'final';

export interface PrivatParty {
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
  /** REF + REFN — unique per payment instruction. */
  id: string;
  ref: string | null;
  refn: string | null;
  account: string | null;
  currency: string | null;
  amount: number | null;
  amount_uah: number | null;
  direction: PrivatDirection | null;
  /** Credit positive, debit negative. */
  amount_signed: number | null;
  purpose: string | null;
  doc_number: string | null;
  doc_type: string | null;
  date: string | null;
  date_client: string | null;
  datetime: string | null;
  time: string | null;
  /** p — проводиться, t — сторнована, r — проведена, n — забракована. */
  status: string | null;
  status_label: string | null;
  real_flag: string | null;
  me: PrivatParty;
  counterparty: PrivatParty;
  payment_pack_ref: string | null;
  technical_id: string | null;
  bank_row_id: string | null;
  uetr: string | null;
  ultimate: string | null;
  payer_ultimate: PrivatUltimate;
  recipient_ultimate: PrivatUltimate;
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

export interface PrivatList<T> {
  items: T[];
  total: number;
  pages: number;
  /** The server stopped at its page cap before the bank ran out of data. */
  truncated: boolean;
  scope: PrivatScope;
  start_date: string | null;
  end_date: string | null;
  account: string | null;
  fetched_at: string;
}

export interface PrivatTransactionsResult extends PrivatList<PrivatTransaction> {
  summary: PrivatCurrencySummary[];
}

/* ── картковий API (корпоративні картки) ─────────────────────────────────── */

export interface PrivatCard {
  pan_masked: string | null;
  /** Ключ картки в банку — потрібен для виписки по одній картці. */
  pan_key: string | null;
  iban: string | null;
  holder_name: string | null;
  holder_inn: string | null;
  holder_client_id: string | null;
  currency: string | null;
  currency_code: string | null;
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

export interface PrivatCardsResult {
  client_id: string | null;
  client_name: string | null;
  okpo: string | null;
  cards_total: number;
  corporations: PrivatCorporation[];
  fetched_at: string;
}

export interface PrivatCardTransaction {
  id: string;
  id_front: string | null;
  tran_ref: string | null;
  approval: string | null;
  entry_type: string | null;
  code: string | null;
  mcc: string | null;
  card: string | null;
  card_holder: string | null;
  account: { currency: string | null; card: string | null; name: string | null; account: string | null };
  amount: number | null;
  currency: string | null;
  amount_signed: number | null;
  direction: PrivatDirection | null;
  original_amount: number | null;
  original_currency: string | null;
  fee: number | null;
  discount: number | null;
  rest: number | null;
  description: string | null;
  details: string | null;
  country: string | null;
  linked: boolean | null;
  date: string | null;
  posted_date: string | null;
  datetime: string | null;
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

export interface PrivatCardCurrencySummary {
  currency: string;
  count: number;
  debit: number;
  credit: number;
  fee: number;
  net: number;
}

export interface PrivatCardTransactionsResult {
  items: PrivatCardTransaction[];
  total: number;
  summary: PrivatCardCurrencySummary[];
  card_summaries: PrivatCardSummary[];
  /** Корпорації, які банк не віддав; решта все одно повернута. */
  errors: { corp: string | null; type: string | null; message: string }[];
  corporations_read: number;
  start_date: string;
  end_date: string;
  fetched_at: string;
}
