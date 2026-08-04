'use client';

import React from 'react';
import Link from 'next/link';
import { Eye, Lock } from 'lucide-react';

/**
 * Guest-role notices. The restriction itself lives on the server
 * (`backend/src/auth/read-only.guard.ts`) — these only explain it, so a guest is
 * never shown a control that would come back 403.
 */

/** Inline strip for a screen a guest may use, with some controls disabled. */
export function GuestBanner({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-field border border-warn/30 bg-warn/10 px-3 py-2.5 text-2xs text-warn">
      <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="text-txt-secondary">
        {children ?? (
          <>
            <strong className="font-semibold text-warn">Гостьовий доступ.</strong> Дані
            доступні для перегляду, зміни заблоковані.
          </>
        )}
      </span>
    </div>
  );
}

/** Full-panel replacement for a screen whose entire purpose is writing data. */
export function GuestBlockedPanel({
  title = 'Доступно лише для співробітників',
  description = 'У гостьовому режимі створення та редагування маршрутів вимкнено — поїздка з дашборда потрапляє напряму в Ruptela і може бути надіслана водієві.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="glass-panel flex flex-col items-center justify-center gap-3 p-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-panel bg-warn/10 text-warn">
        <Lock className="h-5 w-5" />
      </span>
      <h2 className="text-sm font-semibold text-txt-primary">{title}</h2>
      <p className="max-w-md text-2xs leading-relaxed text-txt-secondary">{description}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Link href="/ruptela/routes-tasks" className="btn btn-ghost">
          Переглянути маршрути
        </Link>
        <Link href="/login" className="btn btn-warn">
          Увійти під іншим користувачем
        </Link>
      </div>
    </section>
  );
}
