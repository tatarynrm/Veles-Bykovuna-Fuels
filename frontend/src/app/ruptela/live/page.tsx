'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import RuptelaShell from '@/components/RuptelaShell';
import RuptelaVehicleSearchSelect from '@/components/RuptelaVehicleSearchSelect';
import { apiGet, apiList } from '@/lib/api';
import { useAuthGuard } from '@/lib/useAuthGuard';
import {
  NO_DATA,
  STATUS_LABEL,
  driverStateLabel,
  metric,
  relativeAge,
  type RuptelaTrackPoint,
  type RuptelaVehicle,
  type RuptelaVehicleTrack,
} from '@/lib/ruptela';
import {
  Activity,
  Crosshair,
  Fuel,
  Gauge,
  Locate,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  Route,
  Satellite,
  Thermometer,
  Timer,
  AlertTriangle,
  Truck,
  Zap,
} from 'lucide-react';

const RuptelaLiveTrackMap = dynamic(() => import('@/components/RuptelaLiveTrackMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full flex-col items-center justify-center gap-2 rounded-card border border-bdr-subtle bg-surface-inset lg:h-[520px]">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-bdr-strong border-t-warn" />
      <p className="text-2xs text-txt-muted">Ініціалізація карти треку…</p>
    </div>
  ),
});

/** Poll intervals offered to the dispatcher. 5 s is the working default. */
const INTERVALS = [3, 5, 10, 30] as const;

/** How far back the track is drawn. */
const WINDOWS = [
  { minutes: 15, label: '15 хв' },
  { minutes: 30, label: '30 хв' },
  { minutes: 60, label: '1 год' },
  { minutes: 180, label: '3 год' },
] as const;

/** Fallback window used when the vehicle reported nothing inside the chosen one. */
const WIDE_WINDOW_MINUTES = 24 * 60;

/** Buffer ceiling — a 3 h window on a busy tractor stays far below this. */
const MAX_POINTS = 1500;

/** A reading older than this is stale enough to say so out loud. */
const STALE_AFTER_MS = 15 * 60_000;

const LAST_VEHICLE_KEY = 'veles_live_vehicle';

export default function RuptelaLivePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-bdr-strong border-t-warn" />
        </div>
      }
    >
      <LiveWatchView />
    </Suspense>
  );
}

