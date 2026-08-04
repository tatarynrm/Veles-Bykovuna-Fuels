'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import RuptelaShell from '@/components/RuptelaShell';
import { AuthGate } from '@/components/PageShell';
import ExportDropdown from '@/components/ExportDropdown';
import MultiSelect from '@/components/ui/MultiSelect';
import GaugeRing from '@/components/ui/GaugeRing';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { usePersistentState } from '@/lib/usePersistentState';
import { apiGet, apiSend, API_BASE } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  Fuel,
  AlertTriangle,
  Leaf,
  Users,
  MapPin,
  Globe2,
  Link2,
  Library,
  HardDriveDownload,
  Loader2,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  ArrowDownRight,
  ArrowUpRight,
  LogIn,
  LogOut,
  SearchX,
  Download,
  CalendarClock,
} from 'lucide-react';

/* ══════════════════════ shared plumbing ══════════════════════ */

interface VehicleOption {
  id: string;
  name: string;
  plate: string;
}

interface Driver {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  identifiers?: Array<{ identifier: string; type: string }>;
}

type TabKey =
  | 'fuel'
  | 'events'
  | 'eco'
  | 'drivers'
  | 'geozones'
  | 'countries'
  | 'tacho'
  | 'share'
  | 'registry';

const TABS: Array<{ key: TabKey; label: string; icon: React.ElementType }> = [
  { key: 'fuel', label: 'Паливні події', icon: Fuel },
  { key: 'events', label: 'Події', icon: AlertTriangle },
  { key: 'eco', label: 'Еко-водіння', icon: Leaf },
  { key: 'drivers', label: 'Водії', icon: Users },
  { key: 'geozones', label: 'Геозони', icon: MapPin },
  { key: 'countries', label: 'Країни', icon: Globe2 },
  { key: 'tacho', label: 'Тахограф', icon: HardDriveDownload },
  { key: 'share', label: 'Посилання', icon: Link2 },
  { key: 'registry', label: 'Довідники', icon: Library },
];

/* ── period presets ── */

type PresetKey = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'prevMonth' | 'quarter';

const PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: 'today', label: 'Сьогодні' },
  { key: 'yesterday', label: 'Вчора' },
  { key: '7d', label: '7 днів' },
  { key: '30d', label: '30 днів' },
  { key: 'month', label: 'Цей місяць' },
  { key: 'prevMonth', label: 'Минулий місяць' },
  { key: 'quarter', label: 'Квартал' },
];

function presetRange(key: PresetKey): { from: Date; to: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const from = startOfDay(now);
  const to = new Date(now);

  switch (key) {
    case 'today':
      return { from, to };
    case 'yesterday': {
      const y = new Date(from);
      y.setDate(y.getDate() - 1);
      return { from: y, to: from };
    }
    case '7d': {
      const f = new Date(from);
      f.setDate(f.getDate() - 7);
      return { from: f, to };
    }
    case '30d': {
      const f = new Date(from);
      f.setDate(f.getDate() - 30);
      return { from: f, to };
    }
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
    case 'prevMonth':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 1),
      };
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      return { from: new Date(now.getFullYear(), q * 3, 1), to };
    }
  }
}

const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toIso = (local: string) => (local ? new Date(local).toISOString() : '');

const fmtDuration = (seconds?: number | null) => {
  if (!seconds || !Number.isFinite(seconds)) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h} год ${m} хв` : `${m} хв`;
};

const fmtNum = (n?: number | null, digits = 1) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? '—'
    : new Intl.NumberFormat('uk-UA', { maximumFractionDigits: digits }).format(n);

const osmLink = (lat?: number | null, lon?: number | null) =>
  lat != null && lon != null
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`
    : null;

