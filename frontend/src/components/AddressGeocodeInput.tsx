'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, SearchX } from 'lucide-react';
import { cn } from '@/lib/cn';

/** What a picked suggestion resolves to. Coordinates are strings, 6 decimals. */
export interface GeocodeResult {
  address: string;
  latitude: string;
  longitude: string;
}

interface Suggestion {
  placeId: number;
  label: string;
  lat: string;
  lon: string;
}

interface AddressGeocodeInputProps {
  value: string;
  onChange: (address: string) => void;
  /** Fired when the dispatcher picks a suggestion — address AND coordinates. */
  onResolve: (result: GeocodeResult) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Nominatim's usage policy caps anonymous use at 1 req/s — the debounce below
 * plus the module-level cache keep a typing dispatcher well under that.
 * Results are biased to Ukrainian labels but not restricted to Ukraine:
 * CUSTOMS waypoints mean international routes are a normal case.
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const DEBOUNCE_MS = 600;
const MIN_QUERY = 3;

const queryCache = new Map<string, Suggestion[]>();

/**
 * Address input with OpenStreetMap autocomplete. Typing searches; picking a
 * suggestion resolves coordinates through `onResolve`. Plain typing without a
 * pick only updates the address — the caller decides what that means for any
 * previously resolved coordinates.
 */
export default function AddressGeocodeInput({
  value,
  onChange,
  onResolve,
  placeholder = 'м. Чернівці, вул. Заводська, 12',
  ariaLabel,
  className,
}: AddressGeocodeInputProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // A selection writes the label back into `value`; that write must not
  // immediately re-query for the text we just resolved.
  const skipQueryRef = useRef(false);

  useEffect(() => {
    if (skipQueryRef.current) {
      skipQueryRef.current = false;
      return;
    }

    const q = value.trim();
    if (q.length < MIN_QUERY) {
      setItems([]);
      setOpen(false);
      setFailed(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      const cached = queryCache.get(q);
      if (cached) {
        setItems(cached);
        setActive(0);
        setFailed(false);
        setOpen(true);
        return;
      }

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);

      try {
        const url =
          `${NOMINATIM}?format=jsonv2&limit=5&accept-language=uk&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);

        const data = await res.json();
        const parsed: Suggestion[] = (Array.isArray(data) ? data : []).map((d: any) => ({
          placeId: d.place_id,
          label: String(d.display_name ?? ''),
          lat: String(d.lat ?? ''),
          lon: String(d.lon ?? ''),
        }));

        queryCache.set(q, parsed);
        setItems(parsed);
        setActive(0);
        setFailed(false);
        setOpen(true);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setItems([]);
          setFailed(true);
          setOpen(true);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [value]);

  // Outside click closes the list
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const select = (s: Suggestion) => {
    const lat = Number(s.lat);
    const lon = Number(s.lon);
    skipQueryRef.current = true;
    onResolve({
      address: s.label,
      latitude: Number.isFinite(lat) ? lat.toFixed(6) : '',
      longitude: Number.isFinite(lon) ? lon.toFixed(6) : '',
    });
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || (items.length === 0 && !failed)) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter') {
      // Enter picks the suggestion instead of submitting the whole trip form.
      e.preventDefault();
      const s = items[active];
      if (s) select(s);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <MapPin className="pointer-events-none absolute left-3 top-[19px] z-10 h-3.5 w-3.5 -translate-y-1/2 text-txt-muted" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (items.length > 0 || failed) setOpen(true);
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        className="field pl-9 pr-9"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-[19px] h-3.5 w-3.5 -translate-y-1/2 animate-spin text-txt-muted" />
      )}

      {open && (
        <div
          role="listbox"
          aria-label="Знайдені адреси"
          className="glass-float animate-pop absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-card p-1.5"
        >
          {failed ? (
            <p className="flex items-center gap-2 px-3 py-2.5 text-2xs text-txt-muted">
              <SearchX className="h-3.5 w-3.5 shrink-0" />
              Сервіс геокодування недоступний — введіть координати вручну
            </p>
          ) : items.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-2.5 text-2xs text-txt-muted">
              <SearchX className="h-3.5 w-3.5 shrink-0" />
              Адресу не знайдено — уточніть запит або введіть координати
            </p>
          ) : (
            items.map((s, i) => (
              <button
                key={s.placeId}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onClick={() => select(s)}
                className={cn(
                  'flex w-full items-start gap-2 rounded-field px-3 py-2 text-left text-2xs transition-colors',
                  i === active
                    ? 'bg-surface-hover text-txt-primary'
                    : 'text-txt-secondary',
                )}
              >
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-warn" />
                <span className="min-w-0 flex-1">{s.label}</span>
                <span className="tabular shrink-0 font-mono text-[10px] text-txt-muted">
                  {Number(s.lat).toFixed(3)}, {Number(s.lon).toFixed(3)}
                </span>
              </button>
            ))
          )}
          <p className="border-t border-bdr-subtle px-3 pb-1 pt-1.5 text-[9px] text-txt-muted">
            Пошук: Nominatim · дані © OpenStreetMap contributors
          </p>
        </div>
      )}
    </div>
  );
}
