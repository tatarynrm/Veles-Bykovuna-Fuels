'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageShell, { AuthGate } from '@/components/PageShell';
import TransactionsJournal from '@/components/TransactionsJournal';
import { DateRange } from '@/components/DateRangePicker';
import { SkeletonTable } from '@/components/Skeletons';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { cachedList, hasFreshEnough, useApiRefreshing } from '@/lib/apiCache';
import { t } from '@/lib/i18n';

export default function TransactionsPage() {
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
  const [transactions, setTransactions] = useState<any[]>([]);

  const loadData = useCallback(async (brand: string, range: DateRange, force = false) => {
    setIsRefreshing(true);
    const params = {
      date_from: range.dateFrom,
      date_to: range.dateTo,
      brand,
      size: 500,
    };

    // Журнал на 500 рядків — найдовша відповідь у застосунку, тож саме тут
    // миттєвий показ кешу помітний найбільше.
    if (!hasFreshEnough('/api/transactions', params)) setLoading(true);
    setTransactions(await cachedList<any>('/api/transactions', params, setTransactions, { force }));

    setLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    if (authenticated) loadData(activeBrand, dateRange);
  }, [activeBrand, dateRange, authenticated, loadData]);

  if (!authenticated) return <AuthGate />;

  return (
    <PageShell
      title={t('common.transactionLog')}
      subtitle={t('tx.refuellingTransactionsVolumesDiscounts')}
      onRefresh={() => loadData(activeBrand, dateRange, true)}
      isRefreshing={isRefreshing || revalidating}
      currentRange={dateRange}
      onDateChange={setDateRange}
      activeBrand={activeBrand}
      onSelectBrand={setActiveBrand}
    >
      {loading ? <SkeletonTable /> : <TransactionsJournal transactions={transactions} />}
    </PageShell>
  );
}
