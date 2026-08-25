'use client';

import React, { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import NovaPoshtaShell from '@/components/NovaPoshtaShell';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { formatCurrency, formatDateTime } from '@/lib/format';
import {
  trackParcels,
  trackingPhase,
  NO_DATA,
  type NovaPoshtaTracking,
  type TrackingPhase,
} from '@/lib/novaposhta';
import {
  PackageSearch,
  Search,
  Loader2,
  AlertCircle,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Truck,
  Package,
  Clock,
  Trash2,
} from 'lucide-react';
import { t } from '@/lib/i18n';

const RECENT_KEY = 'veles_np_recent';

/** Pill colour per coarse delivery phase. Red stays destructive-only, so a
 *  problem status uses `warn`, not `danger`. */
const PHASE_STYLE: Record<TrackingPhase, string> = {
  created: 'bg-surface-hover text-txt-secondary',
  in_transit: 'bg-accent/10 text-accent',
  arrived: 'bg-warn/10 text-warn',
  delivered: 'bg-accent/15 text-accent',
  problem: 'bg-warn/15 text-warn',
};

const PHASE_ICON: Record<TrackingPhase, React.ElementType> = {
  created: Package,
  in_transit: Truck,
  arrived: MapPin,
  delivered: CheckCircle2,
  problem: AlertCircle,
};

export default function NovaPoshtaTrackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-bdr-strong border-t-accent" />
        </div>
      }
    >
      <TrackView />
    </Suspense>
  );
}

