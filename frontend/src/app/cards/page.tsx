'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageShell, { AuthGate } from '@/components/PageShell';
import CardsTable from '@/components/CardsTable';
import { DateRange } from '@/components/DateRangePicker';
import { SkeletonTable } from '@/components/Skeletons';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { apiList } from '@/lib/api';

export default function CardsPage() {
  const { authenticated } = useAuthGuard();

  const [activeBrand, setActiveBrand] = useState('ALL');
  const [dateRange, setDateRange] = useState<DateRange>({
    preset: 'ALL',
    dateFrom: '',
    dateTo: '',
  });

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cards, setCards] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);

  const loadData = useCallback(async (brand: string) => {
    setIsRefreshing(true);

    // /api/cards returns a paginated envelope, /api/contracts a bare array —
    // apiList unwraps both, which the old `Array.isArray` check did not.
    const [cardsRes, contractsRes] = await Promise.all([
      apiList<any>('/api/cards', { brand, size: 200 }),
      apiList<any>('/api/contracts', { brand }),
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
      title="Паливні картки"
      subtitle="Ліміти, договори та баланс активних карток автопарку"
      onRefresh={() => loadData(activeBrand)}
      isRefreshing={isRefreshing}
      currentRange={dateRange}
      onDateChange={setDateRange}
      activeBrand={activeBrand}
      onSelectBrand={setActiveBrand}
    >
      {loading ? <SkeletonTable /> : <CardsTable cards={cards} contracts={contracts} />}
    </PageShell>
  );
}
