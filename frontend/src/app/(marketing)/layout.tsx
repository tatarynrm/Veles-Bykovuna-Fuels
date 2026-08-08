'use client';

import React from 'react';
import { MarketingNav } from '@/widgets/marketing-nav';
import MarketingFooter from '@/widgets/marketing-footer/ui/MarketingFooter';

/** Спільна оболонка публічних сторінок. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </>
  );
}
