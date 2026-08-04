'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'accent' | 'ghost' | 'warn';
  icon?: React.ElementType;
  loading?: boolean;
  /** Trailing keyboard hint, e.g. "⏎". */
  kbd?: string;
}

const toneClass = {
  accent: 'btn-primary',
  ghost: 'btn-ghost',
  warn: 'btn-warn',
} as const;

/**
 * Primary action with a light sweep across the face on hover/focus.
 *
 * The sweep fires on interaction only — a permanently travelling highlight is
 * this product's signal for live data, and a button is not live data.
 */
export default function ShimmerButton({
  tone = 'accent',
  icon: Icon,
  loading = false,
  kbd,
  className,
  children,
  disabled,
  ...rest
}: ShimmerButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn('btn shimmer', toneClass[tone], className)}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {children}
      {kbd && (
        <span
          className="ml-1 rounded-md border border-current px-1 text-[10px] leading-4 opacity-50"
          aria-hidden="true"
        >
          {kbd}
        </span>
      )}
    </button>
  );
}
