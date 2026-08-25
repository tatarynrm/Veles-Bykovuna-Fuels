'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';

export default function NovaPoshtaRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/workflow/novaposhta/track');
  }, [router]);

  return (
    <div className="min-h-screen bg-page flex items-center justify-center text-txt-secondary font-semibold">
      {t('nova.redirectingTracking')}
    </div>
  );
}
