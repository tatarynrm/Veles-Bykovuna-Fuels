'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DateRangePicker, { DateRange } from './DateRangePicker';
import BrandTabs from './BrandTabs';
import { CommandPaletteTrigger } from './ui/CommandPalette';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggleButton from './ThemeToggleButton';
import { signOut, SessionUser } from '@/lib/useAuthGuard';
import { t } from '@/lib/i18n';

interface HeaderProps {
  title: string;
  subtitle: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  currentRange?: DateRange;
  onDateChange?: (range: DateRange) => void;
  activeBrand?: string;
  onSelectBrand?: (brand: string) => void;
  actions?: React.ReactNode;
}

export default function Header({
  title,
  subtitle,
  onRefresh,
  isRefreshing = false,
  currentRange,
  onDateChange,
  activeBrand,
  onSelectBrand,
  actions,
}: HeaderProps) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('veles_user');
      if (raw) setUser(JSON.parse(raw));
    } catch {
      /* optional */
    }
  }, []);

  const handleLogout = () => {
    signOut();
    router.push('/login');
  };

  const initials = (user?.name || user?.username || 'V')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const showTabs = Boolean(activeBrand && onSelectBrand);

  return (
    <header className="sticky top-0 z-30 -mx-4 mb-6 border-b border-bdr-subtle bg-glass px-4 pb-3 pt-3 backdrop-blur-chrome sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 pl-12 lg:pl-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-txt-primary sm:text-xl">
            {title}
          </h1>
          <p className="mt-0.5 truncate text-2xs text-txt-muted">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {actions}

          <CommandPaletteTrigger />

          {currentRange && onDateChange && (
            <DateRangePicker currentRange={currentRange} onDateChange={onDateChange} />
          )}

          {onRefresh && (
            <button onClick={onRefresh} disabled={isRefreshing} className="btn btn-primary">
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isRefreshing ? t('nav.refreshingEllipsis') : t('common.refresh')}
              </span>
            </button>
          )}

          <LanguageSwitcher />

          <ThemeToggleButton />

          <div className="flex items-center gap-2 rounded-control border border-bdr-subtle bg-surface py-1 pl-1 pr-1">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-micro font-semibold text-accent"
              title={user?.name || user?.username}
            >
              {initials}
            </span>
            <button
              onClick={handleLogout}
              title={t('common.signOut')}
              aria-label={t('common.signOut')}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-txt-muted transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {showTabs && (
        <div className="mt-3">
          <BrandTabs activeBrand={activeBrand!} onSelectBrand={onSelectBrand!} />
        </div>
      )}
    </header>
  );
}
