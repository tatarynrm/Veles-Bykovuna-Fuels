/** Спільні форматувальники екранів «Банк». Дати банку — ISO без часового поясу, їх не перераховуємо. */

export const NO_DATA = '—';

/** Місцева дата для <input type="date">, зі зсувом у днях. */
export const localYmd = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** "2026-10-20" → "20.10.2026". */
export const dmy = (ymd: string | null | undefined) =>
  ymd ? ymd.slice(0, 10).split('-').reverse().join('.') : NO_DATA;

/** "2026-10-20T03:51:00" → "20.10.2026 03:51" без перерахунку часових поясів. */
export const dmyHm = (iso: string | null | undefined) =>
  iso ? `${dmy(iso)} ${iso.slice(11, 16)}`.trim() : NO_DATA;

const formatters = new Map<string, Intl.NumberFormat>();

export function money(value: number | null | undefined, currency?: string | null): string {
  if (value === null || value === undefined) return NO_DATA;
  const code = currency || 'UAH';
  let f = formatters.get(code);
  if (!f) {
    try {
      f = new Intl.NumberFormat('uk-UA', { style: 'currency', currency: code });
    } catch {
      f = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    formatters.set(code, f);
  }
  return f.format(value);
}

export const count = (n: number) => n.toLocaleString('uk-UA');

/** IBAN у скороченому вигляді для таблиці: повний — у title й у деталях. */
export const shortIban = (iban: string | null | undefined) =>
  iban ? (iban.length > 12 ? `${iban.slice(0, 4)}…${iban.slice(-6)}` : iban) : NO_DATA;
