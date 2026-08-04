import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { OkkoModule } from '../okko/okko.module';
import { ShellModule } from '../shell/shell.module';

@Module({
  imports: [OkkoModule, ShellModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
