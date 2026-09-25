import { Module } from '@nestjs/common';
import { OracleModule } from '../oracle/oracle.module';
import { OkkoModule } from '../okko/okko.module';
import { ShellModule } from '../shell/shell.module';
import { FuelSyncController } from './fuel-sync.controller';
import { OkkoOracleSyncService } from './okko-oracle-sync.service';
import { ShellOracleSyncService } from './shell-oracle-sync.service';
import { TruckPayRepository } from './truck-pay.repository';

@Module({
  imports: [OracleModule, OkkoModule, ShellModule],
  controllers: [FuelSyncController],
  providers: [TruckPayRepository, OkkoOracleSyncService, ShellOracleSyncService],
})
export class FuelSyncModule {}
