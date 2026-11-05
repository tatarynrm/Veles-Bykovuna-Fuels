'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, Landmark, Receipt } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import ThemeToggleButton from '@/components/ThemeToggleButton';
import { t } from '@/lib/i18n';

/** Вкладки Приват24: рахунки й картки — окремі API банку, окремі дані. */
const TABS = [
  { href: '/workflow/bank/privat24/transactions', label: 'bank.transactions', icon: Receipt },
  { href: '/workflow/bank/privat24/cards', label: 'bank.cardTransactions', icon: CreditCard },
];

interface BankShellProps {
  title: string;
  subtitle: string;
  /** Right-aligned controls in the sticky header. */
  actions?: React.ReactNode;
  /** Small status chip rendered next to the title. */
  status?: React.ReactNode;
  children: React.ReactNode;
}

/** Оболонка розділу «Банк». Вкладки — розділи Приват24; другий банк додасть свій набір. */
export default function BankShell({ title, subtitle, actions, status, children }: BankShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />

      <main className="h-screen min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 border-b border-bdr-subtle bg-glass px-4 pb-3 pt-3 backdrop-blur-chrome sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 pl-12 lg:pl-0">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control bg-accent/10 text-accent">
                  <Landmark className="h-3.5 w-3.5" />
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

          <nav className="mt-3 flex gap-1 overflow-x-auto" aria-label={t('bank.sections')}>
            <div className="segmented">
              {TABS.map((tab) => {
                const active = pathname === tab.href;
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={active ? 'page' : undefined}
                    className={`segmented-item flex items-center gap-2 ${
                      active ? 'segmented-item-active text-accent' : ''
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${active ? 'text-accent' : 'text-txt-muted'}`} />
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
