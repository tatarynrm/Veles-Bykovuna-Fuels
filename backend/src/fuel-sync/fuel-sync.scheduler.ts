import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { SyncConfigService } from '../config/sync-config.service';
import { rescheduleJobs } from '../config/cron-jobs';
import { cronExpressions } from './fuel-sync.utils';
import { OkkoOracleSyncService } from './okko-oracle-sync.service';
import { ShellOracleSyncService } from './shell-oracle-sync.service';

/**
 * Один розклад на обох вендорів: за планом оновлюємо ЗАВЖДИ і OKKO, і Shell. Проходи
 * йдуть ПОСЛІДОВНО (спочатку OKKO — він короткий, далі повільніший Shell), щоб не бити
 * одночасно по Oracle і по вендорських API. Вимкнений вендор свій прохід пропускає,
 * а збій одного не заважає іншому.
 *
 * Часи беруться з `fuel.times` у backend/sync-config.json і перечитуються на льоту:
 * зберегли файл — завдання одразу переставлено.
 */
@Injectable()
export class FuelSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger('fuel-sync');

  constructor(
    private readonly syncConfig: SyncConfigService,
    private readonly registry: SchedulerRegistry,
    private readonly okko: OkkoOracleSyncService,
    private readonly shell: ShellOracleSyncService,
  ) {}

  onModuleInit(): void {
    this.apply();
    this.syncConfig.onChange(() => this.apply());
  }

  private apply(): void {
    const times = this.syncConfig.get().fuel.times;
    rescheduleJobs(this.registry, 'fuel-sync', cronExpressions(times), () => this.runAll(), this.logger);
  }

  /** Плановий прохід: обидва вендори, один за одним. */
  async runAll(): Promise<void> {
    this.logger.log('Плановий прохід: OKKO → Shell');
    for (const vendor of [this.okko, this.shell]) {
      try {
        await vendor.runScheduled();
      } catch (error) {
        this.logger.error(`Прохід вендора впав: ${error?.message ?? error}`);
      }
    }
  }
}
