import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { SyncConfigService } from "../config/sync-config.service";
import { rescheduleJobs } from "../config/cron-jobs";
import { oracleErrorText } from "../common/oracle-error";
import { OracleService } from "../oracle/oracle.service";
import {
  addDays,
  isYmd,
  localYmd,
  splitPeriod,
} from "../fuel-sync/fuel-sync.utils";
import { PrivatApiService } from "./privat-api.service";
import { BankRepository } from "./bank.repository";
import {
  AddBankVParams,
  mapPrivatToAddBankV,
  shouldSyncPrivat,
} from "./privat-bank.mapper";

export type PrivatSyncTrigger = "cron" | "manual";
/** `recent` — сьогодні + lookbackDays (крон і «Запустити зараз»); `period` — вибраний діапазон. */
export type PrivatSyncMode = "recent" | "period";
export type PrivatWindowStatus = "pending" | "active" | "done" | "error";

/** Одне вікно періоду в живому прогресі проходу. */
export interface PrivatSyncWindow {
  from: string;
  to: string;
  status: PrivatWindowStatus;
  /** Рядків отримано з виписки ПриватБанку. */
  fetched: number;
  /** Не пишемо: ще не проведені / сторновані / без обов'язкових даних. */
  skipped: number;
  /** Уже лежали в BANKV — у процедуру не йшли. */
  alreadyStored: number;
  /** Передано процедурі без помилки (у пробному проході — скільки пішло б). */
  sent: number;
  /** З них нових рядків у BANKV. */
  inserted: number;
  failed: number;
  error: string | null;
  /** Коли вікно завершилось (ISO). */
  at: string | null;
}

/** Підсумок останнього проходу — його показує GET /api/privat/sync-status. */
export interface PrivatSyncRun {
  at: string;
  trigger: PrivatSyncTrigger;
  mode: PrivatSyncMode;
  /** `true` — нічого не записувалось, лише порахували, що б пішло в Oracle. */
  dryRun: boolean;
  from: string;
  to: string;
  /** Скільки вікон було в плані й скільки з них опрацьовано (done або error). */
  windowsTotal: number;
  windowsDone: number;
  fetched: number;
  skipped: number;
  alreadyStored: number;
  sent: number;
  inserted: number;
  failed: number;
  durationMs: number;
  ok: boolean;
  error: string | null;
  /** Перші помилки процедури. */
  errors: string[];
  /** Лише для dryRun: перші рядки у вигляді, в якому підуть в AddBankV. */
  sample?: AddBankVParams[];
}

export interface PrivatSyncStatus {
  enabled: boolean;
  oracleConfigured: boolean;
  bankConfigured: boolean;
  running: boolean;
  startedAt: string | null;
  /** Режим і період поточного (або останнього) проходу. */
  mode: PrivatSyncMode | null;
  period: { from: string; to: string } | null;
  windowsTotal: number;
  windowsDone: number;
  windows: PrivatSyncWindow[];
  lastRun: PrivatSyncRun | null;
  nextRunAt: string | null;
  config: {
    cron: string;
    cronLabel: string;
    lookbackDays: number;
    windowDays: number;
    maxPeriodDays: number;
    procedure: string;
    configFile: string;
  };
}

/**
 * Період ділиться на вікна по стільки днів, і вікна йдуть ЧЕРГОЮ — одне за одним, від
 * найстарішого. Так Приват (≈1 запит/с) не перевантажується, прогрес видно по вікнах, а збій
 * зупиняє прохід на першому ж вікні: наступний запуск продовжить із того самого місця.
 */
export const WINDOW_DAYS = 7;
/** Запобіжник від випадкового «з 2000 року»: до 3 років за один запуск. */
export const MAX_PERIOD_DAYS = 1100;

/** Наступний запуск крону `0 0 *\/N * * *` (о :00 кожної N-ї години доби). */
export function nextHourlyRun(now: Date, everyHours: number): Date {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  do {
    next.setHours(next.getHours() + 1);
  } while (next.getHours() % everyHours !== 0 || next <= now);
  return next;
}

const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );

