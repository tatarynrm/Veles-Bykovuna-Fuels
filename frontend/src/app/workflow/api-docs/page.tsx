'use client';

import React from 'react';
import PageShell, { AuthGate } from '@/components/PageShell';
import VendorApiDocs from '@/components/VendorApiDocs';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { t } from '@/lib/i18n';

export default function ApiDocsPage() {
  const { authenticated } = useAuthGuard();

  if (!authenticated) return <AuthGate />;

  return (
    <PageShell
      title={t('vdocs.title')}
      subtitle={t('vdocs.subtitle')}
    >
      <VendorApiDocs />
    </PageShell>
  );
}
