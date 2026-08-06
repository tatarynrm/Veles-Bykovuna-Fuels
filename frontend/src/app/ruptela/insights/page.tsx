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
import { t, localizedMap } from '@/lib/i18n';

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
  { key: 'fuel', label: 'insights.fuelEvents', icon: Fuel },
  { key: 'events', label: 'insights.events', icon: AlertTriangle },
  { key: 'eco', label: 'insights.ecoDriving', icon: Leaf },
  { key: 'drivers', label: 'insights.driversTab', icon: Users },
  { key: 'geozones', label: 'common.geofences', icon: MapPin },
  { key: 'countries', label: 'insights.countries', icon: Globe2 },
  { key: 'tacho', label: 'common.tachograph', icon: HardDriveDownload },
  { key: 'share', label: 'insights.links', icon: Link2 },
  { key: 'registry', label: 'insights.registries', icon: Library },
];

/* ── period presets ── */

type PresetKey = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'prevMonth' | 'quarter';

const PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: 'today', label: 'common.today' },
  { key: 'yesterday', label: 'insights.yesterday' },
  { key: '7d', label: 'insights.n7Days' },
  { key: '30d', label: 'insights.n30Days' },
  { key: 'month', label: 'insights.thisMonth' },
  { key: 'prevMonth', label: 'insights.lastMonth' },
  { key: 'quarter', label: 'insights.quarter' },
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
  return h > 0 ? t('insights.hMin', { v0: h, v1: m }) : t('common.min', { v0: m });
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
      .catch((e: any) => alive && setError(e?.message ?? t('insights.requestError')))
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
        {t('insights.queryingRuptelaFMSEllipsis')}
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
          {t('insights.retry')}
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
              subtitle: t('insights.velesERPRuptelaFm'),
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
      title={t('common.fmsReports')}
      subtitle={t('insights.rawRuptelaFmTrack')}
    >
      {/* Global report filters.
          backdrop-filter makes every glass panel its own stacking context, so
          the MultiSelect dropdown (z-50) cannot escape it — the panel itself
          must sit above the sibling sections below (and under the z-30 sticky
          header, which it never overlaps). */}
      <div className="glass-panel relative z-20 space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <span className="micro-label mb-1 block">{t('insights.vehicles')}</span>
            <MultiSelect
              options={vehicles.map((v) => ({ value: v.id, label: v.name, hint: v.plate }))}
              selected={vehicleIds}
              onChange={setVehicleIds}
              placeholder={t('insights.selectAVehicleEllipsis')}
              unit={t('insights.vehiclesSelected')}
              ariaLabel={t('insights.vehiclesReport')}
            />
          </div>
          <label className="block">
            <span className="micro-label mb-1 block">{t('insights.periodFrom')}</span>
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
            <span className="micro-label mb-1 block">{t('insights.to')}</span>
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
                {t(p.label)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 overflow-x-auto" aria-label={t('insights.reportSections')}>
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
              {t(label)}
            </button>
          ))}
        </div>
      </nav>

      {!rangeReady ? (
        <div className="glass-panel p-6 text-center text-2xs text-txt-muted">
          {t('insights.selectVehiclePeriodBuild')}
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
      type: e.event_type === 'REFUEL' ? t('common.refuelling') : t('insights.drain'),
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
        title={t('insights.refuellingsAndDrains')}
        exportData={exportRows}
        exportName="fuel_events"
        exportColumns={[
          { label: t('common.vehicles'), key: 'vehicle' },
          { label: t('insights.type'), key: 'type' },
          { label: t('common.start'), key: 'start' },
          { label: t('common.end'), key: 'end' },
          { label: t('insights.levelBeforeL'), key: 'level_start' },
          { label: t('insights.levelAfterL'), key: 'level_end' },
          { label: t('insights.volumeL'), key: 'volume' },
          { label: t('common.driver'), key: 'driver' },
        ]}
        note={t('insights.sourceFuelLevelSensor')}
      >
        <span className="badge badge-success">
          <ArrowUpRight className="h-3 w-3" /> {refuels.length} {t('insights.refuellings')}{' '}
          {fmtNum(refuels.reduce((a, e) => a + (e.difference ?? 0), 0), 0)} {t('unit.litre')}
        </span>
        {drains.length > 0 && (
          <span className="badge badge-danger">
            <ArrowDownRight className="h-3 w-3" /> {drains.length} {t('insights.drains')}{' '}
            {fmtNum(Math.abs(drains.reduce((a, e) => a + (e.difference ?? 0), 0)), 0)} {t('unit.litre')}
          </span>
        )}
      </ReportHeader>

      <ReportState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyText={t('insights.noFuelEventsRecorded')}
        onRetry={reload}
      />

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.vehicles')}</th>
                <th>{t('insights.type')}</th>
                <th>{t('common.start')}</th>
                <th>{t('common.end')}</th>
                <th className="num">{t('insights.toL')}</th>
                <th className="num">{t('insights.afterL')}</th>
                <th className="num">{t('insights.volumeL')}</th>
                <th>{t('common.driver')}</th>
                <th>{t('insights.location')}</th>
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
                        {refuel ? t('common.refuelling') : t('insights.drain')}
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
                          {t('insights.map')}
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
        title={t('insights.recordedEvents')}
        exportData={exportRows}
        exportName="detected_events"
        exportColumns={[
          { label: t('common.vehicles'), key: 'vehicle' },
          { label: t('insights.event'), key: 'name' },
          { label: t('common.start'), key: 'start' },
          { label: t('insights.duration'), key: 'duration' },
          { label: t('common.speed'), key: 'speed' },
          { label: t('common.driver'), key: 'driver' },
        ]}
        note={t('insights.eventRulesConfiguredFm')}
      >
        <span className="badge badge-neutral">{rows.length}</span>
      </ReportHeader>

      <ReportState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyText={t('insights.noEventsSelectedPeriod')}
        onRetry={reload}
      />

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.vehicles')}</th>
                <th>{t('insights.event')}</th>
                <th>{t('common.start')}</th>
                <th className="num">{t('insights.duration')}</th>
                <th className="num">{t('insights.speedKmH')}</th>
                <th>{t('common.driver')}</th>
                <th>{t('insights.location')}</th>
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
                          {t('insights.map')}
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
    { label: t('common.vehicles'), key: 'vehicle' },
    { label: t('insights.overall'), key: 'total_score' },
    { label: t('common.speed'), key: 'speed_score' },
    { label: t('insights.idle'), key: 'idling_score' },
    { label: t('insights.engine'), key: 'engine_score' },
    { label: t('insights.mileageKm'), key: 'distance' },
    { label: t('insights.fuelL'), key: 'fuel' },
    { label: t('insights.l100KmUnit'), key: 'rate' },
    { label: t('insights.speeding2'), key: 'overspeed_pct' },
    { label: t('insights.idleTime'), key: 'idling' },
    { label: t('insights.coKg'), key: 'co2' },
  ];

  return (
    <section className="glass-panel overflow-hidden">
      <ReportHeader
        title={t('insights.ecoDrivingPeriod')}
        exportData={exportRows}
        exportName="ecodriving"
        exportColumns={exportColumns}
        note={t('insights.score0100Higher')}
      >
        <span className="badge badge-neutral">{results.length} {t('common.vehicleShort')}</span>
      </ReportHeader>

      <ReportState
        loading={loading}
        error={error}
        empty={results.length === 0}
        emptyText={t('insights.noEcoDrivingData')}
        onRetry={reload}
      />

      {!loading && !error && single && <EcoSingle result={single.result} />}

      {!loading && !error && results.length > 1 && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.vehicles')}</th>
                <th className="num">{t('insights.overall')}</th>
                <th className="num">{t('common.speed')}</th>
                <th className="num">{t('insights.idle')}</th>
                <th className="num">{t('insights.engine')}</th>
                <th className="num">{t('insights.mileageKm')}</th>
                <th className="num">{t('insights.fuelL')}</th>
                <th className="num">{t('insights.l100KmUnit')}</th>
                <th className="num">{t('insights.speeding3')}</th>
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
    { label: t('insights.overallScore'), value: main?.total_score },
    { label: t('common.speed'), value: p?.speed_parameters?.speed_score },
    { label: t('common.idling'), value: p?.idling_parameters?.idling_score },
    { label: t('insights.engine'), value: p?.engine_parameters?.engine_score },
  ].filter((s) => Number.isFinite(s.value));

  const facts = [
    { label: t('common.mileage'), value: t('insights.km', { v0: fmtNum(main?.distance, 0) }) },
    { label: t('insights.timeMoving'), value: fmtDuration(main?.driving_duration) },
    { label: t('insights.fuelConsumed'), value: t('common.l', { v0: fmtNum(main?.fuel_consumed_count, 0) }) },
    { label: t('insights.averageConsumption'), value: t('insights.l100Km', { v0: fmtNum(main?.fuel_consumption_rate) }) },
    { label: t('insights.coEmissions'), value: t('insights.kg', { v0: fmtNum(main?.co2_emission, 0) }) },
    { label: t('insights.topSpeed'), value: t('common.kmH', { v0: fmtNum(p?.speed_parameters?.maximum_speed, 0) }) },
    {
      label: t('insights.speeding'),
      value: t('insights.ofTheRoute', { v0: fmtNum(p?.speed_parameters?.overspeeding_percentage) }),
    },
    {
      label: t('common.idling'),
      value: t('insights.l', { v0: fmtDuration(p?.idling_parameters?.idling_duration), v1: fmtNum(
        p?.idling_parameters?.idling_fuel_consumed_count,
      ) }),
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
        title={t('insights.companyDrivers')}
        exportData={exportRows}
        exportName="drivers"
        exportColumns={[
          { label: t('insights.fullName'), key: 'name' },
          { label: t('insights.phone'), key: 'phone' },
          { label: t('insights.tachographCard'), key: 'card' },
        ]}
        note={t('insights.clickDriverTachographActivity')}
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
            placeholder={t('insights.allDrivers')}
            unit={t('insights.drivers')}
            ariaLabel={t('insights.driverFilter')}
          />
        </div>
      </ReportHeader>

      {visible.length === 0 ? (
        <ReportState
          loading={false}
          error={null}
          empty
          emptyText={t('insights.driverRegistryEmpty')}
          onRetry={() => {}}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('insights.fullName')}</th>
                <th>{t('insights.phone')}</th>
                <th>{t('insights.tachographCard')}</th>
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
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('insights.loadingTachographStatesEllipsis')}
                              </p>
                            ) : (states[d.id] ?? []).length === 0 ? (
                              <p className="text-2xs text-txt-muted">
                                {t('insights.noTachographActivityPeriod')}
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
      direction: r.direction === 'IN' ? t('insights.entry') : t('insights.exit'),
      datetime: formatDateTime(r.datetime),
      mileage: r.mileage,
      fuel_level: r.fuel_level,
    }));

  return (
    <section className="glass-panel overflow-hidden">
      <ReportHeader
        title={t('insights.geofenceVisits')}
        exportData={exportRows}
        exportName="geozone_visits"
        exportColumns={[
          { label: t('common.vehicles'), key: 'vehicle' },
          { label: t('insights.geofence'), key: 'zone' },
          { label: t('insights.direction'), key: 'direction' },
          { label: t('common.time'), key: 'datetime' },
          { label: t('insights.odometer'), key: 'mileage' },
          { label: t('insights.fuelLevelL'), key: 'fuel_level' },
        ]}
        note={t('insights.entryOUTExit')}
      >
        <span className="badge badge-neutral">{zones.data?.items?.length ?? 0} {t('insights.zonesAccount')}</span>
      </ReportHeader>

      <ReportState
        loading={visits.loading || zones.loading}
        error={visits.error ?? zones.error}
        empty={rows.length === 0}
        emptyText={t('insights.selectedVehiclesDidNot')}
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
                <th>{t('common.vehicles')}</th>
                <th>{t('insights.geofence')}</th>
                <th>{t('insights.direction')}</th>
                <th>{t('common.time')}</th>
                <th className="num">{t('insights.odometerKm')}</th>
                <th className="num">{t('insights.fuelLevelL')}</th>
                <th>{t('insights.location')}</th>
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
                        {inbound ? t('insights.entry') : t('insights.exit')}
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
                          {t('insights.map')}
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
        title={t('insights.countryReport')}
        exportData={exportRows}
        exportName="countries"
        exportColumns={[
          { label: t('common.vehicles'), key: 'vehicle' },
          { label: t('insights.country'), key: 'country' },
          { label: t('insights.entry'), key: 'entered' },
          { label: t('insights.exit'), key: 'exited' },
          { label: t('insights.mileageKm'), key: 'mileage' },
          { label: t('insights.fuelL'), key: 'fuel' },
          { label: t('insights.l100KmUnit'), key: 'rate' },
          { label: t('insights.driving'), key: 'driving' },
          { label: t('insights.idling'), key: 'stop' },
          { label: t('common.driver'), key: 'driver' },
        ]}
        note={t('insights.borderCrossingsPerCountry')}
      >
        <span className="badge badge-neutral">{rows.length} {t('insights.visits')}</span>
      </ReportHeader>

      <ReportState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyText={t('insights.selectedVehiclesDidNotCross')}
        onRetry={reload}
      />

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.vehicles')}</th>
                <th>{t('insights.country')}</th>
                <th>{t('insights.entry')}</th>
                <th>{t('insights.exit')}</th>
                <th className="num">{t('insights.mileageKm')}</th>
                <th className="num">{t('insights.fuelL')}</th>
                <th className="num">{t('insights.avgConsumption')}</th>
                <th className="num">{t('insights.driving')}</th>
                <th>{t('common.driver')}</th>
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
                  <td className="num">{fmtNum(c.average_fuel_consumption)} {t('insights.l100KmUnit')}</td>
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

const TACHO_STATUS_LABEL: Record<string, string> = localizedMap({
  SUCCEEDED: 'insights.done',
  SUCCEEDED_DIRTY: 'insights.donePartial',
  PENDING: 'insights.waitingDevice',
  AUTHENTICATING: 'insights.authentication',
  AUTHENTICATION_COMPLETED: 'insights.authenticated',
  DOWNLOADING: 'common.loading',
  PENDING_VALIDATION: 'insights.fileCheck',
  FAILED: 'insights.error',
  UNKNOWN: 'insights.unknown',
});

/**
 * Optional VU download blocks — the base activity data always downloads;
 * these enum values come from VehicleTachoScheduleRequest in the swagger.
 */
const VU_OPTIONS = [
  { value: 'TACHO_FILE_FAULTS_AND_EVENTS', label: 'insights.eventsAndFaults' },
  { value: 'TACHO_FILE_DETAILED_SPEED', label: 'insights.detailedSpeed' },
  { value: 'TACHO_FILE_TECHNICAL_DATA', label: 'insights.technicalData' },
  { value: 'SINCE_LAST_DOWNLOAD', label: 'insights.sinceLastDownloadOnly' },
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
          request_name: t('insights.velesCard', { v0: new Date().toISOString().slice(0, 10) }),
          slot,
        });
      } else {
        await apiSend('POST', '/api/ruptela/insights/tacho/vehicle-download', {
          external_object_id: targetVehicle,
          request_name: t('insights.velesTachograph', { v0: new Date().toISOString().slice(0, 10) }),
          from_date_time: toIso(vuFrom),
          to_date_time: toIso(vuTo),
          options: vuOptions,
        });
      }
      setActionOk(
        t('insights.downloadScheduledDeviceWill'),
      );
      requests.reload();
    } catch (e: any) {
      setActionError(e?.message ?? t('insights.couldNotScheduleDownload'));
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
      setActionError(e?.message ?? t('insights.couldNotCancelRequest'));
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
          {t('insights.scheduleTachographDownload')}
        </h2>
        <p className="mb-4 text-2xs text-txt-muted">
          {t('insights.commandGoesRealDevice')}
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="micro-label mb-1 block">{t('insights.whatToDownload')}</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="field w-auto"
            >
              <option value="driver-card">{t('insights.driverCardTab')}</option>
              <option value="vehicle">{t('insights.vehicleUnitVU')}</option>
            </select>
          </label>

          <label className="block min-w-[220px] flex-1">
            <span className="micro-label mb-1 block">{t('common.vehicle')}</span>
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
              <span className="micro-label mb-1 block">{t('insights.cardSlot')}</span>
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value as typeof slot)}
                className="field w-auto"
              >
                <option value="DRIVER_CARD_FIRST_SLOT">{t('insights.slot1Driver')}</option>
                <option value="DRIVER_CARD_SECOND_SLOT">{t('insights.slot2CoDriver')}</option>
              </select>
            </label>
          ) : (
            <>
              <label className="block">
                <span className="micro-label mb-1 block">{t('insights.dataAsOf')}</span>
                <input
                  type="datetime-local"
                  value={vuFrom}
                  onChange={(e) => setVuFrom(e.target.value)}
                  className="field"
                />
              </label>
              <label className="block">
                <span className="micro-label mb-1 block">{t('insights.to')}</span>
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
            {t('insights.schedule')}
          </button>
        </div>

        {kind === 'vehicle' && (
          <div className="mt-3">
            <span className="micro-label mb-1.5 block">
              {t('insights.extraDDDBlocksActivities')}
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
                    {t(o.label)}
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
          <h2 className="text-sm font-semibold text-txt-primary">{t('insights.downloadRequests')}</h2>
          <span className="badge badge-neutral">{items.length}</span>
          <button
            type="button"
            onClick={requests.reload}
            className="btn-icon ml-auto h-8 w-8"
            title={t('insights.refreshTheList')}
            aria-label={t('insights.refreshTheList')}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${requests.loading ? 'animate-spin' : ''}`} />
          </button>
        </header>

        <ReportState
          loading={requests.loading}
          error={requests.error}
          empty={items.length === 0}
          emptyText={t('insights.noRequestsYetSchedule')}
          onRetry={requests.reload}
        />

        {!requests.loading && !requests.error && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('insights.created')}</th>
                  <th>{t('insights.type')}</th>
                  <th>{t('common.vehicles')}</th>
                  <th>{t('insights.driverCard')}</th>
                  <th>{t('common.status')}</th>
                  <th aria-label={t('common.actions')} />
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
                          title={t('insights.downloadDddFile')}
                          aria-label={t('insights.downloadDddFile')}
                          className="btn-icon mr-1 inline-flex h-7 w-7"
                        >
                          <Download className="h-3.5 w-3.5 text-accent" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        disabled={deletingId === r.id}
                        title={t('insights.cancelTheRequest')}
                        aria-label={t('insights.cancelTheRequest')}
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
      setActionError(e?.message ?? t('insights.couldNotCreateLink'));
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
      setActionError(e?.message ?? t('insights.couldNotDeleteLink'));
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
        <h2 className="text-sm font-semibold text-txt-primary">{t('insights.publicTrackingLinks')}</h2>
        <p className="ml-auto text-micro text-txt-muted">
          {t('insights.vehicleTrackingWithoutAccount')}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 border-b border-bdr-subtle px-4 py-3">
        <label className="block min-w-[200px] flex-1">
          <span className="micro-label mb-1 block">{t('common.vehicle')}</span>
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
          <span className="micro-label mb-1 block">{t('insights.validUntil')}</span>
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
          {t('insights.createALink')}
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
        emptyText={t('insights.noActiveLinksCreate')}
        onRetry={reload}
      />

      {!loading && !error && items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('insights.links')}</th>
                <th>{t('common.vehicles')}</th>
                <th>{t('insights.created')}</th>
                <th>{t('insights.validUntil')}</th>
                <th aria-label={t('common.actions')} />
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
                      title={t('insights.copyTheLink')}
                      aria-label={t('insights.copyTheLink')}
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
                      title={t('insights.deleteLink')}
                      aria-label={t('insights.deleteLink')}
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
          <h2 className="text-sm font-semibold text-txt-primary">{t('common.vehicleGroups')}</h2>
          <span className="badge badge-neutral">{groups.data?.items?.length ?? 0}</span>
        </header>
        <ReportState
          loading={groups.loading}
          error={groups.error}
          empty={(groups.data?.items ?? []).length === 0}
          emptyText={t('insights.noGroupsCreatedFm')}
          onRetry={groups.reload}
        />
        {(groups.data?.items ?? []).length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.title')}</th>
                <th className="num">{t('insights.objects')}</th>
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
          <h2 className="text-sm font-semibold text-txt-primary">{t('insights.fmTrackUsers')}</h2>
          <span className="badge badge-neutral">{users.data?.items?.length ?? 0}</span>
        </header>
        <ReportState
          loading={users.loading}
          error={users.error}
          empty={(users.data?.items ?? []).length === 0}
          emptyText={t('insights.noUsersFound')}
          onRetry={users.reload}
        />
        {(users.data?.items ?? []).length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('insights.name')}</th>
                <th>Email</th>
                <th>{t('insights.phone')}</th>
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
