'use client';

import React from 'react';
import './globals.css';

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
            <h2 className="text-lg font-semibold">Критична помилка системи</h2>
            <p className="mt-2 text-2xs text-txt-muted">
              {error?.message || 'Невідома помилка'}
            </p>
            <button onClick={reset} className="btn btn-primary mt-6 w-full py-2.5">
              Перезавантажити застосунок
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