/**
 * ПриватБанк → Oracle: транзакції рахунків у `P_BANK.AddBankV` (таблиця `BANKV`).
 *
 * Щогодини (`privat.everyHours` у sync-config.json) читає виписку за СЬОГОДНІ — разом із
 * `privat.lookbackDays` попередніх днів (за замовчуванням 1) — і передає процедурі кожну
 * проведену транзакцію. Попередній день потрібен не для «історії»: проведення, що прийшло
 * між останнім запуском доби та північчю, інакше випало б, бо о 00:00 вікно вже нове.
 * Вручну можна обрати довільний період (`start({ from, to })`) — він іде вікнами по
 * WINDOW_DAYS днів, по черзі, від найстарішого.
 *
 * Безпечно запускати скільки завгодно разів: уже записане відсіюється за ID банку ще до
 * виклику, а сама процедура додатково не пускає дублів і нічого не оновлює.
 *
 * Керується `privat.enabled` у backend/sync-config.json (запасний — PRIVAT_SYNC_ENABLED у .env);
 * за замовчуванням УВІМКНЕНО й пише в живу БД. `dryRun` нічого не пише й працює без цього прапорця.
 */
@Injectable()
export class PrivatSyncService implements OnModuleInit {
  private readonly logger = new Logger(PrivatSyncService.name);
  private running = false;
  private startedAt: number | null = null;
  private mode: PrivatSyncMode | null = null;
  private period: { from: string; to: string } | null = null;
  private windows: PrivatSyncWindow[] = [];
  private lastRun: PrivatSyncRun | null = null;

  constructor(
    private readonly privat: PrivatApiService,
    private readonly oracle: OracleService,
    private readonly repo: BankRepository,
    private readonly syncConfig: SyncConfigService,
    private readonly registry: SchedulerRegistry,
  ) {}

  /** Налаштування читаємо щоразу — зміни у файлі діють без перезапуску. */
  private get settings() {
    return this.syncConfig.get().privat;
  }

  private cronExpression(): string {
    return `0 0 */${this.settings.everyHours} * * *`;
  }

  private cronLabel(): string {
    const n = this.settings.everyHours;
    return n === 1 ? "щогодини" : `кожні ${n} год`;
  }

  onModuleInit(): void {
    this.applySchedule();
    this.syncConfig.onChange(() => this.applySchedule());
    // Прогрів при старті, щоб не чекати першого тіку; вимкнений сервіс просто нічого не зробить.
    setTimeout(() => {
      if (this.settings.enabled) this.sync("cron").catch(() => undefined);
    }, 20_000);
  }

  private applySchedule(): void {
    const expressions = this.settings.enabled ? [this.cronExpression()] : [];
    rescheduleJobs(
      this.registry,
      "privat-sync",
      expressions,
      () => this.sync("cron"),
      this.logger,
    );
  }

  getStatus(): PrivatSyncStatus {
    const enabled = this.settings.enabled;
    return {
      enabled,
      oracleConfigured: this.oracle.isConfigured(),
      bankConfigured: this.privat.isConfigured(),
      running: this.running,
      startedAt: this.startedAt ? new Date(this.startedAt).toISOString() : null,
      mode: this.mode,
      period: this.period,
      windowsTotal: this.windows.length,
      windowsDone: this.windows.filter(
        (w) => w.status === "done" || w.status === "error",
      ).length,
      windows: this.windows,
      lastRun: this.lastRun,
      nextRunAt: enabled
        ? nextHourlyRun(new Date(), this.settings.everyHours).toISOString()
        : null,
      config: {
        cron: this.cronExpression(),
        cronLabel: this.cronLabel(),
        lookbackDays: this.settings.lookbackDays,
        windowDays: WINDOW_DAYS,
        maxPeriodDays: MAX_PERIOD_DAYS,
        procedure: this.repo.procedure,
        configFile: this.syncConfig.getStatus().file,
      },
    };
  }

