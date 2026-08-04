import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  async getSummary(
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('brand') brand?: string,
  ) {
    return this.analyticsService.getSummaryMetrics(dateFrom, dateTo, brand);
  }

  @Get('fuel-breakdown')
  async getFuelBreakdown(
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('brand') brand?: string,
  ) {
    return this.analyticsService.getFuelConsumptionBreakdown(dateFrom, dateTo, brand);
  }

  @Get('spending-trends')
  async getSpendingTrends(
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('brand') brand?: string,
  ) {
    return this.analyticsService.getSpendingTrends(dateFrom, dateTo, brand);
  }
}
