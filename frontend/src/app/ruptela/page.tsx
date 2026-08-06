'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';

export default function RuptelaRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/ruptela/fleet');
  }, [router]);

  return (
    <div className="min-h-screen bg-page flex items-center justify-center text-txt-secondary font-semibold">
      {t('telematics.redirectingMyFleetEllipsis')}
    </div>
  );
}
