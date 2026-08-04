import { Module } from '@nestjs/common';
import { RuptelaApiService } from './ruptela-api.service';
import { RuptelaRoutingService } from './ruptela-routing.service';
import { RuptelaInsightsService } from './ruptela-insights.service';
import { RuptelaController } from './ruptela.controller';
import { RuptelaInsightsController } from './ruptela-insights.controller';

@Module({
  controllers: [RuptelaController, RuptelaInsightsController],
  providers: [RuptelaApiService, RuptelaRoutingService, RuptelaInsightsService],
  exports: [RuptelaApiService, RuptelaRoutingService, RuptelaInsightsService],
})
export class RuptelaModule {}
