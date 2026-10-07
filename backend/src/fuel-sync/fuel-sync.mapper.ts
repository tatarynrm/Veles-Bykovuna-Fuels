import type { TruckPayRow } from './fuel-sync.types';

/**
 * Сирі транзакції OKKO / Shell → JSON для `P_API_TRUCK_PAY.save_transaction`
 * (таблиця TZ_TRANS). Чисті функції без I/O — покриті fuel-sync.mapper.spec.ts.
 *
 * Семантика грошей однакова для обох вендорів (як у CCINVOICED):
 *   *full — за ціною стели, до знижки;  api_suma/api_cina — фактично для нас;
 *   *zn   — знижка (від'ємна = націнка).
 * Суми завжди додатні; повернення / кредит позначає `api_minus = 1`.
 */

/** Розміри VARCHAR2 у TZ_TRANS, у байтах: кирилиця в UTF-8 займає 2 байти на символ. */
const MAX_BYTES = {
  api_adresa: 4000,
  api_cc: 100,
  api_chek: 1000,
  api_kraina: 20,
  api_oper1: 500,
  api_os: 100,
  api_oper2: 200,
  api_rahnum: 100,
  api_station: 100,
  api_tz: 100,
  api_valut: 100,
  api_transaction_id: 200,
} as const;

const round = (n: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Обрізає рядок до `maxBytes` байтів UTF-8, не розрізаючи символ; порожнє → null. */
export function clipText(v: unknown, maxBytes: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (Buffer.byteLength(s, 'utf8') <= maxBytes) return s;
  let bytes = 0;
  let out = '';
  for (const ch of s) {
    const b = Buffer.byteLength(ch, 'utf8');
    if (bytes + b > maxBytes) break;
    bytes += b;
    out += ch;
  }
  return out;
}

const joinText = (parts: unknown[], sep: string) =>
  parts
    .map((p) => (p === null || p === undefined ? '' : String(p).trim()))
    .filter(Boolean)
    .join(sep);

/** api_przn — NUMBER(5,2): за межами ±999.99 Oracle відхилить рядок. */
const percent = (value: number): number | null =>
  Number.isFinite(value) && Math.abs(value) <= 999.99 ? round(value, 2) : null;

/** Серіалізація для процедури: null-поля не передаємо (get_* на відсутньому ключі дає NULL). */
export function toProcedureJson(row: TruckPayRow): string {
  return JSON.stringify(row, (_key, value) => (value === null ? undefined : value));
}

// ─── OKKO ──────────────────────────────────────────────────────────────────

/** Офіційний словник типів операцій OKKO: GET /v2/metadata, KEY = "TPTP", LANG = 3. */
export const OKKO_TRANS_TYPES: Record<number, string> = {
  550: 'Зміна PIN-коду',
  659: "Дебетовий договір з пред'явленням",
  687: 'Поповнення контракту',
  688: 'Списання з контракту',
  706: 'Переказ з контракту',
  736: 'Попередня авторизація заправки "до повного"',
  737: 'Заправка "до повного"',
  774: 'Заправка/покупка з карткою',
  775: 'Часткове повернення',
  780: 'Заправка по талону',
  781: 'Переказ з контракту',
  783: 'Повернення талона',
  785: 'Зарахування на контракт',
  787: 'Часткове повернення талона',
};

/**
 * Не пишемо: операції з договором, а не витрата по картці (поповнення, списання,
 * перекази, зміна PIN), і передавторизацію 736 — фактичне списання приходить окремо як 737.
 */
export const OKKO_SKIP_TYPES = new Set([550, 659, 687, 688, 706, 736, 781, 785]);

/** Повернення: сума в OKKO завжди додатна, напрям видно лише з коду. */
export const OKKO_RETURN_TYPES = new Set([775, 783, 787]);

/** "2026-08-27T16:10:47.000" → "2026-08-27T16:10:47". */
export function okkoDateTime(value: unknown): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(String(value ?? ''));
  return m ? `${m[1]}T${m[2]}` : null;
}

export function shouldSyncOkko(t: any): boolean {
  return Boolean(
    t?.trans_id && t.card_num && okkoDateTime(t.trans_date) && !OKKO_SKIP_TYPES.has(Number(t.trans_type)),
  );
}

