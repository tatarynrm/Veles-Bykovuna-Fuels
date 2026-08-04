'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageShell, { AuthGate } from '@/components/PageShell';
import TransactionsJournal from '@/components/TransactionsJournal';
import { DateRange } from '@/components/DateRangePicker';
import { SkeletonTable } from '@/components/Skeletons';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { apiList } from '@/lib/api';

export default function TransactionsPage() {
  const { authenticated } = useAuthGuard();

  const [activeBrand, setActiveBrand] = useState('ALL');
  const [dateRange, setDateRange] = useState<DateRange>({
    preset: 'ALL',
    dateFrom: '',
    dateTo: '',
  });

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  const loadData = useCallback(async (brand: string, range: DateRange) => {
    setIsRefreshing(true);
    setTransactions(
      await apiList<any>('/api/transactions', {
        date_from: range.dateFrom,
        date_to: range.dateTo,
        brand,
        size: 500,
      }),
    );
    setLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    if (authenticated) loadData(activeBrand, dateRange);
  }, [activeBrand, dateRange, authenticated, loadData]);

  if (!authenticated) return <AuthGate />;

  return (
    <PageShell
      title="Журнал транзакцій"
      subtitle="Заправні операції, обсяги палива та застосовані знижки"
      onRefresh={() => loadData(activeBrand, dateRange)}
      isRefreshing={isRefreshing}
      currentRange={dateRange}
      onDateChange={setDateRange}
      activeBrand={activeBrand}
      onSelectBrand={setActiveBrand}
    >
      {loading ? <SkeletonTable /> : <TransactionsJournal transactions={transactions} />}
    </PageShell>
  );
}
