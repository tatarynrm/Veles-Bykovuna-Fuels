'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import RuptelaShell from '@/components/RuptelaShell';
import { GuestBlockedPanel } from '@/components/GuestLock';
import { useSessionUser } from '@/lib/useAuthGuard';
import RuptelaVehicleSearchSelect from '@/components/RuptelaVehicleSearchSelect';
import { apiGet, apiList, apiSend } from '@/lib/api';
import {
  NO_DATA,
  PLANNABLE_WAYPOINT_TYPES,
  WAYPOINT_TYPE_LABEL,
  driverDisplayName,
  type RuptelaDriver,
  type RuptelaTrip,
  type RuptelaVehicle,
  type WaypointType,
} from '@/lib/ruptela';
import AddressGeocodeInput from '@/components/AddressGeocodeInput';
import {
  PlusCircle,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  BellRing,
  Info,
  History,
  Globe2,
} from 'lucide-react';
import { t } from '@/lib/i18n';

/**
 * A waypoint as edited in this form. Ruptela's InputLocation accepts either a
 * lat/lon pair or a free-text address, so the form keeps both and sends
 * whichever the dispatcher filled in.
 */
interface DraftWaypoint {
  key: string;
  type: WaypointType;
  address: string;
  latitude: string;
  longitude: string;
  notes: string;
  /** Ruptela requires the arrival window as a pair — send both or neither. */
  arrivalPlannedFrom: string;
  arrivalPlannedTill: string;
  durationMinutes: string;
  cargoWeightKg: string;
  todos: string[];
  /**
   * True when lat/lon came from geocoding the current address text. Editing
   * the address afterwards clears the pair — otherwise Ruptela would route to
   * the old coordinates while the form shows a new address (coordinates win
   * over address upstream).
   */
  geocoded: boolean;
}

const newWaypoint = (type: WaypointType): DraftWaypoint => ({
  key: Math.random().toString(36).slice(2),
  type,
  address: '',
  latitude: '',
  longitude: '',
  notes: '',
  arrivalPlannedFrom: '',
  arrivalPlannedTill: '',
  durationMinutes: '',
  cargoWeightKg: '',
  todos: [],
  geocoded: false,
});

export default function RuptelaCreateTripPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-bdr-strong border-t-warn" />
        </div>
      }
    >
      <CreateTripView />
    </Suspense>
  );
}

/** One localStorage slot for the whole unsaved trip form. */
const TRIP_DRAFT_KEY = 'veles_draft_create_trip';

interface TripDraft {
  title: string;
  vehicleId: string;
  driverId: string;
  notes: string;
  plannedArrivalFrom: string;
  plannedArrivalTill: string;
  notifyDriver: boolean;
  waypoints: DraftWaypoint[];
  savedAt: string;
}

/** ISO from the API → value for <input type="datetime-local"> (local time). */
const isoToLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** A trip fetched for editing → editable form rows. */
const tripToDraftWaypoints = (trip: RuptelaTrip): DraftWaypoint[] =>
  (trip.waypoints ?? []).map((w) => ({
    key: Math.random().toString(36).slice(2),
    type: (PLANNABLE_WAYPOINT_TYPES.includes(w.type as WaypointType)
      ? w.type
      : 'OTHER') as WaypointType,
    address: w.address ?? '',
    latitude: w.latitude != null ? String(w.latitude) : '',
    longitude: w.longitude != null ? String(w.longitude) : '',
    notes: w.notes ?? '',
    arrivalPlannedFrom: isoToLocalInput(w.arrival_planned_from),
    arrivalPlannedTill: isoToLocalInput(w.arrival_planned_till),
    durationMinutes: w.duration_minutes != null ? String(w.duration_minutes) : '',
    cargoWeightKg: w.cargo_weight_kg != null ? String(w.cargo_weight_kg) : '',
    todos: (w.todos ?? []).map((t) => t.description ?? '').filter(Boolean),
    geocoded: false,
  }));

