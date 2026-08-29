import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NovaPoshtaApiService } from './novaposhta-api.service';
import { OracleService } from '../oracle/oracle.service';
import { DeliveriesRepository } from './deliveries.repository';

/**
 * Крон-синхронізація дат доставки Нової Пошти → Oracle.
 *
 * Кожні 20 хв бере НАШІ відправлення за останні 40 днів (getDocumentList),
 * відбирає доставлені (StateId 9/10/11) і для кожного викликає процедуру
 * SetDateDelivered('NVP', номерТТН, датаДоставки) — вона працює як upsert.
 *
 * Свідомо просто: лише крон, без BullMQ і без локів. Вікно (40 днів) навмисно
 * ширше за крок (20 хв) — це дає самозагоєння пропущених тіків, а сама процедура
 * ідемпотентна (повторний виклик лише перезапише ту саму дату). In-process guard
 * не дає тікам накладатися. Для кількох інстансів згодом — див. обговорення в
 * історії (лідер-лок в Oracle або окремий worker з 1 реплікою).
 */
@Injectable()
export class NovaPoshtaSyncService implements OnModuleInit {
  private readonly logger = new Logger(NovaPoshtaSyncService.name);
  private running = false;

  private static readonly WINDOW_DAYS = 40;

  constructor(
    private readonly np: NovaPoshtaApiService,
    private readonly oracle: OracleService,
    private readonly deliveries: DeliveriesRepository,
  ) {}

  onModuleInit() {
    // Прогрів при старті, щоб не чекати першого тіку 20 хв. Не блокуємо bootstrap.
    setTimeout(() => {
      this.sync().catch(() => undefined);
    }, 10_000);
  }

  @Cron('0 */20 * * * *', { name: 'np-delivered-sync' })
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
    try {
      const { from, to } = NovaPoshtaSyncService.window();
      const deliveries = await this.np.collectDeliveries(from, to);
      // Записуємо лише ті, де є дата доставки (setDeliveredBatch відфільтрує null/невалідні).
      const written = deliveries.length > 0 ? await this.deliveries.setDeliveredBatch(deliveries) : 0;
      this.logger.log(
        `SetDateDelivered: записано ${written} доставлених накладних (з датою) за ${from}–${to} (${Date.now() - started}ms)`,
      );
      return { delivered: written };
    } catch (error) {
      // Наступний тік доллє — вікно 40 днів самовідновлюване.
      this.logger.error(`Синхронізація дат доставки НП впала: ${error.message}`);
      return { delivered: 0 };
    } finally {
      this.running = false;
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
