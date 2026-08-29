/**
 * Ruptela / fm-track telematics + Routing & Tasking — the normalized shapes the
 * frontend consumes. **Single source of truth** for these types on the frontend.
 *
 * Mirrors the backend adapters:
 *   - backend/src/ruptela/ruptela-api.service.ts       (FMS telemetry)
 *   - backend/src/ruptela/ruptela-routing.service.ts   (RnT trips, GraphQL)
 *
 * Every field is read straight off api.fm-track.com. `null` means the device did not
 * report that value — render it as a dash, never as a substituted number.
 *
 * Pure types only (no runtime): i18n label maps and formatters live in
 * `@/lib/ruptela`, which re-exports everything here.
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

/** A driver from GET /api/ruptela/insights/drivers (FMS /drivers?version=2). */
export interface RuptelaDriver {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone?: string | null;
  identifiers?: Array<{ identifier: string; type: string }>;
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
