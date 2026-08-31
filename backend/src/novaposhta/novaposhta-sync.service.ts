import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NovaPoshtaApiService } from './novaposhta-api.service';
import { OracleService } from '../oracle/oracle.service';
import { DeliveriesRepository } from './deliveries.repository';

/**
 * Крон-синхронізація дат доставки Нової Пошти → Oracle.
 *
 * Кожні 3 год бере НАШІ відправлення за останні 40 днів (getDocumentList),
 * відбирає доставлені (StateId 9/10/11) і для кожного викликає процедуру
 * SetDateDelivered('NVP', номерТТН, датаДоставки) — вона працює як upsert.
 *
 * Свідомо просто: лише крон, без BullMQ і без локів. Вікно (40 днів) навмисно
 * ширше за крок (3 год) — це дає самозагоєння пропущених тіків, а сама процедура
 * ідемпотентна (повторний виклик лише перезапише ту саму дату). In-process guard
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

  private static readonly WINDOW_DAYS = 40;
  private static readonly CRON = '0 0 */3 * * *';

  constructor(
    private readonly np: NovaPoshtaApiService,
    private readonly oracle: OracleService,
    private readonly deliveries: DeliveriesRepository,
  ) {}

  /** Snapshot for the sync-status page (poll this). */
  getSyncStatus(): NpSyncStatus {
    return {
      enabled: this.oracle.isConfigured(),
      running: this.running,
      startedAt: this.startedAt ? new Date(this.startedAt).toISOString() : null,
      lastRun: this.lastRun,
      config: {
        windowDays: NovaPoshtaSyncService.WINDOW_DAYS,
        cron: NovaPoshtaSyncService.CRON,
        cronLabel: 'кожні 3 год',
      },
    };
  }

  onModuleInit() {
    // Прогрів при старті, щоб не чекати першого тіку 20 хв. Не блокуємо bootstrap.
    setTimeout(() => {
      this.sync().catch(() => undefined);
    }, 10_000);
  }

  @Cron('0 0 */3 * * *', { name: 'np-delivered-sync' })
  handleCron() {
    return this.sync();
  }

  async sync(): Promise<{ delivered: number; skipped?: boolean }> {
    if (this.running) {
      this.logger.warn('Синхронізація ще триває — пропускаю цей тік');
      return { delivered: 0, skipped: true };
    }
    if (!this.oracle.isConfigured()) {
      this.logger.warn('Oracle не налаштовано — синк дат доставки НП вимкнено');
      return { delivered: 0, skipped: true };
    }

    this.running = true;
    const started = Date.now();
    this.startedAt = started;
    const { from, to } = NovaPoshtaSyncService.window();
    try {
      const deliveries = await this.np.collectDeliveries(from, to);
      // Записуємо лише ті, де є дата доставки (setDeliveredBatch відфільтрує null/невалідні).
      const written = deliveries.length > 0 ? await this.deliveries.setDeliveredBatch(deliveries) : 0;
      const durationMs = Date.now() - started;
      this.logger.log(
        `SetDateDelivered: записано ${written} доставлених накладних (з датою) за ${from}–${to} (${durationMs}ms)`,
      );
      this.lastRun = {
        at: new Date().toISOString(),
        from,
        to,
        collected: deliveries.length,
        written,
        durationMs,
        ok: true,
        error: null,
      };
      return { delivered: written };
    } catch (error) {
      // Наступний тік доллє — вікно 40 днів самовідновлюване.
      this.logger.error(`Синхронізація дат доставки НП впала: ${error.message}`);
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

  private static window(): { from: string; to: string } {
    const to = new Date();
    const from = new Date(to.getTime() - NovaPoshtaSyncService.WINDOW_DAYS * 86400000);
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    return { from: fmt(from), to: fmt(to) };
  }
}