  /** Чому прохід не можна починати (або `null`). */
  private blockReason(dryRun: boolean): string | null {
    if (this.running) return "Синхронізація вже триває";
    if (!this.privat.isConfigured())
      return "ПриватБанк не налаштовано (PRIVAT_BANK_API_KEY)";
    if (dryRun) return null;
    if (!this.settings.enabled) {
      return `Синхронізацію вимкнено: увімкніть privat.enabled у ${this.syncConfig.getStatus().file}`;
    }
    if (!this.oracle.isConfigured()) return "Oracle не налаштовано";
    return null;
  }

  /**
   * Який період і в якому режимі читати. Без `from` — «останні дні» (сьогодні +
   * lookbackDays); з `from` — вибраний діапазон: кінець за замовчуванням і максимум — сьогодні
   * (майбутнє банк однаково не віддасть), довжина — не більше MAX_PERIOD_DAYS.
   */
  private plan(
    period?: { from?: string; to?: string },
  ): { mode: PrivatSyncMode; from: string; to: string } | { error: string } {
    const today = localYmd();
    if (!period?.from && !period?.to) {
      return {
        mode: "recent",
        from: addDays(today, -this.settings.lookbackDays),
        to: today,
      };
    }
    const from = period.from;
    let to = period.to ?? today;
    if (!isYmd(from) || !isYmd(to)) {
      return { error: "Вкажіть період у форматі РРРР-ММ-ДД" };
    }
    if (from > today) return { error: "Початок періоду в майбутньому" };
    if (to > today) to = today;
    if (from > to) return { error: "Початок періоду пізніший за кінець" };
    if (daysBetween(from, to) + 1 > MAX_PERIOD_DAYS) {
      return {
        error: `Період завеликий: максимум ${MAX_PERIOD_DAYS} днів за один запуск`,
      };
    }
    return { mode: "period", from, to };
  }

  /**
   * Ручний запуск з HTTP. Прохід іде у фоні — відповідь одразу, прогрес по вікнах видно в
   * статусі. Виняток — пробний прохід за одне вікно: він швидкий, тож його звіт повертається
   * відразу.
   */
  async start(
    opts: { dryRun?: boolean; from?: string; to?: string } = {},
  ): Promise<{
    started: boolean;
    message: string;
    run?: PrivatSyncRun | null;
  }> {
    const dryRun = Boolean(opts.dryRun);
    const plan = this.plan({ from: opts.from, to: opts.to });
    if ("error" in plan) return { started: false, message: plan.error };
    const blocked = this.blockReason(dryRun);
    if (blocked) return { started: false, message: blocked };

    const windows = splitPeriod(plan.from, plan.to, WINDOW_DAYS).length;
    const span = `${plan.from} → ${plan.to}, вікон ${windows}`;
    if (dryRun && windows === 1) {
      const run = await this.sync("manual", true, plan);
      return {
        started: true,
        message: `Пробний прохід за ${span} (нічого не записано)`,
        run,
      };
    }
    this.sync("manual", dryRun, plan).catch(() => undefined);
    return {
      started: true,
      message: `${dryRun ? "Запущено пробний прохід" : "Запущено синхронізацію"} за ${span}`,
    };
  }

