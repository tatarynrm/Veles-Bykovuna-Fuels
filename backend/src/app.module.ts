import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ReadOnlyGuard } from './auth/read-only.guard';
import { OkkoModule } from './okko/okko.module';
import { ShellModule } from './shell/shell.module';
import { AuthModule } from './auth/auth.module';
import { ContractsModule } from './contracts/contracts.module';
import { CardsModule } from './cards/cards.module';
import { MerchantsModule } from './merchants/merchants.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RuptelaModule } from './ruptela/ruptela.module';
import { NovaPoshtaModule } from './novaposhta/novaposhta.module';
import { OracleModule } from './oracle/oracle.module';

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
    NovaPoshtaModule,
    OracleModule,
  ],
  providers: [
    // Global, so a route added later is covered without anyone remembering to opt in.
    { provide: APP_GUARD, useClass: ReadOnlyGuard },
  ],
})
export class AppModule {}
