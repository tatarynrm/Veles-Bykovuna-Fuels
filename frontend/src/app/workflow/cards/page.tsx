'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageShell, { AuthGate } from '@/components/PageShell';
import CardsTable from '@/components/CardsTable';
import { DateRange, todayRange } from '@/components/DateRangePicker';
import { SkeletonTable } from '@/components/Skeletons';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { cachedList, hasFreshEnough, useApiRefreshing } from '@/lib/apiCache';
import { t } from '@/lib/i18n';

export default function CardsPage() {
  const { authenticated } = useAuthGuard();
  const revalidating = useApiRefreshing();

  const [activeBrand, setActiveBrand] = useState('ALL');
  const [dateRange, setDateRange] = useState<DateRange>(todayRange());

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cards, setCards] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);

  const loadData = useCallback(async (brand: string, force = false) => {
    setIsRefreshing(true);
    const cardParams = { brand, size: 200 };
    const opts = { force };

    if (!hasFreshEnough('/api/cards', cardParams)) setLoading(true);

    // /api/cards returns a paginated envelope, /api/contracts a bare array —
    // cachedList unwraps both, which the old `Array.isArray` check did not.
    const [cardsRes, contractsRes] = await Promise.all([
      cachedList<any>('/api/cards', cardParams, setCards, opts),
      cachedList<any>('/api/contracts', { brand }, setContracts, opts),
    ]);

    setCards(cardsRes);
    setContracts(contractsRes);
    setLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    if (authenticated) loadData(activeBrand);
  }, [activeBrand, authenticated, loadData]);

  if (!authenticated) return <AuthGate />;

  return (
    <PageShell
      title={t('common.fuelCards')}
      subtitle={t('cards.limitsContractsBalanceFleet')}
      onRefresh={() => loadData(activeBrand, true)}
      isRefreshing={isRefreshing || revalidating}
      currentRange={dateRange}
      onDateChange={setDateRange}
      activeBrand={activeBrand}
      onSelectBrand={setActiveBrand}
    >
      {loading ? <SkeletonTable /> : <CardsTable cards={cards} contracts={contracts} />}
    </PageShell>
  );
}
