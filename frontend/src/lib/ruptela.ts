import { t, localizedMap, intlLocale } from '@/lib/i18n';
/**
 * Shape of the Ruptela telematics feed, mirroring `backend/src/ruptela/ruptela-api.service.ts`.
 *
 * Every field is read straight off api.fm-track.com. `null` means the device did not
 * report that value — render it as a dash, never as a substituted number.
 */

export interface RuptelaTelemetry {
  // GPS — from /objects-last-coordinate
  latitude: number | null;
  longitude: number | null;
  speed: number | null; // km/h
  heading: number | null; // degrees
  altitude: number | null; // m
  satellites: number | null;
  gps_datetime: string | null;

  // CAN bus / device inputs — from /objects/{id}/coordinates
  can_datetime: string | null;
  ignition: boolean | null;
  engine_rpm: number | null;
  engine_hours: number | null; // h
  odometer_km: number | null; // km
  fuel_level_liters: number | null; // L
  fuel_level_percent: number | null; // %
  fuel_rate_lph: number | null; // L/h
  fuel_used_total_liters: number | null; // L, lifetime
  coolant_temp: number | null; // °C — null while the engine is off
  power_supply_voltage: number | null; // V — vehicle 24 V line
  device_battery_voltage: number | null; // V — tracker backup cell
  pedal_position: number | null; // %
  parking_brake: boolean | null;
  cruise_control: boolean | null;
  gsm_signal: number | null;
  hdop: number | null;
  gprs_connected: boolean | null;
}

export type RuptelaStatus = 'moving' | 'idle' | 'stopped' | 'offline';

export interface RuptelaVehicle {
  id: string;
  device_imei: string;
  name: string;
  plate: string;
  type: string;
  make: string;
  model: string;
  vin: string | null;
  fuel_type: string | null;
  status: RuptelaStatus;
  /** Resolved from the vehicle's most recent trip; null when the API has no assignment. */
  driver_name: string | null;
  /** Tachograph card id from the CAN bus. */
  driver_card: string | null;
  driver_state: string | null;
  driver_card_inserted: boolean | null;
  telemetry: RuptelaTelemetry;
}

export interface RuptelaTripHistoryItem {
  id: string;
  object_id: string;
  trip_type: string;
  duration_minutes: number;
  mileage_km: number;
  fuel_consumed_liters: number;
  start_time: string;
  start_address: string;
  end_time: string;
  end_address: string;
}

/**
 * One record of the coordinate history (`/api/ruptela/vehicles/:id/coordinates`,
 * fm-track `/objects/{id}/coordinates?version=2`). Position and CAN values come from
 * the same record, so a point is internally consistent.
 */
export interface RuptelaTrackPoint {
  datetime: string;
  latitude: number | null;
  longitude: number | null;
  speed: number | null; // km/h
  heading: number | null; // degrees
  altitude: number | null; // m
  satellites: number | null;
  ignition: boolean | null;
  trip_type: string | null;
  engine_rpm: number | null;
  engine_hours: number | null; // h
  odometer_km: number | null; // km
  fuel_level_liters: number | null; // L
  fuel_level_percent: number | null; // %
  fuel_rate_lph: number | null; // L/h
  fuel_used_total_liters: number | null; // L, lifetime
  coolant_temp: number | null; // °C — null while the engine is off
  power_supply_voltage: number | null; // V
  device_battery_voltage: number | null; // V
  pedal_position: number | null; // %
  gsm_signal: number | null;
  hdop: number | null;
  driver_state: string | null;
}

export interface RuptelaVehicleTrack {
  object_id: string;
  from: string;
  to: string;
  /** Oldest-first. */
  points: RuptelaTrackPoint[];
  latest: RuptelaTrackPoint | null;
  count: number;
  truncated: boolean;
  fetched_at: string;
  error: string | null;
}

export const STATUS_LABEL: Record<RuptelaStatus, string> = localizedMap({
  moving: 'telematics.moving',
  idle: 'common.idling',
  stopped: 'telematics.stopped',
  offline: 'common.offline',
});

/** The dash shown wherever the device reported nothing. */
export const NO_DATA = '—';

