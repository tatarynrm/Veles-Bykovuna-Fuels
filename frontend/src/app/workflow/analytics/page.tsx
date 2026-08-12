'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageShell, { AuthGate } from '@/components/PageShell';
import AnalyticsCharts from '@/components/AnalyticsCharts';
import KpiCards from '@/components/KpiCards';
import { DateRange } from '@/components/DateRangePicker';
import { SkeletonChart, SkeletonKpi } from '@/components/Skeletons';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { cachedList, cachedObject, hasFreshEnough, useApiRefreshing } from '@/lib/apiCache';
import { t } from '@/lib/i18n';

export default function AnalyticsPage() {
  const { authenticated } = useAuthGuard();
  const revalidating = useApiRefreshing();

  const [activeBrand, setActiveBrand] = useState('ALL');
  const [dateRange, setDateRange] = useState<DateRange>({
    preset: 'ALL',
    dateFrom: '',
    dateTo: '',
  });

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [fuelBreakdown, setFuelBreakdown] = useState<any[]>([]);
  const [spendingTrends, setSpendingTrends] = useState<any[]>([]);

  const loadData = useCallback(async (brand: string, range: DateRange, force = false) => {
    setIsRefreshing(true);
    const params = { date_from: range.dateFrom, date_to: range.dateTo, brand };
    const opts = { force };

    if (!hasFreshEnough('/api/analytics/summary', params)) setLoading(true);

    const [sum, breakdown, trends] = await Promise.all([
      cachedObject<any>('/api/analytics/summary', params, setSummary, opts),
      cachedList<any>('/api/analytics/fuel-breakdown', params, setFuelBreakdown, opts),
      cachedList<any>('/api/analytics/spending-trends', params, setSpendingTrends, opts),
    ]);

    setSummary(sum);
    setFuelBreakdown(breakdown);
    setSpendingTrends(trends);
    setLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    if (authenticated) loadData(activeBrand, dateRange);
  }, [activeBrand, dateRange, authenticated, loadData]);

  if (!authenticated) return <AuthGate />;

  return (
    <PageShell
      title={t('common.fuelAnalytics')}
      subtitle={t('analytics.visualisingSpendingConsumptionRefuelling')}
      onRefresh={() => loadData(activeBrand, dateRange, true)}
      isRefreshing={isRefreshing || revalidating}
      currentRange={dateRange}
      onDateChange={setDateRange}
      activeBrand={activeBrand}
      onSelectBrand={setActiveBrand}
    >
      {loading ? (
        <div className="space-y-5">
          <SkeletonKpi />
          <SkeletonChart />
        </div>
      ) : (
        <div className="space-y-5">
          <KpiCards summary={summary} />
          <AnalyticsCharts fuelBreakdown={fuelBreakdown} spendingTrends={spendingTrends} />
        </div>
      )}
    </PageShell>
  );
}
