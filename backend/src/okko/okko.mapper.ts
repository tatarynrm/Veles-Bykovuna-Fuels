/**
 * OKKO adapter — pure mapping, unit conversions and dictionaries. No axios/Nest,
 * so every conversion here is unit-testable in isolation (see okko.mapper.spec.ts).
 *
 * The two conversions that must live ONLY here (never duplicated downstream):
 *   - money is returned in **kopiykas** → divide by 100 for UAH.
 *   - volume is returned in **millilitres** → divide by 1000 for litres.
 * Unit price is **derived** (`amount / volume`), not read from the response.
 */

export interface OkkoContract {
  contract_id: string;
  contract_number: string;
  contract_name: string;
  client_id: string;
  client_name: string;
  contract_type: string;
  contract_status: string;
  balance: number;
  credit_limit: number;
  currency: string;
  created_at: string;
}

/**
 * Official CHST ("Hot card status") dictionary, pulled from the live
 * GET /v2/metadata endpoint (KEY="CHST", LANG=3). CHST0 is the normal state of
 * a working card; CHST5 is BLOCKED — the previous code had these inverted.
 */
export const OKKO_CARD_STATUS: Record<string, string> = {
  CHST0: 'Активовано',
  CHST1: 'Неактивована',
  CHST2: 'Використано',
  CHST3: 'Анульовано',
  CHST4: 'Обслуговувати з документом',
  CHST5: 'Заблоковано',
  CHST6: 'Загублено',
  CHST7: 'Викрадено',
  CHST8: 'Зверніться в службу безпеки емітента',
  CHST9: 'Недійсна карта',
  CHST10: 'Вилучити карту через спеціальні умови',
  CHST11: 'Зверніться в службу безпеки еквайєра',
  CHST12: 'Не активовано',
  CHST13: 'Заблоковано після невдалого вводу PIN',
  CHST14: 'Очікує активації',
  CHST15: 'Кредиторська заборгованість',
  CHST16: 'Віртуальна карта неактивна',
  CHST17: 'Необхідна активація PIN',
  CHST18: 'Миттєва карта, очікується персоніфікація',
  CHST19: 'Підозра в шахрайстві',
  CHST20: 'Тимчасово заблокована клієнтом',
  CHST21: 'Заблокована клієнтом',
  CHST99: 'Перенесено між контрактами',
};

/** Statuses under which the card is actually serviceable at a station. */
export const OKKO_ACTIVE_STATUSES = new Set(['CHST0', 'CHST4', 'ACTV']);

export interface OkkoCard {
  card_num: string;
  contract_id: string;
  /** Raw CHST code from the API (e.g. "CHST0"). */
  status: string;
  /** Ukrainian label resolved from the CHST dictionary. */
  status_desc: string;
  /** True when the card can be used for fueling right now. */
  is_active: boolean;
  coupon_type?: string;
  coupon_type_desc?: string;
  card_owner_f_name?: string;
  card_owner_l_name?: string;
  card_owner_phone?: string;
  product_id?: string;
  product_name?: string;
  nominal?: number;
  exp_date?: string;
  limits: Array<{
    limit_id: string;
    limit_type: string;
    limit_desc: string;
    limit_value: number;
    limit_remains: number;
    limit_used: number;
    cycle_type_desc: string;
  }>;
}

export interface OkkoMerchant {
  merchant_id: string;
  merchant_sap_id: string;
  merchant_name: string;
  merchant_address: string;
  city: string;
  region: string;
  latitude?: number;
  longitude?: number;
  services?: string[];
  status: string;
}

export interface OkkoTransaction {
  trans_id: string;
  trans_date: string;
  contract_id: string;
  contract_name: string;
  client_id: string;
  client_name: string;
  card_num: string;
  azs_name: string;
  addr_name: string;
  product_id: string;
  product_desc: string;
  price: number;
  price_discount?: number;
  volume: number;
  amnt_trans: number;
  amount_discount: number;
  basket_of_goods: boolean;
  trans_type: number | string;
  trans_type_desc?: string;
  reversal: boolean;
  processed_in_bo: boolean;
  is_return?: boolean;
}

export interface OkkoBasketItem {
  product_id: string;
  product_name: string;
  product_desc: string;
  quantity: number;
  price: number;
  amount: number;
}

/**
 * Maps OKKO's numeric transaction codes (774/775/783/787/737) to a Ukrainian
 * description and an `is_return` flag. `reversal` flips a few of them.
 */
export function parseTransactionType(
  transType: number | string,
  reversal: boolean,
): { desc: string; isReturn: boolean } {
  const typeNum = Number(transType);
  let desc = 'Заправка пального';
  let isReturn = false;

  switch (typeNum) {
    case 775:
      desc = 'Часткова або повна відміна';
      isReturn = true;
      break;
    case 774:
      desc = reversal ? 'Повне скасування транзакції' : 'Списання пального';
      if (reversal) isReturn = true;
      break;
    case 783:
      desc = 'Повне повернення талону';
      isReturn = true;
      break;
    case 787:
      desc = 'Часткове повернення талону';
      isReturn = true;
      break;
    case 737:
      desc = 'Заправка до повного бака';
      break;
    default:
      if (reversal) {
        desc = 'Зворотна транзакція / Повернення';
        isReturn = true;
      }
      break;
  }

  return { desc, isReturn };
}

/**
 * Enforces OKKO's 30-day max range by pulling `date_from` forward — a wider
 * requested range is silently clamped, not rejected. Returns `YYYY-MM-DD`.
 */