function TrackView() {
  const { authenticated } = useAuthGuard();
  const searchParams = useSearchParams();

  const [raw, setRaw] = useState('');
  const [phone, setPhone] = useState('');
  const [results, setResults] = useState<NovaPoshtaTracking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  /** Split on anything that is not a digit — TTNs are 14-digit numbers. */
  const parseNumbers = (value: string): string[] =>
    Array.from(new Set(value.split(/[^0-9]+/).map((s) => s.trim()).filter((s) => s.length >= 8)));

  const run = useCallback(
    async (value: string, phoneValue: string) => {
      const numbers = parseNumbers(value);
      setTouched(true);
      if (numbers.length === 0) {
        setResults([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const rows = await trackParcels(numbers, phoneValue.trim() || undefined);
        setResults(rows);
        try {
          localStorage.setItem(RECENT_KEY, JSON.stringify({ numbers, phone: phoneValue }));
        } catch {
          /* private mode */
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Deep link (?numbers=…) wins; otherwise restore the last query so the screen
  // reads as a live monitor rather than an empty box on every visit.
  useEffect(() => {
    if (!authenticated) return;
    const fromUrl = searchParams.get('numbers');
    if (fromUrl) {
      setRaw(fromUrl);
      run(fromUrl, '');
      return;
    }
    try {
      const saved = localStorage.getItem(RECENT_KEY);
      if (saved) {
        const { numbers, phone: savedPhone } = JSON.parse(saved);
        const value = Array.isArray(numbers) ? numbers.join('\n') : '';
        setRaw(value);
        setPhone(savedPhone ?? '');
        if (value) run(value, savedPhone ?? '');
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    run(raw, phone);
  };

  const clearAll = () => {
    setRaw('');
    setPhone('');
    setResults([]);
    setTouched(false);
    setError(null);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* ignore */
    }
  };

  if (!authenticated) return null;

  const count = parseNumbers(raw).length;

  return (
    <NovaPoshtaShell
      title={t('nova.trackingTitle')}
      subtitle={t('nova.trackingSubtitle')}
      status={
        results.length > 0 ? (
          <span className="badge badge-accent">{t('nova.parcelsCount', { v0: results.length })}</span>
        ) : undefined
      }
    >
      {/* Query panel */}
      <section className="glass-panel p-4 sm:p-5">
        <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <div>
              <label className="micro-label mb-1.5 block">{t('nova.ttnNumbers')}</label>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={3}
                placeholder={t('nova.ttnPlaceholder')}
                className="field min-h-[76px] w-full resize-y font-mono text-sm"
              />
              <p className="mt-1 text-micro text-txt-muted">{t('nova.ttnHint')}</p>
            </div>
            <div>
              <label className="micro-label mb-1.5 block">{t('nova.recipientPhoneOptional')}</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+380…"
                className="field w-full"
                inputMode="tel"
              />
              <p className="mt-1 text-micro text-txt-muted">{t('nova.phoneHint')}</p>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <button type="submit" className="btn btn-primary" disabled={loading || count === 0}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span>{t('nova.trackButton')}</span>
            </button>
            {(raw || results.length > 0) && (
              <button type="button" onClick={clearAll} className="btn btn-ghost" title={t('nova.clear')}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>
      </section>

      {error && (
        <div className="flex items-start gap-2.5 rounded-field border border-warn/30 bg-warn/10 px-3 py-2.5 text-2xs text-warn">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="text-txt-secondary">{error}</span>
        </div>
      )}

      {/* Results */}
      {results.length > 0 ? (
        <div className="grid gap-3">
          {results.map((r) => (
            <TrackingCard key={r.number} row={r} />
          ))}
        </div>
      ) : (
        !loading &&
        touched &&
        !error && (
          <EmptyState
            title={t('nova.nothingFound')}
            description={t('nova.nothingFoundHint')}
          />
        )
      )}

      {!touched && results.length === 0 && !loading && (
        <EmptyState
          icon={PackageSearch}
          title={t('nova.startTracking')}
          description={t('nova.startTrackingHint')}
        />
      )}
    </NovaPoshtaShell>
  );
}

function TrackingCard({ row }: { row: NovaPoshtaTracking }) {
  const phase = trackingPhase(row.status_code);
  const PhaseIcon = PHASE_ICON[phase];

  // A per-document error (unknown number / wrong phone) comes back on the row.
  if (row.error && !row.status) {
    return (
      <article className="glass-panel flex items-start gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-warn/10 text-warn">
          <AlertCircle className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-txt-primary">{row.number}</p>
          <p className="mt-0.5 text-2xs text-txt-secondary">{row.error}</p>
        </div>
      </article>
    );
  }

  return (
    <article className="glass-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control ${PHASE_STYLE[phase]}`}>
            <PhaseIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="font-mono text-sm font-semibold text-txt-primary">{row.number}</p>
            <span className={`badge mt-1 inline-block ${PHASE_STYLE[phase]}`}>
              {row.status ?? NO_DATA}
            </span>
          </div>
        </div>
        <div className="text-right">
          {row.cost_on_site != null && (
            <p className="text-sm font-semibold text-txt-primary">{formatCurrency(row.cost_on_site)}</p>
          )}
          {row.backward_delivery_sum ? (
            <p className="text-micro text-accent">
              {t('nova.codLabel')}: {formatCurrency(row.backward_delivery_sum)}
            </p>
          ) : null}
        </div>
      </div>

      {/* Route */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-2xs text-txt-secondary">
        <MapPin className="h-3.5 w-3.5 text-txt-muted" />
        <span>{row.city_sender ?? NO_DATA}</span>
        <ArrowRight className="h-3.5 w-3.5 text-txt-muted" />
        <span className="font-medium text-txt-primary">{row.city_recipient ?? NO_DATA}</span>
        {row.warehouse_recipient && (
          <span className="text-txt-muted">· {row.warehouse_recipient}</span>
        )}
      </div>

      {/* Meta grid */}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-2xs sm:grid-cols-4">
        <Meta label={t('nova.recipient')} value={row.recipient_full_name} />
        <Meta label={t('nova.weight')} value={row.weight != null ? `${row.weight} ${t('unit.kg')}` : null} />
        <Meta
          label={t('nova.scheduledDelivery')}
          value={row.scheduled_delivery_date ? formatDateTime(row.scheduled_delivery_date) : null}
          icon={Clock}
        />
        <Meta
          label={t('nova.delivered')}
          value={row.actual_delivery_date ? formatDateTime(row.actual_delivery_date) : null}
          icon={CheckCircle2}
        />
      </dl>
    </article>
  );
}

function Meta({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  icon?: React.ElementType;
}) {
  return (
    <div className="min-w-0">
      <dt className="micro-label flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-txt-primary">{value ?? NO_DATA}</dd>
    </div>
  );
}

function EmptyState({
  icon: Icon = Package,
  title,
  description,
}: {
  icon?: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <section className="glass-panel flex flex-col items-center justify-center gap-3 p-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-panel bg-accent-soft text-accent">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="text-sm font-semibold text-txt-primary">{title}</h2>
      <p className="max-w-md text-2xs leading-relaxed text-txt-secondary">{description}</p>
    </section>
  );
}
