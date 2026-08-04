import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { OkkoModule } from '../okko/okko.module';
import { ShellModule } from '../shell/shell.module';

@Module({
  imports: [OkkoModule, ShellModule],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
