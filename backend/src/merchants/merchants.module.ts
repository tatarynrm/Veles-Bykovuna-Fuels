import { Module } from '@nestjs/common';
import { MerchantsController } from './merchants.controller';
import { OkkoModule } from '../okko/okko.module';
import { ShellModule } from '../shell/shell.module';

@Module({
  imports: [OkkoModule, ShellModule],
  controllers: [MerchantsController],
})
export class MerchantsModule {}
