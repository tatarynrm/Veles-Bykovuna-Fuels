'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-panel rise w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-field bg-[var(--danger-soft)] text-danger">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 className="text-base font-semibold text-txt-primary">
          Помилка під час завантаження розділу
        </h2>
        {error?.message && (
          <p className="glass-inset mt-3 break-words p-3 text-left font-mono text-micro text-txt-muted">
            {error.message}
          </p>
        )}
        <button onClick={reset} className="btn btn-primary mt-6 w-full py-2.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Спробувати знову
        </button>
      </div>
    </div>
  );
}