const driverName = (drivers: Driver[], id?: string | null) => {
  if (!id) return '—';
  const d = drivers.find((x) => x.id === id);
  return d ? `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || id : id;
};

/**
 * Per-object reports (fuel, events, eco, countries) accept ONE object id —
 * multi-vehicle mode fans out one request per vehicle and merges the rows.
 */
async function perVehicle<T>(
  ids: string[],
  fetchOne: (id: string) => Promise<T>,
): Promise<Array<{ vehicleId: string; result: T | null }>> {
  return Promise.all(
    ids.map(async (vehicleId) => {
      try {
        return { vehicleId, result: await fetchOne(vehicleId) };
      } catch {
        // One dead vehicle must not sink the whole report — its rows are
        // simply absent; the tab-level error state covers the all-failed case.
        return { vehicleId, result: null };
      }
    }),
  );
}

function useReport<T>(load: (() => Promise<T>) | null, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!load) return;
    let alive = true;
    setLoading(true);
    setError(null);
    load()
      .then((d) => alive && setData(d))
      .catch((e: any) => alive && setError(e?.message ?? 'Помилка запиту'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}

function ReportState({
  loading,
  error,
  empty,
  emptyText,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyText: string;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-2xs text-txt-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Запит до Ruptela FMS…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <AlertTriangle className="h-5 w-5 text-danger" />
        <p className="max-w-md text-center text-2xs text-txt-secondary">{error}</p>
        <button type="button" onClick={onRetry} className="btn btn-ghost">
          <RefreshCw className="h-3.5 w-3.5" />
          Повторити
        </button>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex flex-col items-center gap-2 py-12">
        <SearchX className="h-5 w-5 text-txt-muted" />
        <p className="text-2xs text-txt-muted">{emptyText}</p>
      </div>
    );
  }
  return null;
}

/** Header row shared by report sections: title, badges, export, source note. */
function ReportHeader({
  title,
  children,
  exportData,
  exportColumns,
  exportName,
  note,
}: {
  title: string;
  children?: React.ReactNode;
  exportData?: () => any[];
  exportColumns?: Array<{ label: string; key: string }>;
  exportName?: string;
  note?: string;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-bdr-subtle px-4 py-3">
      <h2 className="text-sm font-semibold text-txt-primary">{title}</h2>
      {children}
      <div className="ml-auto flex items-center gap-3">
        {note && <p className="hidden text-micro text-txt-muted lg:block">{note}</p>}
        {exportData && (
          <ExportDropdown
            data={exportData}
            options={{
              filename: `${exportName ?? 'report'}_${new Date().toISOString().slice(0, 10)}`,
              title,
              subtitle: 'VELES ERP · дані Ruptela fm-track',
              columns: exportColumns,
            }}
          />
        )}
      </div>
    </header>
  );
}

/* ══════════════════════ page ══════════════════════ */

export default function RuptelaInsightsPage() {
  const { authenticated } = useAuthGuard();

  // Filters survive a reload — a dispatcher's report setup is data entry too.
  const [tab, setTab] = usePersistentState<TabKey>('veles_insights_tab', 'fuel');
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [vehicleIds, setVehicleIds] = usePersistentState<string[]>('veles_insights_vehicles', []);
  const [preset, setPreset] = usePersistentState<PresetKey | 'custom'>(
    'veles_insights_preset',
    '7d',
  );
  const [fromLocal, setFromLocal] = usePersistentState('veles_insights_from', () =>
    toLocalInput(presetRange('7d').from),
  );
  const [toLocal, setToLocal] = usePersistentState('veles_insights_to', () =>
    toLocalInput(presetRange('7d').to),
  );
  const [drivers, setDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    if (!authenticated) return;
    apiGet<any[]>('/api/ruptela/vehicles')
      .then((list) => {
        const opts = (list ?? []).map((v) => ({ id: v.id, name: v.name, plate: v.plate }));
        setVehicles(opts);
        if (opts[0]) setVehicleIds((prev) => (prev.length ? prev : [opts[0].id]));
      })
      .catch(() => setVehicles([]));
    apiGet<{ items: Driver[] }>('/api/ruptela/insights/drivers')
      .then((r) => setDrivers(r.items ?? []))
      .catch(() => setDrivers([]));
  }, [authenticated]);

  const applyPreset = useCallback((key: PresetKey) => {
    const { from, to } = presetRange(key);
    setPreset(key);
    setFromLocal(toLocalInput(from));
    setToLocal(toLocalInput(to));
  }, []);

  const vehicleName = useCallback(
    (id: string) => {
      const v = vehicles.find((x) => x.id === id);
      return v ? v.name : id;
    },
    [vehicles],
  );

  if (!authenticated) return <AuthGate />;

  const from = toIso(fromLocal);
  const to = toIso(toLocal);
  const needsVehicles = !['drivers', 'tacho', 'share', 'registry'].includes(tab);
  const rangeReady = Boolean(from && to) && (!needsVehicles || vehicleIds.length > 0);

  const shared: TabProps = { vehicleIds, vehicles, from, to, drivers, vehicleName };

  return (
    <RuptelaShell
      title="Звіти FMS"
      subtitle="Прямі дані Ruptela fm-track: паливо, події, тахограф, геозони, кордони"
    >
      {/* Global report filters.
          backdrop-filter makes every glass panel its own stacking context, so
          the MultiSelect dropdown (z-50) cannot escape it — the panel itself
          must sit above the sibling sections below (and under the z-30 sticky
          header, which it never overlaps). */}
      <div className="glass-panel relative z-20 space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <span className="micro-label mb-1 block">Транспортні засоби</span>
            <MultiSelect
              options={vehicles.map((v) => ({ value: v.id, label: v.name, hint: v.plate }))}
              selected={vehicleIds}
              onChange={setVehicleIds}
              placeholder="Оберіть транспорт…"
              unit="ТЗ обрано"
              ariaLabel="Транспортні засоби для звіту"
            />
          </div>
          <label className="block">
            <span className="micro-label mb-1 block">Період від</span>
            <input
              type="datetime-local"
              value={fromLocal}
              onChange={(e) => {
                setFromLocal(e.target.value);
                setPreset('custom');
              }}
              className="field"
            />
          </label>
          <label className="block">
            <span className="micro-label mb-1 block">до</span>
            <input
              type="datetime-local"
              value={toLocal}
              min={fromLocal || undefined}
              onChange={(e) => {
                setToLocal(e.target.value);
                setPreset('custom');
              }}
              className="field"
            />
          </label>
        </div>

        {/* Period presets */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-txt-muted" aria-hidden="true" />
          <div className="segmented">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                aria-pressed={preset === p.key}
                className={`segmented-item ${preset === p.key ? 'segmented-item-active text-warn' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 overflow-x-auto" aria-label="Розділи звітів">
        <div className="segmented">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={tab === key ? 'page' : undefined}
              className={`segmented-item flex items-center gap-1.5 ${
                tab === key ? 'segmented-item-active text-warn' : ''
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${tab === key ? 'text-warn' : 'text-txt-muted'}`} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {!rangeReady ? (
        <div className="glass-panel p-6 text-center text-2xs text-txt-muted">
          Оберіть транспортний засіб і період, щоб побудувати звіт.
        </div>
      ) : (
        <>
          {tab === 'fuel' && <FuelEventsTab {...shared} />}
          {tab === 'events' && <DetectedEventsTab {...shared} />}
          {tab === 'eco' && <EcodrivingTab {...shared} />}
          {tab === 'drivers' && <DriversTab {...shared} />}
          {tab === 'geozones' && <GeozonesTab {...shared} />}
          {tab === 'countries' && <CountriesTab {...shared} />}
          {tab === 'tacho' && <TachoTab {...shared} />}
          {tab === 'share' && <ShareLinksTab {...shared} />}
          {tab === 'registry' && <RegistryTab />}
        </>
      )}
    </RuptelaShell>
  );
}

interface TabProps {
  vehicleIds: string[];
  vehicles: VehicleOption[];
  from: string;
  to: string;
  drivers: Driver[];
  vehicleName: (id: string) => string;
}

/* ══════════════════════ fuel events ══════════════════════ */

