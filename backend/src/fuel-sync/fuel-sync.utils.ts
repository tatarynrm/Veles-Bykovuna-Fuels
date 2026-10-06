/**
 * Чисті помічники синхронізації транзакцій → Oracle: календарні вікна, дати, розклад.
 * Без Nest/axios/oracledb, тож покриті тестами (fuel-sync.mapper.spec.ts).
 */

const DAY_MS = 86_400_000;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, '0');

/** Місцева дата сервера у форматі YYYY-MM-DD. */
export function localYmd(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Чи це дата у форматі YYYY-MM-DD (валідація періоду з HTTP). */
export function isYmd(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(`${value}T00:00:00Z`));
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
 * Звідки починати звичайний прохід: **завжди щонайменше останні `days` днів** (вендори
 * доносять транзакції й виставляють рахунки із запізненням, а повторне надсилання
 * безпечне). Якщо синхронізація довго не працювала і остання записана дата старіша —
 * беремо від неї, щоб закрити пропуск. Не раніше стартової дати.
 */
export function recentFrom(lastDat: string | null, startDate: string, days: number, today: string = localYmd()): string {
  const recent = addDays(today, -days);
  const candidate = lastDat && lastDat.slice(0, 10) < recent ? lastDat.slice(0, 10) : recent;
  return candidate < startDate ? startDate : candidate;
}

/** "09:00" → { hour: 9, minute: 0 }; інакше null. */
function parseTime(value: string): { hour: number; minute: number } | null {
  const m = TIME_RE.exec(String(value ?? '').trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : null;
}

/**
 * Наступний запуск за списком щоденних часів із налаштувань (місцевий час сервера):
 * ["09:00", "15:00"]. Порожній список — розкладу немає.
 */
export function nextDailyRun(now: Date, times: string[]): Date | null {
  const parsed = times
    .map(parseTime)
    .filter((t): t is { hour: number; minute: number } => t !== null)
    .sort((a, b) => a.hour - b.hour || a.minute - b.minute);
  if (!parsed.length) return null;

  for (const { hour, minute } of parsed) {
    const candidate = new Date(now);
    candidate.setHours(hour, minute, 0, 0);
    if (candidate > now) return candidate;
  }
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(parsed[0].hour, parsed[0].minute, 0, 0);
  return next;
}

/** Крон-вирази для щоденних часів: ["09:00"] → ["0 0 9 * * *"]. */
export function cronExpressions(times: string[]): string[] {
  return times
    .map(parseTime)
    .filter((t): t is { hour: number; minute: number } => t !== null)
    .map(({ hour, minute }) => `0 ${minute} ${hour} * * *`);
}
