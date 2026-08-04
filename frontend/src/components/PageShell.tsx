'use client';

import React, { useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { DateRange } from './DateRangePicker';
import { REFRESH_EVENT } from './ui/CommandPalette';

interface PageShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  currentRange?: DateRange;
  onDateChange?: (range: DateRange) => void;
  activeBrand?: string;
  onSelectBrand?: (brand: string) => void;
  actions?: React.ReactNode;
  apiStatus?: any;
}

/**
 * Standard chrome for every authenticated page: sidebar + sticky topbar.
 * Pages supply data and content only.
 */
export default function PageShell({
  title,
  subtitle,
  children,
  onRefresh,
  isRefreshing,
  currentRange,
  onDateChange,
  activeBrand,
  onSelectBrand,
  actions,
  apiStatus,
}: PageShellProps) {
  // "Оновити дані" in the command palette reaches the page's own refresh handler.
  useEffect(() => {
    if (!onRefresh) return;
    const handler = () => onRefresh();
    window.addEventListener(REFRESH_EVENT, handler);
    return () => window.removeEventListener(REFRESH_EVENT, handler);
  }, [onRefresh]);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar apiStatus={apiStatus} />

      <main className="h-screen min-w-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
        <Header
          title={title}
          subtitle={subtitle}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          currentRange={currentRange}
          onDateChange={onDateChange}
          activeBrand={activeBrand}
          onSelectBrand={onSelectBrand}
          actions={actions}
        />
        {children}
      </main>
    </div>
  );
}

/** Full-screen placeholder shown while the session token is being checked. */
export function AuthGate() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-bdr-strong border-t-accent" />
        <p className="text-2xs text-txt-muted">Перевірка сесії…</p>
      </div>
    </div>
  );
}
