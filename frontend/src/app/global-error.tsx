'use client';

import React from 'react';
import './globals.css';
import { t } from '@/lib/i18n';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uk">
      <body className="bg-page text-txt-primary">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="glass-panel w-full max-w-md p-8 text-center">
            <h2 className="text-lg font-semibold">{t('error.criticalSystemError')}</h2>
            <p className="mt-2 text-2xs text-txt-muted">
              {error?.message || t('error.unknownError')}
            </p>
            <button onClick={reset} className="btn btn-primary mt-6 w-full py-2.5">
              {t('error.reloadTheApp')}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
