import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { OracleService } from '../oracle/oracle.service';
import { OkkoApiService } from '../okko/okko-api.service';
import { TruckPayRepository } from './truck-pay.repository';
import { FuelSyncBase } from './fuel-sync.base';
import { mapOkkoToTruckPay, shouldSyncOkko } from './fuel-sync.mapper';
import { TruckPayRow } from './fuel-sync.types';

const OKKO_CRON = '0 0 */2 * * *';

/**
 * OKKO → Oracle: транзакції паливних карток у P_API_TRUCK_PAY.save_transaction.
 * Кожні 2 год (парні години, :00). Вмикається OKKO_SYNC_ENABLED=true; старт — OKKO_SYNC_START.
 */
@Injectable()
export class OkkoOracleSyncService extends FuelSyncBase {
  constructor(
    config: ConfigService,
    oracle: OracleService,
    repo: TruckPayRepository,
    private readonly okko: OkkoApiService,
  ) {
    super(
      {
        vendor: 'OKKO',
        enabledEnv: 'OKKO_SYNC_ENABLED',
        startEnv: 'OKKO_SYNC_START',
        cron: OKKO_CRON,
        cronMinute: 0,
        cronLabel: 'кожні 2 год',
        // Ліміт API — 31 день на запит.
        windowDays: 30,
        skippedLabel: 'операції з договором (поповнення, списання, перекази) та передавторизації',
      },
      config,
      oracle,
      repo,
    );
  }

  @Cron(OKKO_CRON, { name: 'okko-oracle-sync' })
  handleCron() {
    return this.runScheduled();
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
