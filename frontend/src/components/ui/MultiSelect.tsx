'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Dimmed second line/suffix, e.g. a plate number. */
  hint?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** Shown when nothing is selected. */
  placeholder?: string;
  /** Label unit for the "N обрано" summary, e.g. "ТЗ" or "водіїв". */
  unit?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Checkbox dropdown in the `.field` control system: the trigger is a field,
 * the panel is a floating glass layer with search, select-all and clear.
 */
export default function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = t('ui.selectEllipsis'),
  unit = t('ui.selected'),
  ariaLabel,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    const raf = requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q),
    );
  }, [options, query]);

  const toggle = (value: string) =>
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? placeholder
        : `${selected.length} ${unit}`;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="field flex items-center justify-between gap-2 text-left"
      >
        <span className={cn('truncate', selected.length === 0 && 'text-txt-muted')}>
          {summary}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-txt-muted transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="glass-float animate-pop absolute left-0 right-0 top-full z-50 mt-2 rounded-card p-1.5">
          {/* Search + bulk actions */}
          <div className="mb-1 flex items-center gap-1.5 border-b border-bdr-subtle pb-1.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-txt-muted" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('common.searchEllipsis')}
                aria-label={t('ui.filterOptions')}
                className="field field-sm w-full pl-7"
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(options.map((o) => o.value))}
              className="whitespace-nowrap text-micro font-semibold text-warn hover:underline"
            >
              {t('ui.all')}
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              title={t('ui.clearSelection')}
              aria-label={t('ui.clearSelection')}
              className="btn-icon h-7 w-7"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div role="listbox" aria-multiselectable="true" className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2.5 py-3 text-center text-2xs text-txt-muted">{t('ui.nothingFound')}</p>
            ) : (
              filtered.map((o) => {
                const active = selected.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => toggle(o.value)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-control px-2.5 py-1.5 text-left text-2xs transition-colors',
                      active
                        ? 'bg-warn/10 text-txt-primary'
                        : 'text-txt-secondary hover:bg-surface-hover hover:text-txt-primary',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                        active
                          ? 'border-transparent bg-warn text-[#1A1206]'
                          : 'border-bdr-strong bg-transparent',
                      )}
                    >
                      {active && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && (
                      <span className="shrink-0 font-mono text-[10px] text-txt-muted">{o.hint}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
