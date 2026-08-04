'use client';

import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-panel rise w-full max-w-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-field bg-surface-hover text-txt-muted">
          <Compass className="h-5 w-5" />
        </div>
        <p className="stat text-3xl">404</p>
        <h2 className="mt-2 text-base font-semibold text-txt-primary">Сторінку не знайдено</h2>
        <p className="mt-1.5 text-2xs text-txt-muted">
          Запитаний розділ не існує або був переміщений.
        </p>
        <Link href="/" className="btn btn-primary mt-6 w-full py-2.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          На головну панель
        </Link>
      </div>
    </div>
  );
}
