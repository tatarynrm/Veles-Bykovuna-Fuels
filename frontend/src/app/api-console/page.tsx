'use client';

import React from 'react';
import PageShell, { AuthGate } from '@/components/PageShell';
import ApiConsole from '@/components/ApiConsole';
import { useAuthGuard } from '@/lib/useAuthGuard';

export default function ApiConsolePage() {
  const { authenticated } = useAuthGuard();

  if (!authenticated) return <AuthGate />;

  return (
    <PageShell
      title="Консоль API"
      subtitle="Тестування інтеграційних запитів OKKO ERP, Shell B2B та Ruptela"
    >
      <ApiConsole />
    </PageShell>
  );
}
