import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrivatApiService } from './privat-api.service';
import { PrivatController } from './privat.controller';

@Module({
  imports: [ConfigModule],
  controllers: [PrivatController],
  providers: [PrivatApiService],
  exports: [PrivatApiService],
})
export class PrivatModule {}
