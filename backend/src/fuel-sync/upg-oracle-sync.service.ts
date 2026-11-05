import { Injectable } from '@nestjs/common';
import { OracleService } from '../oracle/oracle.service';
import { UpgApiService } from '../upg/upg-api.service';
import { SyncConfigService } from '../config/sync-config.service';
import { TruckPayRepository } from './truck-pay.repository';
import { FuelSyncBase } from './fuel-sync.base';
import { mapUpgToTruckPay, shouldSyncUpg } from './fuel-sync.mapper';
import { TruckPayRow } from './fuel-sync.types';

/**
 * UPG → Oracle: історія транзакцій паливних карток UPG (`/fuel-card-history`) у
 * P_API_TRUCK_PAY.save_transaction, бренд `UPG`, суми в гривнях. Розклад, прапорець і
 * стартова дата — у backend/sync-config.json (`fuel.upg`), запуски ставить FuelSyncScheduler.
 */
@Injectable()
export class UpgOracleSyncService extends FuelSyncBase {
  constructor(
    syncConfig: SyncConfigService,
    oracle: OracleService,
    repo: TruckPayRepository,
    private readonly upg: UpgApiService,
  ) {
    super(
      {
        vendor: 'UPG',
        key: 'upg',
        // Ліміт діапазону в документації не вказано — місяць на запит, як у решти вендорів.
        windowDays: 31,
        skippedLabel: 'рядки без id, номера картки або дати (у звіті UPG таких зазвичай немає)',
      },
      syncConfig,
      oracle,
      repo,
    );
  }

  protected vendorBlockReason(): string | null {
    return this.upg.isConfigured() ? null : 'UPG не налаштовано: задайте UPG_LOGIN і UPG_PASSWORD у backend/.env';
  }

  protected fetchWindow(from: string, to: string): Promise<any[]> {
    return this.upg.getRawFuelCardHistory(from, to);
  }

  protected shouldSync(raw: any): boolean {
    return shouldSyncUpg(raw);
  }

  protected map(raw: any): TruckPayRow {
    return mapUpgToTruckPay(raw);
  }
}
