import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OracleModule } from '../oracle/oracle.module';
import { PrivatApiService } from './privat-api.service';
import { PrivatController } from './privat.controller';
import { BankRepository } from './bank.repository';
import { PrivatSyncService } from './privat-sync.service';

@Module({
  imports: [ConfigModule, OracleModule],
  controllers: [PrivatController],
  providers: [PrivatApiService, BankRepository, PrivatSyncService],
  exports: [PrivatApiService],
})
export class PrivatModule {}
