'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import RuptelaShell from '@/components/RuptelaShell';
import { GuestBanner } from '@/components/GuestLock';
import { useSessionUser } from '@/lib/useAuthGuard';
import { apiGet, apiList, apiSend } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  NO_DATA,
  TRIP_STATE_LABEL,
  TRIP_SORT_LABEL,
  WAYPOINT_TYPE_LABEL,
  driverDisplayName,
  metric,
  relativeAge,
  waypointLabel,
  type RuptelaDriver,
  type RuptelaTrip,
  type RuptelaVehicle,
  type SortOrder,
  type TripListResult,
  type TripScope,
  type TripSortKey,
  type TripState,
} from '@/lib/ruptela';
import {
  Route,
  Truck,
  MapPin,
  Clock,
  CheckCircle2,
  Circle,
  Pencil,
  Trash2,
  PlusCircle,
  Lock,
  RefreshCw,
  Search,
  AlertCircle,
  Loader2,
  X,
  Flag,
  Archive,
  Info,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  RotateCcw,
} from 'lucide-react';
import { t } from '@/lib/i18n';

export default function RuptelaRoutesTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-bdr-strong border-t-warn" />
        </div>
      }
    >
      <RoutesTasksView />
    </Suspense>
  );
}

function RoutesTasksView() {
  const { isGuest } = useSessionUser();
  const searchParams = useSearchParams();
  const deepLinkTripId = searchParams.get('trip');

  const [scope, setScope] = useState<TripScope>('active');
  const [result, setResult] = useState<TripListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(deepLinkTripId);
  /** Deep-linked trip resolved separately — it may sit on a page we don't show. */
  const [deepTrip, setDeepTrip] = useState<RuptelaTrip | null>(null);

  // Filters are applied server-side; every change restarts from page 1,
  // otherwise the user can land on a page that no longer exists.
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<TripState | ''>('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<TripSortKey>('default');
  const [order, setOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const [editing, setEditing] = useState<RuptelaTrip | null>(null);
  const [deleting, setDeleting] = useState<RuptelaTrip | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  /**
   * Full skeleton only the first time a scope is shown; filter/page changes keep
   * the current list on screen and just spin the refresh indicator.
   */
  const scopeShown = useRef<Record<TripScope, boolean>>({
    active: false,
    archive: false,
    all: false,
  });

  const load = useCallback(
    async (silent?: boolean) => {
      const soft = silent ?? scopeShown.current[scope];
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await apiGet<TripListResult>('/api/ruptela/trips', {
          scope,
          q: debouncedQuery || undefined,
          states: stateFilter || undefined,
          vehicleId: vehicleFilter || undefined,
          driverId: driverFilter || undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
          sort: sort === 'default' ? undefined : sort,
          order: order === 'asc' ? undefined : order,
          page,
          size,
        });
        setResult(data);
        scopeShown.current[scope] = true;
      } catch (err: any) {
        setError(err?.message ?? t('trip.couldNotLoadTrips'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      scope,
      debouncedQuery,
      stateFilter,
      vehicleFilter,
      driverFilter,
      dateFrom,
      dateTo,
      sort,
      order,
      page,
      size,
    ],
  );

  useEffect(() => {
    load();
  }, [load]);

  // The deep-linked trip might not be on the current page — resolve it once by id.
  useEffect(() => {
    if (!deepLinkTripId) return;
    apiGet<RuptelaTrip | null>(`/api/ruptela/trips/${deepLinkTripId}`)
      .then((trip) => setDeepTrip(trip ?? null))
      .catch(() => setDeepTrip(null));
  }, [deepLinkTripId]);

  const trips = result?.items ?? [];
  const facets = result?.facets ?? null;

  const hasFilters = Boolean(
    debouncedQuery || stateFilter || vehicleFilter || driverFilter || dateFrom || dateTo,
  );

  const resetFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setStateFilter('');
    setVehicleFilter('');
    setDriverFilter('');
    setDateFrom('');
    setDateTo('');
    setSort('default');
    setOrder('asc');
    setPage(1);
  };

  const selected =
    trips.find((t) => t.id === selectedId) ??
    (selectedId && deepTrip?.id === selectedId ? deepTrip : null) ??
    trips[0] ??
    null;

  /** Replaces one trip in place so the list does not flicker after a mutation. */
  const patchTrip = (trip: RuptelaTrip) => {
    setDeepTrip((prev) => (prev?.id === trip.id ? trip : prev));
    setResult((prev) =>
      prev
        ? { ...prev, items: prev.items.map((t) => (t.id === trip.id ? trip : t)) }
        : prev,
    );
  };

  const removeTrip = (id: string) => {
    setDeepTrip((prev) => (prev?.id === id ? null : prev));
    setResult((prev) =>
      prev
        ? { ...prev, items: prev.items.filter((t) => t.id !== id), total: prev.total - 1 }
        : prev,
    );
  };

  const toggleTask = async (trip: RuptelaTrip, taskId: string, completed: boolean) => {
    if (isGuest) return; // PATCH — the server rejects it for guests anyway
    // Optimistic: the flag is dispatcher-local anyway, so a round trip would
    // only add latency to a checkbox.
    patchTrip({
      ...trip,
      tasks: trip.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)),
      waypoints: trip.waypoints.map((w) => ({
        ...w,
        todos: w.todos.map((t) => (t.id === taskId ? { ...t, completed } : t)),
      })),
    });

    try {
      await apiSend('PATCH', `/api/ruptela/trips/${trip.id}/tasks/${taskId}`, {
        completed,
      });
    } catch {
      load(true);
    }
  };

  const stateBadge = (trip: RuptelaTrip) => {
    const cls =
      trip.status === 'in_progress'
        ? 'badge-success'
        : trip.status === 'completed'
          ? 'badge-neutral'
          : trip.status === 'cancelled'
            ? 'badge-danger'
            : 'badge-warn';
    return (
      <span className={`badge ${cls}`}>
        {trip.state ? (TRIP_STATE_LABEL[trip.state] ?? trip.state) : NO_DATA}
      </span>
    );
  };

  return (
    <RuptelaShell
      title={t('trip.routesAndTasks')}
      subtitle={t('trip.ruptelaRoutingTaskingTrips')}
      status={
        result?.fetchedAt ? (
          <span className="badge badge-neutral" title={formatDateTime(result.fetchedAt)}>
            {refreshing || result.stale ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : null}
            {t('common.data')} {relativeAge(result.fetchedAt)}
          </span>
        ) : null
      }
      actions={
        <>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="btn btn-ghost"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </button>
          {isGuest ? (
            <button
              type="button"
              disabled
              className="btn btn-ghost"
              title={t('trip.guestAccessCreatingTrips')}
            >
              <Lock className="h-3.5 w-3.5" />
              <span>{t('common.newTrip')}</span>
            </button>
          ) : (
            <Link href="/workflow/ruptela/create-trip" className="btn btn-warn">
              <PlusCircle className="h-3.5 w-3.5" />
              <span>{t('common.newTrip')}</span>
            </Link>
          )}
        </>
      }
    >
      {isGuest && (
        <div className="mb-4">
          <GuestBanner>
            <strong className="font-semibold text-warn">{t('common.guestAccess')}</strong> {t('trip.routesTasksViewableCreating')}
          </GuestBanner>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-field border border-danger/25 bg-danger/10 p-3 text-2xs text-danger"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Scope + filters */}
      <div className="glass-panel mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="segmented" role="tablist" aria-label={t('trip.tripScope')}>
            <button
              role="tab"
              aria-selected={scope === 'active'}
              onClick={() => {
                setScope('active');
                setPage(1);
              }}
              className={`segmented-item flex items-center gap-2 ${scope === 'active' ? 'segmented-item-active' : ''}`}
            >
              <Flag className="h-3.5 w-3.5" />
              {t('trip.active')}
            </button>
            <button
              role="tab"
              aria-selected={scope === 'archive'}
              onClick={() => {
                setScope('archive');
                setPage(1);
              }}
              className={`segmented-item flex items-center gap-2 ${scope === 'archive' ? 'segmented-item-active' : ''}`}
              title={t('trip.completedCancelledSlowerLoad')}
            >
              <Archive className="h-3.5 w-3.5" />
              {t('trip.archive')}
            </button>
            <button
              role="tab"
              aria-selected={scope === 'all'}
              onClick={() => {
                setScope('all');
                setPage(1);
              }}
              className={`segmented-item flex items-center gap-2 ${scope === 'all' ? 'segmented-item-active' : ''}`}
              title={t('trip.activePlusArchive')}
            >
              <Route className="h-3.5 w-3.5" />
              {t('trip.all')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-txt-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('trip.titleVehicleDriverRouteEllipsis')}
                aria-label={t('trip.searchTrips')}
                className="field field-sm w-64 pl-9"
              />
            </div>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="btn btn-ghost"
                title={t('trip.resetAllFilters')}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('trip.reset')}
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <label className="block">
            <span className="micro-label mb-1 block">{t('trip.state')}</span>
            <select
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value as TripState | '');
                setPage(1);
              }}
              className="field field-sm"
            >
              <option value="">{t('trip.allStates')}</option>
              {(facets?.states ?? []).map((s) => (
                <option key={s.state} value={s.state}>
                  {TRIP_STATE_LABEL[s.state] ?? s.state} ({s.count})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="micro-label mb-1 block">{t('common.vehicles')}</span>
            <select
              value={vehicleFilter}
              onChange={(e) => {
                setVehicleFilter(e.target.value);
                setPage(1);
              }}
              className="field field-sm"
            >
              <option value="">{t('trip.allVehicles')}</option>
              {(facets?.vehicles ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate ?? v.name ?? v.id} ({v.count})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="micro-label mb-1 block">{t('common.driver')}</span>
            <select
              value={driverFilter}
              onChange={(e) => {
                setDriverFilter(e.target.value);
                setPage(1);
              }}
              className="field field-sm"
            >
              <option value="">{t('trip.allDrivers')}</option>
              {(facets?.drivers ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name ?? d.id} ({d.count})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="micro-label mb-1 block">{t('trip.dateFrom')}</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="field field-sm"
            />
          </label>

          <label className="block">
            <span className="micro-label mb-1 block">{t('trip.dateTo')}</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="field field-sm"
            />
          </label>

          <div className="block">
            <span className="micro-label mb-1 block">{t('trip.sorting')}</span>
            <div className="flex items-center gap-1.5">
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as TripSortKey);
                  setPage(1);
                }}
                aria-label={t('trip.sortField')}
                className="field field-sm min-w-0 flex-1"
              >
                {(Object.keys(TRIP_SORT_LABEL) as TripSortKey[]).map((key) => (
                  <option key={key} value={key}>
                    {TRIP_SORT_LABEL[key]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  setOrder(order === 'asc' ? 'desc' : 'asc');
                  setPage(1);
                }}
                className="btn-icon h-8 w-8 shrink-0"
                title={order === 'asc' ? t('trip.ascending') : t('trip.descending')}
                aria-label={t('trip.sortDirection')}
              >
                {order === 'asc' ? (
                  <ArrowUp className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {scope === 'archive' && loading && (
        <div className="glass-inset mb-4 flex items-center gap-2 p-3 text-2xs text-txt-muted">
          <Info className="h-3.5 w-3.5 shrink-0" />
          {t('trip.archiveFetchedRuptelaSingle')}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* ── List ── */}
        <div className="space-y-2.5 xl:col-span-5">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass-panel space-y-2 p-4">
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-2.5 w-1/2" />
              </div>
            ))
          ) : trips.length === 0 ? (
            <div className="glass-panel p-10 text-center">
              <Route className="mx-auto mb-2 h-6 w-6 text-txt-muted" />
              <p className="text-sm text-txt-secondary">
                {hasFilters
                  ? t('trip.nothingMatchesTheseFilters')
                  : t('trip.thereNoTripsScope')}
              </p>
              {hasFilters ? (
                <button onClick={resetFilters} className="btn btn-ghost mt-4">
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('trip.resetFilters')}
                </button>
              ) : (
                scope === 'active' && (
                  <Link href="/workflow/ruptela/create-trip" className="btn btn-warn mt-4">
                    <PlusCircle className="h-3.5 w-3.5" />
                    {t('trip.createFirstOne')}
                  </Link>
                )
              )}
            </div>
          ) : (
            trips.map((trip, i) => {
              const isSelected = selected?.id === trip.id;
              const done = trip.tasks.filter((t) => t.completed).length;
              return (
                <article
                  key={trip.id}
                  onClick={() => setSelectedId(trip.id)}
                  className={`glass-panel rise cursor-pointer p-4 transition-colors ${
                    isSelected ? 'border-warn/40' : 'hover:border-bdr-strong'
                  }`}
                  style={{ '--d': `${Math.min(i, 8) * 30}ms` } as React.CSSProperties}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-micro text-txt-muted">
                      {trip.id.slice(0, 8)}
                    </span>
                    {stateBadge(trip)}
                  </div>

                  <h3 className="mt-1.5 truncate text-sm font-medium text-txt-primary">
                    {trip.title}
                  </h3>

                  <p className="mt-1 flex items-center gap-1.5 truncate text-2xs text-txt-muted">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {trip.origin_name ?? NO_DATA} → {trip.destination_name ?? NO_DATA}
                  </p>

                  <div className="hairline-t mt-3 flex flex-wrap items-center justify-between gap-2 pt-2.5 text-micro text-txt-muted">
                    <span className="flex items-center gap-1.5 truncate">
                      <Truck className="h-3 w-3 shrink-0 text-warn" />
                      {trip.vehicle_plate ?? NO_DATA} · {trip.driver_name ?? NO_DATA}
                    </span>
                    <span className="tabular shrink-0">
                      {metric(trip.distance_km, { unit: t('common.km') })}
                      {trip.tasks.length > 0 && ` · ${done}/${trip.tasks.length}`}
                    </span>
                  </div>
                </article>
              );
            })
          )}

          {/* ── Pagination ── */}
          {!loading && result && result.total > 0 && (
            <div className="glass-panel flex flex-wrap items-center justify-between gap-3 p-3">
              <span className="tabular text-2xs text-txt-muted">
                {(result.page - 1) * result.size + 1}–
                {Math.min(result.page * result.size, result.total)} {t('common.of')} {result.total}
              </span>

              <div className="flex items-center gap-2">
                <select
                  value={size}
                  onChange={(e) => {
                    setSize(Number(e.target.value));
                    setPage(1);
                  }}
                  aria-label={t('trip.tripsPerPage')}
                  className="field field-sm w-auto"
                >
                  {[10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} {t('trip.page')}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={result.page <= 1}
                  className="btn-icon h-8 w-8 disabled:pointer-events-none disabled:opacity-40"
                  title={t('common.previousPage')}
                  aria-label={t('common.previousPage')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="tabular text-2xs text-txt-secondary">
                  {result.page} / {result.totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(result.totalPages, page + 1))}
                  disabled={result.page >= result.totalPages}
                  className="btn-icon h-8 w-8 disabled:pointer-events-none disabled:opacity-40"
                  title={t('common.nextPage')}
                  aria-label={t('common.nextPage')}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Detail ── */}
        <div className="xl:col-span-7">
          {!selected ? (
            <div className="glass-panel p-12 text-center text-sm text-txt-muted">
              {t('trip.selectTripList')}
            </div>
          ) : (
            <div className="space-y-4">
              <section className="glass-panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {stateBadge(selected)}
                      <span className="font-mono text-micro text-txt-muted">
                        {selected.id.slice(0, 8)}
                      </span>
                    </div>
                    <h2 className="mt-1.5 text-base font-semibold text-txt-primary">
                      {selected.title}
                    </h2>
                    {selected.notes && (
                      <p className="mt-1 text-2xs text-txt-secondary">{selected.notes}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {isGuest ? (
                      <span className="badge badge-warn">
                        <Lock className="h-3 w-3" />
                        {t('common.viewOnly')}
                      </span>
                    ) : (
                      <>
                        {/* Full editor: route, waypoints, tasks — the same form that creates trips */}
                        <Link
                          href={`/workflow/ruptela/create-trip?edit=${selected.id}`}
                          className="btn btn-warn"
                        >
                          <Route className="h-3.5 w-3.5" />
                          {t('trip.editTheRoute')}
                        </Link>
                        <button
                          onClick={() => setEditing(selected)}
                          className="btn btn-ghost"
                          title={t('trip.quicklyChangeTitleNotes')}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t('trip.quickEdit')}
                        </button>
                        <button
                          onClick={() => setDeleting(selected)}
                          className="btn btn-ghost hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t('trip.delete')}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: t('common.vehicles'), value: selected.vehicle_plate ?? NO_DATA },
                    { label: t('common.driver'), value: selected.driver_name ?? NO_DATA },
                    {
                      label: t('trip.distance'),
                      value: metric(selected.distance_km, { unit: t('common.km') }),
                    },
                    {
                      label: 'ETA',
                      value: selected.eta ? formatDateTime(selected.eta) : NO_DATA,
                    },
                  ].map((cell) => (
                    <div key={cell.label} className="glass-inset p-3">
                      <p className="micro-label">{cell.label}</p>
                      <p className="stat mt-0.5 truncate text-xs">{cell.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Waypoints */}
              <section className="glass-panel p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-txt-primary">
                  <Route className="h-4 w-4 text-warn" />
                  {t('trip.routeCountPrefix')}{selected.waypoints.length})
                </h3>

                {selected.waypoints.length === 0 ? (
                  <p className="py-6 text-center text-2xs text-txt-muted">
                    {t('trip.ruptelaReturnedNoStops')}
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {selected.waypoints.map((w, index) => {
                      const visited = Boolean(w.visited_at);
                      return (
                        <li key={w.id ?? index} className="glass-inset flex gap-3 p-3">
                          <div className="flex flex-col items-center">
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-micro font-semibold ${
                                visited
                                  ? 'bg-accent-soft text-accent'
                                  : 'bg-surface-hover text-txt-muted'
                              }`}
                            >
                              {index + 1}
                            </span>
                            {index < selected.waypoints.length - 1 && (
                              <span className="mt-1 w-px flex-1 bg-bdr-subtle" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-2xs font-medium text-txt-primary">
                                {waypointLabel(w)}
                              </span>
                              <span className="badge badge-neutral">
                                {WAYPOINT_TYPE_LABEL[w.type ?? ''] ?? w.type ?? NO_DATA}
                              </span>
                            </div>

                            {w.address && (
                              <p className="mt-0.5 truncate text-micro text-txt-muted">
                                {w.address}
                              </p>
                            )}

                            <div className="mt-1 flex flex-wrap gap-3 text-micro text-txt-muted">
                              {visited ? (
                                <span className="flex items-center gap-1 text-accent">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {t('trip.visited')} {formatDateTime(w.visited_at)}
                                </span>
                              ) : w.eta ? (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  ETA {formatDateTime(w.eta)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              {/* Driver checklist */}
              <section className="glass-panel p-5">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-txt-primary">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    {t('trip.driverChecklist')}{selected.tasks.filter((t) => t.completed).length}/
                    {selected.tasks.length})
                  </h3>
                </div>
                <p className="mb-3 text-micro text-txt-muted">
                  {t('trip.ruptelaHasNoMutation')}
                </p>

                {selected.tasks.length === 0 ? (
                  <p className="py-6 text-center text-2xs text-txt-muted">
                    {t('trip.noTasksDefinedTrip')}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {selected.tasks.map((task, index) => (
                      <li key={task.id ?? index}>
                        <button
                          onClick={() =>
                            task.id && toggleTask(selected, task.id, !task.completed)
                          }
                          disabled={isGuest}
                          title={
                            isGuest
                              ? t('trip.guestAccessTickingTasks')
                              : undefined
                          }
                          className={`glass-inset flex w-full items-center gap-3 p-3 text-left transition-colors ${
                            isGuest ? 'cursor-not-allowed' : 'glass-inset-hover'
                          }`}
                        >
                          {task.completed ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-txt-muted" />
                          )}
                          <span
                            className={`min-w-0 flex-1 truncate text-2xs ${
                              task.completed
                                ? 'text-txt-muted line-through'
                                : 'text-txt-primary'
                            }`}
                          >
                            {task.description ?? NO_DATA}
                          </span>
                          {task.type && (
                            <span className="badge badge-neutral shrink-0">{task.type}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <EditTripDialog
          trip={editing}
          onClose={() => setEditing(null)}
          onSaved={(trip) => {
            patchTrip(trip);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <DeleteTripDialog
          trip={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(id) => {
            removeTrip(id);
            if (selectedId === id) setSelectedId(null);
            setDeleting(null);
          }}
        />
      )}
    </RuptelaShell>
  );
}

/* ── Edit ──────────────────────────────────────────────────────────────── */

function EditTripDialog({
  trip,
  onClose,
  onSaved,
}: {
  trip: RuptelaTrip;
  onClose: () => void;
  onSaved: (trip: RuptelaTrip) => void;
}) {
  const [title, setTitle] = useState(trip.title);
  const [notes, setNotes] = useState(trip.notes ?? '');
  const [vehicleId, setVehicleId] = useState(trip.vehicle_id ?? '');
  const [driverId, setDriverId] = useState('');
  const [vehicles, setVehicles] = useState<RuptelaVehicle[]>([]);
  const [drivers, setDrivers] = useState<RuptelaDriver[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<RuptelaVehicle[]>('/api/ruptela/vehicles')
      .then(setVehicles)
      .catch(() => setVehicles([]));
    apiList<RuptelaDriver>('/api/ruptela/insights/drivers').then(setDrivers);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiSend<RuptelaTrip>('PUT', `/api/ruptela/trips/${trip.id}`, {
        title: title.trim(),
        notes: notes.trim(),
        ...(vehicleId && vehicleId !== trip.vehicle_id ? { vehicleId } : {}),
        ...(driverId ? { primaryDriverId: driverId } : {}),
      });
      onSaved(updated);
    } catch (err: any) {
      setError(err?.message ?? t('trip.couldNotSaveChanges'));
      setSaving(false);
    }
  };

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('trip.editingATrip')}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-float animate-pop w-full max-w-lg space-y-4 rounded-panel p-6"
      >
        <div className="hairline-b flex items-start justify-between pb-4">
          <div>
            <h3 className="text-sm font-semibold text-txt-primary">{t('trip.editTheTrip')}</h3>
            <p className="font-mono text-micro text-txt-muted">{trip.id}</p>
          </div>
          <button onClick={onClose} className="btn-icon h-8 w-8" aria-label={t('common.close')}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-field border border-danger/25 bg-danger/10 p-3 text-2xs text-danger"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <label className="block">
          <span className="micro-label mb-1.5 block">{t('common.title')}</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="field"
          />
        </label>

        <label className="block">
          <span className="micro-label mb-1.5 block">{t('trip.notes')}</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="field resize-none"
          />
        </label>

        <label className="block">
          <span className="micro-label mb-1.5 block">{t('common.vehicle')}</span>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="field"
          >
            <option value="">{t('trip.unchanged')}</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.plate})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="micro-label mb-1.5 block">{t('common.driver')}</span>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="field"
          >
            <option value="">
              {t('trip.unchanged2')}{trip.driver_name ? t('trip.currently', { v0: trip.driver_name }) : ''} —
            </option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {driverDisplayName(d)}
              </option>
            ))}
          </select>
        </label>

        <p className="text-micro text-txt-muted">
          {t('trip.ruptelaAllowsChangingTitle')}
        </p>

        <div className="hairline-t flex justify-end gap-2 pt-4">
          <button onClick={onClose} className="btn btn-ghost">
            {t('trip.cancel')}
          </button>
          <button onClick={save} disabled={saving} className="btn btn-warn">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t('trip.saveToRuptela')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Delete ────────────────────────────────────────────────────────────── */

function DeleteTripDialog({
  trip,
  onClose,
  onDeleted,
}: {
  trip: RuptelaTrip;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const confirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await apiSend('DELETE', `/api/ruptela/trips/${trip.id}`);
      onDeleted(trip.id);
    } catch (err: any) {
      setError(err?.message ?? t('trip.couldNotDeleteTrip'));
      setDeleting(false);
    }
  };

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-float animate-pop w-full max-w-md space-y-4 rounded-panel p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-danger/10 text-danger">
            <Trash2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-txt-primary">{t('trip.deleteThisTripQuestion')}</h3>
            <p className="mt-1 text-2xs text-txt-secondary">
              «{trip.title}{t('trip.willPermanentlyDeletedRuptela')}
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-field border border-danger/25 bg-danger/10 p-3 text-2xs text-danger"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">
            {t('trip.cancel')}
          </button>
          <button
            onClick={confirm}
            disabled={deleting}
            className="btn bg-danger text-white hover:brightness-110"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t('trip.deletePermanently')}
          </button>
        </div>
      </div>
    </div>
  );
}
