'use client';

/**
 * Стару адресу закачки GPS перенесено в розділ «Синхронізація з базою».
 * Лишаємо редірект, щоб старі посилання/закладки не ламались.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RealtimeCoordinatesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/workflow/sync/gps');
  }, [router]);
  return null;
}
