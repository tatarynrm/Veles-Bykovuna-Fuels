'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import RuptelaShell from '@/components/RuptelaShell';
import { apiGet, apiList, apiObject } from '@/lib/api';
import {
  NO_DATA,
  STATUS_LABEL,
  driverStateLabel,
  metric,
  relativeAge,
  type RuptelaStatus,
  type RuptelaTripHistoryItem,
  type RuptelaVehicle,
} from '@/lib/ruptela';
import {
  Truck,
  Gauge,
  Fuel,
  Thermometer,
  Zap,
  MapPin,
  Compass,
  Satellite,
  PlusCircle,
  Search,
  RefreshCw,
  UserCheck,
  Activity,
  History,
  X,
  Route,
  Radio,
} from 'lucide-react';

const RuptelaFleetMap = dynamic(() => import('@/components/RuptelaFleetMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] w-full flex-col items-center justify-center gap-2 rounded-card border border-bdr-subtle bg-surface-inset">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-bdr-strong border-t-warn" />
      <p className="text-2xs text-txt-muted">Ініціалізація карти Ruptela GPS…</p>
    </div>
  ),
});

interface ApiStatus {
  isLiveConnected: boolean;
  vehiclesInSnapshot: number;
  snapshotAgeSeconds: number | null;
  driversResolved: number;
  lastError: string | null;
}