function CreateTripView() {
  const router = useRouter();
  const { isGuest } = useSessionUser();
  const searchParams = useSearchParams();
  const preselectedVehicleId = searchParams.get('vehicleId');
  /** Present → the same form edits an existing trip instead of creating one. */
  const editTripId = searchParams.get('edit');

  const [vehicles, setVehicles] = useState<RuptelaVehicle[]>([]);
  const [drivers, setDrivers] = useState<RuptelaDriver[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(Boolean(editTripId));

  const [title, setTitle] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [notes, setNotes] = useState('');
  // Ruptela requires this window as a pair — see assertArrivalWindow on the backend.
  const [plannedArrivalFrom, setPlannedArrivalFrom] = useState('');
  const [plannedArrivalTill, setPlannedArrivalTill] = useState('');
  const [notifyDriver, setNotifyDriver] = useState(false);

  const [waypoints, setWaypoints] = useState<DraftWaypoint[]>([
    newWaypoint('LOADING'),
    newWaypoint('UNLOADING'),
  ]);

  /* ── draft persistence: a reload must not cost the dispatcher the form ──
     Edit drafts are keyed per trip so an unfinished edit of one trip can
     never leak into another trip or into the create form. */
  const draftKey = editTripId ? `veles_draft_edit_trip_${editTripId}` : TRIP_DRAFT_KEY;
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);

  // Restore once after mount (the first render must match SSR markup).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw) as TripDraft;
        setTitle(d.title ?? '');
        setVehicleId(d.vehicleId ?? '');
        setDriverId(d.driverId ?? '');
        setNotes(d.notes ?? '');
        setPlannedArrivalFrom(d.plannedArrivalFrom ?? '');
        setPlannedArrivalTill(d.plannedArrivalTill ?? '');
        setNotifyDriver(Boolean(d.notifyDriver));
        if (Array.isArray(d.waypoints) && d.waypoints.length >= 2) {
          setWaypoints(d.waypoints);
        }
        setDraftRestoredAt(d.savedAt ?? null);
      }
    } catch {
      /* corrupted draft — start clean */
    }
    setDraftReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Edit mode: pull the trip and prefill — unless a newer local draft exists.
  useEffect(() => {
    if (!editTripId || !draftReady) return;
    if (draftRestoredAt) {
      setLoadingTrip(false);
      return;
    }
    let alive = true;
    apiGet<RuptelaTrip | null>(`/api/ruptela/trips/${editTripId}`)
      .then((trip) => {
        if (!alive) return;
        if (!trip) {
          setError(t('trip.tripNotFoundMay'));
          return;
        }
        setTitle(trip.title ?? '');
        setVehicleId(trip.vehicle_id ?? '');
        setDriverId(trip.driver_id ?? '');
        setNotes(trip.notes ?? '');
        const wps = tripToDraftWaypoints(trip);
        if (wps.length >= 2) setWaypoints(wps);
      })
      .catch((e: any) => alive && setError(e?.message ?? t('trip.couldNotLoadTrip')))
      .finally(() => alive && setLoadingTrip(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTripId, draftReady, draftRestoredAt]);

  // Save on any change, debounced. Never before restore — that would wipe the draft.
  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      const draft: TripDraft = {
        title,
        vehicleId,
        driverId,
        notes,
        plannedArrivalFrom,
        plannedArrivalTill,
        notifyDriver,
        waypoints,
        savedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        /* best-effort */
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    draftReady,
    title,
    vehicleId,
    driverId,
    notes,
    plannedArrivalFrom,
    plannedArrivalTill,
    notifyDriver,
    waypoints,
  ]);

  const clearDraftStorage = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, []);

  const discardDraft = useCallback(() => {
    clearDraftStorage();
    setTitle('');
    setDriverId('');
    setNotes('');
    setPlannedArrivalFrom('');
    setPlannedArrivalTill('');
    setNotifyDriver(false);
    setWaypoints([newWaypoint('LOADING'), newWaypoint('UNLOADING')]);
    setDraftRestoredAt(null);
    setError(null);
  }, [clearDraftStorage]);

  useEffect(() => {
    apiList<RuptelaVehicle>('/api/ruptela/vehicles').then((data) => {
      setVehicles(data);
      // Priority: explicit ?vehicleId in the URL → restored draft → first vehicle.
      const fromUrl = data.find((v) => v.id === preselectedVehicleId);
      if (fromUrl) setVehicleId(fromUrl.id);
      else setVehicleId((prev) => (data.some((v) => v.id === prev) ? prev : (data[0]?.id ?? '')));
    });
    apiList<RuptelaDriver>('/api/ruptela/insights/drivers').then(setDrivers);
  }, [preselectedVehicleId]);

  const patchWaypoint = useCallback(
    (key: string, patch: Partial<DraftWaypoint>) =>
      setWaypoints((list) => list.map((w) => (w.key === key ? { ...w, ...patch } : w))),
    [],
  );

  /** Keyboard/touch fallback for reordering — HTML5 DnD covers neither. */
  const moveWaypoint = (index: number, delta: -1 | 1) => {
    setWaypoints((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  /* ── drag & drop: live reorder while dragging over siblings ── */
  const [dragKey, setDragKey] = useState<string | null>(null);

  const onCardDragEnter = (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) return;
    setWaypoints((list) => {
      const from = list.findIndex((w) => w.key === dragKey);
      const to = list.findIndex((w) => w.key === targetKey);
      if (from === -1 || to === -1) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError(t('trip.enterTripTitle'));
    if (!vehicleId) return setError(t('common.selectAVehicle'));

    // Mirror the backend's rules so the dispatcher gets instant feedback
    // instead of a round-trip; the backend still enforces all of this.
    for (let i = 0; i < waypoints.length; i++) {
      const w = waypoints[i];
      const n = t('trip.stopNo', { v0: i + 1 });

      const hasLat = w.latitude.trim() !== '';
      const hasLon = w.longitude.trim() !== '';
      if (hasLat !== hasLon) {
        return setError(t('trip.coordinatesComePairsBoth', { v0: n }));
      }
      if (hasLat) {
        const lat = Number(w.latitude);
        const lon = Number(w.longitude);
        if (!Number.isFinite(lat) || Math.abs(lat) > 90) {
          return setError(t('trip.latitudeMustNumberBetween', { v0: n }));
        }
        if (!Number.isFinite(lon) || Math.abs(lon) > 180) {
          return setError(t('trip.longitudeMustNumberBetween', { v0: n }));
        }
      }
      if (!hasLat && !w.address.trim()) {
        return setError(t('trip.enterAddressCoordinates', { v0: n }));
      }

      // datetime-local strings share a format, so they compare lexicographically
      const hasFrom = Boolean(w.arrivalPlannedFrom);
      const hasTill = Boolean(w.arrivalPlannedTill);
      if (hasFrom !== hasTill) {
        return setError(t('trip.setBothEndsArrival', { v0: n }));
      }
      if (hasFrom && w.arrivalPlannedFrom > w.arrivalPlannedTill) {
        return setError(t('trip.arrivalWindowStartsAfter', { v0: n }));
      }
    }

    if (Boolean(plannedArrivalFrom) !== Boolean(plannedArrivalTill)) {
      return setError(t('trip.plannedArrivalSetBoth'));
    }
    if (plannedArrivalFrom && plannedArrivalFrom > plannedArrivalTill) {
      return setError(t('trip.plannedArrivalStartLater'));
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        vehicleId,
        notes: notes.trim() || undefined,
        plannedArrivalFrom: plannedArrivalFrom
          ? new Date(plannedArrivalFrom).toISOString()
          : undefined,
        plannedArrivalTill: plannedArrivalTill
          ? new Date(plannedArrivalTill).toISOString()
          : undefined,
        notifyDrivers: notifyDriver,
        primaryDriverId: driverId || undefined,
        waypoints: waypoints.map((w) => ({
          type: w.type,
          // Ruptela prefers coordinates when both are supplied.
          latitude: w.latitude.trim() ? Number(w.latitude) : undefined,
          longitude: w.longitude.trim() ? Number(w.longitude) : undefined,
          address: w.address.trim() || undefined,
          notes: w.notes.trim() || undefined,
          arrivalPlannedFrom: w.arrivalPlannedFrom
            ? new Date(w.arrivalPlannedFrom).toISOString()
            : undefined,
          arrivalPlannedTill: w.arrivalPlannedTill
            ? new Date(w.arrivalPlannedTill).toISOString()
            : undefined,
          durationMinutes: w.durationMinutes ? Number(w.durationMinutes) : undefined,
          cargoWeightKg: w.cargoWeightKg ? Number(w.cargoWeightKg) : undefined,
          todos: w.todos
            .filter((t) => t.trim())
            .map((description) => ({ description: description.trim() })),
        })),
      };

      const saved = editTripId
        ? await apiSend<RuptelaTrip>('PUT', `/api/ruptela/trips/${editTripId}`, payload)
        : await apiSend<RuptelaTrip>('POST', '/api/ruptela/trips', payload);
      // The trip is in Ruptela now — the local draft has served its purpose.
      clearDraftStorage();
      router.push(`/ruptela/routes-tasks?trip=${saved.id}`);
    } catch (err: any) {
      // The backend forwards Ruptela's own validation text — show it verbatim
      // instead of a generic failure message.
      setError(err?.message ?? (editTripId ? t('trip.couldNotSaveChanges') : t('trip.couldNotCreateTrip')));
      setSubmitting(false);
    }
  };

  // A guest never reaches the form: the backend would reject the write anyway, and a
  // filled-in form that fails on submit is a worse answer than saying so up front.
  if (isGuest) {
    return (
      <RuptelaShell
        title={editTripId ? t('trip.editTheTrip') : t('common.createATrip')}
        subtitle={t('trip.guestModeViewOnly')}
      >
        <GuestBlockedPanel />
      </RuptelaShell>
    );
  }

  return (
    <RuptelaShell
      title={editTripId ? t('trip.editTheTrip') : t('common.createATrip')}
      subtitle={
        editTripId
          ? t('trip.routeStopTaskChanges')
          : t('trip.routeGoesStraightRuptela')
      }
    >
      {loadingTrip && (
        <div className="flex items-center gap-2 py-10 text-2xs text-txt-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('trip.loadingTripRuptelaEllipsis')}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={`max-w-4xl space-y-5 ${loadingTrip ? 'hidden' : ''}`}
      >
        {draftRestoredAt && (
          <div className="flex flex-wrap items-center gap-2 rounded-field border border-bdr-subtle bg-surface px-3 py-2 text-2xs text-txt-secondary">
            <History className="h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
            <span>
              {t('trip.draftRestoredFrom')}{' '}
              {new Date(draftRestoredAt).toLocaleString('uk-UA', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              {t('trip.noDataWasLost')}
            </span>
            <button
              type="button"
              onClick={discardDraft}
              className="ml-auto font-semibold text-danger hover:underline"
            >
              {t('trip.startBlankForm')}
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-field border border-danger/25 bg-danger/10 p-3 text-2xs text-danger"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Basics ── */}
        <section className="glass-panel space-y-4 p-5">
          <h2 className="text-sm font-semibold text-txt-primary">{t('trip.main')}</h2>

          <label className="block">
            <span className="micro-label mb-1.5 block">{t('trip.tripTitle')}</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('trip.exampleChernivtsiLviv')}
              required
              className="field"
            />
          </label>

          <RuptelaVehicleSearchSelect
            vehicles={vehicles}
            selectedVehicleId={vehicleId}
            onSelectVehicle={(v) => setVehicleId(v.id)}
          />

          <label className="block">
            <span className="micro-label mb-1.5 block">{t('common.driver')}</span>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="field"
            >
              <option value="">
                {t('trip.assignedVehicle')}{selectedVehicle?.driver_name ? `: ${selectedVehicle.driver_name}` : ` (${NO_DATA})`}
              </option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {driverDisplayName(d)}
                </option>
              ))}
            </select>
          </label>

          <div className="glass-inset flex items-start gap-2 p-3">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-txt-muted" />
            <p className="text-micro text-txt-muted">
              {t('trip.driverChosenHereAssigned')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="micro-label mb-1.5 block">{t('trip.notesDriver')}</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('trip.cargoSpecialConditionsEllipsis')}
                className="field"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="micro-label mb-1.5 block">{t('trip.arrivalFrom')}</span>
                <input
                  type="datetime-local"
                  value={plannedArrivalFrom}
                  onChange={(e) => setPlannedArrivalFrom(e.target.value)}
                  className="field"
                />
              </label>
              <label className="block">
                <span className="micro-label mb-1.5 block">{t('trip.arrivalTo')}</span>
                <input
                  type="datetime-local"
                  value={plannedArrivalTill}
                  min={plannedArrivalFrom || undefined}
                  onChange={(e) => setPlannedArrivalTill(e.target.value)}
                  className="field"
                />
              </label>
            </div>
          </div>

          <label className="glass-inset flex cursor-pointer items-center gap-3 p-3">
            <input
              type="checkbox"
              checked={notifyDriver}
              onChange={(e) => setNotifyDriver(e.target.checked)}
              className="h-4 w-4 shrink-0 accent-[color:var(--warn)]"
            />
            <span className="flex items-center gap-2 text-2xs text-txt-secondary">
              <BellRing className="h-3.5 w-3.5 text-warn" />
              {t('trip.sendTripDriverS')}
            </span>
          </label>
        </section>

        {/* ── Waypoints ── */}
        <section className="glass-panel space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-txt-primary">{t('trip.route')}</h2>
              <p className="mt-0.5 text-2xs text-txt-muted">
                {t('trip.leastTwoStopsTheir')}{' '}
                <GripVertical className="inline h-3 w-3 align-[-2px]" /> {t('trip.arrowKeys')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWaypoints((l) => [...l, newWaypoint('PASS_THROUGH')])}
              className="btn btn-ghost"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('trip.addStop')}
            </button>
          </div>

          <div className="space-y-3">
            {waypoints.map((w, index) => (
              <div
                key={w.key}
                data-wp-card
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDragEnter={() => onCardDragEnter(w.key)}
                onDrop={(e) => e.preventDefault()}
                className={`glass-inset space-y-3 p-4 transition-[opacity,box-shadow] duration-150 ${
                  dragKey === w.key ? 'opacity-60 ring-1 ring-warn/50' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      draggable
                      onDragStart={(e) => {
                        setDragKey(w.key);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', w.key);
                        // Drag the whole card visually, not the tiny handle
                        const card = (e.currentTarget as HTMLElement).closest('[data-wp-card]');
                        if (card instanceof HTMLElement) {
                          e.dataTransfer.setDragImage(card, 24, 24);
                        }
                      }}
                      onDragEnd={() => setDragKey(null)}
                      title={t('trip.dragToReorder')}
                      aria-hidden="true"
                      className="flex h-7 w-7 cursor-grab items-center justify-center rounded-control text-txt-muted transition-colors hover:bg-surface-hover hover:text-txt-primary active:cursor-grabbing"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-control bg-warn/10 font-mono text-micro font-semibold text-warn">
                      {index + 1}
                    </span>
                    <select
                      value={w.type}
                      onChange={(e) =>
                        patchWaypoint(w.key, { type: e.target.value as WaypointType })
                      }
                      aria-label={t('trip.typeOfStop', { v0: index + 1 })}
                      className="field field-sm w-auto"
                    >
                      {PLANNABLE_WAYPOINT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {WAYPOINT_TYPE_LABEL[t] ?? t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveWaypoint(index, -1)}
                      disabled={index === 0}
                      aria-label={t('trip.moveUp')}
                      title={t('trip.moveUp')}
                      className="btn-icon h-7 w-7 disabled:opacity-30"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveWaypoint(index, 1)}
                      disabled={index === waypoints.length - 1}
                      aria-label={t('trip.moveDown')}
                      title={t('trip.moveDown')}
                      className="btn-icon h-7 w-7 disabled:opacity-30"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaypoints((l) => l.filter((x) => x.key !== w.key))}
                      disabled={waypoints.length <= 2}
                      aria-label={t('trip.removeStop')}
                      title={t('trip.removeStop')}
                      className="btn-icon h-7 w-7 hover:text-danger disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="block">
                  <span className="micro-label mb-1 block">
                    {t('trip.addressStartTypingThen')}
                  </span>
                  <AddressGeocodeInput
                    value={w.address}
                    ariaLabel={t('trip.addressOfStop', { v0: index + 1 })}
                    onChange={(address) =>
                      patchWaypoint(
                        w.key,
                        // Coordinates win over address upstream, so geocoded
                        // coords must not outlive the address they came from.
                        w.geocoded
                          ? { address, latitude: '', longitude: '', geocoded: false }
                          : { address },
                      )
                    }
                    onResolve={(r) =>
                      patchWaypoint(w.key, {
                        address: r.address,
                        latitude: r.latitude,
                        longitude: r.longitude,
                        geocoded: true,
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="micro-label mb-1 block">{t('common.latitude')}</span>
                    <input
                      type="number"
                      step="any"
                      value={w.latitude}
                      onChange={(e) =>
                        patchWaypoint(w.key, { latitude: e.target.value, geocoded: false })
                      }
                      placeholder="48.292"
                      className="field tabular"
                    />
                  </label>
                  <label className="block">
                    <span className="micro-label mb-1 block">{t('common.longitude')}</span>
                    <input
                      type="number"
                      step="any"
                      value={w.longitude}
                      onChange={(e) =>
                        patchWaypoint(w.key, { longitude: e.target.value, geocoded: false })
                      }
                      placeholder="25.935"
                      className="field tabular"
                    />
                  </label>
                </div>

                {w.geocoded && (
                  <p className="flex items-center gap-1.5 text-micro text-txt-muted">
                    <Globe2 className="h-3 w-3 shrink-0 text-accent" />
                    {t('trip.coordinatesResolvedAutomaticallyAddress')}
                  </p>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="block">
                    <span className="micro-label mb-1 block">{t('trip.arrivalFrom')}</span>
                    <input
                      type="datetime-local"
                      value={w.arrivalPlannedFrom}
                      onChange={(e) =>
                        patchWaypoint(w.key, { arrivalPlannedFrom: e.target.value })
                      }
                      className="field"
                    />
                  </label>
                  <label className="block">
                    <span className="micro-label mb-1 block">{t('trip.arrivalTo')}</span>
                    <input
                      type="datetime-local"
                      value={w.arrivalPlannedTill}
                      min={w.arrivalPlannedFrom || undefined}
                      onChange={(e) =>
                        patchWaypoint(w.key, { arrivalPlannedTill: e.target.value })
                      }
                      className="field"
                    />
                  </label>
                  <label className="block">
                    <span className="micro-label mb-1 block">{t('trip.standingMin')}</span>
                    <input
                      type="number"
                      min="0"
                      value={w.durationMinutes}
                      onChange={(e) =>
                        patchWaypoint(w.key, { durationMinutes: e.target.value })
                      }
                      placeholder="60"
                      className="field tabular"
                    />
                  </label>
                  <label className="block">
                    <span className="micro-label mb-1 block">{t('trip.cargoKg')}</span>
                    <input
                      type="number"
                      min="0"
                      value={w.cargoWeightKg}
                      onChange={(e) =>
                        patchWaypoint(w.key, { cargoWeightKg: e.target.value })
                      }
                      placeholder="20000"
                      disabled={w.type !== 'LOADING' && w.type !== 'UNLOADING'}
                      title={
                        w.type !== 'LOADING' && w.type !== 'UNLOADING'
                          ? t('trip.ruptelaAcceptsCargoWeight')
                          : undefined
                      }
                      className="field tabular"
                    />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <span className="micro-label block">{t('trip.driverTaskStop')}</span>
                  {w.todos.map((todo, tIdx) => (
                    <div key={tIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={todo}
                        onChange={(e) =>
                          patchWaypoint(w.key, {
                            todos: w.todos.map((t, i) => (i === tIdx ? e.target.value : t)),
                          })
                        }
                        placeholder={t('trip.exampleSignConsignmentNote')}
                        className="field"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patchWaypoint(w.key, {
                            todos: w.todos.filter((_, i) => i !== tIdx),
                          })
                        }
                        aria-label={t('trip.removeTask')}
                        className="btn-icon h-8 w-8 shrink-0 hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => patchWaypoint(w.key, { todos: [...w.todos, ''] })}
                    className="text-micro font-semibold text-warn hover:underline"
                  >
                    {t('trip.addTask')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-center justify-end gap-2 pb-4">
          <Link href="/ruptela/routes-tasks" className="btn btn-ghost">
            {t('trip.cancel')}
          </Link>
          <button type="submit" disabled={submitting} className="btn btn-warn px-6 py-3">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {editTripId ? t('trip.savingEllipsis') : t('trip.creatingEllipsis')}
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4" />
                {editTripId ? t('trip.saveChangesRuptela') : t('trip.createTripRuptela')}
              </>
            )}
          </button>
        </div>
      </form>
    </RuptelaShell>
  );
}
