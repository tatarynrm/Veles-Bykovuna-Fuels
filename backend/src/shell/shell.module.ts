import { Module } from '@nestjs/common';
import { ShellController } from './shell.controller';
import { ShellApiService } from './shell-api.service';
import { CurrencyService } from '../common/currency.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [ShellController],
  providers: [ShellApiService, CurrencyService],
  exports: [ShellApiService],
})
export class ShellModule {}
