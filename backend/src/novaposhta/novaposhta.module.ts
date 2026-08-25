import { Module } from '@nestjs/common';
import { NovaPoshtaApiService } from './novaposhta-api.service';
import { NovaPoshtaController } from './novaposhta.controller';

@Module({
  controllers: [NovaPoshtaController],
  providers: [NovaPoshtaApiService],
  exports: [NovaPoshtaApiService],
})
export class NovaPoshtaModule {}
