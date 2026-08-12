'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageShell, { AuthGate } from '@/components/PageShell';
import KpiCards, { KpiSecondary } from '@/components/KpiCards';
import TransactionsJournal from '@/components/TransactionsJournal';
import AnalyticsCharts from '@/components/AnalyticsCharts';
import { DateRange } from '@/components/DateRangePicker';
import { SkeletonKpi, SkeletonTable, SkeletonChart } from '@/components/Skeletons';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { cachedList, cachedObject, hasFreshEnough, useApiRefreshing } from '@/lib/apiCache';
import { t } from '@/lib/i18n';

export default function OverviewPage() {
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
  const [transactions, setTransactions] = useState<any[]>([]);
  const [fuelBreakdown, setFuelBreakdown] = useState<any[]>([]);
  const [spendingTrends, setSpendingTrends] = useState<any[]>([]);
  const [apiStatus, setApiStatus] = useState<any>(null);

  const applySummary = useCallback((sum: any) => {
    if (!sum) return;
    setSummary(sum);
    setApiStatus(sum.apiStatus);
  }, []);

  const loadData = useCallback(
    async (brand: string, range: DateRange, force = false) => {
      setIsRefreshing(true);
      const params = { date_from: range.dateFrom, date_to: range.dateTo, brand };
      const opts = { force };

      if (!hasFreshEnough('/api/analytics/summary', params)) setLoading(true);

      const [sum, tx, breakdown, trends] = await Promise.all([
        cachedObject<any>('/api/analytics/summary', params, applySummary, opts),
        cachedList<any>('/api/transactions', params, setTransactions, opts),
        cachedList<any>('/api/analytics/fuel-breakdown', params, setFuelBreakdown, opts),
        cachedList<any>('/api/analytics/spending-trends', params, setSpendingTrends, opts),
      ]);

      applySummary(sum);
      setTransactions(tx);
      setFuelBreakdown(breakdown);
      setSpendingTrends(trends);

      setLoading(false);
      setIsRefreshing(false);
    },
    [applySummary],
  );

  useEffect(() => {
    if (authenticated) loadData(activeBrand, dateRange);
  }, [activeBrand, dateRange, authenticated, loadData]);

  if (!authenticated) return <AuthGate />;

  const title =
    activeBrand === 'SHELL'
      ? t('common.shellMobilityPortal')
      : activeBrand === 'OKKO'
        ? t('common.okkoStationPortal')
        : t('common.integratedDashboard');

  return (
    <PageShell
      title={title}
      subtitle={t('common.spendingTransactionAnalyticsVeles')}
      onRefresh={() => loadData(activeBrand, dateRange, true)}
      isRefreshing={isRefreshing || revalidating}
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
