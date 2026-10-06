import { Injectable } from '@nestjs/common';
import { OracleService } from '../oracle/oracle.service';
import { OkkoApiService } from '../okko/okko-api.service';
import { SyncConfigService } from '../config/sync-config.service';
import { TruckPayRepository } from './truck-pay.repository';
import { FuelSyncBase } from './fuel-sync.base';
import { mapOkkoToTruckPay, shouldSyncOkko } from './fuel-sync.mapper';
import { TruckPayRow } from './fuel-sync.types';

/**
 * OKKO → Oracle: транзакції паливних карток у P_API_TRUCK_PAY.save_transaction.
 * Розклад, прапорець і стартова дата — у backend/sync-config.json (`fuel.okko`),
 * запуски ставить FuelSyncScheduler.
 */
@Injectable()
export class OkkoOracleSyncService extends FuelSyncBase {
  constructor(
    syncConfig: SyncConfigService,
    oracle: OracleService,
    repo: TruckPayRepository,
    private readonly okko: OkkoApiService,
  ) {
    super(
      {
        vendor: 'OKKO',
        key: 'okko',
        // Ліміт API — 31 день на запит.
        windowDays: 30,
        skippedLabel: 'операції з договором (поповнення, списання, перекази) та передавторизації',
      },
      syncConfig,
      oracle,
      repo,
    );
  }

  protected fetchWindow(from: string, to: string): Promise<any[]> {
    return this.okko.getRawTransactions(from, to);
  }

  protected shouldSync(raw: any): boolean {
    return shouldSyncOkko(raw);
  }

  protected map(raw: any): TruckPayRow {
    return mapOkkoToTruckPay(raw);
  }
}
