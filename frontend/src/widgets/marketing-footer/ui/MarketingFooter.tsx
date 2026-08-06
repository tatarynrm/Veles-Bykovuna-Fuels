'use client';

import React from 'react';
import Link from 'next/link';
import { MARKETING_NAV, BRAND } from '@/shared/config/site';
import { t } from '@/lib/i18n';

export default function MarketingFooter() {
  return (
    <footer className="border-t px-5 py-10 sm:px-8" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-sm" style={{ color: 'var(--accent)', letterSpacing: '0.14em' }}>
            {BRAND.name}
          </p>
          <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            © 2026 {BRAND.legal}. {t('landing.allRightsReserved')}
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {MARKETING_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs transition-colors hover:text-[var(--text-primary)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t(item.label)}
            </Link>
          ))}
          <Link
            href="/login"
            className="text-xs transition-colors hover:text-[var(--text-primary)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('landing.signIn')}
          </Link>
        </nav>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{BRAND.version}</p>
      </div>
    </footer>
  );
}
