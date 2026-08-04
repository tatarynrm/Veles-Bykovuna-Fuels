import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OkkoModule } from './okko/okko.module';
import { ShellModule } from './shell/shell.module';
import { AuthModule } from './auth/auth.module';
import { ContractsModule } from './contracts/contracts.module';
import { CardsModule } from './cards/cards.module';
import { MerchantsModule } from './merchants/merchants.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RuptelaModule } from './ruptela/ruptela.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    OkkoModule,
    ShellModule,
    AuthModule,
    ContractsModule,
    CardsModule,
    MerchantsModule,
    TransactionsModule,
    AnalyticsModule,
    RuptelaModule,
  ],
})
export class AppModule {}
