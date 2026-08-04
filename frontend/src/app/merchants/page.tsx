'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageShell, { AuthGate } from '@/components/PageShell';
import MerchantsGrid from '@/components/MerchantsGrid';
import { DateRange } from '@/components/DateRangePicker';
import { SkeletonGrid } from '@/components/Skeletons';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { apiList } from '@/lib/api';

export default function MerchantsPage() {
  const { authenticated } = useAuthGuard();

  const [activeBrand, setActiveBrand] = useState('ALL');
  const [dateRange, setDateRange] = useState<DateRange>({
    preset: 'ALL',
    dateFrom: '',
    dateTo: '',
  });

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [merchants, setMerchants] = useState<any[]>([]);

  const loadData = useCallback(async (brand: string) => {
    setIsRefreshing(true);
    setMerchants(await apiList<any>('/api/merchants', { brand, size: 200 }));
    setLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    if (authenticated) loadData(activeBrand);
  }, [activeBrand, authenticated, loadData]);

  if (!authenticated) return <AuthGate />;

  return (
    <PageShell
      title="Мережа АЗК"
      subtitle="Заправні комплекси ОККО та Shell з підтримкою паливних карток"
      onRefresh={() => loadData(activeBrand)}
      isRefreshing={isRefreshing}
      currentRange={dateRange}
      onDateChange={setDateRange}
      activeBrand={activeBrand}
      onSelectBrand={setActiveBrand}
    >
      {loading ? <SkeletonGrid /> : <MerchantsGrid merchants={merchants} />}
    </PageShell>
  );
}