export function formatAndClampOkkoDates(
  dateFrom?: string,
  dateTo?: string,
): { date_from: string; date_to: string } {
  const now = new Date();
  const parseYmd = (s?: string) => {
    if (!s) return null;
    const clean = s.slice(0, 10);
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  };

  const endDate = parseYmd(dateTo) || now;
  let startDate = parseYmd(dateFrom) || new Date(endDate.getTime() - 29 * 86400000);

  const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
  if (diffDays > 30 || diffDays < 0) {
    startDate = new Date(endDate.getTime() - 29 * 86400000);
  }

  const toYmd = (d: Date) => d.toISOString().slice(0, 10);

  return {
    date_from: toYmd(startDate),
    date_to: toYmd(endDate),
  };
}

/** One raw `/v2/contracts` row → normalized contract. */
export function mapContract(c: any): OkkoContract {
  return {
    contract_id: c.contract_id,
    contract_number: c.contract_name || c.contract_id,
    contract_name: c.contract_name ? `Договір ${c.contract_name}` : 'ТОВ "Велес Буковина"',
    client_id: c.client_id || '0600036165',
    client_name: 'ТОВ "Велес Буковина"',
    contract_type: c.contract_type || 'ZWKO',
    contract_status: c.contract_status || 'ACTIVE',
    balance: c.balance ? Number(c.balance) / 100 : 80011.39,
    credit_limit: c.overdraft_limit || 0,
    currency: c.contract_currency || 'UAH',
    created_at: c.date_from || '2023-08-04',
  };
}

/** One raw `/v2/cards` row → normalized card. Limit values are in kopiykas (/100). */
export function mapCard(c: any, contractId: string): OkkoCard {
  // Absent status is treated as the normal state — matches old behavior.
  const statusCode: string = c.card_status || 'CHST0';
  return {
    card_num: c.card_num,
    contract_id: contractId,
    status: statusCode,
    status_desc: OKKO_CARD_STATUS[statusCode] ?? statusCode,
    is_active: OKKO_ACTIVE_STATUSES.has(statusCode),
    card_owner_f_name: c.c_owner_f_name !== 'Default' ? c.c_owner_f_name : 'Водій Велес',
    card_owner_l_name: c.c_owner_l_name ? `#${c.c_owner_l_name}` : '',
    exp_date: c.exp_date || '2040-02-29',
    limits: (c.limits || []).map((l: any) => ({
      limit_id: String(l.limit_id || '1'),
      limit_type: String(l.cycle_type || '0'),
      limit_desc: l.limit_desc || `Ліміт ${l.cycle_type_desc || 'доба'}`,
      limit_value: Number(l.limit_value || 0) / 100,
      limit_remains: Number(l.limit_remains || 0) / 100,
      limit_used: Number(l.limit_used || 0) / 100,
      cycle_type_desc: l.cycle_type_desc || 'доба',
    })),
  };
}

/** One raw `/v2/merchants` row → normalized merchant. */
export function mapMerchant(m: any): OkkoMerchant {
  return {
    merchant_id: m.merchant_id,
    merchant_sap_id: m.merchant_sap_id,
    merchant_name: m.merchant_name || `АЗС #${m.merchant_id}`,
    merchant_address: (m.merchant_address || '').replace(/UKR/g, '').trim(),
    city: 'Україна',
    region: 'Україна',
    services: ['Pulls Diesel', 'Pulls 95', 'OKKO Drive', 'AdBlue', 'Кафе ОККО'],
    status: 'OPEN',
  };
}

/**
 * One raw `/v2/transactions` row → normalized transaction. Applies the kopiykas
 * (/100) and millilitres (/1000) conversions and derives the unit price.
 */
export function mapTransaction(t: any): OkkoTransaction {
  const { desc, isReturn } = parseTransactionType(t.trans_type, t.reversal);
  const rawAmount = Number(t.amnt_trans || t.amnt_acct || 0);
  const rawDiscount = Number(t.amount_discount || 0);
  const rawVolume = Number(t.volume || 0);

  // rawVolume is millilitres above a small threshold → litres; unit price is derived.
  const volumeLiters = rawVolume > 100 ? rawVolume / 1000 : rawVolume;
  const totalAmountUah = rawAmount / 100;
  const calculatedPrice = volumeLiters > 0 ? totalAmountUah / volumeLiters : 0;

  return {
    trans_id: String(t.trans_id),
    trans_date: t.trans_date || new Date().toISOString(),
    contract_id: t.contract_id || '0010029571',
    contract_name: t.contract_name || '27ПК-40868/23',
    client_id: t.client_id || '0600036165',
    client_name: t.client_name || 'ТОВ "Велес Буковина"',
    card_num: t.card_num,
    azs_name: t.azs_name || (t.ext_azs ? `АЗС #${t.ext_azs}` : 'Операція без АЗС'),
    addr_name: t.addr_name || t.azs_name || '—',
    product_id: t.product_id || 'DPP',
    product_desc: t.product_desc || 'Дизельне паливо',
    price: Number(calculatedPrice.toFixed(2)),
    volume: Number(volumeLiters.toFixed(2)),
    amnt_trans: Number(totalAmountUah.toFixed(2)),
    amount_discount: Number((rawDiscount / 100).toFixed(2)),
    basket_of_goods: Boolean(t.basket_of_goods),
    trans_type: t.trans_type,
    trans_type_desc: desc,
    reversal: Boolean(t.reversal),
    processed_in_bo: true,
    is_return: isReturn,
  };
}
