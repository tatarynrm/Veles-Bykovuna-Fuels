'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageShell, { AuthGate } from '@/components/PageShell';
import AnalyticsCharts from '@/components/AnalyticsCharts';
import KpiCards from '@/components/KpiCards';
import { DateRange } from '@/components/DateRangePicker';
import { SkeletonChart, SkeletonKpi } from '@/components/Skeletons';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { apiList, apiObject } from '@/lib/api';

export default function AnalyticsPage() {
  const { authenticated } = useAuthGuard();

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

  const loadData = useCallback(async (brand: string, range: DateRange) => {
    setIsRefreshing(true);
    const params = { date_from: range.dateFrom, date_to: range.dateTo, brand };

    const [sum, breakdown, trends] = await Promise.all([
      apiObject<any>('/api/analytics/summary', params),
      apiList<any>('/api/analytics/fuel-breakdown', params),
      apiList<any>('/api/analytics/spending-trends', params),
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
      title="Аналітика палива"
      subtitle="Візуалізація витрат, споживання та структури заправок"
      onRefresh={() => loadData(activeBrand, dateRange)}
      isRefreshing={isRefreshing}
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
