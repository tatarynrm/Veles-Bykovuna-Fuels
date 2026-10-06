import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { OkkoOracleSyncService } from './okko-oracle-sync.service';
import { ShellOracleSyncService } from './shell-oracle-sync.service';
import { FuelSyncBase } from './fuel-sync.base';

/** Синхронізація транзакцій OKKO / Shell → Oracle (TZ_TRANS). `:vendor` = okko | shell. */
@Controller('api/fuel-sync')
export class FuelSyncController {
  constructor(
    private readonly okko: OkkoOracleSyncService,
    private readonly shell: ShellOracleSyncService,
  ) {}

  private pick(vendor: string): FuelSyncBase {
    if (vendor === 'okko') return this.okko;
    if (vendor === 'shell') return this.shell;
    throw new NotFoundException(`Невідомий вендор: ${vendor} (okko | shell)`);
  }

  /** Живий стан: поточний/останній прохід по вікнах, розклад, налаштування. Сторінка опитує. */
  @Get(':vendor')
  getStatus(@Param('vendor') vendor: string) {
    return this.pick(vendor).getStatus();
  }

  /**
   * Ручний запуск у фоні:
   *   `{ from, to }` — за вибраний період (to за замовчуванням — сьогодні);
   *   `{ full: true }` — усе з OKKO_SYNC_START / SHELL_SYNC_START;
   *   порожнє тіло — останні FUEL_SYNC_LOOKBACK_DAYS днів (те саме, що робить крон).
   * Пише в живу БД, тож ReadOnlyGuard блокує його для гостя; без <VENDOR>_SYNC_ENABLED=true
   * повертає started: false.
   */
  @Post(':vendor/run')
  run(@Param('vendor') vendor: string, @Body() body?: { full?: boolean; from?: string; to?: string }) {
    const service = this.pick(vendor);
    if (body?.from || body?.to) return service.start('period', { from: body.from, to: body.to });
    return service.start(body?.full === true ? 'full' : 'recent');
  }
}
