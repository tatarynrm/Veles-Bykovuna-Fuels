import { Logger } from '@nestjs/common';
import { SyncConfigService } from '../config/sync-config.service';
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
import { cronExpressions, isYmd, localYmd, nextDailyRun, recentFrom, splitPeriod } from './fuel-sync.utils';

export interface FuelSyncSettings {
  vendor: FuelVendor;
  /** Ключ вендора в sync-config.json → fuel.<key>. */
  key: 'okko' | 'shell';
  /** Розмір вікна запиту до API вендора, днів. */
  windowDays: number;
  /** Що саме відфільтровується (текст для сторінки). */
  skippedLabel: string;
}

const DEFAULT_START = '2025-01-01';
const DEFAULT_LOOKBACK_DAYS = 7;
const FETCH_ATTEMPTS = 4;

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
 *  - `recent` (крон і кнопка «Запустити»): завжди останні FUEL_SYNC_LOOKBACK_DAYS (7) днів;
 *    якщо синхронізація довго не працювала — від останньої записаної дати, щоб закрити пропуск.
 *  - `period` (кнопка «За період»): вибраний діапазон дат.
 *  - `full` (кнопка «Повністю»): від стартової дати.
 *  Повторний прохід безпечний: уже записані транзакції відсіюються за `api_transaction_id`.
 * * Вимкнено, доки `fuel.<вендор>.enabled` у backend/sync-config.json не true — пише в живу БД.
 */
export abstract class FuelSyncBase {
  protected readonly logger: Logger;

  /** Усе налаштовується у backend/sync-config.json і читається НА КОЖЕН прохід, */
  /** тож зміни у файлі діють одразу, без перезапуску бекенда. */
  get enabled(): boolean {
    return this.syncConfig.get().fuel[this.settings.key].enabled;
  }

  get startDate(): string {
    return this.syncConfig.get().fuel[this.settings.key].startDate;
  }

  get lookbackDays(): number {
    return this.syncConfig.get().fuel.lookbackDays;
  }

  private running = false;
  private startedAt: number | null = null;
  private mode: SyncMode | null = null;
  private trigger: SyncTrigger | null = null;
  private period: { from: string; to: string } | null = null;
  private windows: SyncWindowProgress[] = [];
  private lastRun: FuelSyncRun | null = null;

  protected constructor(
    protected readonly settings: FuelSyncSettings,
    protected readonly syncConfig: SyncConfigService,
    protected readonly oracle: OracleService,
    protected readonly repo: TruckPayRepository,
  ) {
    this.logger = new Logger(`${settings.vendor}→Oracle`);
    if (this.enabled) {
      this.logger.log(
        `Синхронізацію увімкнено: ${this.cronLabel}, старт ${this.startDate}, останні ${this.lookbackDays} дн.`,
      );
    } else {
      this.logger.warn(`Синхронізацію вимкнено (fuel.${settings.key}.enabled у sync-config.json)`);
    }
  }

  /** Часи запуску з файлу налаштувань. */
  get times(): string[] {
    return this.syncConfig.get().fuel.times;
  }

  /** Людський опис розкладу з файлу: «щодня о 09:00 і 15:00». */
  get cronLabel(): string {
    const times = this.times;
    return times.length ? `щодня о ${times.join(' і ')}` : 'за розкладом';
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
      nextRunAt: this.enabled ? (nextDailyRun(new Date(), this.times)?.toISOString() ?? null) : null,
      config: {
        cron: cronExpressions(this.times).join(' · '),
        cronLabel: this.cronLabel,
        configFile: this.syncConfig.getStatus().file,
        startDate: this.startDate,
        lookbackDays: this.lookbackDays,
        windowDays: this.settings.windowDays,
        procedure: this.repo.procedure,
        skippedLabel: this.settings.skippedLabel,
      },
    };
  }

  /** Для крона: тихо нічого не робить, якщо синхронізацію вимкнено. */
  runScheduled(): Promise<FuelSyncRun | null> | undefined {
    if (!this.enabled) return undefined;
    return this.run('recent', 'cron');
  }

  /**
   * Ручний запуск з HTTP: прохід іде у фоні (повна закачка Shell триває хвилини),
   * відповідь — одразу; прогрес сторінка бачить через getStatus().
   */
  start(mode: SyncMode, period?: { from?: string; to?: string }): { started: boolean; message: string } {
    const blocked = this.blockReason();
    if (blocked) return { started: false, message: blocked };

    if (mode === 'period') {
      const from = period?.from;
      const to = period?.to ?? localYmd();
      if (!isYmd(from) || !isYmd(to)) return { started: false, message: 'Вкажіть період у форматі РРРР-ММ-ДД' };
      if (from > to) return { started: false, message: 'Початок періоду пізніший за кінець' };
      this.run(mode, 'manual', { from, to }).catch(() => undefined);
      return { started: true, message: `Запущено за період ${from} → ${to}` };
    }

    this.run(mode, 'manual').catch(() => undefined);
    return {
      started: true,
      message:
        mode === 'full'
          ? `Запущено повну закачку з ${this.startDate}`
          : `Запущено синхронізацію за останні ${this.lookbackDays} дн.`,
    };
  }

  private blockReason(): string | null {
    if (!this.enabled) {
      return `Синхронізацію вимкнено: увімкніть fuel.${this.settings.key}.enabled у ${this.syncConfig.getStatus().file}`;
    }
    if (this.running) return 'Синхронізація вже триває';
    if (!this.oracle.isConfigured()) return 'Oracle не налаштовано';
    return null;
  }

  async run(
    mode: SyncMode,
    trigger: SyncTrigger,
    period?: { from: string; to: string },
  ): Promise<FuelSyncRun | null> {
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

    let to = localYmd();
    let from = this.startDate;
    const totals = { fetched: 0, skipped: 0, alreadyStored: 0, sent: 0, inserted: 0, failed: 0 };
    let error: string | null = null;

    try {
      if (mode === 'recent') {
        // Завжди останні N днів, а якщо синхронізація стояла довше — від останньої
        // записаної дати, щоб не лишилось пропуску.
        from = recentFrom(await this.repo.getLastDate(this.settings.vendor), this.startDate, this.lookbackDays, to);
      } else if (mode === 'period' && period) {
        from = period.from;
        to = period.to;
      }
      if (from > to) from = to;
      this.period = { from, to };
      this.windows = splitPeriod(from, to, this.settings.windowDays).map((w) => ({
        ...w,
        status: 'pending' as const,
        fetched: 0,
        skipped: 0,
        alreadyStored: 0,
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
          totals.alreadyStored += w.alreadyStored;
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
          `нових ${totals.inserted}, вже були ${totals.alreadyStored + (totals.sent - totals.inserted)}, ` +
          `помилок ${totals.failed}`,
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
      const mapped = [...new Map(eligible.map((r) => this.map(r)).map((row) => [row.api_transaction_id, row])).values()];
      // …і від повторного надсилання вже записаного: звіряємось за вендорським id, а не
      // за cctrans, бо той містить дату з часом і змінюється разом із правилами api_dat.
      const stored = await this.repo.getExistingIds(this.settings.vendor, w.from, w.to);
      const rows = mapped.filter((row) => !stored.has(row.api_transaction_id));
      w.alreadyStored = mapped.length - rows.length;
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
          `вже були ${w.alreadyStored + (w.sent - w.inserted)}, помилок ${w.failed}`,
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
