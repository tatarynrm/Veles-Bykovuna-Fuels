import type { PrivatCard, PrivatCardTransaction } from '@/shared/contracts';
import { csvCell } from './statements';

/** Пошук по картці: власник, маска, аліас, IBAN, ІПН. */
export function filterCards(cards: PrivatCard[], query: string): PrivatCard[] {
  const q = query.trim().toLowerCase();
  if (!q) return cards;
  return cards.filter((c) =>
    [c.holder_name, c.pan_masked, c.card_alias, c.card_name, c.iban, c.holder_inn]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}

const toCsv = <T,>(rows: T[], columns: [string, (r: T) => unknown][]): string => {
  const head = columns.map(([name]) => name).join(';');
  const body = rows.map((r) => columns.map(([, get]) => csvCell(get(r))).join(';'));
  // BOM + «;» — так файл без налаштувань відкриває український Excel.
  return `\uFEFF${[head, ...body].join('\r\n')}`;
};

export const cardsToCsv = (cards: PrivatCard[]) =>
  toCsv(cards, [
    ['pan_masked', (c) => c.pan_masked],
    ['pan_key', (c) => c.pan_key],
    ['holder_name', (c) => c.holder_name],
    ['holder_inn', (c) => c.holder_inn],
    ['holder_client_id', (c) => c.holder_client_id],
    ['iban', (c) => c.iban],
    ['currency', (c) => c.currency],
    ['balance', (c) => c.balance],
    ['credit_limit', (c) => c.credit_limit],
    ['state', (c) => c.state],
    ['state_text', (c) => c.state_text],
    ['card_type', (c) => c.card_type],
    ['expires', (c) => c.expires],
    ['last_transaction_at', (c) => c.last_transaction_at],
    ['card_alias', (c) => c.card_alias],
    ['card_name', (c) => c.card_name],
    ['is_main', (c) => c.is_main],
    ['is_additional', (c) => c.is_additional],
    ['purse', (c) => c.purse],
    ['contract_ref', (c) => c.contract_ref],
    ['contract_type', (c) => c.contract_type],
    ['group_id', (c) => c.group_id],
    ['opened_at', (c) => c.opened_at],
    ['corp_code', (c) => c.corp_code],
  ]);

export const cardTransactionsToCsv = (items: PrivatCardTransaction[]) =>
  toCsv(items, [
    ['id', (t) => t.id],
    ['tran_ref', (t) => t.tran_ref],
    ['id_front', (t) => t.id_front],
    ['datetime', (t) => t.datetime],
    ['date', (t) => t.date],
    ['posted_date', (t) => t.posted_date],
    ['card', (t) => t.card],
    ['card_holder', (t) => t.card_holder],
    ['account', (t) => t.account.account],
    ['direction', (t) => t.direction],
    ['amount', (t) => t.amount],
    ['amount_signed', (t) => t.amount_signed],
    ['currency', (t) => t.currency],
    ['original_amount', (t) => t.original_amount],
    ['original_currency', (t) => t.original_currency],
    ['fee', (t) => t.fee],
    ['discount', (t) => t.discount],
    ['rest', (t) => t.rest],
    ['description', (t) => t.description],
    ['details', (t) => t.details],
    ['mcc', (t) => t.mcc],
    ['country', (t) => t.country],
    ['approval', (t) => t.approval],
    ['entry_type', (t) => t.entry_type],
    ['code', (t) => t.code],
    ['linked', (t) => t.linked],
    ['corp_code', (t) => t.corp_code],
    ['corp_type', (t) => t.corp_type],
  ]);

/* ── стан картки ──────────────────────────────────────────────────────────
   Легенди кодів у документації банку немає. Виведено з живих даних: банківський фільтр
   panState=o («відкриті») повертає стани 1 і 0, фільтр c («закриті») — стан 9. Тож
   1 = діюча, 9 = закрита; стан 0 банк теж вважає «відкритим», але це єдина прострочена
   картка INSTANT, тому окремо від діючих. */

export type CardKind = 'active' | 'closed' | 'other';

export const cardKind = (c: PrivatCard): CardKind =>
  c.state === '1' ? 'active' : c.state === '9' ? 'closed' : 'other';

export const CARD_KIND_LABEL: Record<CardKind, string> = {
  active: 'Діюча',
  closed: 'Закрита',
  other: 'Інший стан',
};

export const CARD_KIND_BADGE: Record<CardKind, string> = {
  active: 'badge-success',
  closed: 'badge-neutral',
  other: 'badge-warn',
};

export type CardKindFilter = CardKind | 'all';
export const matchesKind = (c: PrivatCard, f: CardKindFilter) => f === 'all' || cardKind(c) === f;
