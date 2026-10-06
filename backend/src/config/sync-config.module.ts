import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SyncConfigService } from './sync-config.service';

/** Глобальний: налаштування потрібні всім синхронізаціям (паливні картки, GPS, Нова Пошта). */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [SyncConfigService],
  exports: [SyncConfigService],
})
export class SyncConfigModule {}