export default function RuptelaFleetPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<RuptelaVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RuptelaStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);

  // Trip history modal
  const [historyVehicle, setHistoryVehicle] = useState<RuptelaVehicle | null>(null);
  const [tripHistory, setTripHistory] = useState<RuptelaTripHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const [data, status] = await Promise.all([
        apiGet<RuptelaVehicle[]>('/api/ruptela/vehicles'),
        apiObject<ApiStatus>('/api/ruptela/status'),
      ]);
      setVehicles(Array.isArray(data) ? data : []);
      setApiStatus(status);
    } catch (err) {
      console.error('Error fetching Ruptela telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  // Poll faster while something is actually moving.
  const isAnyMoving = vehicles.some((v) => v.status === 'moving');
  const pollIntervalMs = isAnyMoving ? 5000 : 15000;

  useEffect(() => {
    const interval = setInterval(fetchVehicles, pollIntervalMs);
    return () => clearInterval(interval);
  }, [pollIntervalMs, fetchVehicles]);

  // Track the selection by id so polling keeps the panel on live data.
  const selectedVehicle =
    vehicles.find((v) => v.id === selectedId) ?? vehicles[0] ?? null;

  const handleOpenHistory = async (v: RuptelaVehicle) => {
    setHistoryVehicle(v);
    setLoadingHistory(true);
    setTripHistory(await apiList<RuptelaTripHistoryItem>(`/api/ruptela/vehicles/${v.id}/trips`));
    setLoadingHistory(false);
  };

  const filteredVehicles = vehicles.filter((v) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      v.name.toLowerCase().includes(q) ||
      v.plate.toLowerCase().includes(q) ||
      (v.driver_name ?? '').toLowerCase().includes(q) ||
      (v.driver_card ?? '').toLowerCase().includes(q) ||
      (v.vin ?? '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const countBy = (s: RuptelaStatus) => vehicles.filter((v) => v.status === s).length;

  // Only sum vehicles that actually reported a fuel level — never treat a missing
  // reading as a zero-litre tank.
  const fuelReadings = vehicles.filter((v) => v.telemetry.fuel_level_liters !== null);
  const totalFuelLiters = fuelReadings.reduce(
    (acc, v) => acc + (v.telemetry.fuel_level_liters ?? 0),
    0,
  );

  const kpis = [
    {
      label: "Обʼєкти в Ruptela",
      value: metric(vehicles.length),
      unit: 'ТЗ',
      meta: apiStatus?.isLiveConnected === false ? 'Немає звʼязку з API' : 'fm-track підключено',
      icon: Truck,
      tone: 'warn' as const,
    },
    {
      label: 'В русі',
      value: metric(countBy('moving')),
      unit: 'авто',
      meta: `Опитування кожні ${pollIntervalMs / 1000}с`,
      icon: Activity,
      tone: 'accent' as const,
    },
    {
      label: 'Холостий хід / стоянка',
      value: metric(countBy('idle') + countBy('stopped')),
      unit: 'авто',
      meta: `${countBy('idle')} ХХ · ${countBy('stopped')} заглушено · ${countBy('offline')} без звʼязку`,
      icon: Compass,
      tone: 'muted' as const,
    },
    {
      label: 'Запас пального у баках',
      value: metric(Math.round(totalFuelLiters)),
      unit: 'л',
      meta: `CAN-дані з ${fuelReadings.length} із ${vehicles.length} ТЗ`,
      icon: Fuel,
      tone: 'accent' as const,
    },
  ];

  const toneClass = {
    warn: 'bg-warn/10 text-warn',
    accent: 'bg-accent-soft text-accent',
    muted: 'bg-surface-hover text-txt-secondary',
  };

  const statusBadgeClass = (s: RuptelaStatus) =>
    s === 'moving'
      ? 'bg-accent/10 text-accent border-bdr-highlight'
      : s === 'idle'
        ? 'bg-warn/10 text-warn border-warn/30'
        : s === 'offline'
          ? 'bg-danger/10 text-danger border-danger/30'
          : 'bg-surface-hover text-txt-secondary border-bdr-subtle';

  return (
    <RuptelaShell
      title="Мій автопарк"
      subtitle="Пряма телеметрія Ruptela GPS · api.fm-track.com"
      status={
        isAnyMoving ? (
          <span className="badge badge-success">
            <span className="live-dot" />
            Оновлення 5с
          </span>
        ) : (
          <span className="badge badge-neutral">Оновлення 15с</span>
        )
      }
      actions={
        <>
          <button onClick={fetchVehicles} className="btn btn-ghost">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-warn' : ''}`} />
            <span className="hidden sm:inline">Оновити</span>
          </button>
          <Link href="/ruptela/create-trip" className="btn btn-warn">
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Нова поїздка</span>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {/* KPI Cards */}
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
                <p className="stat mt-2 text-2xl">
                  {kpi.value}
                  <span className="ml-1 text-xs font-normal text-txt-muted">{kpi.unit}</span>
                </p>
                <p className="mt-1 text-micro text-txt-muted">{kpi.meta}</p>
              </article>
            );
          })}
        </div>

        {/* Map + telemetry detail */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="glass-panel flex min-h-[420px] flex-col justify-between p-5 lg:col-span-7">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-txt-primary">
                  <MapPin className="h-4 w-4 text-warn" />
                  <span>Карта дислокації транспорту</span>
                </h3>
                <p className="text-micro text-txt-secondary">
                  Позиції {filteredVehicles.length} ТЗ за останнім GPS-фіксом
                </p>
              </div>
              <span className="badge badge-neutral">
                <span className="live-dot" />
                GPS Live
              </span>
            </div>

            <RuptelaFleetMap
              vehicles={filteredVehicles}
              selectedVehicle={selectedVehicle}
              onSelectVehicle={(v) => setSelectedId(v.id)}
              onCreateTrip={(vehicleId) => router.push(`/ruptela/create-trip?vehicleId=${vehicleId}`)}
            />

            <p className="mt-3 text-micro text-txt-secondary">
              Натисніть маркер авто для детальної телеметрії CAN
            </p>
          </div>

          {/* Telemetry detail */}
          <div className="glass-panel flex flex-col p-5 lg:col-span-5">
            {selectedVehicle ? (
              <div className="space-y-4">
                <div className="hairline-b flex items-start justify-between gap-3 pb-3">
                  <div className="min-w-0">
                    <span className="badge badge-warn font-mono">{selectedVehicle.plate || NO_DATA}</span>
                    <h4 className="mt-1 truncate text-base font-semibold text-txt-primary">
                      {selectedVehicle.name}
                    </h4>
                    <p className="text-micro text-txt-secondary">
                      {selectedVehicle.type || NO_DATA} · {selectedVehicle.fuel_type ?? NO_DATA}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider ${statusBadgeClass(selectedVehicle.status)}`}
                  >
                    {STATUS_LABEL[selectedVehicle.status]}
                  </span>
                </div>

                {/* Driver — resolved from the vehicle's last trip; the API supplies no phone number */}
                <div className="glass-inset flex items-center justify-between gap-3 rounded-card p-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-warn/10 text-warn">
                      <UserCheck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-txt-primary">
                        {selectedVehicle.driver_name ?? 'Водія не призначено'}
                      </div>
                      <div className="text-2xs text-txt-secondary">
                        Тахограф: {driverStateLabel(selectedVehicle.driver_state)}
                      </div>
                    </div>
                  </div>
                  <span className="tabular shrink-0 rounded-control border border-bdr-subtle bg-surface-inset px-2 py-1 font-mono text-2xs text-txt-secondary">
                    {selectedVehicle.driver_card ?? NO_DATA}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MetricTile
                    label="Швидкість GPS"
                    icon={<Gauge className="h-3.5 w-3.5 text-warn" />}
                    value={metric(selectedVehicle.telemetry.speed, { unit: 'км/год' })}
                    sub={`Оберти: ${metric(selectedVehicle.telemetry.engine_rpm, { unit: 'об/хв' })}`}
                  />

                  <div className="glass-inset rounded-card p-3">
                    <div className="micro-label mb-1 flex items-center justify-between">
                      <span>Рівень пального</span>
                      <Fuel className="h-3.5 w-3.5 text-accent" />
                    </div>
                    <div className="tabular text-lg font-semibold text-accent">
                      {metric(selectedVehicle.telemetry.fuel_level_percent, { unit: '%', digits: 1 })}
                    </div>
                    <div className="tabular mt-0.5 text-2xs text-txt-muted">
                      {metric(selectedVehicle.telemetry.fuel_level_liters, { unit: 'л', digits: 1 })}
                    </div>
                    {selectedVehicle.telemetry.fuel_level_percent !== null && (
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-500"
                          style={{ width: `${selectedVehicle.telemetry.fuel_level_percent}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <MetricTile
                    label="Пробіг CAN"
                    icon={<Route className="h-3.5 w-3.5 text-txt-secondary" />}
                    value={metric(selectedVehicle.telemetry.odometer_km, { unit: 'км' })}
                    sub={`Мотогодини: ${metric(selectedVehicle.telemetry.engine_hours, { unit: 'год' })}`}
                  />

                  <MetricTile
                    label="Бортова напруга"
                    icon={<Zap className="h-3.5 w-3.5 text-warn" />}
                    value={metric(selectedVehicle.telemetry.power_supply_voltage, {
                      unit: 'В',
                      digits: 2,
                    })}
                    sub={
                      selectedVehicle.telemetry.ignition === null
                        ? 'Запалювання: немає даних'
                        : selectedVehicle.telemetry.ignition
                          ? 'Запалювання УВІМК'
                          : 'Запалювання ВИМК'
                    }
                  />

                  <MetricTile
                    label="Температура ОЖ"
                    icon={<Thermometer className="h-3.5 w-3.5 text-info" />}
                    value={metric(selectedVehicle.telemetry.coolant_temp, { unit: '°C' })}
                    sub={
                      selectedVehicle.telemetry.coolant_temp === null
                        ? 'Двигун заглушено — датчик мовчить'
                        : `Витрата: ${metric(selectedVehicle.telemetry.fuel_rate_lph, { unit: 'л/год', digits: 1 })}`
                    }
                  />

                  <MetricTile
                    label="Якість звʼязку"
                    icon={<Satellite className="h-3.5 w-3.5 text-txt-secondary" />}
                    value={`${metric(selectedVehicle.telemetry.satellites)} супут.`}
                    sub={`HDOP ${metric(selectedVehicle.telemetry.hdop, { digits: 1 })} · GSM ${metric(selectedVehicle.telemetry.gsm_signal)}`}
                  />
                </div>

                {/* Identity + freshness — makes it obvious how old the reading is */}
                <dl className="glass-inset space-y-1.5 rounded-card p-3 text-2xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-txt-muted">VIN</dt>
                    <dd className="tabular font-mono text-txt-secondary">{selectedVehicle.vin ?? NO_DATA}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-txt-muted">IMEI трекера</dt>
                    <dd className="tabular font-mono text-txt-secondary">
                      {selectedVehicle.device_imei || NO_DATA}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-txt-muted">Останній GPS-фікс</dt>
                    <dd className="text-txt-secondary">
                      {relativeAge(selectedVehicle.telemetry.gps_datetime)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-txt-muted">Останній CAN-запис</dt>
                    <dd className="text-txt-secondary">
                      {relativeAge(selectedVehicle.telemetry.can_datetime)}
                    </dd>
                  </div>
                </dl>

                <Link
                  href={`/ruptela/live?vehicle=${selectedVehicle.id}`}
                  className="btn btn-warn w-full"
                >
                  <Radio className="h-4 w-4" />
                  <span>Спостерігати в реальному часі</span>
                </Link>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleOpenHistory(selectedVehicle)} className="btn btn-ghost">
                    <History className="h-4 w-4" />
                    <span>Історія поїздок</span>
                  </button>
                  <button
                    onClick={() => router.push(`/ruptela/create-trip?vehicleId=${selectedVehicle.id}`)}
                    className="btn btn-ghost"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>Створити поїздку</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-txt-muted">
                {loading ? 'Завантаження телеметрії…' : 'Дані з Ruptela API не отримано'}
              </div>
            )}
          </div>
        </div>

        {/* Vehicle list */}
        <div className="glass-panel space-y-4 p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-txt-primary">
                <Truck className="h-4 w-4 text-warn" />
                <span>Перелік обʼєктів автопарку ({filteredVehicles.length})</span>
              </h3>
              <p className="text-micro text-txt-secondary">
                {apiStatus?.driversResolved !== undefined
                  ? `Водіїв визначено за останніми поїздками: ${apiStatus.driversResolved}`
                  : 'Пряме підключення до api.fm-track.com'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-txt-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Пошук авто / водія / картки…"
                  className="field w-48 pl-8 sm:w-60"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | RuptelaStatus)}
                className="field"
              >
                <option value="all">Усі статуси</option>
                <option value="moving">В русі</option>
                <option value="idle">Холостий хід</option>
                <option value="stopped">Заглушено</option>
                <option value="offline">Немає звʼязку</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table w-full text-left">
              <thead>
                <tr>
                  <th>Транспортний засіб</th>
                  <th>Держ. номер</th>
                  <th>Водій</th>
                  <th>Статус</th>
                  <th className="text-right">Швидкість</th>
                  <th className="text-right">Паливо (CAN)</th>
                  <th className="text-right">Пробіг</th>
                  <th className="text-right">Дії</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => setSelectedId(v.id)}
                    className={`cursor-pointer transition-colors hover:bg-surface-hover ${
                      selectedVehicle?.id === v.id ? 'bg-warn/10' : ''
                    }`}
                  >
                    <td>
                      <div className="font-medium text-txt-primary">{v.name}</div>
                      <div className="tabular text-2xs font-mono text-txt-muted">
                        IMEI: {v.device_imei || NO_DATA}
                      </div>
                    </td>
                    <td className="tabular font-mono font-semibold text-warn">{v.plate || NO_DATA}</td>
                    <td>
                      <div className="text-txt-secondary">{v.driver_name ?? NO_DATA}</div>
                      <div className="tabular text-2xs font-mono text-txt-muted">
                        {v.driver_card ?? NO_DATA}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`rounded-control border px-2 py-0.5 text-2xs font-semibold uppercase ${statusBadgeClass(v.status)}`}
                      >
                        {STATUS_LABEL[v.status]}
                      </span>
                    </td>
                    <td className="tabular text-right text-txt-primary">
                      {metric(v.telemetry.speed, { unit: 'км/год' })}
                    </td>
                    <td className="tabular text-right">
                      <div className="font-medium text-accent">
                        {metric(v.telemetry.fuel_level_percent, { unit: '%', digits: 1 })}
                      </div>
                      <div className="text-2xs text-txt-muted">
                        {metric(v.telemetry.fuel_level_liters, { unit: 'л', digits: 0 })}
                      </div>
                    </td>
                    <td className="tabular text-right text-txt-secondary">
                      {metric(v.telemetry.odometer_km, { unit: 'км' })}
                    </td>
                    <td className="space-x-1 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenHistory(v);
                        }}
                        className="btn btn-ghost btn-sm"
                      >
                        Історія
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/ruptela/create-trip?vehicleId=${v.id}`);
                        }}
                        className="btn btn-warn btn-sm"
                      >
                        + Поїздка
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredVehicles.length === 0 && (
              <p className="py-10 text-center text-sm text-txt-muted">
                {loading ? 'Завантаження…' : 'Жодного ТЗ не знайдено за цим фільтром'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Trip history — GET /objects/{objectId}/trips?version=1 */}
      {historyVehicle && (
        <div
          className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setHistoryVehicle(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-float animate-pop flex max-h-[85vh] w-full max-w-4xl flex-col space-y-4 rounded-panel p-6"
          >
            <div className="hairline-b flex items-start justify-between pb-3">
              <div>
                <span className="badge badge-warn font-mono">{historyVehicle.plate}</span>
                <h3 className="mt-1 text-base font-semibold text-txt-primary">
                  Історія поїздок: {historyVehicle.name}
                </h3>
                <p className="text-micro text-txt-secondary">
                  Дані Ruptela за останні 14 днів
                </p>
              </div>
              <button onClick={() => setHistoryVehicle(null)} className="btn btn-icon btn-ghost">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 text-sm text-txt-secondary">
                  <span className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-bdr-strong border-t-warn" />
                  <span>Завантаження історії поїздок…</span>
                </div>
              ) : tripHistory.length === 0 ? (
                <p className="py-12 text-center text-sm text-txt-muted">
                  Історії поїздок за останні 14 днів не знайдено для цього ТЗ.
                </p>
              ) : (
                tripHistory.map((trip) => (
                  <div key={trip.id} className="glass-inset space-y-2 rounded-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="badge badge-warn font-mono">{trip.trip_type}</span>
                      <div className="tabular flex flex-wrap items-center gap-3 text-2xs text-txt-secondary">
                        <span>
                          Тривалість:{' '}
                          <strong className="text-txt-primary">
                            {metric(trip.duration_minutes, { unit: 'хв' })}
                          </strong>
                        </span>
                        <span>
                          Пробіг:{' '}
                          <strong className="text-txt-primary">
                            {metric(trip.mileage_km, { unit: 'км', digits: 1 })}
                          </strong>
                        </span>
                        <span>
                          Пальне:{' '}
                          <strong className="text-accent">
                            {metric(trip.fuel_consumed_liters, { unit: 'л', digits: 1 })}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                      <div className="rounded-control border border-bdr-subtle p-2.5">
                        <div className="micro-label mb-0.5 text-warn">Початок</div>
                        <div className="text-xs font-medium text-txt-primary">{trip.start_address}</div>
                        <div className="tabular mt-1 text-2xs text-txt-secondary">
                          {trip.start_time ? new Date(trip.start_time).toLocaleString('uk-UA') : NO_DATA}
                        </div>
                      </div>

                      <div className="rounded-control border border-bdr-subtle p-2.5">
                        <div className="micro-label mb-0.5 text-accent">Кінець</div>
                        <div className="text-xs font-medium text-txt-primary">{trip.end_address}</div>
                        <div className="tabular mt-1 text-2xs text-txt-secondary">
                          {trip.end_time ? new Date(trip.end_time).toLocaleString('uk-UA') : NO_DATA}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hairline-t flex justify-end pt-3">
              <button onClick={() => setHistoryVehicle(null)} className="btn btn-ghost">
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </RuptelaShell>
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
      <div className="micro-label mb-1 flex items-center justify-between">
        <span>{label}</span>
        {icon}
      </div>
      <div className="tabular text-lg font-semibold text-txt-primary">{value}</div>
      <div className="mt-0.5 text-2xs text-txt-muted">{sub}</div>
    </div>
  );
}
