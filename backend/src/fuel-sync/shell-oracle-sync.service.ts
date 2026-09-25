import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { OracleService } from '../oracle/oracle.service';
import { ShellApiService } from '../shell/shell-api.service';
import { TruckPayRepository } from './truck-pay.repository';
import { FuelSyncBase } from './fuel-sync.base';
import { mapShellToTruckPay, shouldSyncShell } from './fuel-sync.mapper';
import { TruckPayRow } from './fuel-sync.types';

/** Зсув на 15 хв від OKKO, щоб два проходи не стартували одночасно. */
const SHELL_CRON = '0 15 */2 * * *';

/**
 * Shell → Oracle: продажі (пальне, AdBlue, тол) і збори Shell у
 * P_API_TRUCK_PAY.save_transaction, суми у валюті інвойсу (EUR), лише рядки, вже
 * виставлені в рахунок. Кожні 2 год (парні години, :15). Вмикається
 * SHELL_SYNC_ENABLED=true; старт — SHELL_SYNC_START.
 */
@Injectable()
export class ShellOracleSyncService extends FuelSyncBase {
  constructor(
    config: ConfigService,
    oracle: OracleService,
    repo: TruckPayRepository,
    private readonly shell: ShellApiService,
  ) {
    super(
      {
        vendor: 'SHELL',
        enabledEnv: 'SHELL_SYNC_ENABLED',
        startEnv: 'SHELL_SYNC_START',
        cron: SHELL_CRON,
        cronMinute: 15,
        cronLabel: 'кожні 2 год (о :15)',
        // API дозволяє 210 днів, але режим зі зборами повільний — місяць на запит.
        windowDays: 31,
        skippedLabel: 'ще не виставлені в рахунок (запишуться, щойно зʼявиться рахунок)',
      },
      config,
      oracle,
      repo,
    );
  }

  @Cron(SHELL_CRON, { name: 'shell-oracle-sync' })
  handleCron() {
    return this.runScheduled();
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
