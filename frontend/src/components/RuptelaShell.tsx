'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Truck, PlusCircle, Route, Radio, Sun, Moon, BarChart3 } from 'lucide-react';
import Sidebar from './Sidebar';
import { useSessionUser } from '@/lib/useAuthGuard';
import { t } from '@/lib/i18n';
import ThemeToggleButton from './ThemeToggleButton';

const TABS = [
  { href: '/workflow/ruptela/fleet', label: 'common.myFleet', icon: Truck },
  { href: '/workflow/ruptela/live', label: 'common.realTime', icon: Radio },
  {
    href: '/workflow/ruptela/create-trip',
    label: 'common.createATrip',
    icon: PlusCircle,
    /** Writes to Ruptela — not offered to the read-only guest role. */
    staffOnly: true,
  },
  { href: '/workflow/ruptela/routes-tasks', label: 'common.routesAndTasks', icon: Route },
  { href: '/workflow/ruptela/insights', label: 'common.fmsReports', icon: BarChart3 },
];

interface RuptelaShellProps {
  title: string;
  subtitle: string;
  /** Right-aligned controls in the sticky header. */
  actions?: React.ReactNode;
  /** Small status chip rendered next to the title. */
  status?: React.ReactNode;
  children: React.ReactNode;
}

/** Shared chrome for the Ruptela telematics section (amber accent domain). */
export default function RuptelaShell({
  title,
  subtitle,
  actions,
  status,
  children,
}: RuptelaShellProps) {
  const pathname = usePathname();
  const { isGuest } = useSessionUser();
  const tabs = TABS.filter((tab) => !(tab.staffOnly && isGuest));

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />

      <main className="h-screen min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 border-b border-bdr-subtle bg-glass px-4 pb-3 pt-3 backdrop-blur-chrome sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 pl-12 lg:pl-0">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control bg-warn/10 text-warn">
                  <Radio className="h-3.5 w-3.5" />
                </span>
                <h1 className="truncate text-base font-semibold tracking-tight text-txt-primary sm:text-lg">
                  {title}
                </h1>
                {status}
              </div>
              <p className="mt-0.5 truncate text-2xs text-txt-muted">{subtitle}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {actions}
              <ThemeToggleButton />
            </div>
          </div>

          <nav className="mt-3 flex gap-1 overflow-x-auto" aria-label={t('telematics.ruptelaSections')}>
            <div className="segmented">
              {tabs.map((tab) => {
                const active = pathname === tab.href;
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={active ? 'page' : undefined}
                    className={`segmented-item flex items-center gap-2 ${
                      active ? 'segmented-item-active text-warn' : ''
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${active ? 'text-warn' : 'text-txt-muted'}`} />
                    <span>{t(tab.label)}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </header>

        <div className="space-y-5 px-4 py-5 sm:px-6">{children}</div>
      </main>
    </div>
  );
}
