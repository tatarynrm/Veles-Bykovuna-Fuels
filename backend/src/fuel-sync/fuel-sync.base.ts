import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OracleService } from '../oracle/oracle.service';
import { TruckPayRepository } from './truck-pay.repository';
import {
  FuelSyncRun,
  FuelSyncStatus,
  FuelVendor,
  SyncMode,
  SyncTrigger,
  SyncWindowProgress,
  TruckPayRow,
} from './fuel-sync.types';
import { incrementalFrom, localYmd, nextEvenHourRun, splitPeriod } from './fuel-sync.utils';

export interface FuelSyncSettings {
  vendor: FuelVendor;
  /** Прапорець у .env, що вмикає і крон, і ручний запуск. */
  enabledEnv: string;
  /** Змінна .env зі стартовою датою (YYYY-MM-DD). */
  startEnv: string;
  cron: string;
  /** Хвилина крона `0 <minute> *\/2 * * *` — для підказки «наступний запуск». */
  cronMinute: number;
  cronLabel: string;
  /** Розмір вікна запиту до API вендора, днів. */
  windowDays: number;
  /** Що саме відфільтровується (текст для сторінки). */
  skippedLabel: string;
}

const DEFAULT_START = '2025-01-01';
const DEFAULT_LOOKBACK_DAYS = 40;
const FETCH_ATTEMPTS = 3;

const describeError = (error: any): string => {
  const status = error?.response?.status;
  const message = String(error?.message ?? error ?? 'Невідома помилка').split('\n')[0];
  return status ? `HTTP ${status}: ${message}` : message;
};

/**
 * Спільний механізм синхронізації транзакцій паливних карток → Oracle
 * (`P_API_TRUCK_PAY.save_transaction` → TZ_TRANS). OKKO і Shell — окремі сервіси-нащадки
 * зі своїм кроном, прапорцем і прогресом; тут лише прохід.
 *
 * Прохід ділить період на вікна (≤ місяць) і йде ними ПОСЛІДОВНО від старішого:
 * отримати сирі рядки → відфільтрувати → змапити → записати й закомітити. На першому
 * вікні, що впало, прохід зупиняється — так остання записана дата не «перестрибує»
 * пропуск, і наступний запуск продовжить з того ж місця.
 *
 *  - `incremental` (крон і кнопка «Запустити»): від max(api_dat) бренду мінус запас
 *    FUEL_SYNC_LOOKBACK_DAYS (40), не раніше стартової дати; порожня таблиця → від старту.
 *  - `full` (кнопка «Повністю»): від стартової дати. Безпечно: процедура пропускає наявне.
 *
 * Вимкнено, доки `<VENDOR>_SYNC_ENABLED != true` — пише в живу БД.
 */
export abstract class FuelSyncBase {
  protected readonly logger: Logger;
  readonly enabled: boolean;
  readonly startDate: string;
  readonly lookbackDays: number;

  private running = false;
  private startedAt: number | null = null;
  private mode: SyncMode | null = null;
  private trigger: SyncTrigger | null = null;
  private period: { from: string; to: string } | null = null;
  private windows: SyncWindowProgress[] = [];
  private lastRun: FuelSyncRun | null = null;

  protected constructor(
    protected readonly settings: FuelSyncSettings,
    config: ConfigService,
    protected readonly oracle: OracleService,
    protected readonly repo: TruckPayRepository,
  ) {
    this.logger = new Logger(`${settings.vendor}→Oracle`);
    this.enabled = (config.get<string>(settings.enabledEnv) ?? 'false').trim().toLowerCase() === 'true';

    const start = (config.get<string>(settings.startEnv) ?? '').trim();
    this.startDate = /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : DEFAULT_START;

    const lookback = Number(config.get<string>('FUEL_SYNC_LOOKBACK_DAYS'));
    this.lookbackDays = Number.isFinite(lookback) && lookback >= 0 ? lookback : DEFAULT_LOOKBACK_DAYS;

    if (this.enabled) {
      this.logger.log(`Синхронізацію увімкнено: ${settings.cronLabel}, старт ${this.startDate}, запас ${this.lookbackDays} дн.`);
    } else {
      this.logger.warn(`Синхронізацію вимкнено (${settings.enabledEnv} != true)`);
    }
  }

  /** Сирі рядки API вендора за вікно [from, to] (YYYY-MM-DD, включно). Помилку кидає. */
  protected abstract fetchWindow(from: string, to: string): Promise<any[]>;
  protected abstract shouldSync(raw: any): boolean;
  protected abstract map(raw: any): TruckPayRow;

  getStatus(): FuelSyncStatus {
    return {
      vendor: this.settings.vendor,
      enabled: this.enabled,
      oracleConfigured: this.oracle.isConfigured(),
      running: this.running,
      startedAt: this.startedAt ? new Date(this.startedAt).toISOString() : null,
      mode: this.mode,
      trigger: this.trigger,
      period: this.period,
      windowsTotal: this.windows.length,
      windowsDone: this.windows.filter((w) => w.status === 'done' || w.status === 'error').length,
      windows: this.windows,
      lastRun: this.lastRun,
      nextRunAt: this.enabled ? nextEvenHourRun(new Date(), this.settings.cronMinute).toISOString() : null,
      config: {
        cron: this.settings.cron,
        cronLabel: this.settings.cronLabel,
        startDate: this.startDate,
        lookbackDays: this.lookbackDays,
        windowDays: this.settings.windowDays,
        procedure: this.repo.procedure,
        skippedLabel: this.settings.skippedLabel,
      },
    };
  }