  async sync(
    trigger: PrivatSyncTrigger,
    dryRun = false,
    planned?: { mode: PrivatSyncMode; from: string; to: string },
  ): Promise<PrivatSyncRun | null> {
    const blocked = this.blockReason(dryRun);
    if (blocked) {
      this.logger.warn(`Прохід пропущено: ${blocked}`);
      return null;
    }
    const plan = planned ?? this.plan();
    if ("error" in plan) {
      this.logger.warn(`Прохід пропущено: ${plan.error}`);
      return null;
    }

    // Усе до першого await виконується синхронно — повторний виклик уже бачить running.
    this.running = true;
    const started = Date.now();
    this.startedAt = started;
    this.mode = plan.mode;
    this.period = { from: plan.from, to: plan.to };
    this.windows = splitPeriod(plan.from, plan.to, WINDOW_DAYS).map((w) => ({
      ...w,
      status: "pending" as const,
      fetched: 0,
      skipped: 0,
      alreadyStored: 0,
      sent: 0,
      inserted: 0,
      failed: 0,
      error: null,
      at: null,
    }));

    const run: PrivatSyncRun = {
      at: new Date().toISOString(),
      trigger,
      mode: plan.mode,
      dryRun,
      from: plan.from,
      to: plan.to,
      windowsTotal: this.windows.length,
      windowsDone: 0,
      fetched: 0,
      skipped: 0,
      alreadyStored: 0,
      sent: 0,
      inserted: 0,
      failed: 0,
      durationMs: 0,
      ok: true,
      error: null,
      errors: [],
    };
    this.logger.log(
      `${dryRun ? "[пробний] " : ""}Прохід ${plan.mode} (${trigger}): ${plan.from} → ${plan.to}, вікон ${this.windows.length}`,
    );

    try {
      // Вікна — ЧЕРГОЮ, від найстарішого; на першому, що впало, прохід зупиняється.
      for (const w of this.windows) {
        w.status = "active";
        try {
          await this.syncWindow(w, dryRun, run);
        } finally {
          run.fetched += w.fetched;
          run.skipped += w.skipped;
          run.alreadyStored += w.alreadyStored;
          run.sent += w.sent;
          run.inserted += w.inserted;
          run.failed += w.failed;
          run.windowsDone += 1;
        }
      }
    } catch (error) {
      run.ok = false;
      run.error = oracleErrorText(error);
      this.logger.error(`Прохід зупинено: ${run.error}`);
    } finally {
      run.durationMs = Date.now() - started;
      this.lastRun = run;
      this.running = false;
      this.startedAt = null;
      this.logger.log(
        `${dryRun ? "[пробний] " : ""}Прохід завершено за ${Math.round(run.durationMs / 1000)}с: отримано ${run.fetched}, ` +
          `пропущено ${run.skipped}, вже були ${run.alreadyStored}, ` +
          `${dryRun ? `пішло б ${run.sent}` : `нових ${run.inserted}`}, помилок ${run.failed}`,
      );
    }
    return run;
  }

  /** Одне вікно: виписка → фільтр → мапінг → відсів уже записаного → процедура. Кидає, якщо вікно не вдалось. */
  private async syncWindow(
    w: PrivatSyncWindow,
    dryRun: boolean,
    run: PrivatSyncRun,
  ): Promise<void> {
    try {
      const rows = await this.privat.getTransactionsForSync(w.from, w.to);
      w.fetched = rows.length;

      const eligible = rows.filter(shouldSyncPrivat);
      w.skipped = rows.length - eligible.length;
      const params = eligible.map(mapPrivatToAddBankV);

      // Вже записане відсіюємо до виклику процедури. Для dryRun це лише SELECT, і лише якщо Oracle є.
      const stored = this.oracle.isConfigured()
        ? await this.repo.getStoredIds(w.from, w.to)
        : new Set<string>();
      const fresh = params.filter(
        (p) => !stored.has(p.bank_trans_id.toUpperCase()),
      );
      w.alreadyStored = params.length - fresh.length;

      if (dryRun) {
        w.sent = fresh.length;
        if (!run.sample) run.sample = [];
        for (const p of fresh) {
          if (run.sample.length >= 3) break;
          run.sample.push(p);
        }
      } else {
        const result = await this.repo.addBatch(fresh);
        w.sent = result.sent;
        w.inserted = result.inserted;
        w.failed = result.failed;
        for (const e of result.errors) {
          if (run.errors.length < 5) run.errors.push(e);
        }
        // Процедура відхилила все — найчастіше вона невалідна або змінився контракт.
        if (result.failed > 0 && result.sent === 0) {
          throw new Error(
            `Процедура відхилила всі ${result.failed} рядків: ${result.errors[0]}`,
          );
        }
      }

      w.status = "done";
      w.at = new Date().toISOString();
      this.logger.log(
        `${w.from}..${w.to}: отримано ${w.fetched}, пропущено ${w.skipped}, вже були ${w.alreadyStored}, ` +
          `${dryRun ? `пішло б ${w.sent}` : `нових ${w.inserted}`}, помилок ${w.failed}`,
      );
    } catch (error) {
      w.status = "error";
      w.error = w.error ?? oracleErrorText(error);
      w.at = new Date().toISOString();
      throw error;
    }
  }
}
