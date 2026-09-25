/**
 * Чисті помічники синхронізації транзакцій → Oracle: календарні вікна, дати, розклад.
 * Без Nest/axios/oracledb, тож покриті тестами (fuel-sync.mapper.spec.ts).
 */

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Місцева дата сервера у форматі YYYY-MM-DD. */
export function localYmd(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Ділить [from, to] на вікна по `days` днів без перекриття. Обидві межі включні: і
 * OKKO `date_to`, і Shell `ToDate` віддають транзакції останнього дня (перевірено —
 * на перекритті вікон рядки дублювались).
 */
export function splitPeriod(from: string, to: string, days: number): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  for (let start = from; start <= to; start = addDays(start, days)) {
    const end = addDays(start, days - 1);
    out.push({ from: start, to: end < to ? end : to });
  }
  return out;
}

/**
 * Звідки починати інкрементальний прохід: від останньої записаної дати мінус запас
 * `lookbackDays` (транзакції доходять і виставляються в рахунок із запізненням, а
 * процедура ідемпотентна), але не раніше стартової дати. Порожня таблиця → старт.
 */
export function incrementalFrom(lastDat: string | null, startDate: string, lookbackDays: number): string {
  if (!lastDat) return startDate;
  const back = addDays(lastDat.slice(0, 10), -lookbackDays);
  return back > startDate ? back : startDate;
}

/**
 * Наступний запуск крона `0 <minute> *\/2 * * *` (кожна парна година, місцевий час).
 */
export function nextEvenHourRun(now: Date, minute: number): Date {
  const next = new Date(now);
  next.setMinutes(minute, 0, 0);
  if (next.getHours() % 2 !== 0) next.setHours(next.getHours() + 1);
  if (next <= now) next.setHours(next.getHours() + 2);
  return next;
}