function FuelEventsTab({ vehicleIds, from, to, drivers, vehicleName }: TabProps) {
  const { data, loading, error, reload } = useReport(
    () =>
      perVehicle(vehicleIds, (id) =>
        apiGet<{ items: any[] }>('/api/ruptela/insights/fuel-events', {
          objectId: id,
          from,
          to,
        }),
      ),
    [vehicleIds.join(','), from, to],
  );

  const rows = useMemo(
    () =>
      (data ?? [])
        .flatMap((r) => (r.result?.items ?? []).map((e: any) => ({ ...e, vehicleId: r.vehicleId })))
        .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date))),
    [data],
  );

  const refuels = rows.filter((e) => e.event_type === 'REFUEL');
  const drains = rows.filter((e) => e.event_type !== 'REFUEL');

  const exportRows = () =>
    rows.map((e) => ({
      vehicle: vehicleName(e.vehicleId),
      type: e.event_type === 'REFUEL' ? 'Заправка' : 'Злив',
      start: formatDateTime(e.start_date),
      end: formatDateTime(e.end_date),
      level_start: e.fuel_level_start,
      level_end: e.fuel_level_end,
      volume: Math.abs(e.difference ?? 0),
      driver: driverName(drivers, e.driver_id),
    }));

  return (
    <section className="glass-panel overflow-hidden">
      <ReportHeader
        title="Заправки та зливи"
        exportData={exportRows}
        exportName="fuel_events"
        exportColumns={[
          { label: 'Транспорт', key: 'vehicle' },
          { label: 'Тип', key: 'type' },
          { label: 'Початок', key: 'start' },
          { label: 'Кінець', key: 'end' },
          { label: 'Рівень до, л', key: 'level_start' },
          { label: 'Рівень після, л', key: 'level_end' },
          { label: 'Обсяг, л', key: 'volume' },
          { label: 'Водій', key: 'driver' },
        ]}
        note="Джерело: датчик рівня палива"
      >
        <span className="badge badge-success">
          <ArrowUpRight className="h-3 w-3" /> {refuels.length} заправок ·{' '}
          {fmtNum(refuels.reduce((a, e) => a + (e.difference ?? 0), 0), 0)} л
        </span>
        {drains.length > 0 && (
          <span className="badge badge-danger">
            <ArrowDownRight className="h-3 w-3" /> {drains.length} зливів ·{' '}
            {fmtNum(Math.abs(drains.reduce((a, e) => a + (e.difference ?? 0), 0)), 0)} л
          </span>
        )}
      </ReportHeader>

      <ReportState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyText="За обраний період паливних подій не зафіксовано"
        onRetry={reload}
      />

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Транспорт</th>
                <th>Тип</th>
                <th>Початок</th>
                <th>Кінець</th>
                <th className="num">До, л</th>
                <th className="num">Після, л</th>
                <th className="num">Обсяг, л</th>
                <th>Водій</th>
                <th>Локація</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => {
                const refuel = e.event_type === 'REFUEL';
                const map = osmLink(e.latitude, e.longitude);
                return (
                  <tr key={i}>
                    <td className="font-medium text-txt-primary">{vehicleName(e.vehicleId)}</td>
                    <td>
                      <span className={`badge ${refuel ? 'badge-success' : 'badge-danger'}`}>
                        {refuel ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {refuel ? 'Заправка' : 'Злив'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">{formatDateTime(e.start_date)}</td>
                    <td className="whitespace-nowrap">{formatDateTime(e.end_date)}</td>
                    <td className="num">{fmtNum(e.fuel_level_start)}</td>
                    <td className="num">{fmtNum(e.fuel_level_end)}</td>
                    <td
                      className="num font-semibold"
                      style={{ color: refuel ? 'var(--accent)' : 'var(--danger)' }}
                    >
                      {refuel ? '+' : '−'}
                      {fmtNum(Math.abs(e.difference))}
                    </td>
                    <td>{driverName(drivers, e.driver_id)}</td>
                    <td>
                      {map ? (
                        <a
                          href={map}
                          target="_blank"
                          rel="noreferrer"
                          className="text-2xs text-warn hover:underline"
                        >
                          мапа ↗
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ══════════════════════ detected events ══════════════════════ */

function DetectedEventsTab({ vehicleIds, from, to, drivers, vehicleName }: TabProps) {
  const { data, loading, error, reload } = useReport(
    () =>
      perVehicle(vehicleIds, (id) =>
        apiGet<{ items: any[] }>('/api/ruptela/insights/detected-events', {
          objectId: id,
          from,
          to,
          limit: 200,
        }),
      ),
    [vehicleIds.join(','), from, to],
  );

  const rows = useMemo(
    () =>
      (data ?? [])
        .flatMap((r) => (r.result?.items ?? []).map((e: any) => ({ ...e, vehicleId: r.vehicleId })))
        .sort((a, b) => String(a.start?.datetime).localeCompare(String(b.start?.datetime))),
    [data],
  );

  const exportRows = () =>
    rows.map((e) => ({
      vehicle: vehicleName(e.vehicleId),
      name: e.name ?? e.description ?? '—',
      start: formatDateTime(e.start?.datetime),
      duration: fmtDuration(e.duration),
      speed: e.start?.speed ?? '',
      driver: driverName(drivers, e.driver_id),
    }));

  return (
    <section className="glass-panel overflow-hidden">
      <ReportHeader
        title="Зафіксовані події"
        exportData={exportRows}
        exportName="detected_events"
        exportColumns={[
          { label: 'Транспорт', key: 'vehicle' },
          { label: 'Подія', key: 'name' },
          { label: 'Початок', key: 'start' },
          { label: 'Тривалість', key: 'duration' },
          { label: 'Швидкість', key: 'speed' },
          { label: 'Водій', key: 'driver' },
        ]}
        note="Правила подій налаштовуються у fm-track"
      >
        <span className="badge badge-neutral">{rows.length}</span>
      </ReportHeader>

      <ReportState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyText="Подій за обраний період немає"
        onRetry={reload}
      />

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Транспорт</th>
                <th>Подія</th>
                <th>Початок</th>
                <th className="num">Тривалість</th>
                <th className="num">Швидкість, км/год</th>
                <th>Водій</th>
                <th>Локація</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => {
                const lat = e.start?.location?.latitude ?? e.start?.location?.lat;
                const lon = e.start?.location?.longitude ?? e.start?.location?.lon;
                const map = osmLink(lat, lon);
                return (
                  <tr key={i}>
                    <td className="font-medium text-txt-primary">{vehicleName(e.vehicleId)}</td>
                    <td>{e.name ?? e.description ?? '—'}</td>
                    <td className="whitespace-nowrap">{formatDateTime(e.start?.datetime)}</td>
                    <td className="num">{fmtDuration(e.duration)}</td>
                    <td className="num">{fmtNum(e.start?.speed, 0)}</td>
                    <td>{driverName(drivers, e.driver_id)}</td>
                    <td>
                      {map ? (
                        <a
                          href={map}
                          target="_blank"
                          rel="noreferrer"
                          className="text-2xs text-warn hover:underline"
                        >
                          мапа ↗
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ══════════════════════ ecodriving ══════════════════════ */

function EcodrivingTab({ vehicleIds, from, to, vehicleName }: TabProps) {
  const { data, loading, error, reload } = useReport(
    () =>
      perVehicle(vehicleIds, (id) =>
        apiGet<any>(`/api/ruptela/insights/ecodriving/object/${id}`, { from, to }),
      ),
    [vehicleIds.join(','), from, to],
  );

  const results = (data ?? []).filter((r) => r.result?.parameters?.main_parameters);
  const single = results.length === 1 ? results[0] : null;

  const exportRows = () =>
    results.map((r) => {
      const p = r.result.parameters;
      const m = p.main_parameters;
      return {
        vehicle: vehicleName(r.vehicleId),
        total_score: m?.total_score,
        speed_score: p?.speed_parameters?.speed_score,
        idling_score: p?.idling_parameters?.idling_score,
        engine_score: p?.engine_parameters?.engine_score,
        distance: m?.distance,
        fuel: m?.fuel_consumed_count,
        rate: m?.fuel_consumption_rate,
        overspeed_pct: p?.speed_parameters?.overspeeding_percentage,
        idling: fmtDuration(p?.idling_parameters?.idling_duration),
        co2: m?.co2_emission,
      };
    });

  const exportColumns = [
    { label: 'Транспорт', key: 'vehicle' },
    { label: 'Заг. бал', key: 'total_score' },
    { label: 'Швидкість', key: 'speed_score' },
    { label: 'Хол. хід', key: 'idling_score' },
    { label: 'Двигун', key: 'engine_score' },
    { label: 'Пробіг, км', key: 'distance' },
    { label: 'Пальне, л', key: 'fuel' },
    { label: 'л/100км', key: 'rate' },
    { label: 'Перевищ., %', key: 'overspeed_pct' },
    { label: 'Хол. хід, час', key: 'idling' },
    { label: 'CO₂, кг', key: 'co2' },
  ];

  return (
    <section className="glass-panel overflow-hidden">
      <ReportHeader
        title="Еко-водіння за період"
        exportData={exportRows}
        exportName="ecodriving"
        exportColumns={exportColumns}
        note="Бали 0–100; більше — краще"
      >
        <span className="badge badge-neutral">{results.length} ТЗ</span>
      </ReportHeader>

      <ReportState
        loading={loading}
        error={error}
        empty={results.length === 0}
        emptyText="Немає даних еко-водіння за період"
        onRetry={reload}
      />

      {!loading && !error && single && <EcoSingle result={single.result} />}

      {!loading && !error && results.length > 1 && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Транспорт</th>
                <th className="num">Заг. бал</th>
                <th className="num">Швидкість</th>
                <th className="num">Хол. хід</th>
                <th className="num">Двигун</th>
                <th className="num">Пробіг, км</th>
                <th className="num">Пальне, л</th>
                <th className="num">л/100км</th>
                <th className="num">Перевищ. %</th>
              </tr>
            </thead>
            <tbody>
              {results
                .slice()
                .sort(
                  (a, b) =>
                    (b.result.parameters.main_parameters?.total_score ?? 0) -
                    (a.result.parameters.main_parameters?.total_score ?? 0),
                )
                .map((r) => {
                  const p = r.result.parameters;
                  const m = p.main_parameters;
                  const score = m?.total_score;
                  return (
                    <tr key={r.vehicleId}>
                      <td className="font-medium text-txt-primary">{vehicleName(r.vehicleId)}</td>
                      <td className="num">
                        <span
                          className={`badge ${
                            score >= 70 ? 'badge-success' : score >= 45 ? 'badge-warn' : 'badge-danger'
                          }`}
                        >
                          {fmtNum(score, 0)}
                        </span>
                      </td>
                      <td className="num">{fmtNum(p?.speed_parameters?.speed_score, 0)}</td>
                      <td className="num">{fmtNum(p?.idling_parameters?.idling_score, 0)}</td>
                      <td className="num">{fmtNum(p?.engine_parameters?.engine_score, 0)}</td>
                      <td className="num">{fmtNum(m?.distance, 0)}</td>
                      <td className="num">{fmtNum(m?.fuel_consumed_count, 0)}</td>
                      <td className="num">{fmtNum(m?.fuel_consumption_rate)}</td>
                      <td className="num">{fmtNum(p?.speed_parameters?.overspeeding_percentage)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EcoSingle({ result }: { result: any }) {
  const p = result.parameters;
  const main = p?.main_parameters;

  const scores = [
    { label: 'Загальний бал', value: main?.total_score },
    { label: 'Швидкість', value: p?.speed_parameters?.speed_score },
    { label: 'Холостий хід', value: p?.idling_parameters?.idling_score },
    { label: 'Двигун', value: p?.engine_parameters?.engine_score },
  ].filter((s) => Number.isFinite(s.value));

  const facts = [
    { label: 'Пробіг', value: `${fmtNum(main?.distance, 0)} км` },
    { label: 'Час у русі', value: fmtDuration(main?.driving_duration) },
    { label: 'Витрачено пального', value: `${fmtNum(main?.fuel_consumed_count, 0)} л` },
    { label: 'Середня витрата', value: `${fmtNum(main?.fuel_consumption_rate)} л/100км` },
    { label: 'Викиди CO₂', value: `${fmtNum(main?.co2_emission, 0)} кг` },
    { label: 'Макс. швидкість', value: `${fmtNum(p?.speed_parameters?.maximum_speed, 0)} км/год` },
    {
      label: 'Перевищення швидкості',
      value: `${fmtNum(p?.speed_parameters?.overspeeding_percentage)} % шляху`,
    },
    {
      label: 'Холостий хід',
      value: `${fmtDuration(p?.idling_parameters?.idling_duration)} · ${fmtNum(
        p?.idling_parameters?.idling_fuel_consumed_count,
      )} л`,
    },
  ];

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center justify-center gap-8 py-2 sm:justify-start">
        {scores.map((s) => (
          <GaugeRing key={s.label} value={s.value} label={s.label} unit="" size={118} />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="glass-inset p-3">
            <p className="micro-label">{f.label}</p>
            <p className="stat mt-1 text-sm">{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════ drivers ══════════════════════ */

function DriversTab({ from, to, drivers }: TabProps) {
  const [driverIds, setDriverIds] = usePersistentState<string[]>('veles_insights_drivers', []);
  const [openId, setOpenId] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, any[]>>({});
  const [stateLoading, setStateLoading] = useState<string | null>(null);

  const visible = driverIds.length
    ? drivers.filter((d) => driverIds.includes(d.id))
    : drivers;

  const toggle = useCallback(
    async (id: string) => {
      if (openId === id) return setOpenId(null);
      setOpenId(id);
      if (!states[id]) {
        setStateLoading(id);
        try {
          const r = await apiGet<{ items: any[] }>(`/api/ruptela/insights/drivers/${id}/states`, {
            from,
            to,
            limit: 50,
          });
          setStates((s) => ({ ...s, [id]: r.items ?? [] }));
        } catch {
          setStates((s) => ({ ...s, [id]: [] }));
        } finally {
          setStateLoading(null);
        }
      }
    },
    [openId, states, from, to],
  );

  const activityBadge: Record<string, string> = {
    DRIVE: 'badge-warn',
    WORK: 'badge-info',
    REST: 'badge-success',
    AVAILABLE: 'badge-neutral',
  };

  const exportRows = () =>
    visible.map((d) => ({
      name: `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || d.id,
      phone: d.phone ?? '',
      card: d.identifiers?.find((i) => i.type === 'TACHOGRAPH')?.identifier ?? '',
    }));

  return (
    <section className="glass-panel overflow-hidden">
      <ReportHeader
        title="Водії компанії"
        exportData={exportRows}
        exportName="drivers"
        exportColumns={[
          { label: 'ПІБ', key: 'name' },
          { label: 'Телефон', key: 'phone' },
          { label: 'Тахокартка', key: 'card' },
        ]}
        note="Клік по водію — тахо-активність за період"
      >
        <span className="badge badge-neutral">{visible.length}</span>
        <div className="w-56">
          <MultiSelect
            options={drivers.map((d) => ({
              value: d.id,
              label: `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || d.id,
            }))}
            selected={driverIds}
            onChange={setDriverIds}
            placeholder="Усі водії"
            unit="водіїв"
            ariaLabel="Фільтр водіїв"
          />
        </div>
      </ReportHeader>

      {visible.length === 0 ? (
        <ReportState
          loading={false}
          error={null}
          empty
          emptyText="Реєстр водіїв порожній"
          onRetry={() => {}}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>ПІБ</th>
                <th>Телефон</th>
                <th>Тахокартка</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((d) => {
                const tacho = d.identifiers?.find((i) => i.type === 'TACHOGRAPH')?.identifier;
                const open = openId === d.id;
                return (
                  <React.Fragment key={d.id}>
                    <tr onClick={() => toggle(d.id)} className="cursor-pointer">
                      <td className="font-medium text-txt-primary">
                        {`${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || d.id}
                      </td>
                      <td>{d.phone ?? '—'}</td>
                      <td className="font-mono text-2xs">{tacho ?? '—'}</td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={3} className="!p-0">
                          <div className="bg-[var(--surface-inset)] px-4 py-3">
                            {stateLoading === d.id ? (
                              <p className="flex items-center gap-2 text-2xs text-txt-muted">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Завантаження
                                тахо-станів…
                              </p>
                            ) : (states[d.id] ?? []).length === 0 ? (
                              <p className="text-2xs text-txt-muted">
                                Немає тахо-активності за період
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {(states[d.id] ?? []).map((s, i) => (
                                  <span
                                    key={i}
                                    className={`badge ${activityBadge[s.activity] ?? 'badge-neutral'}`}
                                    title={`${formatDateTime(s.start_time)} → ${formatDateTime(s.end_time)}`}
                                  >
                                    {s.activity} · {fmtDuration(s.duration)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ══════════════════════ geozones ══════════════════════ */

function GeozonesTab({ vehicleIds, from, to, vehicleName }: TabProps) {
  const zones = useReport(() => apiGet<{ items: any[] }>('/api/ruptela/insights/geozones'), []);

  const visits = useReport(
    () =>
      apiSend<{ items: any[] }>('POST', '/api/ruptela/insights/geozones/visits', {
        object_ids: vehicleIds,
        from_datetime: from,
        to_datetime: to,
      }),
    [vehicleIds.join(','), from, to],
  );

  const zoneName = (id: string) => zones.data?.items?.find((z) => z.id === id)?.name ?? id;

  const rows = (visits.data?.items ?? []).flatMap((v) =>
    (v.visit_data ?? []).map((d: any) => ({
      ...d,
      geozone_id: v.geozone_id,
      object_id: v.object_id,
    })),
  );

  const exportRows = () =>
    rows.map((r) => ({
      vehicle: vehicleName(r.object_id),
      zone: zoneName(r.geozone_id),
      direction: r.direction === 'IN' ? 'В’їзд' : 'Виїзд',
      datetime: formatDateTime(r.datetime),
      mileage: r.mileage,
      fuel_level: r.fuel_level,
    }));

  return (
    <section className="glass-panel overflow-hidden">
      <ReportHeader
        title="Візити геозон"
        exportData={exportRows}
        exportName="geozone_visits"
        exportColumns={[
          { label: 'Транспорт', key: 'vehicle' },
          { label: 'Геозона', key: 'zone' },
          { label: 'Напрямок', key: 'direction' },
          { label: 'Час', key: 'datetime' },
          { label: 'Одометр', key: 'mileage' },
          { label: 'Рівень палива, л', key: 'fuel_level' },
        ]}
        note="IN — в’їзд, OUT — виїзд"
      >
        <span className="badge badge-neutral">{zones.data?.items?.length ?? 0} зон у акаунті</span>
      </ReportHeader>

      <ReportState
        loading={visits.loading || zones.loading}
        error={visits.error ?? zones.error}
        empty={rows.length === 0}
        emptyText="Обрані ТЗ не перетинали геозони за період"
        onRetry={() => {
          zones.reload();
          visits.reload();
        }}
      />

      {!visits.loading && !visits.error && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Транспорт</th>
                <th>Геозона</th>
                <th>Напрямок</th>
                <th>Час</th>
                <th className="num">Одометр, км</th>
                <th className="num">Рівень палива, л</th>
                <th>Локація</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const inbound = r.direction === 'IN';
                const map = osmLink(r.latitude, r.longitude);
                return (
                  <tr key={i}>
                    <td className="font-medium text-txt-primary">{vehicleName(r.object_id)}</td>
                    <td>{zoneName(r.geozone_id)}</td>
                    <td>
                      <span className={`badge ${inbound ? 'badge-success' : 'badge-warn'}`}>
                        {inbound ? <LogIn className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
                        {inbound ? 'В’їзд' : 'Виїзд'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">{formatDateTime(r.datetime)}</td>
                    <td className="num">{fmtNum(r.mileage, 0)}</td>
                    <td className="num">{fmtNum(r.fuel_level)}</td>
                    <td>
                      {map ? (
                        <a
                          href={map}
                          target="_blank"
                          rel="noreferrer"
                          className="text-2xs text-warn hover:underline"
                        >
                          мапа ↗
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ══════════════════════ countries ══════════════════════ */

function CountriesTab({ vehicleIds, from, to, drivers, vehicleName }: TabProps) {
  const { data, loading, error, reload } = useReport(
    () =>
      perVehicle(vehicleIds, (id) =>
        apiGet<{ items: any[] }>(`/api/ruptela/insights/countries/object/${id}`, { from, to }),
      ),
    [vehicleIds.join(','), from, to],
  );

  const rows = useMemo(
    () =>
      (data ?? [])
        .flatMap((r) => (r.result?.items ?? []).map((c: any) => ({ ...c, vehicleId: r.vehicleId })))
        .sort((a, b) => String(a.start?.datetime).localeCompare(String(b.start?.datetime))),
    [data],
  );

  const exportRows = () =>
    rows.map((c) => ({
      vehicle: vehicleName(c.vehicleId),
      country: c.country_code,
      entered: formatDateTime(c.start?.datetime),
      exited: formatDateTime(c.end?.datetime),
      mileage: c.mileage,
      fuel: c.fuel_consumed,
      rate: c.average_fuel_consumption,
      driving: fmtDuration(c.driving_status_duration),
      stop: fmtDuration(c.stop_duration),
      driver: driverName(drivers, c.first_driver_ids?.[0]),
    }));

  return (
    <section className="glass-panel overflow-hidden">
      <ReportHeader
        title="Звіт по країнах"
        exportData={exportRows}
        exportName="countries"
        exportColumns={[
          { label: 'Транспорт', key: 'vehicle' },
          { label: 'Країна', key: 'country' },
          { label: 'В’їзд', key: 'entered' },
          { label: 'Виїзд', key: 'exited' },
          { label: 'Пробіг, км', key: 'mileage' },
          { label: 'Пальне, л', key: 'fuel' },
          { label: 'л/100км', key: 'rate' },
          { label: 'Кермування', key: 'driving' },
          { label: 'Простій', key: 'stop' },
          { label: 'Водій', key: 'driver' },
        ]}
        note="Перетини кордонів і показники в межах країни"
      >
        <span className="badge badge-neutral">{rows.length} перебувань</span>
      </ReportHeader>

      <ReportState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyText="Обрані ТЗ не перетинали кордони за період"
        onRetry={reload}
      />

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Транспорт</th>
                <th>Країна</th>
                <th>В’їзд</th>
                <th>Виїзд</th>
                <th className="num">Пробіг, км</th>
                <th className="num">Пальне, л</th>
                <th className="num">Сер. витрата</th>
                <th className="num">Кермування</th>
                <th>Водій</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr key={i}>
                  <td className="font-medium text-txt-primary">{vehicleName(c.vehicleId)}</td>
                  <td>
                    <span className="badge badge-info">{c.country_code ?? '—'}</span>
                    {c.exited_to ? (
                      <span className="ml-1.5 text-micro text-txt-muted">→ {c.exited_to}</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap">{formatDateTime(c.start?.datetime)}</td>
                  <td className="whitespace-nowrap">{formatDateTime(c.end?.datetime)}</td>
                  <td className="num">{fmtNum(c.mileage, 0)}</td>
                  <td className="num">{fmtNum(c.fuel_consumed, 0)}</td>
                  <td className="num">{fmtNum(c.average_fuel_consumption)} л/100км</td>
                  <td className="num">{fmtDuration(c.driving_status_duration)}</td>
                  <td>{driverName(drivers, c.first_driver_ids?.[0])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ══════════════════════ tacho downloads ══════════════════════ */

/** Vendor statuses, verified against the live TachoFilterRequest enum. */
const TACHO_STATUS_BADGE: Record<string, string> = {
  SUCCEEDED: 'badge-success',
  SUCCEEDED_DIRTY: 'badge-warn',
  PENDING: 'badge-warn',
  AUTHENTICATING: 'badge-info',
  AUTHENTICATION_COMPLETED: 'badge-info',
  DOWNLOADING: 'badge-info',
  PENDING_VALIDATION: 'badge-info',
  FAILED: 'badge-danger',
  UNKNOWN: 'badge-neutral',
};

const TACHO_STATUS_LABEL: Record<string, string> = {
  SUCCEEDED: 'Готово',
  SUCCEEDED_DIRTY: 'Готово (частково)',
  PENDING: 'Очікує пристрій',
  AUTHENTICATING: 'Автентифікація',
  AUTHENTICATION_COMPLETED: 'Автентифіковано',
  DOWNLOADING: 'Завантаження',
  PENDING_VALIDATION: 'Перевірка файлу',
  FAILED: 'Помилка',
  UNKNOWN: 'Невідомо',
};

/**
 * Optional VU download blocks — the base activity data always downloads;
 * these enum values come from VehicleTachoScheduleRequest in the swagger.
 */
const VU_OPTIONS = [
  { value: 'TACHO_FILE_FAULTS_AND_EVENTS', label: 'Події та збої' },
  { value: 'TACHO_FILE_DETAILED_SPEED', label: 'Детальна швидкість' },
  { value: 'TACHO_FILE_TECHNICAL_DATA', label: 'Технічні дані' },
  { value: 'SINCE_LAST_DOWNLOAD', label: 'Лише з останнього завантаження' },
];

function TachoTab({ vehicles }: TabProps) {
  const requests = useReport(
    () =>
      // The vendor caps page size well below 50 — 20 is verified to pass.
      apiSend<{ items: any[] }>('POST', '/api/ruptela/insights/tacho/requests', {
        page_descriptor: { page: 1, size: 20 },
      }),
    [],
  );

  // The schedule form survives a reload like every other entry form.
  const [kind, setKind] = usePersistentState<'driver-card' | 'vehicle'>(
    'veles_tacho_kind',
    'driver-card',
  );
  const [vehicleId, setVehicleId] = usePersistentState('veles_tacho_vehicle', '');
  const [slot, setSlot] = usePersistentState<'DRIVER_CARD_FIRST_SLOT' | 'DRIVER_CARD_SECOND_SLOT'>(
    'veles_tacho_slot',
    'DRIVER_CARD_FIRST_SLOT',
  );
  const [vuFrom, setVuFrom] = usePersistentState('veles_tacho_from', () =>
    toLocalInput(presetRange('30d').from),
  );
  const [vuTo, setVuTo] = usePersistentState('veles_tacho_to', () => toLocalInput(new Date()));
  const [vuOptions, setVuOptions] = usePersistentState<string[]>('veles_tacho_options', [
    'TACHO_FILE_FAULTS_AND_EVENTS',
  ]);
  const [scheduling, setScheduling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const targetVehicle = vehicleId || vehicles[0]?.id || '';

  const schedule = async () => {
    if (!targetVehicle) return;
    setScheduling(true);
    setActionError(null);
    setActionOk(null);
    try {
      if (kind === 'driver-card') {
        await apiSend('POST', '/api/ruptela/insights/tacho/driver-card-download', {
          external_object_id: targetVehicle,
          request_name: `VELES картка ${new Date().toISOString().slice(0, 10)}`,
          slot,
        });
      } else {
        await apiSend('POST', '/api/ruptela/insights/tacho/vehicle-download', {
          external_object_id: targetVehicle,
          request_name: `VELES тахограф ${new Date().toISOString().slice(0, 10)}`,
          from_date_time: toIso(vuFrom),
          to_date_time: toIso(vuTo),
          options: vuOptions,
        });
      }
      setActionOk(
        'Завантаження заплановано. Пристрій передасть файл, щойно буде на зв’язку — стежте за статусом у списку нижче.',
      );
      requests.reload();
    } catch (e: any) {
      setActionError(e?.message ?? 'Не вдалося запланувати завантаження');
    } finally {
      setScheduling(false);
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    setActionError(null);
    try {
      await apiSend('DELETE', `/api/ruptela/insights/tacho/request/${id}`);
      requests.reload();
    } catch (e: any) {
      setActionError(e?.message ?? 'Не вдалося скасувати запит');
    } finally {
      setDeletingId(null);
    }
  };

  const items = requests.data?.items ?? [];
  const downloadable = (status?: string) =>
    ['SUCCEEDED', 'SUCCEEDED_DIRTY'].includes(String(status).toUpperCase());

  return (
    <div className="space-y-5">
      {/* Schedule form */}
      <section className="glass-panel p-5">
        <h2 className="mb-1 text-sm font-semibold text-txt-primary">
          Запланувати завантаження тахографа
        </h2>
        <p className="mb-4 text-2xs text-txt-muted">
          Команда надсилається на реальний пристрій у ТЗ. Файл .ddd з’явиться у списку після
          передачі — зазвичай коли запалювання ввімкнене і є GSM-зв’язок.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="micro-label mb-1 block">Що завантажити</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="field w-auto"
            >
              <option value="driver-card">Картка водія</option>
              <option value="vehicle">Тахограф ТЗ (VU)</option>
            </select>
          </label>

          <label className="block min-w-[220px] flex-1">
            <span className="micro-label mb-1 block">Транспортний засіб</span>
            <select
              value={targetVehicle}
              onChange={(e) => setVehicleId(e.target.value)}
              className="field"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.plate ? `· ${v.plate}` : ''}
                </option>
              ))}
            </select>
          </label>

          {kind === 'driver-card' ? (
            <label className="block">
              <span className="micro-label mb-1 block">Слот картки</span>
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value as typeof slot)}
                className="field w-auto"
              >
                <option value="DRIVER_CARD_FIRST_SLOT">Слот 1 — водій</option>
                <option value="DRIVER_CARD_SECOND_SLOT">Слот 2 — змінник</option>
              </select>
            </label>
          ) : (
            <>
              <label className="block">
                <span className="micro-label mb-1 block">Дані від</span>
                <input
                  type="datetime-local"
                  value={vuFrom}
                  onChange={(e) => setVuFrom(e.target.value)}
                  className="field"
                />
              </label>
              <label className="block">
                <span className="micro-label mb-1 block">до</span>
                <input
                  type="datetime-local"
                  value={vuTo}
                  min={vuFrom || undefined}
                  onChange={(e) => setVuTo(e.target.value)}
                  className="field"
                />
              </label>
            </>
          )}

          <button
            type="button"
            onClick={schedule}
            disabled={scheduling || !targetVehicle}
            className="btn btn-warn"
          >
            {scheduling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <HardDriveDownload className="h-3.5 w-3.5" />
            )}
            Запланувати
          </button>
        </div>

        {kind === 'vehicle' && (
          <div className="mt-3">
            <span className="micro-label mb-1.5 block">
              Додаткові блоки DDD — активності завантажуються завжди
            </span>
            <div className="flex flex-wrap gap-2">
              {VU_OPTIONS.map((o) => {
                const on = vuOptions.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() =>
                      setVuOptions((list) =>
                        on ? list.filter((x) => x !== o.value) : [...list, o.value],
                      )
                    }
                    aria-pressed={on}
                    className={`badge ${on ? 'badge-warn' : 'badge-neutral'} cursor-pointer`}
                  >
                    {on && <Check className="h-3 w-3" />}
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {actionOk && (
          <p className="mt-3 rounded-field border border-bdr-subtle bg-accent-soft px-3 py-2 text-2xs text-accent">
            {actionOk}
          </p>
        )}
        {actionError && (
          <p className="mt-3 rounded-field border border-danger/25 bg-danger/10 px-3 py-2 text-2xs text-danger" role="alert">
            {actionError}
          </p>
        )}
      </section>

      {/* Requests table */}
      <section className="glass-panel overflow-hidden">
        <header className="flex items-center gap-3 border-b border-bdr-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-txt-primary">Запити на завантаження</h2>
          <span className="badge badge-neutral">{items.length}</span>
          <button
            type="button"
            onClick={requests.reload}
            className="btn-icon ml-auto h-8 w-8"
            title="Оновити список"
            aria-label="Оновити список"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${requests.loading ? 'animate-spin' : ''}`} />
          </button>
        </header>

        <ReportState
          loading={requests.loading}
          error={requests.error}
          empty={items.length === 0}
          emptyText="Запитів ще немає — заплануйте перше завантаження вище"
          onRetry={requests.reload}
        />

        {!requests.loading && !requests.error && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Створено</th>
                  <th>Тип</th>
                  <th>Транспорт</th>
                  <th>Водій / картка</th>
                  <th>Статус</th>
                  <th aria-label="Дії" />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                    <td className="text-2xs">{r.type ?? '—'}</td>
                    <td>{r.object_info?.name ?? '—'}</td>
                    <td>
                      {r.driver_info
                        ? `${r.driver_info.first_name ?? ''} ${r.driver_info.last_name ?? ''}`.trim() ||
                          r.driver_info.card_number ||
                          '—'
                        : '—'}
                    </td>
                    <td>
                      <span
                        className={`badge ${TACHO_STATUS_BADGE[String(r.status).toUpperCase()] ?? 'badge-neutral'}`}
                        title={r.error && r.error !== 'NONE' ? r.error : undefined}
                      >
                        {TACHO_STATUS_LABEL[String(r.status).toUpperCase()] ?? r.status ?? '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {downloadable(r.status) && (
                        <a
                          href={`${API_BASE}/api/ruptela/insights/tacho/file/${r.id}`}
                          download
                          title="Завантажити файл .ddd"
                          aria-label="Завантажити файл .ddd"
                          className="btn-icon mr-1 inline-flex h-7 w-7"
                        >
                          <Download className="h-3.5 w-3.5 text-accent" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        disabled={deletingId === r.id}
                        title="Скасувати запит"
                        aria-label="Скасувати запит"
                        className="btn-icon h-7 w-7 hover:text-danger"
                      >
                        {deletingId === r.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ══════════════════════ share links ══════════════════════ */

function ShareLinksTab({ vehicles }: TabProps) {
  const { data, loading, error, reload } = useReport(
    () => apiGet<{ items: any[] }>('/api/ruptela/insights/share-links'),
    [],
  );
  const [creating, setCreating] = useState(false);
  const [newVehicleId, setNewVehicleId] = usePersistentState('veles_share_vehicle', '');
  const [expires, setExpires] = usePersistentState('veles_share_expires', () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toLocalInput(d);
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const items = data?.items ?? [];
  const linkUrl = (l: any) => (l.domain ? `https://${l.domain}/${l.id}` : l.id);

  const create = async () => {
    const vid = newVehicleId || vehicles[0]?.id;
    if (!vid || !expires) return;
    setCreating(true);
    setActionError(null);
    try {
      await apiSend('POST', '/api/ruptela/insights/share-links', {
        objects: [{ id: vid }],
        valid_from: new Date().toISOString(),
        expires_at: new Date(expires).toISOString(),
      });
      reload();
    } catch (e: any) {
      setActionError(e?.message ?? 'Не вдалося створити посилання');
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    setActionError(null);
    try {
      await apiSend('DELETE', `/api/ruptela/insights/share-links/${id}`);
      reload();
    } catch (e: any) {
      setActionError(e?.message ?? 'Не вдалося видалити посилання');
    } finally {
      setDeletingId(null);
    }
  };

  const copy = async (l: any) => {
    await navigator.clipboard.writeText(linkUrl(l));
    setCopiedId(l.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <section className="glass-panel overflow-hidden">
      <header className="flex items-center gap-3 border-b border-bdr-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-txt-primary">Публічні посилання на трекінг</h2>
        <p className="ml-auto text-micro text-txt-muted">
          Стеження за ТЗ без облікового запису — для клієнтів і експедиторів
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 border-b border-bdr-subtle px-4 py-3">
        <label className="block min-w-[200px] flex-1">
          <span className="micro-label mb-1 block">Транспортний засіб</span>
          <select
            value={newVehicleId || vehicles[0]?.id || ''}
            onChange={(e) => setNewVehicleId(e.target.value)}
            className="field"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} {v.plate ? `· ${v.plate}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="micro-label mb-1 block">Діє до</span>
          <input
            type="datetime-local"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className="field"
          />
        </label>
        <button type="button" onClick={create} disabled={creating} className="btn btn-warn">
          {creating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
          Створити посилання
        </button>
      </div>

      {actionError && (
        <p
          className="border-b border-danger/25 bg-danger/10 px-4 py-2 text-2xs text-danger"
          role="alert"
        >
          {actionError}
        </p>
      )}

      <ReportState
        loading={loading}
        error={error}
        empty={items.length === 0}
        emptyText="Активних посилань немає — створіть перше вище"
        onRetry={reload}
      />

      {!loading && !error && items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Посилання</th>
                <th>Транспорт</th>
                <th>Створено</th>
                <th>Діє до</th>
                <th aria-label="Дії" />
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id}>
                  <td>
                    <a
                      href={linkUrl(l)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-2xs text-warn hover:underline"
                    >
                      {linkUrl(l)}
                    </a>
                  </td>
                  <td>{(l.objects ?? []).map((o: any) => o.name ?? o.id).join(', ') || '—'}</td>
                  <td className="whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                  <td className="whitespace-nowrap">{formatDateTime(l.expires_at)}</td>
                  <td className="whitespace-nowrap text-right">
                    <button
                      type="button"
                      onClick={() => copy(l)}
                      title="Скопіювати посилання"
                      aria-label="Скопіювати посилання"
                      className="btn-icon mr-1 h-7 w-7"
                    >
                      {copiedId === l.id ? (
                        <Check className="h-3.5 w-3.5 text-accent" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(l.id)}
                      disabled={deletingId === l.id}
                      title="Видалити посилання"
                      aria-label="Видалити посилання"
                      className="btn-icon h-7 w-7 hover:text-danger"
                    >
                      {deletingId === l.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ══════════════════════ registry (groups + users) ══════════════════════ */

function RegistryTab() {
  const groups = useReport(
    () => apiGet<{ items: any[] }>('/api/ruptela/insights/object-groups'),
    [],
  );
  const users = useReport(() => apiGet<{ items: any[] }>('/api/ruptela/insights/users'), []);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <section className="glass-panel overflow-hidden">
        <header className="flex items-center gap-3 border-b border-bdr-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-txt-primary">Групи транспорту</h2>
          <span className="badge badge-neutral">{groups.data?.items?.length ?? 0}</span>
        </header>
        <ReportState
          loading={groups.loading}
          error={groups.error}
          empty={(groups.data?.items ?? []).length === 0}
          emptyText="Груп не створено у fm-track"
          onRetry={groups.reload}
        />
        {(groups.data?.items ?? []).length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Назва</th>
                <th className="num">Обʼєктів</th>
              </tr>
            </thead>
            <tbody>
              {groups.data!.items.map((g) => (
                <tr key={g.id}>
                  <td className="font-medium text-txt-primary">{g.name}</td>
                  <td className="num">{g.objects_ids?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="glass-panel overflow-hidden">
        <header className="flex items-center gap-3 border-b border-bdr-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-txt-primary">Користувачі fm-track</h2>
          <span className="badge badge-neutral">{users.data?.items?.length ?? 0}</span>
        </header>
        <ReportState
          loading={users.loading}
          error={users.error}
          empty={(users.data?.items ?? []).length === 0}
          emptyText="Користувачів не знайдено"
          onRetry={users.reload}
        />
        {(users.data?.items ?? []).length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Імʼя</th>
                <th>Email</th>
                <th>Телефон</th>
              </tr>
            </thead>
            <tbody>
              {users.data!.items.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium text-txt-primary">{u.full_name ?? '—'}</td>
                  <td>{u.email ?? '—'}</td>
                  <td className="tabular">{u.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
