import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { SyncConfigService } from '../config/sync-config.service';
import { rescheduleJobs } from '../config/cron-jobs';
import { NovaPoshtaApiService } from './novaposhta-api.service';
import { OracleService } from '../oracle/oracle.service';
import { DeliveriesRepository } from './deliveries.repository';

/**
 * Крон-синхронізація статусів Нової Пошти → Oracle.
 *
 * Кожні 3 год бере НАШІ відправлення за останні 40 днів (getDocumentList) і для
 * КОЖНОГО (будь-який статус, не лише доставлені) викликає процедуру
 * p_post.SetStatus('NVP', номерТТН, statusId, statusName, датаСтатусу, датаСтарту,
 * датаДоставки, місто, відділення, pErr) — вона працює як upsert.
 *
 * Свідомо просто: лише крон, без BullMQ і без локів. Вікно (40 днів) навмисно
 * ширше за крок (3 год) — це дає самозагоєння пропущених тіків, а сама процедура
 * ідемпотентна (повторний виклик лише перезапише той самий статус). In-process guard
 * не дає тікам накладатися. Для кількох інстансів згодом — див. обговорення в
 * історії (лідер-лок в Oracle або окремий worker з 1 реплікою).
 */
/** Result of the last completed sync pass — surfaced to the sync-status page. */
export interface NpSyncRun {
  /** ISO timestamp when the pass finished. */
  at: string;
  /** Date window used (DD.MM.YYYY). */
  from: string;
  to: string;
  /** How many delivered waybills were collected in the window. */
  collected: number;
  /** How many rows were written to Oracle (SetDateDelivered). */
  written: number;
  durationMs: number;
  ok: boolean;
  error: string | null;
}

/** Live status of the Nova Poshta → Oracle delivery-date sync. */
export interface NpSyncStatus {
  /** False when Oracle is not configured (the sync is a no-op). */
  enabled: boolean;
  running: boolean;
  /** ISO timestamp of the current pass while running, else null. */
  startedAt: string | null;
  lastRun: NpSyncRun | null;
  config: { windowDays: number; cron: string; cronLabel: string };
}

@Injectable()
export class NovaPoshtaSyncService implements OnModuleInit {
  private readonly logger = new Logger(NovaPoshtaSyncService.name);
  private running = false;
  private startedAt: number | null = null;
  private lastRun: NpSyncRun | null = null;


  constructor(
    private readonly np: NovaPoshtaApiService,
    private readonly oracle: OracleService,
    private readonly deliveries: DeliveriesRepository,
    private readonly syncConfig: SyncConfigService,
    private readonly registry: SchedulerRegistry,
  ) {}

  /** Налаштування з backend/sync-config.json (секція `novaposhta`). */
  private get settings() {
    return this.syncConfig.get().novaposhta;
  }

  /** Snapshot for the sync-status page (poll this). */
  getSyncStatus(): NpSyncStatus {
    return {
      enabled: this.oracle.isConfigured() && this.settings.enabled,
      running: this.running,
      startedAt: this.startedAt ? new Date(this.startedAt).toISOString() : null,
      lastRun: this.lastRun,
      config: {
        windowDays: this.settings.windowDays,
        cron: `0 0 */${this.settings.everyHours} * * *`,
        cronLabel: `кожні ${this.settings.everyHours} год`,
      },
    };
  }

  onModuleInit() {
    // Крок береться з backend/sync-config.json і перечитується на льоту.
    this.applySchedule();
    this.syncConfig.onChange(() => this.applySchedule());
    // Прогрів при старті, щоб не чекати першого тіку. Не блокуємо bootstrap.
    setTimeout(() => {
      this.sync().catch(() => undefined);
    }, 10_000);
  }

  private applySchedule(): void {
    const expressions = this.settings.enabled ? [`0 0 */${this.settings.everyHours} * * *`] : [];
    rescheduleJobs(this.registry, 'np-delivered-sync', expressions, () => this.sync(), this.logger);
  }

  async sync(): Promise<{ delivered: number; skipped?: boolean }> {
    if (this.running) {
      this.logger.warn('Синхронізація ще триває — пропускаю цей тік');
      return { delivered: 0, skipped: true };
    }
    if (!this.oracle.isConfigured()) {
      this.logger.warn('Oracle не налаштовано — синк статусів НП вимкнено');
      return { delivered: 0, skipped: true };
    }
    if (!this.settings.enabled) {
      this.logger.warn('Синк статусів НП вимкнено в sync-config.json (novaposhta.enabled)');
      return { delivered: 0, skipped: true };
    }

    this.running = true;
    const started = Date.now();
    this.startedAt = started;
    const { from, to } = NovaPoshtaSyncService.window(this.settings.windowDays);
    try {
      const statuses = await this.np.collectStatuses(from, to);
      // Пушимо повний статус КОЖНОГО відправлення за вікно (upsert p_post.SetStatus).
      const written = statuses.length > 0 ? await this.deliveries.setStatusBatch(statuses) : 0;
      const durationMs = Date.now() - started;
      this.logger.log(
        `SetStatus: записано ${written}/${statuses.length} статусів накладних за ${from}–${to} (${durationMs}ms)`,
      );
      this.lastRun = {
        at: new Date().toISOString(),
        from,
        to,
        collected: statuses.length,
        written,
        durationMs,
        ok: true,
        error: null,
      };
      return { delivered: written };
    } catch (error) {
      // Наступний тік доллє — вікно 40 днів самовідновлюване.
      this.logger.error(`Синхронізація статусів НП впала: ${error.message}`);
      this.lastRun = {
        at: new Date().toISOString(),
        from,
        to,
        collected: 0,
        written: 0,
        durationMs: Date.now() - started,
        ok: false,
        error: error.message ?? 'Помилка синхронізації',
      };
      return { delivered: 0 };
    } finally {
      this.running = false;
      this.startedAt = null;
    }
  }

  private static window(windowDays: number): { from: string; to: string } {
    const to = new Date();
    const from = new Date(to.getTime() - windowDays * 86400000);
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    return { from: fmt(from), to: fmt(to) };
  }
}
