'use client';

import React from 'react';
import PageShell, { AuthGate } from '@/components/PageShell';
import ApiConsole from '@/components/ApiConsole';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { t } from '@/lib/i18n';

export default function ApiConsolePage() {
  const { authenticated } = useAuthGuard();

  if (!authenticated) return <AuthGate />;

  return (
    <PageShell
      title={t('console.apiConsole')}
      subtitle={t('console.testingOKKOERPShell')}
    >
      <ApiConsole />
    </PageShell>
  );
}
