'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageShell, { AuthGate } from '@/components/PageShell';
import KpiCards, { KpiSecondary } from '@/components/KpiCards';
import TransactionsJournal from '@/components/TransactionsJournal';
import AnalyticsCharts from '@/components/AnalyticsCharts';
import { DateRange } from '@/components/DateRangePicker';
import { SkeletonKpi, SkeletonTable, SkeletonChart } from '@/components/Skeletons';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { apiList, apiObject } from '@/lib/api';

export default function OverviewPage() {
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
  const [transactions, setTransactions] = useState<any[]>([]);
  const [fuelBreakdown, setFuelBreakdown] = useState<any[]>([]);
  const [spendingTrends, setSpendingTrends] = useState<any[]>([]);
  const [apiStatus, setApiStatus] = useState<any>(null);

  const loadData = useCallback(async (brand: string, range: DateRange) => {
    setIsRefreshing(true);
    const params = { date_from: range.dateFrom, date_to: range.dateTo, brand };

    const [sum, tx, breakdown, trends] = await Promise.all([
      apiObject<any>('/api/analytics/summary', params),
      apiList<any>('/api/transactions', params),
      apiList<any>('/api/analytics/fuel-breakdown', params),
      apiList<any>('/api/analytics/spending-trends', params),
    ]);

    if (sum) {
      setSummary(sum);
      setApiStatus(sum.apiStatus);
    }
    setTransactions(tx);
    setFuelBreakdown(breakdown);
    setSpendingTrends(trends);

    setLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    if (authenticated) loadData(activeBrand, dateRange);
  }, [activeBrand, dateRange, authenticated, loadData]);

  if (!authenticated) return <AuthGate />;

  const title =
    activeBrand === 'SHELL'
      ? 'Портал Shell Mobility'
      : activeBrand === 'OKKO'
        ? 'Портал АЗК ОККО'
        : 'Інтегрована панель';

  return (
    <PageShell
      title={title}
      subtitle="Аналітика витрат та транзакцій автопарку ТОВ «Велес Буковина»"
      onRefresh={() => loadData(activeBrand, dateRange)}
      isRefreshing={isRefreshing}
      currentRange={dateRange}
      onDateChange={setDateRange}
      activeBrand={activeBrand}
      onSelectBrand={setActiveBrand}
      apiStatus={apiStatus}
    >
      {loading ? (
        <div className="space-y-5">
          <SkeletonKpi />
          <SkeletonChart />
          <SkeletonTable />
        </div>
      ) : (
        <div className="space-y-5">
          <KpiCards summary={summary} />
          <KpiSecondary summary={summary} />
          <AnalyticsCharts fuelBreakdown={fuelBreakdown} spendingTrends={spendingTrends} />
          <TransactionsJournal transactions={transactions} />
        </div>
      )}
    </PageShell>
  );
}