/** Гроші OKKO — у копійках, обʼєм — у мілілітрах. */
export function mapOkkoToTruckPay(t: any): TruckPayRow {
  const type = Number(t.trans_type);
  const price = num(t.price) ?? 0; // коп./л, ціна стели до знижки
  const priceDiscount = num(t.price_discount) ?? 0; // коп./л; від'ємна = націнка
  const volumeMl = num(t.volume) ?? 0;
  const uah = (kop: unknown) => {
    const n = num(kop);
    return n === null ? null : round(n / 100, 2);
  };
  // «Власник картки» в OKKO — не водій, а мітка картки: марка авто або цифри номера.
  const cardLabel = joinText(
    [t.person_first_name, t.person_last_name].filter((v) => v && String(v).trim() !== 'Default'),
    ' ',
  );

  return {
    api_brend: 'OKKO',
    api_transaction_id: clipText(t.trans_id, MAX_BYTES.api_transaction_id) as string,
    api_dat: okkoDateTime(t.trans_date) as string,
    api_cc: clipText(t.card_num, MAX_BYTES.api_cc),
    api_adresa: clipText(joinText([t.azs_name, t.addr_name], ', '), MAX_BYTES.api_adresa),
    api_station: clipText(t.ext_azs, MAX_BYTES.api_station),
    // Номера чека OKKO не віддає; RRN — референс платіжної операції (у 775 він
    // дорівнює trans_id заправки 774, яку повертають).
    api_chek: clipText(t.rrn, MAX_BYTES.api_chek),
    api_kil: volumeMl > 0 ? round(volumeMl / 1000, 3) : null,
    api_km: null,
    api_kraina: 'UA',
    api_valut: clipText(t.acurr_acct, MAX_BYTES.api_valut) ?? 'UAH',
    api_cinafull: price > 0 ? round(price / 100, 2) : null,
    api_cinazn: price > 0 ? round(priceDiscount / 100, 2) : null,
    api_cina: price > 0 ? round((price - priceDiscount) / 100, 2) : null,
    api_sumafull: uah(t.amnt_trans),
    api_sumazn: uah(t.amount_discount),
    // amnt_acct = amnt_trans − amount_discount — фактично списано з договору.
    api_suma: uah(t.amnt_acct ?? t.amnt_trans),
    api_pdv: null,
    api_przn: price > 0 ? percent((priceDiscount / price) * 100) : null,
    api_minus: OKKO_RETURN_TYPES.has(type) || t.reversal === true ? 1 : 0,
    api_oper1: clipText(joinText([type, OKKO_TRANS_TYPES[type]], ' '), MAX_BYTES.api_oper1),
    api_oper2: clipText(joinText([t.product_id, t.product_desc], ' '), MAX_BYTES.api_oper2),
    api_os: null,
    api_tz: clipText(cardLabel, MAX_BYTES.api_tz),
    api_rahnum: null,
    api_rahdat: null,
  };
}

// ─── Shell ─────────────────────────────────────────────────────────────────

/**
 * "20260827" + "08:59:36" → "2026-08-27T08:59:36"; також "20260831 00:00:00" і
 * "20260819 000530" (формат PostingDate з документації) → ISO-подібний рядок.
 */
export function shellDateTime(date: unknown, time?: unknown): string | null {
  const d = /^(\d{4})(\d{2})(\d{2})(?:[ T](\d{2}):?(\d{2}):?(\d{2}))?/.exec(String(date ?? '').trim());
  if (!d) return null;
  const t = /^(\d{2}):(\d{2}):(\d{2})$/.exec(String(time ?? '').trim());
  const [hh, mi, ss] = t ? [t[1], t[2], t[3]] : [d[4] ?? '00', d[5] ?? '00', d[6] ?? '00'];
  return `${d[1]}-${d[2]}-${d[3]}T${hh}:${mi}:${ss}`;
}

/**
 * Повний момент операції Shell. На комісіях (`Transaction Fee`, `Invoice Adjustment`)
 * вендор віддає `TransactionTime = 00:00:00`, але в тих же рядках є `PostingDate` з
 * реальним часом рознесення. Якщо рознесення того самого дня — беремо час звідти, щоб
 * api_dat був повноцінним timestamp; якщо іншого дня (комісія за 28.02 рознесена 01.03) —
 * лишаємо 00:00:00, бо чужий час на цю дату чіпляти не можна.
 */
