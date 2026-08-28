import { Module } from '@nestjs/common';
import { NovaPoshtaApiService } from './novaposhta-api.service';
import { NovaPoshtaController } from './novaposhta.controller';
import { NovaPoshtaSyncService } from './novaposhta-sync.service';
import { OracleModule } from '../oracle/oracle.module';

@Module({
  imports: [OracleModule],
  controllers: [NovaPoshtaController],
  providers: [NovaPoshtaApiService, NovaPoshtaSyncService],
  exports: [NovaPoshtaApiService],
})
export class NovaPoshtaModule {}