  /** Для крона: тихо нічого не робить, якщо синхронізацію вимкнено. */
  protected runScheduled(): Promise<FuelSyncRun | null> | undefined {
    if (!this.enabled) return undefined;
    return this.run('incremental', 'cron');
  }

  /**
   * Ручний запуск з HTTP: прохід іде у фоні (повна закачка Shell триває хвилини),
   * відповідь — одразу; прогрес сторінка бачить через getStatus().
   */
  start(mode: SyncMode): { started: boolean; message: string } {
    const blocked = this.blockReason();
    if (blocked) return { started: false, message: blocked };
    this.run(mode, 'manual').catch(() => undefined);
    return {
      started: true,
      message: mode === 'full' ? `Запущено повну закачку з ${this.startDate}` : 'Запущено синхронізацію',
    };
  }

  private blockReason(): string | null {
    if (!this.enabled) return `Синхронізацію вимкнено: задайте ${this.settings.enabledEnv}=true у backend/.env`;
    if (this.running) return 'Синхронізація вже триває';
    if (!this.oracle.isConfigured()) return 'Oracle не налаштовано';
    return null;
  }

  async run(mode: SyncMode, trigger: SyncTrigger): Promise<FuelSyncRun | null> {
    const blocked = this.blockReason();
    if (blocked) {
      this.logger.warn(`Прохід пропущено: ${blocked}`);
      return null;
    }

    // Усе до першого await виконується синхронно — повторний start() вже бачить running.
    this.running = true;
    const started = Date.now();
    this.startedAt = started;
    this.mode = mode;
    this.trigger = trigger;
    this.windows = [];

    const to = localYmd();
    let from = this.startDate;
    const totals = { fetched: 0, skipped: 0, sent: 0, inserted: 0, failed: 0 };
    let error: string | null = null;

    try {
      if (mode === 'incremental') {
        from = incrementalFrom(await this.repo.getLastDate(this.settings.vendor), this.startDate, this.lookbackDays);
      }
      if (from > to) from = to;
      this.period = { from, to };
      this.windows = splitPeriod(from, to, this.settings.windowDays).map((w) => ({
        ...w,
        status: 'pending' as const,
        fetched: 0,
        skipped: 0,
        sent: 0,
        inserted: 0,
        failed: 0,
        error: null,
        at: null,
      }));
      this.logger.log(`Прохід ${mode} (${trigger}): ${from} → ${to}, вікон ${this.windows.length}`);

      for (const w of this.windows) {
        w.status = 'active';
        try {
          await this.syncWindow(w);
        } finally {
          totals.fetched += w.fetched;
          totals.skipped += w.skipped;
          totals.sent += w.sent;
          totals.inserted += w.inserted;
          totals.failed += w.failed;
        }
      }
    } catch (e) {
      error = describeError(e);
      this.logger.error(`Прохід зупинено: ${error}`);
    } finally {
      const durationMs = Date.now() - started;
      this.lastRun = {
        at: new Date().toISOString(),
        mode,
        trigger,
        from: this.period?.from ?? from,
        to,
        ...totals,
        durationMs,
        ok: error === null,
        error,
      };
      this.running = false;
      this.startedAt = null;
      this.logger.log(
        `Прохід завершено за ${Math.round(durationMs / 1000)}с: отримано ${totals.fetched}, пропущено ${totals.skipped}, ` +
          `нових ${totals.inserted}, вже були ${totals.sent - totals.inserted}, помилок ${totals.failed}`,
      );
    }
    return this.lastRun;
  }

  /** Одне вікно: API → фільтр → мапінг → процедура. Кидає, якщо вікно не вдалось. */
  private async syncWindow(w: SyncWindowProgress): Promise<void> {
    try {
      const raw = await this.fetchWithRetry(w.from, w.to);
      w.fetched = raw.length;

      const eligible = raw.filter((r) => this.shouldSync(r));
      w.skipped = raw.length - eligible.length;

      // Захист від дублів усередині вікна (однаковий ID → однаковий cctrans).
      const rows = [...new Map(eligible.map((r) => this.map(r)).map((row) => [row.api_transaction_id, row])).values()];
      const result = await this.repo.saveBatch(this.settings.vendor, rows);
      w.sent = result.sent;
      w.inserted = result.inserted;
      w.failed = result.failed;
      w.error = result.errors[0] ?? null;
      w.at = new Date().toISOString();

      // Процедура відхилила все — найчастіше вона невалідна або змінився контракт JSON.
      if (result.failed > 0 && result.sent === 0) {
        w.status = 'error';
        throw new Error(`Процедура відхилила всі ${result.failed} рядків: ${result.errors[0]}`);
      }
      w.status = 'done';
      this.logger.log(
        `${w.from}..${w.to}: отримано ${w.fetched}, пропущено ${w.skipped}, нових ${w.inserted}, ` +
          `вже були ${w.sent - w.inserted}, помилок ${w.failed}`,
      );
    } catch (e) {
      w.status = 'error';
      w.error = w.error ?? describeError(e);
      w.at = new Date().toISOString();
      throw e;
    }
  }

  /** Shell повільний і часом віддає таймаут — пара повторів, перш ніж зупинити прохід. */
  private async fetchWithRetry(from: string, to: string): Promise<any[]> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.fetchWindow(from, to);
      } catch (e) {
        const status = e?.response?.status;
        const retriable = !status || status === 429 || status >= 500;
        if (!retriable || attempt >= FETCH_ATTEMPTS) throw e;
        this.logger.warn(`${from}..${to}: ${describeError(e)} — повтор ${attempt}/${FETCH_ATTEMPTS - 1}`);
        await new Promise((resolve) => setTimeout(resolve, 5_000 * attempt));
      }
    }
  }
}