export function shellEventDateTime(t: any): string | null {
  const base = shellDateTime(t?.TransactionDate, t?.TransactionTime);
  if (!base || !base.endsWith("T00:00:00")) return base;
  const posting = shellDateTime(t?.PostingDate);
  return posting && posting.slice(0, 10) === base.slice(0, 10) ? posting : base;
}
/**
 * Пишемо продажі (пальне, AdBlue, тол) і збори (комісії, оренда OBU, пеня), але лише
 * ВЖЕ виставлені в рахунок: процедура тільки вставляє, тож № і дата рахунку для рядка,
 * записаного раніше, вже ніколи б не заповнились. Інкрементальний прохід перечитує
 * останні дні із запасом і підбере рядок, щойно Shell виставить рахунок.
 */
export function shouldSyncShell(t: any): boolean {
  return Boolean(t?.IsInvoiced === true && t.TrnIdentifier && shellDateTime(t.TransactionDate));
}

/** Суми — у валюті інвойсу (EUR): Invoice* та CustomerRetail*, як у рахунку Shell. */
export function mapShellToTruckPay(t: any): TruckPayRow {
  const isSale = t.Type === 'SalesItem';
  const gross = num(t.InvoiceGrossAmount) ?? 0;
  const suma = round(Math.abs(gross), 2);
  const retailGross = num(t.CustomerRetailValueTotalGross);
  // У зборах ціни стели немає — «повна» сума дорівнює фактичній.
  const sumafull = retailGross !== null ? round(Math.abs(retailGross), 2) : suma;
  const sumazn = round(sumafull - suma, 2);
  // Quantity — літри лише в продажах; у комісіях це база нарахування, не кількість.
  const quantity = isSale ? num(t.Quantity) : null;
  const kil = quantity !== null && quantity !== 0 ? Math.abs(quantity) : null;
  const retailUnit = num(t.CustomerRetailPriceUnitGross);
  const cinafull = retailUnit !== null ? round(Math.abs(retailUnit), 4) : null;
  const cina = kil ? round(suma / kil, 4) : null;
  const odometer = num(t.OdometerInput);
  const vrn = clipText(t.VehicleRegistration, MAX_BYTES.api_tz);
  // DriverName на наших картках — це держномер; у «Особу» пишемо лише справжнє ім'я.
  const driver = clipText(t.DriverName, MAX_BYTES.api_os);

  return {
    api_brend: 'SHELL',
    // TransactionId спільний для кількох рядків однієї покупки (дизель + AdBlue) і
    // порожній у зборах; TrnIdentifier ("37" + SalesItemId) унікальний для кожного рядка.
    api_transaction_id: clipText(t.TrnIdentifier, MAX_BYTES.api_transaction_id) as string,
    api_dat: shellEventDateTime(t) as string,
    api_cc: clipText(t.CardPAN, MAX_BYTES.api_cc),
    api_adresa: clipText(joinText([t.SiteName, t.SiteCountry], ', '), MAX_BYTES.api_adresa),
    api_station: clipText(t.SiteCode, MAX_BYTES.api_station),
    api_chek: clipText(t.ReceiptNumber, MAX_BYTES.api_chek),
    api_kil: kil,
    api_km: odometer !== null && odometer > 0 ? odometer : null,
    api_kraina: clipText(t.PurchasedInCountryCode, MAX_BYTES.api_kraina),
    api_valut: clipText(t.InvoiceCurrencyCode, MAX_BYTES.api_valut),
    api_cinafull: cinafull,
    api_cina: cina,
    api_cinazn: cinafull !== null && cina !== null ? round(cinafull - cina, 4) : null,
    api_suma: suma,
    api_sumafull: sumafull,
    api_sumazn: sumazn,
    api_pdv: round(Math.abs(num(t.InvoiceTax) ?? 0), 2),
    api_przn: sumafull > 0 ? percent((sumazn / sumafull) * 100) : null,
    api_minus:
      String(t.CreditDebitCode ?? '').trim().toUpperCase() === 'C' ||
      gross < 0 ||
      /^y(es)?$/i.test(String(t.RefundFlag ?? '').trim())
        ? 1
        : 0,
    api_oper1: clipText(joinText([t.ProductGroupId, t.ProductGroupName], ' '), MAX_BYTES.api_oper1),
    api_oper2: clipText(joinText([t.ProductCode, t.ProductName], ' '), MAX_BYTES.api_oper2),
    api_os: driver && driver !== vrn ? driver : null,
    api_tz: vrn,
    api_rahnum: clipText(t.InvoiceNumber, MAX_BYTES.api_rahnum),
    api_rahdat: shellDateTime(t.InvoiceDate),
  };
}
