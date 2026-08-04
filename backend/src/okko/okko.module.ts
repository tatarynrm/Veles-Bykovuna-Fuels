import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OkkoApiService } from './okko-api.service';

@Module({
  imports: [ConfigModule],
  providers: [OkkoApiService],
  exports: [OkkoApiService],
})
export class OkkoModule {}