/** Formats a nullable reading, keeping a real 0 visible. */
export function metric(
  value: number | null | undefined,
  options: { unit?: string; digits?: number } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NO_DATA;
  const { unit, digits = 0 } = options;
  const text = value.toLocaleString(intlLocale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return unit ? `${text} ${unit}` : text;
}

/** Ukrainian label for a tachograph working state. */
export function driverStateLabel(state: string | null): string {
  switch (state) {
    case 'DRIVE':
      return t('telematics.driving');
    case 'REST':
      return t('telematics.rest');
    case 'WORK':
      return t('telematics.work');
    case 'AVAILABLE':
      return t('telematics.availability');
    default:
      return state || NO_DATA;
  }
}

/** A driver from GET /api/ruptela/insights/drivers (FMS /drivers?version=2). */
export interface RuptelaDriver {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone?: string | null;
  identifiers?: Array<{ identifier: string; type: string }>;
}

/**
 * Display name for an FMS driver. Some drivers are registered under a
 * tachograph card number only — fall back to the identifier, then the id.
 */
export function driverDisplayName(d: RuptelaDriver): string {
  const name = [d.last_name, d.first_name].filter(Boolean).join(' ').trim();
  return name || d.identifiers?.[0]?.identifier || d.id;
}

/** "3 хв тому" style age for a telemetry timestamp. */
export function relativeAge(iso: string | null): string {
  if (!iso) return NO_DATA;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return NO_DATA;

  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return t('telematics.justNow');
  if (minutes < 60) return t('telematics.minAgo', { v0: minutes });

  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('telematics.hAgo', { v0: hours });
  return t('telematics.dAgo', { v0: Math.round(hours / 24) });
}

/* ══════════════════════════════════════════════════════════════════════════
   Routing & Tasking (RnT) — trips
   Mirrors backend/src/ruptela/ruptela-routing.service.ts
   ══════════════════════════════════════════════════════════════════════════ */

export type TripState =
  | 'NEW'
  | 'SENT_TO_DRIVER'
  | 'SEEN'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'CANCELED'
  | 'COMPLETED';

export type TripStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export type TripScope = 'active' | 'archive' | 'all';

export type WaypointType =
  | 'LOADING'
  | 'UNLOADING'
  | 'CUSTOMS'
  | 'REFUELLING'
  | 'REST'
  | 'BREAK'
  | 'SERVICE'
  | 'TRAIN'
  | 'FERRY'
  | 'TRAILER_SWITCH'
  | 'DRIVER_SWITCH'
  | 'VEHICLE_SWITCH'
  | 'PASS_THROUGH'
  | 'OTHER';

export interface RuptelaTodo {
  id: string | null;
  description: string | null;
  type: string | null;
  completed: boolean;
  completed_at: string | null;
}

export interface RuptelaWaypoint {
  id: string | null;
  type: string | null;
  name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  duration_minutes?: number | null;
  cargo_weight_kg?: number | null;
  arrival_planned_from: string | null;
  arrival_planned_till: string | null;
  visited_at: string | null;
  eta: string | null;
  notes: string | null;
  todos: RuptelaTodo[];
}

export interface RuptelaTrip {
  id: string;
  title: string;
  state: TripState | null;
  status: TripStatus;
  notes: string | null;
  eta: string | null;
  completed_at: string | null;
  vehicle_id: string | null;
  vehicle_name: string | null;
  vehicle_plate: string | null;
  driver_id: string | null;
  driver_name: string | null;
  origin_name: string | null;
  origin_address: string | null;
  destination_name: string | null;
  destination_address: string | null;
  departure_time: string | null;
  distance_km: number | null;
  waypoints: RuptelaWaypoint[];
  tasks: RuptelaTodo[];
}

export type TripSortKey =
  | 'default'
  | 'departure'
  | 'eta'
  | 'title'
  | 'distance'
  | 'state';

export type SortOrder = 'asc' | 'desc';

/** Distinct filter values with counts, computed by the backend over the whole scope. */
export interface TripListFacets {
  states: Array<{ state: TripState; count: number }>;
  vehicles: Array<{ id: string; name: string | null; plate: string | null; count: number }>;
  drivers: Array<{ id: string; name: string | null; count: number }>;
}

export interface TripListResult {
  items: RuptelaTrip[];
  /** Count after filters, before pagination. */
  total: number;
  page: number;
  size: number;
  totalPages: number;
  scope: TripScope;
  facets: TripListFacets;
  fetchedAt: string | null;
  stale: boolean;
  error: string | null;
}

export const TRIP_SORT_LABEL: Record<TripSortKey, string> = localizedMap({
  default: 'telematics.defaultOrder',
  departure: 'telematics.byDeparture',
  eta: 'telematics.byArrivalETA',
  title: 'telematics.byTitle',
  distance: 'telematics.byDistance',
  state: 'telematics.byState',
});

/** Ukrainian labels for the RnT trip state machine. */
export const TRIP_STATE_LABEL: Record<TripState, string> = localizedMap({
  NEW: 'telematics.new',
  SENT_TO_DRIVER: 'telematics.sentToDriver',
  SEEN: 'telematics.seen',
  ACCEPTED: 'telematics.acceptedByDriver',
  IN_PROGRESS: 'telematics.enRoute',
  ON_HOLD: 'telematics.onHold',
  CANCELED: 'telematics.cancelled',
  COMPLETED: 'telematics.completed',
});

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = localizedMap({
  planned: 'telematics.planned',
  in_progress: 'telematics.enRoute',
  completed: 'telematics.statusCompleted',
  cancelled: 'telematics.statusCancelled',
});

export const WAYPOINT_TYPE_LABEL: Record<string, string> = localizedMap({
  LOADING: 'common.loading',
  UNLOADING: 'telematics.unloading',
  CUSTOMS: 'telematics.customs',
  REFUELLING: 'common.refuelling',
  REST: 'telematics.rest',
  BREAK: 'telematics.break',
  SERVICE: 'telematics.service',
  TRAIN: 'telematics.train',
  FERRY: 'telematics.ferry',
  TRAILER_SWITCH: 'telematics.trailerSwap',
  DRIVER_SWITCH: 'telematics.driverChange',
  VEHICLE_SWITCH: 'telematics.vehicleChange',
  PASS_THROUGH: 'telematics.passThrough',
  START_ROUTE: 'telematics.startOfRoute',
  END_ROUTE: 'telematics.endOfRoute',
  OTHER: 'telematics.other',
});

/** Waypoint types a dispatcher can pick when planning a trip. */
export const PLANNABLE_WAYPOINT_TYPES: WaypointType[] = [
  'LOADING',
  'UNLOADING',
  'CUSTOMS',
  'REFUELLING',
  'REST',
  'SERVICE',
  'FERRY',
  'PASS_THROUGH',
  'OTHER',
];

/** Best available human label for a stop. */
export function waypointLabel(w: RuptelaWaypoint): string {
  return w.name ?? w.address ?? WAYPOINT_TYPE_LABEL[w.type ?? ''] ?? NO_DATA;
}
