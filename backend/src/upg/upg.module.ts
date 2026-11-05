import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UpgApiService } from './upg-api.service';

@Module({
  imports: [ConfigModule],
  providers: [UpgApiService],
  exports: [UpgApiService],
})
export class UpgModule {}