const clock = (iso: string | null | undefined) => {
  if (!iso) return NO_DATA;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? NO_DATA
    : d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

/** Great-circle distance in km between two fixes. */
function haversineKm(a: RuptelaTrackPoint, b: RuptelaTrackPoint): number {
  if (
    a.latitude === null ||
    a.longitude === null ||
    b.latitude === null ||
    b.longitude === null
  ) {
    return 0;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function LiveWatchView() {
  const { authenticated } = useAuthGuard();
  const searchParams = useSearchParams();

  const [vehicles, setVehicles] = useState<RuptelaVehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string>('');
  const [points, setPoints] = useState<RuptelaTrackPoint[]>([]);

  const [windowMinutes, setWindowMinutes] = useState<number>(30);
  const [intervalSec, setIntervalSec] = useState<number>(5);
  const [live, setLive] = useState(true);
  const [follow, setFollow] = useState(true);
  const [fitKey, setFitKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  /** Set when the chosen window was empty and the last 24 h were pulled instead. */
  const [widened, setWidened] = useState(false);
  /** Re-render clock so "оновлено N с тому" keeps counting between polls. */
  const [, setNowTick] = useState(0);

  // The polling callback must stay stable across ticks, so live values it needs
  // are mirrored into refs instead of becoming dependencies.
  const pointsRef = useRef<RuptelaTrackPoint[]>([]);
  const activeWindowRef = useRef<number>(windowMinutes);
  const inFlightRef = useRef(false);

  /* ── vehicle list (also refreshed so the picker's status dots stay honest) ── */
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;

    const load = async () => {
      const list = await apiList<RuptelaVehicle>('/api/ruptela/vehicles');
      if (!cancelled) setVehicles(list);
    };

    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [authenticated]);

  /* Preselect: ?vehicle= → last watched → first moving vehicle → first in list. */
  useEffect(() => {
    if (vehicleId || vehicles.length === 0) return;

    const requested = searchParams.get('vehicle');
    const remembered =
      typeof window !== 'undefined' ? window.localStorage.getItem(LAST_VEHICLE_KEY) : null;

    const pick =
      vehicles.find((v) => v.id === requested) ??
      vehicles.find((v) => v.id === remembered) ??
      vehicles.find((v) => v.status === 'moving') ??
      vehicles[0];

    if (pick) setVehicleId(pick.id);
  }, [vehicles, vehicleId, searchParams]);

  useEffect(() => {
    if (vehicleId && typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_VEHICLE_KEY, vehicleId);
    }
  }, [vehicleId]);

  /* ── the poll itself ────────────────────────────────────────────────────── */
  /**
   * `initial` pulls the whole window; `poll` asks only for records newer than the
   * one already held, so a 5 s tick transfers a couple of records rather than the
   * whole track. The API is inclusive on `from_datetime`, so the anchor record comes
   * back every time — points are keyed by datetime, which absorbs that.
   */
  const fetchTrack = useCallback(
    async (mode: 'initial' | 'poll') => {
      if (!vehicleId || !authenticated || inFlightRef.current) return;
      inFlightRef.current = true;
      setLoading(true);

      const newest = pointsRef.current[pointsRef.current.length - 1]?.datetime;
      const incremental = mode === 'poll' && Boolean(newest);

      try {
        let track = await apiGet<RuptelaVehicleTrack>(
          `/api/ruptela/vehicles/${vehicleId}/coordinates`,
          {
            from: incremental ? newest : undefined,
            minutes: incremental ? undefined : activeWindowRef.current,
            limit: MAX_POINTS,
          },
        );

        // A truck parked overnight has nothing inside a 30 min window. Widening once
        // shows its actual last position instead of an empty screen — and says so.
        let didWiden = false;
        if (
          mode === 'initial' &&
          track.error === null &&
          track.points.length === 0 &&
          activeWindowRef.current < WIDE_WINDOW_MINUTES
        ) {
          activeWindowRef.current = WIDE_WINDOW_MINUTES;
          track = await apiGet<RuptelaVehicleTrack>(
            `/api/ruptela/vehicles/${vehicleId}/coordinates`,
            { minutes: WIDE_WINDOW_MINUTES, limit: MAX_POINTS },
          );
          didWiden = track.points.length > 0;
        }

        setError(track.error);
        setFetchedAt(track.fetched_at);
        if (mode === 'initial') setWidened(didWiden);

        const cutoff = Date.now() - activeWindowRef.current * 60_000;
        const merged = new Map<string, RuptelaTrackPoint>(
          (mode === 'initial' ? [] : pointsRef.current).map((p) => [p.datetime, p]),
        );
        for (const p of track.points) merged.set(p.datetime, p);

        const next = Array.from(merged.values())
          .filter((p) => new Date(p.datetime).getTime() >= cutoff)
          .sort((a, b) => a.datetime.localeCompare(b.datetime))
          .slice(-MAX_POINTS);

        pointsRef.current = next;
        setPoints(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не вдалося отримати дані');
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    },
    [vehicleId, authenticated],
  );

  /* Vehicle or window changed → drop the buffer and reload from scratch. */
  useEffect(() => {
    if (!vehicleId) return;
    pointsRef.current = [];
    activeWindowRef.current = windowMinutes;
    setPoints([]);
    setWidened(false);
    setError(null);
    setFitKey((k) => k + 1);
    fetchTrack('initial');
  }, [vehicleId, windowMinutes, fetchTrack]);

  /* The live loop. */
  useEffect(() => {
    if (!vehicleId || !live) return;
    const id = setInterval(() => fetchTrack('poll'), intervalSec * 1000);
    return () => clearInterval(id);
  }, [vehicleId, live, intervalSec, fetchTrack]);

  /* 1 s clock so the freshness chip counts up between polls. */
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
  const latest = points.length > 0 ? points[points.length - 1] : null;

  const stats = useMemo(() => {
    let distanceKm = 0;
    for (let i = 1; i < points.length; i++) {
      distanceKm += haversineKm(points[i - 1], points[i]);
    }

    const speeds = points.map((p) => p.speed).filter((s): s is number => s !== null);
    const movingSpeeds = speeds.filter((s) => s > 5);
    const fuelReadings = points
      .map((p) => p.fuel_level_liters)
      .filter((f): f is number => f !== null);

    return {
      distanceKm,
      maxSpeed: speeds.length > 0 ? Math.max(...speeds) : null,
      avgMovingSpeed:
        movingSpeeds.length > 0
          ? movingSpeeds.reduce((a, b) => a + b, 0) / movingSpeeds.length
          : null,
      fuelDelta:
        fuelReadings.length > 1
          ? fuelReadings[fuelReadings.length - 1] - fuelReadings[0]
          : null,
      firstAt: points[0]?.datetime ?? null,
    };
  }, [points]);

  const latestAgeMs = latest ? Date.now() - new Date(latest.datetime).getTime() : null;
  const isStale = latestAgeMs !== null && latestAgeMs > STALE_AFTER_MS;
  const isMoving = (latest?.speed ?? 0) > 5;

  const windowLabel =
    activeWindowRef.current === WIDE_WINDOW_MINUTES
      ? '24 год'
      : (WINDOWS.find((w) => w.minutes === windowMinutes)?.label ?? `${windowMinutes} хв`);

  const kpis = [
    {
      label: 'Швидкість зараз',
      value: metric(latest?.speed ?? null, { unit: 'км/год' }),
      meta: `Макс. за ${windowLabel}: ${metric(stats.maxSpeed, { unit: 'км/год' })}`,
      icon: Gauge,
      tone: 'warn' as const,
    },
    {
      label: 'Пройдено за вікно',
      value: metric(stats.distanceKm, { unit: 'км', digits: 1 }),
      meta: `Середня в русі: ${metric(stats.avgMovingSpeed, { unit: 'км/год' })}`,
      icon: Route,
      tone: 'muted' as const,
    },
    {
      label: 'Пальне в баку',
      value: metric(latest?.fuel_level_liters ?? null, { unit: 'л', digits: 1 }),
      meta:
        stats.fuelDelta === null
          ? 'CAN не передає рівень'
          : `Зміна за вікно: ${stats.fuelDelta > 0 ? '+' : ''}${metric(stats.fuelDelta, { digits: 1 })} л`,
      icon: Fuel,
      tone: 'accent' as const,
    },
    {
      label: 'Точок у треку',
      value: metric(points.length),
      meta: stats.firstAt ? `Від ${clock(stats.firstAt)}` : 'Очікування даних',
      icon: Activity,
      tone: 'muted' as const,
    },
  ];

  const toneClass = {
    warn: 'bg-warn/10 text-warn',
    accent: 'bg-accent-soft text-accent',
    muted: 'bg-surface-hover text-txt-secondary',
  };

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-bdr-strong border-t-warn" />
      </div>
    );
  }

  return (
    <RuptelaShell
      title="Реальний час"
      subtitle="Історія координат Ruptela v2 · /objects/{id}/coordinates"
      status={
        !vehicleId ? null : live ? (
          <span className="badge badge-success">
            <span className="live-dot" />
            Кожні {intervalSec} с
          </span>
        ) : (
          <span className="badge badge-neutral">Паузу увімкнено</span>
        )
      }
      actions={
        <>
          <button
            onClick={() => setLive((v) => !v)}
            className={live ? 'btn btn-ghost' : 'btn btn-warn'}
            title={live ? 'Призупинити оновлення' : 'Відновити оновлення'}
          >
            {live ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{live ? 'Пауза' : 'Старт'}</span>
          </button>
          <button
            onClick={() => fetchTrack('poll')}
            className="btn btn-ghost"
            title="Оновити зараз"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-warn' : ''}`} />
            <span className="hidden sm:inline">Оновити</span>
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ── Controls ─────────────────────────────────────────────────── */}
        <section className="glass-panel p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <RuptelaVehicleSearchSelect
                vehicles={vehicles}
                selectedVehicleId={vehicleId}
                onSelectVehicle={(v) => setVehicleId(v.id)}
                label="Транспорт для спостереження"
              />
            </div>

            <div className="lg:col-span-4">
              <p className="micro-label mb-1.5">Період оновлення</p>
              <div className="segmented w-full">
                {INTERVALS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setIntervalSec(sec)}
                    aria-pressed={intervalSec === sec}
                    className={`segmented-item flex-1 ${
                      intervalSec === sec ? 'segmented-item-active text-warn' : ''
                    }`}
                  >
                    {sec} с
                  </button>
                ))}
              </div>

              <p className="micro-label mb-1.5 mt-3">Глибина треку</p>
              <div className="segmented w-full">
                {WINDOWS.map((w) => (
                  <button
                    key={w.minutes}
                    type="button"
                    onClick={() => setWindowMinutes(w.minutes)}
                    aria-pressed={windowMinutes === w.minutes}
                    className={`segmented-item flex-1 ${
                      windowMinutes === w.minutes ? 'segmented-item-active text-warn' : ''
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-between gap-2 lg:col-span-3">
              <div>
                <p className="micro-label mb-1.5">Карта</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFollow((v) => !v)}
                    aria-pressed={follow}
                    className={follow ? 'btn btn-warn' : 'btn btn-ghost'}
                    title="Тримати авто в центрі карти"
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    <span>Стеження</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFitKey((k) => k + 1)}
                    className="btn btn-ghost"
                    title="Показати весь трек"
                  >
                    <Locate className="h-3.5 w-3.5" />
                    <span>Весь трек</span>
                  </button>
                </div>
              </div>

              <dl className="glass-inset space-y-1 rounded-card p-3 text-2xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-txt-muted">Останній запит</dt>
                  <dd className="text-txt-secondary">{relativeAge(fetchedAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-txt-muted">Останній фікс</dt>
                  <dd className={isStale ? 'text-danger' : 'text-txt-secondary'}>
                    {relativeAge(latest?.datetime ?? null)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {(error || widened || isStale) && (
            <div className="mt-4 space-y-2">
              {error && (
                <p className="flex items-start gap-2 rounded-field border border-danger/30 bg-danger/10 px-3 py-2 text-2xs text-danger">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Ruptela API: {error}</span>
                </p>
              )}
              {widened && (
                <p className="flex items-start gap-2 rounded-field border border-warn/30 bg-warn/10 px-3 py-2 text-2xs text-warn">
                  <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    За обраний період даних немає — показано останні 24 години. Трекер
                    міг бути вимкнений.
                  </span>
                </p>
              )}
              {isStale && !widened && (
                <p className="flex items-start gap-2 rounded-field border border-bdr-subtle bg-surface-inset px-3 py-2 text-2xs text-txt-secondary">
                  <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Останній запис — {relativeAge(latest?.datetime ?? null)}. Пристрій не
                    передає нових координат.
                  </span>
                </p>
              )}
            </div>
          )}
        </section>

        {!vehicleId ? (
          <section className="glass-panel flex flex-col items-center justify-center gap-2 p-12 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-field bg-warn/10 text-warn">
              <Truck className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-txt-primary">
              Оберіть транспортний засіб
            </p>
            <p className="max-w-sm text-2xs text-txt-secondary">
              Після вибору сторінка почне опитувати Ruptela FMS і будувати трек у
              реальному часі.
            </p>
          </section>
        ) : (
          <>
            {/* ── KPIs ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {kpis.map((kpi, i) => {
                const Icon = kpi.icon;
                return (
                  <article
                    key={kpi.label}
                    className="glass-panel rise p-4"
                    style={{ '--d': `${i * 45}ms` } as React.CSSProperties}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="micro-label">{kpi.label}</span>
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control ${toneClass[kpi.tone]}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <p className="stat mt-2 text-2xl">{kpi.value}</p>
                    <p className="mt-1 text-micro text-txt-muted">{kpi.meta}</p>
                  </article>
                );
              })}
            </div>

            {/* ── Map + live telemetry ──────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <section className="glass-panel flex flex-col p-5 lg:col-span-8">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-txt-primary">
                      <MapPin className="h-4 w-4 text-warn" />
                      <span>Трек за {windowLabel}</span>
                    </h3>
                    <p className="truncate text-micro text-txt-secondary">
                      {vehicle
                        ? `${vehicle.name} · ${vehicle.plate || NO_DATA} · ${vehicle.driver_name ?? 'водія не призначено'}`
                        : 'Завантаження даних ТЗ…'}
                    </p>
                  </div>
                  <span className={`badge shrink-0 ${isMoving ? 'badge-success' : 'badge-neutral'}`}>
                    {isMoving && <span className="live-dot" />}
                    {vehicle ? STATUS_LABEL[vehicle.status] : NO_DATA}
                  </span>
                </div>

                <RuptelaLiveTrackMap
                  points={points}
                  plate={vehicle?.plate ?? ''}
                  follow={follow}
                  fitKey={fitKey}
                />

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniFact label="Широта" value={metric(latest?.latitude ?? null, { digits: 5 })} />
                  <MiniFact label="Довгота" value={metric(latest?.longitude ?? null, { digits: 5 })} />
                  <MiniFact label="Курс" value={metric(latest?.heading ?? null, { unit: '°' })} />
                  <MiniFact label="Висота" value={metric(latest?.altitude ?? null, { unit: 'м' })} />
                </div>
              </section>

              <section className="glass-panel flex flex-col gap-4 p-5 lg:col-span-4">
                <div className="hairline-b flex items-center justify-between gap-3 pb-3">
                  <h3 className="text-sm font-semibold text-txt-primary">Телеметрія CAN</h3>
                  <span className="tabular font-mono text-micro text-txt-muted">
                    {clock(latest?.datetime)}
                  </span>
                </div>

                <SpeedTrend points={points} />

                <div className="grid grid-cols-2 gap-3">
                  <MetricTile
                    label="Запалювання"
                    icon={<Zap className="h-3.5 w-3.5 text-warn" />}
                    value={
                      latest?.ignition === null || latest?.ignition === undefined
                        ? NO_DATA
                        : latest.ignition
                          ? 'УВІМК'
                          : 'ВИМК'
                    }
                    sub={`Оберти: ${metric(latest?.engine_rpm ?? null, { unit: 'об/хв' })}`}
                  />
                  <MetricTile
                    label="Рівень пального"
                    icon={<Fuel className="h-3.5 w-3.5 text-accent" />}
                    value={metric(latest?.fuel_level_percent ?? null, { unit: '%', digits: 1 })}
                    sub={`Витрата: ${metric(latest?.fuel_rate_lph ?? null, { unit: 'л/год', digits: 1 })}`}
                  />
                  <MetricTile
                    label="Пробіг CAN"
                    icon={<Route className="h-3.5 w-3.5 text-txt-secondary" />}
                    value={metric(latest?.odometer_km ?? null, { unit: 'км' })}
                    sub={`Мотогодини: ${metric(latest?.engine_hours ?? null, { unit: 'год' })}`}
                  />
                  <MetricTile
                    label="Температура ОЖ"
                    icon={<Thermometer className="h-3.5 w-3.5 text-info" />}
                    value={metric(latest?.coolant_temp ?? null, { unit: '°C' })}
                    sub={
                      latest?.coolant_temp === null || latest?.coolant_temp === undefined
                        ? 'Двигун заглушено — датчик мовчить'
                        : `Педаль: ${metric(latest?.pedal_position ?? null, { unit: '%' })}`
                    }
                  />
                  <MetricTile
                    label="Бортова напруга"
                    icon={<Zap className="h-3.5 w-3.5 text-warn" />}
                    value={metric(latest?.power_supply_voltage ?? null, { unit: 'В', digits: 2 })}
                    sub={`АКБ трекера: ${metric(latest?.device_battery_voltage ?? null, { unit: 'В', digits: 2 })}`}
                  />
                  <MetricTile
                    label="Якість звʼязку"
                    icon={<Satellite className="h-3.5 w-3.5 text-txt-secondary" />}
                    value={`${metric(latest?.satellites ?? null)} супут.`}
                    sub={`HDOP ${metric(latest?.hdop ?? null, { digits: 1 })} · GSM ${metric(latest?.gsm_signal ?? null)}`}
                  />
                </div>

                <dl className="glass-inset space-y-1.5 rounded-card p-3 text-2xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-txt-muted">Тахограф</dt>
                    <dd className="text-txt-secondary">
                      {driverStateLabel(latest?.driver_state ?? null)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-txt-muted">Тип поїздки</dt>
                    <dd className="text-txt-secondary">{latest?.trip_type ?? NO_DATA}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-txt-muted">IMEI трекера</dt>
                    <dd className="tabular font-mono text-txt-secondary">
                      {vehicle?.device_imei || NO_DATA}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>

            {/* ── Raw records ───────────────────────────────────────────── */}
            <section className="glass-panel p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-txt-primary">
                    Останні записи пристрою
                  </h3>
                  <p className="text-micro text-txt-secondary">
                    Кожен рядок — окремий запис Ruptela, найновіші зверху
                  </p>
                </div>
                <span className="badge badge-neutral">{points.length} зап.</span>
              </div>

              <div className="max-h-[420px] overflow-auto rounded-card border border-bdr-subtle">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Час</th>
                      <th className="num">Швидкість</th>
                      <th>Запалювання</th>
                      <th className="num">Оберти</th>
                      <th className="num">Пальне</th>
                      <th className="num">Пробіг</th>
                      <th className="num">Координати</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-2xs text-txt-muted">
                          {loading ? 'Завантаження треку…' : 'Немає записів за обраний період'}
                        </td>
                      </tr>
                    ) : (
                      [...points]
                        .reverse()
                        .slice(0, 60)
                        .map((p) => (
                          <tr key={p.datetime}>
                            <td className="tabular font-mono text-txt-primary">
                              {clock(p.datetime)}
                            </td>
                            <td className="num text-txt-primary">
                              {metric(p.speed, { unit: 'км/год' })}
                            </td>
                            <td>
                              {p.ignition === null ? (
                                <span className="text-txt-muted">{NO_DATA}</span>
                              ) : (
                                <span className={`badge ${p.ignition ? 'badge-warn' : 'badge-neutral'}`}>
                                  {p.ignition ? 'УВІМК' : 'ВИМК'}
                                </span>
                              )}
                            </td>
                            <td className="num text-txt-secondary">{metric(p.engine_rpm)}</td>
                            <td className="num text-accent">
                              {metric(p.fuel_level_liters, { unit: 'л', digits: 1 })}
                            </td>
                            <td className="num text-txt-secondary">
                              {metric(p.odometer_km, { unit: 'км' })}
                            </td>
                            <td className="num font-mono text-micro text-txt-muted">
                              {p.latitude === null || p.longitude === null
                                ? NO_DATA
                                : `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </RuptelaShell>
  );
}

/* ── small building blocks ─────────────────────────────────────────────── */

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-inset rounded-field px-3 py-2">
      <p className="micro-label">{label}</p>
      <p className="tabular mt-0.5 truncate font-mono text-2xs text-txt-primary">{value}</p>
    </div>
  );
}

function MetricTile({
  label,
  icon,
  value,
  sub,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  sub: string;
}) {
  return (
    <div className="glass-inset rounded-card p-3">
      <div className="micro-label mb-1 flex items-center justify-between gap-2">
        <span className="truncate">{label}</span>
        {icon}
      </div>
      <div className="tabular text-lg font-semibold text-txt-primary">{value}</div>
      <div className="mt-0.5 truncate text-micro text-txt-muted">{sub}</div>
    </div>
  );
}

/**
 * Speed over the buffered window. Colors come from `currentColor` so the line
 * follows the theme; a flat baseline is drawn when the device reported no speed.
 */
function SpeedTrend({ points }: { points: RuptelaTrackPoint[] }) {
  const values = points.map((p) => p.speed).filter((s): s is number => s !== null);

  const path = useMemo(() => {
    if (values.length < 2) return null;

    const width = 100;
    const height = 32;
    const max = Math.max(...values, 1);
    const step = width / (values.length - 1);

    const line = values
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${(height - (v / max) * height).toFixed(2)}`)
      .join(' ');

    return { line, area: `${line} L${width},${height} L0,${height} Z`, max };
  }, [values]);

  return (
    <div className="glass-inset rounded-card p-3 text-warn">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="micro-label">Динаміка швидкості</span>
        <span className="tabular font-mono text-micro text-txt-muted">
          {path ? `макс ${Math.round(path.max)} км/год` : NO_DATA}
        </span>
      </div>

      {path ? (
        <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-10 w-full" role="img"
             aria-label="Графік швидкості за обраний період">
          <path d={path.area} fill="currentColor" opacity="0.14" />
          <path
            d={path.line}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <p className="py-3 text-center text-micro text-txt-muted">
          Недостатньо записів для графіка
        </p>
      )}
    </div>
  );
}
