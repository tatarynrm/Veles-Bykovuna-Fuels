'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageShell, { AuthGate } from '@/components/PageShell';
import MerchantsGrid from '@/components/MerchantsGrid';
import { DateRange, todayRange } from '@/components/DateRangePicker';
import { SkeletonGrid } from '@/components/Skeletons';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { cachedList, hasFreshEnough, useApiRefreshing } from '@/lib/apiCache';
import { t } from '@/lib/i18n';

export default function MerchantsPage() {
  const { authenticated } = useAuthGuard();
  const revalidating = useApiRefreshing();

  const [activeBrand, setActiveBrand] = useState('ALL');
  const [dateRange, setDateRange] = useState<DateRange>(todayRange());

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [merchants, setMerchants] = useState<any[]>([]);

  const loadData = useCallback(async (brand: string, force = false) => {
    setIsRefreshing(true);
    const params = { brand, size: 200 };

    if (!hasFreshEnough('/api/merchants', params)) setLoading(true);
    setMerchants(await cachedList<any>('/api/merchants', params, setMerchants, { force }));

    setLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    if (authenticated) loadData(activeBrand);
  }, [activeBrand, authenticated, loadData]);

  if (!authenticated) return <AuthGate />;

  return (
    <PageShell
      title={t('common.stationNetwork')}
      subtitle={t('merchants.okkoShellStationsAccepting')}
      onRefresh={() => loadData(activeBrand, true)}
      isRefreshing={isRefreshing || revalidating}
      currentRange={dateRange}
      onDateChange={setDateRange}
      activeBrand={activeBrand}
      onSelectBrand={setActiveBrand}
    >
      {loading ? <SkeletonGrid /> : <MerchantsGrid merchants={merchants} />}
    </PageShell>
  );
}
