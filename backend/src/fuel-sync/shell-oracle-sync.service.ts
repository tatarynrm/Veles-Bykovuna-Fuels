import { Injectable } from '@nestjs/common';
import { OracleService } from '../oracle/oracle.service';
import { ShellApiService } from '../shell/shell-api.service';
import { SyncConfigService } from '../config/sync-config.service';
import { TruckPayRepository } from './truck-pay.repository';
import { FuelSyncBase } from './fuel-sync.base';
import { mapShellToTruckPay, shouldSyncShell } from './fuel-sync.mapper';
import { TruckPayRow } from './fuel-sync.types';

/**
 * Shell → Oracle: продажі (пальне, AdBlue, тол) і збори Shell у
 * P_API_TRUCK_PAY.save_transaction, суми у валюті інвойсу (EUR), лише рядки, вже
 * виставлені в рахунок. Розклад, прапорець і стартова дата — у
 * backend/sync-config.json (`fuel.shell`), запуски ставить FuelSyncScheduler.
 */
@Injectable()
export class ShellOracleSyncService extends FuelSyncBase {
  constructor(
    syncConfig: SyncConfigService,
    oracle: OracleService,
    repo: TruckPayRepository,
    private readonly shell: ShellApiService,
  ) {
    super(
      {
        vendor: 'SHELL',
        key: 'shell',
        // API дозволяє 210 днів, але режим зі зборами повільний — місяць на запит.
        windowDays: 31,
        skippedLabel: 'ще не виставлені в рахунок (запишуться, щойно зʼявиться рахунок)',
      },
      syncConfig,
      oracle,
      repo,
    );
  }

  protected fetchWindow(from: string, to: string): Promise<any[]> {
    return this.shell.getRawPricedTransactions(from, to);
  }

  protected shouldSync(raw: any): boolean {
    return shouldSyncShell(raw);
  }

  protected map(raw: any): TruckPayRow {
    return mapShellToTruckPay(raw);
  }
}
