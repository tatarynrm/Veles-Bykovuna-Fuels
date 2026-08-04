'use client';

import React from 'react';

/* Skeletons mirror the real layout boxes so nothing shifts when data lands. */

export function SkeletonKpi() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="glass-panel space-y-3 p-5">
          <div className="flex items-start justify-between">
            <div className="skeleton h-2.5 w-24" />
            <div className="skeleton h-8 w-8 rounded-field" />
          </div>
          <div className="skeleton h-7 w-32" />
          <div className="skeleton h-2.5 w-28" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="glass-panel space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton h-4 w-56" />
          <div className="skeleton h-2.5 w-72" />
        </div>
        <div className="skeleton h-8 w-32 rounded-control" />
      </div>
      <div className="skeleton h-9 w-full rounded-field" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="skeleton h-9 flex-[2]" />
            <div className="skeleton h-9 flex-1" />
            <div className="skeleton h-9 flex-1" />
            <div className="skeleton hidden h-9 flex-1 sm:block" />
            <div className="skeleton h-9 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="glass-panel space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton h-4 w-52" />
          <div className="skeleton h-2.5 w-64" />
        </div>
        <div className="skeleton h-8 w-28 rounded-control" />
      </div>
      <div className="flex h-64 items-end gap-3 rounded-field bg-surface-inset p-5">
        {[42, 68, 34, 88, 56, 92, 48, 74, 60, 38].map((h, i) => (
          <div key={i} className="skeleton flex-1 rounded-t-md" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonGrid({ items = 6 }: { items?: number }) {
  return (
    <div className="glass-panel p-6">
      <div className="mb-5 space-y-2">
        <div className="skeleton h-4 w-48" />
        <div className="skeleton h-2.5 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="glass-inset space-y-3 p-4">
            <div className="flex justify-between">
              <div className="skeleton h-4 w-20 rounded-full" />
              <div className="skeleton h-4 w-16 rounded-full" />
            </div>
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-2.5 w-1/2" />
            <div className="flex gap-1.5 pt-2">
              <div className="skeleton h-5 w-16 rounded-full" />
              <div className="skeleton h-5 w-14 rounded-full" />
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shared empty state — every list/table/chart should render one. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon?: React.ElementType;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {Icon && (
        <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-field bg-surface-hover text-txt-muted">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="text-sm font-medium text-txt-secondary">{title}</p>
      {hint && <p className="max-w-sm text-2xs text-txt-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
