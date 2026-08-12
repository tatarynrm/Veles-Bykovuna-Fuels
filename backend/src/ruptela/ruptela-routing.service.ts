import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';

/**
 * Ruptela Routing & Tasking (RnT) GraphQL API.
 *
 * Endpoint: POST https://api.fm-track.com/routing?api_key=…
 * Reference: common/Ruptella - Api/RnT-GraphQL-API-Reference-A3 (1).pdf
 *
 * Two things about this API drive the whole design here:
 *
 * 1. `tripList` has no pagination and no date filter — its only inputs are
 *    `states` and `title`. Asking for COMPLETED trips together with the full
 *    route pulls the entire history in one response: measured at **31s / 146 KB
 *    for 89 trips**. The same query restricted to the six active states costs
 *    **4s / 29 KB for 11 trips**. So active trips and archived trips are fetched
 *    as separate scopes, with very different cache lifetimes, and the archive is
 *    never fetched unless somebody actually asks for it.
 *
 * 2. GraphQL answers with HTTP 200 even when the operation failed — the failure
 *    is in the `errors` array. A plain try/catch around axios therefore reports
 *    success for every rejected mutation, which is what made the previous
 *    implementation look like it was writing to Ruptela while it was only
 *    writing to an in-memory array. `graphql()` below throws on `errors`.
 */

export type TripState =
  | 'NEW'
  | 'SENT_TO_DRIVER'
  | 'SEEN'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'CANCELED'
  | 'COMPLETED';

/** Trips a dispatcher still acts on. Cheap to fetch, refreshed often. */
export const ACTIVE_STATES: TripState[] = [
  'NEW',
  'SENT_TO_DRIVER',
  'SEEN',
  'ACCEPTED',
  'IN_PROGRESS',
  'ON_HOLD',
];

/** Finished work. Expensive to fetch, changes rarely. */
export const ARCHIVE_STATES: TripState[] = ['COMPLETED', 'CANCELED'];

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

export const WAYPOINT_TYPES: WaypointType[] = [
  'LOADING',
  'UNLOADING',
  'CUSTOMS',
  'REFUELLING',
  'REST',
  'BREAK',
  'SERVICE',
  'TRAIN',
  'FERRY',
  'TRAILER_SWITCH',
  'DRIVER_SWITCH',
  'VEHICLE_SWITCH',
  'PASS_THROUGH',
  'OTHER',
];

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
  arrival_planned_from: string | null;
  arrival_planned_till: string | null;
  visited_at: string | null;
  eta: string | null;
  notes: string | null;
  duration_minutes: number | null;
  cargo_weight_kg: number | null;
  todos: RuptelaTodo[];
}

/** UI-facing grouping derived from the RnT state machine. */
export type TripStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

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
  /** Flattened waypoint todos — the driver checklist. */
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

/**
 * All filtering/sorting/pagination happens in memory over the cached scope —
 * Ruptela's tripList has none of it upstream, and the lists are small enough
 * (~10 active / ~90 archived) that this is the honest place to do it.
 */
export interface TripListQuery {
  scope?: TripScope;
  states?: TripState[];
  /** Substring match over title, vehicle, driver, route endpoints, notes, id. */
  q?: string;
  vehicleId?: string;
  driverId?: string;
  /** ISO date/datetime; matched against departure, falling back to ETA/completion. */
  from?: string;
  to?: string;
  sort?: TripSortKey;
  order?: SortOrder;
  page?: number;
  size?: number;
}

/** Distinct filter values with counts, computed over the whole scope (pre-filter). */
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
  /** When this data was actually fetched from Ruptela. */
  fetchedAt: string | null;
  /** True while a background refresh is in flight and this payload is stale. */
  stale: boolean;
  /** Present when the last refresh attempt failed; items are then last-known-good. */
  error: string | null;
}

export interface CreateTripInput {
  title: string;
  vehicleId: string;
  notes?: string;
  owner?: string;
  plannedArrivalFrom?: string;
  plannedArrivalTill?: string;
  waypoints: Array<{
    type: WaypointType;
    latitude?: number;
    longitude?: number;
    address?: string;
    notes?: string;
    arrivalPlannedFrom?: string;
    arrivalPlannedTill?: string;
    durationMinutes?: number;
    cargoWeightKg?: number;
    todos?: Array<{ description: string; type?: string }>;
  }>;
  /** Off by default — creating a trip should not page a driver unless asked. */
  notifyDrivers?: boolean;
  primaryDriverId?: string;
  secondaryDriverId?: string;
}

export interface UpdateTripInput {
  title?: string;
  notes?: string;
  vehicleId?: string;
  primaryDriverId?: string;
  secondaryDriverId?: string;
  notifyDrivers?: boolean;
  /**
   * Full route replacement. When present (≥2 points) the ENTIRE existing route
   * is replaced by these waypoints — verified live: legs sent without ids
   * replace the route, and Ruptela merges the shared boundary waypoint of
   * adjacent legs into one. Same element shape as CreateTripInput.waypoints.
   */
  waypoints?: CreateTripInput['waypoints'];
  /** Trip-level arrival window — travels via UpdateSettingsInput on update. */
  plannedArrivalFrom?: string;
  plannedArrivalTill?: string;
}

/* ── GraphQL documents ─────────────────────────────────────────────────── */

/** List projection. Route detail is deliberately excluded — see class docblock. */
const TRIP_SUMMARY_FIELDS = `
  id
  title
  notes
  eta
  status { state completedAt }
  vehicle { id name primaryDriver { id name } }
`;

/**
 * Detail projection. `route.metadata.distance` is the only metadata field the
 * schema exposes (`duration` is not defined on Metadata), and RouteStatistics
 * nests its numbers under plannedTotal/actualTotal.
 */
const WAYPOINT_FIELDS = `
  id type notes visitedAt eta arrivalPlannedFrom arrivalPlannedTill
  duration cargoWeight
  location { latitude longitude }
  address { locality street country }
  todos { id description type completed completedAt }
`;

const TRIP_DETAIL_FIELDS = `
  ${TRIP_SUMMARY_FIELDS}
  route {
    metadata { distance }
    legs {
      id
      start { ${WAYPOINT_FIELDS} }
      end { ${WAYPOINT_FIELDS} }
    }
  }
`;

const LIST_TRIPS = `
  query tripList($parameters: Parameters!) {
    tripList(parameters: $parameters) { ${TRIP_DETAIL_FIELDS} }
  }
`;

const CREATE_TRIP = `
  mutation createTrip($parameters: TripCreateParameters!) {
    createTrip(parameters: $parameters) { ${TRIP_DETAIL_FIELDS} }
  }
`;

const UPDATE_TRIP = `
  mutation updateTrip($parameters: TripUpdateParameters!) {
    updateTrip(parameters: $parameters) { ${TRIP_DETAIL_FIELDS} }
  }
`;

const DELETE_TRIP = `
  mutation deleteTrip($id: String!) { deleteTrip(id: $id) }
`;

/* ── Cache ─────────────────────────────────────────────────────────────── */

interface CacheEntry {
  data: RuptelaTrip[];
  fetchedAt: number;
  refreshing: boolean;
  error: string | null;
}

@Injectable()
export class RuptelaRoutingService implements OnModuleInit {
  private readonly logger = new Logger(RuptelaRoutingService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;

  /** Active trips change constantly but cost ~4s — refresh often, serve stale. */
  private readonly ACTIVE_TTL_MS = 30_000;
  /** The archive costs ~30s and barely changes — refresh rarely. */
  private readonly ARCHIVE_TTL_MS = 15 * 60_000;

  private readonly cache = new Map<'active' | 'archive', CacheEntry>();

  /**
   * Waypoint todos are read-only in the RnT schema: there is no mutation that
   * sets `completed`, and InputWaypointTodo carries no such field. Ticking a
   * task in this UI is therefore a local dispatcher note, not something Ruptela
   * ever sees — kept here so the flag survives a cache refresh, and surfaced to
   * the client as `local_only`.
   */
  private readonly localTodoOverrides = new Map<string, boolean>();

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RUPTELA_API_KEY') ?? '';
    const baseUrl =
      this.configService.get<string>('RUPTELA_BASE_URL') ?? 'https://api.fm-track.com';

    this.client = axios.create({
      baseURL: baseUrl,
      // The archive query legitimately runs past 30s; anything beyond this is a fault.
      timeout: 60_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** Warm the active scope at boot so the first page view never pays the 4s. */
  onModuleInit() {
    if (!this.apiKey) {
      this.logger.warn('RUPTELA_API_KEY is not set — Routing & Tasking is disabled');
      return;
    }
    this.refresh('active').catch(() => {
      /* logged in refresh(); boot must not fail on an upstream outage */
    });
  }

  /* ── transport ──────────────────────────────────────────────────────── */

  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    if (!this.apiKey) {
      throw new Error('RUPTELA_API_KEY is not configured');
    }

    const response = await this.client.post(
      `/routing?api_key=${this.apiKey}`,
      { query, variables },
    );

    // GraphQL reports failures inside a 200 response — this is the check the
    // previous implementation was missing. A plain Error here would surface to
    // the dispatcher as an anonymous 500; BadGateway carries Ruptela's own text
    // through Nest into the UI (frontend's toError() reads `message` verbatim).
    const errors = response.data?.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const message = errors.map((e: any) => e?.message ?? 'unknown').join('; ');
      throw new BadGatewayException(`Ruptela: ${message}`);
    }

    if (!response.data?.data) {
      throw new BadGatewayException('Ruptela RnT повернула порожню відповідь');
    }

    return response.data.data as T;
  }

  /* ── mapping ────────────────────────────────────────────────────────── */

  private static num(value: unknown): number | null {
    const n = typeof value === 'string' ? Number(value) : (value as number);
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  }

  /**
   * Ruptela treats each planned-arrival pair as one indivisible window: sending
   * half of it fails the whole mutation with
   * "Both [arrivalPlannedFrom] and [arrivalPlannedTill] must be provided".
   * Rejecting it here turns an opaque upstream 500 into a dispatcher-readable 400.
   */
  private static assertArrivalWindow(
    from: string | undefined,
    till: string | undefined,
    context: string,
  ): void {
    const hasFrom = Boolean(from);
    const hasTill = Boolean(till);

    if (hasFrom !== hasTill) {
      throw new BadRequestException(
        `${context}: вкажіть обидві межі вікна прибуття — «від» і «до»`,
      );
    }
    if (hasFrom && new Date(from!).getTime() > new Date(till!).getTime()) {
      throw new BadRequestException(
        `${context}: початок вікна прибуття пізніший за його кінець`,
      );
    }
  }

  private static text(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private static formatAddress(address: any): string | null {
    if (!address) return null;
    const parts = [address.street, address.locality, address.country]
      .map((p: unknown) => RuptelaRoutingService.text(p))
      .filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }

  private static toStatus(state: TripState | null): TripStatus {
    switch (state) {
      case 'IN_PROGRESS':
      case 'ACCEPTED':
      case 'SENT_TO_DRIVER':
      case 'SEEN':
        return 'in_progress';
      case 'COMPLETED':
        return 'completed';
      case 'CANCELED':
        return 'cancelled';
      default:
        return 'planned';
    }
  }

  private mapTodos(raw: any[], waypointId: string | null): RuptelaTodo[] {
    return (raw ?? []).map((todo: any, index: number) => {
      const id = RuptelaRoutingService.text(todo?.id) ?? `${waypointId ?? 'wp'}-todo-${index}`;
      const override = this.localTodoOverrides.get(id);
      return {
        id,
        description: RuptelaRoutingService.text(todo?.description),
        type: RuptelaRoutingService.text(todo?.type),
        completed: override ?? Boolean(todo?.completed),
        completed_at: RuptelaRoutingService.text(todo?.completedAt),
      };
    });
  }

  private mapWaypoint(raw: any): RuptelaWaypoint | null {
    if (!raw) return null;
    const id = RuptelaRoutingService.text(raw.id);
    return {
      id,
      type: RuptelaRoutingService.text(raw.type),
      // Highway stops carry no locality — fall back through the address rather
      // than showing an empty stop name.
      name:
        RuptelaRoutingService.text(raw.address?.locality) ??
        RuptelaRoutingService.text(raw.address?.street) ??
        RuptelaRoutingService.text(raw.address?.country),
      address: RuptelaRoutingService.formatAddress(raw.address),
      latitude: RuptelaRoutingService.num(raw.location?.latitude),
      longitude: RuptelaRoutingService.num(raw.location?.longitude),
      arrival_planned_from: RuptelaRoutingService.text(raw.arrivalPlannedFrom),
      arrival_planned_till: RuptelaRoutingService.text(raw.arrivalPlannedTill),
      visited_at: RuptelaRoutingService.text(raw.visitedAt),
      eta: RuptelaRoutingService.text(raw.eta),
      notes: RuptelaRoutingService.text(raw.notes),
      duration_minutes: RuptelaRoutingService.num(raw.duration),
      cargo_weight_kg: RuptelaRoutingService.num(raw.cargoWeight),
      todos: this.mapTodos(raw.todos, id),
    };
  }

  private mapTrip(raw: any): RuptelaTrip {
    const legs: any[] = raw?.route?.legs ?? [];

    // Legs overlap: leg[n].end is leg[n+1].start. Take every start plus the
    // final end so each physical stop appears exactly once.
    const waypoints: RuptelaWaypoint[] = [];
    for (const leg of legs) {
      const start = this.mapWaypoint(leg?.start);
      if (start) waypoints.push(start);
    }
    const lastEnd = this.mapWaypoint(legs[legs.length - 1]?.end);
    if (lastEnd) waypoints.push(lastEnd);

    const first = waypoints[0] ?? null;
    const last = waypoints.length > 1 ? waypoints[waypoints.length - 1] : null;

    const state = (RuptelaRoutingService.text(raw?.status?.state) as TripState) ?? null;
    const distanceMeters = RuptelaRoutingService.num(raw?.route?.metadata?.distance);
    const vehicleName = RuptelaRoutingService.text(raw?.vehicle?.name);

    return {
      id: raw.id,
      title: RuptelaRoutingService.text(raw.title) ?? 'Без назви',
      state,
      status: RuptelaRoutingService.toStatus(state),
      notes: RuptelaRoutingService.text(raw.notes),
      eta: RuptelaRoutingService.text(raw.eta),
      completed_at: RuptelaRoutingService.text(raw?.status?.completedAt),

      vehicle_id: RuptelaRoutingService.text(raw?.vehicle?.id),
      vehicle_name: vehicleName,
      // fm-track names vehicles "<number> <make> <plate>"; the plate is the tail.
      vehicle_plate: vehicleName ? (vehicleName.split(' ').pop() ?? null) : null,
      driver_id: RuptelaRoutingService.text(raw?.vehicle?.primaryDriver?.id),
      driver_name: RuptelaRoutingService.text(raw?.vehicle?.primaryDriver?.name),

      origin_name: first?.name ?? null,
      origin_address: first?.address ?? null,
      destination_name: last?.name ?? null,
      destination_address: last?.address ?? null,

      departure_time: first?.visited_at ?? first?.arrival_planned_from ?? null,
      distance_km: distanceMeters === null ? null : Math.round(distanceMeters / 1000),

      waypoints,
      tasks: waypoints.flatMap((w) => w.todos),
    };
  }

  /* ── cache plumbing ─────────────────────────────────────────────────── */

  private ttlFor(scope: 'active' | 'archive'): number {
    return scope === 'active' ? this.ACTIVE_TTL_MS : this.ARCHIVE_TTL_MS;
  }

  private async refresh(scope: 'active' | 'archive'): Promise<void> {
    const existing = this.cache.get(scope);
    if (existing?.refreshing) return;

    if (existing) existing.refreshing = true;
    else this.cache.set(scope, { data: [], fetchedAt: 0, refreshing: true, error: null });

    const started = Date.now();
    try {
      const states = scope === 'active' ? ACTIVE_STATES : ARCHIVE_STATES;
      const data = await this.graphql<{ tripList: any[] }>(LIST_TRIPS, {
        parameters: { states },
      });

      const trips = (data.tripList ?? []).map((t) => this.mapTrip(t));
      this.cache.set(scope, {
        data: trips,
        fetchedAt: Date.now(),
        refreshing: false,
        error: null,
      });

      this.logger.log(
        `RnT ${scope} trips refreshed: ${trips.length} in ${Date.now() - started}ms`,
      );
    } catch (error: any) {
      const entry = this.cache.get(scope);
      if (entry) {
        entry.refreshing = false;
        entry.error = error.message;
      }
      this.logger.error(`RnT ${scope} refresh failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stale-while-revalidate. A caller never waits for a refresh when any data
   * exists — the only blocking path is the very first archive request.
   */
  private async read(scope: 'active' | 'archive'): Promise<CacheEntry> {
    const entry = this.cache.get(scope);
    const fresh = entry && Date.now() - entry.fetchedAt < this.ttlFor(scope);

    if (entry && entry.fetchedAt > 0) {
      if (!fresh && !entry.refreshing) {
        this.refresh(scope).catch(() => {
          /* stale data is still served; the error lands on the entry */
        });
      }
      return entry;
    }

    await this.refresh(scope);
    return (
      this.cache.get(scope) ?? { data: [], fetchedAt: 0, refreshing: false, error: null }
    );
  }

  /** Applies a mutation result to the cache so the next read is already correct. */
  private upsertCached(trip: RuptelaTrip): void {
    const scope: 'active' | 'archive' =
      trip.state && ARCHIVE_STATES.includes(trip.state) ? 'archive' : 'active';

    for (const key of ['active', 'archive'] as const) {
      const entry = this.cache.get(key);
      if (!entry) continue;
      const index = entry.data.findIndex((t) => t.id === trip.id);
      if (key === scope) {
        if (index === -1) entry.data.unshift(trip);
        else entry.data[index] = trip;
      } else if (index !== -1) {
        entry.data.splice(index, 1);
      }
    }
  }

  private removeCached(id: string): void {
    for (const entry of this.cache.values()) {
      const index = entry.data.findIndex((t) => t.id === id);
      if (index !== -1) entry.data.splice(index, 1);
    }
  }

  /* ── filtering / sorting / facets ───────────────────────────────────── */

  /** Best timestamp a trip has: departure, else ETA, else completion. */
  private static tripTime(trip: RuptelaTrip): number | null {
    const iso = trip.departure_time ?? trip.eta ?? trip.completed_at;
    if (!iso) return null;
    const time = new Date(iso).getTime();
    return Number.isFinite(time) ? time : null;
  }

  /** Always returns a fresh array — the cache entry must never be mutated. */
  private static applyFilters(trips: RuptelaTrip[], query: TripListQuery): RuptelaTrip[] {
    let out = [...trips];

    if (query.states?.length) {
      const states = new Set(query.states);
      out = out.filter((t) => t.state !== null && states.has(t.state));
    }
    if (query.vehicleId) out = out.filter((t) => t.vehicle_id === query.vehicleId);
    if (query.driverId) out = out.filter((t) => t.driver_id === query.driverId);

    if (query.from || query.to) {
      const from = query.from ? new Date(query.from).getTime() : -Infinity;
      let to = query.to ? new Date(query.to).getTime() : Infinity;
      // A bare date means "through the end of that day", not its midnight.
      if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) to += 86_399_999;
      out = out.filter((t) => {
        const time = RuptelaRoutingService.tripTime(t);
        return time !== null && time >= from && time <= to;
      });
    }

    const q = query.q?.trim().toLowerCase();
    if (q) {
      out = out.filter((t) =>
        [
          t.id,
          t.title,
          t.notes,
          t.vehicle_name,
          t.vehicle_plate,
          t.driver_name,
          t.origin_name,
          t.origin_address,
          t.destination_name,
          t.destination_address,
        ].some((field) => field?.toLowerCase().includes(q)),
      );
    }

    return out;
  }

  private static sortTrips(
    trips: RuptelaTrip[],
    sort: TripSortKey,
    order: SortOrder,
  ): void {
    if (sort === 'default') {
      // Ruptela's own ordering; desc just flips it.
      if (order === 'desc') trips.reverse();
      return;
    }

    const stateOrder: TripState[] = [...ACTIVE_STATES, ...ARCHIVE_STATES];
    const key = (t: RuptelaTrip): string | number | null => {
      switch (sort) {
        case 'title':
          return t.title.toLowerCase();
        case 'eta':
          return t.eta ? new Date(t.eta).getTime() : null;
        case 'departure':
          return RuptelaRoutingService.tripTime(t);
        case 'distance':
          return t.distance_km;
        case 'state':
          return t.state ? stateOrder.indexOf(t.state) : null;
      }
      return null;
    };

    const dir = order === 'desc' ? -1 : 1;
    trips.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (ka === null && kb === null) return 0;
      // Missing values sink to the bottom in either direction.
      if (ka === null) return 1;
      if (kb === null) return -1;
      if (typeof ka === 'string' && typeof kb === 'string') {
        return ka.localeCompare(kb, 'uk') * dir;
      }
      return (Number(ka) - Number(kb)) * dir;
    });
  }

  private static buildFacets(trips: RuptelaTrip[]): TripListFacets {
    const states = new Map<TripState, number>();
    const vehicles = new Map<string, TripListFacets['vehicles'][number]>();
    const drivers = new Map<string, TripListFacets['drivers'][number]>();

    for (const trip of trips) {
      if (trip.state) states.set(trip.state, (states.get(trip.state) ?? 0) + 1);
      if (trip.vehicle_id) {
        const v = vehicles.get(trip.vehicle_id);
        if (v) v.count += 1;
        else
          vehicles.set(trip.vehicle_id, {
            id: trip.vehicle_id,
            name: trip.vehicle_name,
            plate: trip.vehicle_plate,
            count: 1,
          });
      }
      if (trip.driver_id) {
        const d = drivers.get(trip.driver_id);
        if (d) d.count += 1;
        else drivers.set(trip.driver_id, { id: trip.driver_id, name: trip.driver_name, count: 1 });
      }
    }

    const stateOrder: TripState[] = [...ACTIVE_STATES, ...ARCHIVE_STATES];
    const byName = (a: { name: string | null }, b: { name: string | null }) =>
      (a.name ?? '').localeCompare(b.name ?? '', 'uk');

    return {
      states: [...states.entries()]
        .sort((a, b) => stateOrder.indexOf(a[0]) - stateOrder.indexOf(b[0]))
        .map(([state, count]) => ({ state, count })),
      vehicles: [...vehicles.values()].sort(byName),
      drivers: [...drivers.values()].sort(byName),
    };
  }

  /* ── public API ─────────────────────────────────────────────────────── */

  async listTrips(query: TripListQuery = {}): Promise<TripListResult> {
    const scope = query.scope ?? 'active';

    let all: RuptelaTrip[];
    let fetchedAtMs: number;
    let stale: boolean;
    let error: string | null;

    if (scope === 'all') {
      const [active, archive] = await Promise.all([this.read('active'), this.read('archive')]);
      all = [...active.data, ...archive.data];
      fetchedAtMs = Math.min(active.fetchedAt, archive.fetchedAt);
      stale = active.refreshing || archive.refreshing;
      error = active.error ?? archive.error;
    } else {
      const entry = await this.read(scope);
      all = entry.data;
      fetchedAtMs = entry.fetchedAt;
      stale = entry.refreshing;
      error = entry.error;
    }

    // Facets describe the whole scope so filter options never vanish while active.
    const facets = RuptelaRoutingService.buildFacets(all);
    const filtered = RuptelaRoutingService.applyFilters(all, query);
    RuptelaRoutingService.sortTrips(filtered, query.sort ?? 'default', query.order ?? 'asc');

    const size = Math.min(Math.max(Math.trunc(query.size ?? 10) || 10, 1), 100);
    const totalPages = Math.max(1, Math.ceil(filtered.length / size));
    const page = Math.min(Math.max(Math.trunc(query.page ?? 1) || 1, 1), totalPages);

    return {
      items: filtered.slice((page - 1) * size, page * size),
      total: filtered.length,
      page,
      size,
      totalPages,
      scope,
      facets,
      fetchedAt: fetchedAtMs > 0 ? new Date(fetchedAtMs).toISOString() : null,
      stale,
      error,
    };
  }

  /**
   * The schema has no `getTrip(id)` query, so a single trip is resolved out of
   * the cached lists — active first, since that is the cheap scope.
   */
  async getTrip(id: string): Promise<RuptelaTrip | null> {
    const active = await this.read('active');
    const hit = active.data.find((t) => t.id === id);
    if (hit) return hit;

    const archive = await this.read('archive');
    return archive.data.find((t) => t.id === id) ?? null;
  }

  /**
   * Validate a flat waypoint list and map it to GraphQL WaypointInput objects.
   * Shared by createTrip (sent as `waypoints`) and updateTrip (folded into
   * `route.legs` pairs).
   */
  private static buildWaypointInputs(
    list: CreateTripInput['waypoints'],
  ): Array<Record<string, unknown>> {
    return list.map((wp, index) => {
      const hasCoords =
        typeof wp.latitude === 'number' && typeof wp.longitude === 'number';
      const hasAddress = Boolean(wp.address?.trim());

      // InputLocation requires either a lat/lon pair or an address.
      if (!hasCoords && !hasAddress) {
        throw new BadRequestException(`Точка №${index + 1}: вкажіть координати або адресу`);
      }

      RuptelaRoutingService.assertArrivalWindow(
        wp.arrivalPlannedFrom,
        wp.arrivalPlannedTill,
        `Точка №${index + 1}`,
      );

      return {
        type: wp.type,
        location: hasCoords
          ? { latitude: wp.latitude, longitude: wp.longitude }
          : { address: wp.address },
        ...(wp.notes ? { notes: wp.notes } : {}),
        // Both halves or neither — the pair is validated above.
        ...(wp.arrivalPlannedFrom
          ? {
              arrivalPlannedFrom: wp.arrivalPlannedFrom,
              arrivalPlannedTill: wp.arrivalPlannedTill,
            }
          : {}),
        ...(wp.durationMinutes ? { duration: wp.durationMinutes } : {}),
        ...(wp.cargoWeightKg ? { cargoWeight: wp.cargoWeightKg } : {}),
        ...(wp.todos?.length
          ? {
              todos: wp.todos.map((todo, order) => ({
                description: todo.description,
                type: todo.type ?? 'OTHER',
                orderNumber: order + 1,
              })),
            }
          : {}),
      };
    });
  }

  async createTrip(input: CreateTripInput): Promise<RuptelaTrip> {
    if (!input?.title?.trim()) {
      throw new BadRequestException('Вкажіть назву поїздки');
    }
    if (!input?.vehicleId?.trim()) {
      throw new BadRequestException('Оберіть транспортний засіб');
    }
    if (!Array.isArray(input.waypoints) || input.waypoints.length < 2) {
      throw new BadRequestException('Потрібно щонайменше дві точки маршруту');
    }

    const waypoints = RuptelaRoutingService.buildWaypointInputs(input.waypoints);

 
    // TripCreateParameters.id is mandatory and must be a UUID — the client
    // generates it. The previous `trip-rup-<timestamp>` ids were rejected.
    const id = randomUUID();

    const parameters: Record<string, unknown> = {
      id,
      title: input.title.trim(),
      vehicleId: input.vehicleId.trim(),
      waypoints,
    };

    if (input.notes?.trim()) parameters.notes = input.notes.trim();
    if (input.owner?.trim()) parameters.owner = input.owner.trim();

    // Same indivisible-window rule as the waypoints, different field names.
    RuptelaRoutingService.assertArrivalWindow(
      input.plannedArrivalFrom,
      input.plannedArrivalTill,
      'Плановане прибуття',
    );

    if (input.plannedArrivalFrom) {
      parameters.plannedArrivalDateRange = {
        plannedArrivalDateTimeFrom: input.plannedArrivalFrom,
        plannedArrivalDateTimeTill: input.plannedArrivalTill,
      };
    }

    if (input.primaryDriverId || input.secondaryDriverId || input.notifyDrivers) {
      parameters.manuallyAssignedDrivers = {
        ...(input.primaryDriverId ? { primaryDriverId: input.primaryDriverId } : {}),
        ...(input.secondaryDriverId ? { secondaryDriverId: input.secondaryDriverId } : {}),
        // Creating a trip must not page a driver unless explicitly requested.
        notifyDrivers: Boolean(input.notifyDrivers),
      };
    }
console.log('Creating trip with parameters:', parameters);
console.log('Creating trip with createTrip:', CREATE_TRIP);



    const data = await this.graphql<{ createTrip: any }>(CREATE_TRIP, { parameters });
    const trip = this.mapTrip(data.createTrip);

    this.upsertCached(trip);
    this.logger.log(`RnT trip created: ${trip.id} (${trip.title})`);
    return trip;
  }

  async updateTrip(id: string, input: UpdateTripInput): Promise<RuptelaTrip> {
    if (!id?.trim()) throw new BadRequestException('Не вказано ID поїздки');

    const parameters: Record<string, unknown> = { id };

    // TripUpdateParameters treats every field as "send only when changing it".
    if (input.title !== undefined) parameters.title = input.title;
    if (input.notes !== undefined) parameters.notes = input.notes;
    if (input.vehicleId) parameters.vehicle = { id: input.vehicleId };

    if (input.primaryDriverId || input.secondaryDriverId || input.notifyDrivers) {
      parameters.manuallyAssignedDrivers = {
        ...(input.primaryDriverId ? { primaryDriverId: input.primaryDriverId } : {}),
        ...(input.secondaryDriverId ? { secondaryDriverId: input.secondaryDriverId } : {}),
        notifyDrivers: Boolean(input.notifyDrivers),
      };
    }

    // Full route replacement: fold the flat list into consecutive legs
    // (start=wp[i], end=wp[i+1]). Verified live: legs without ids replace the
    // whole route, and the shared boundary object of adjacent legs is merged
    // into a single waypoint by Ruptela.
    if (input.waypoints !== undefined) {
      if (!Array.isArray(input.waypoints) || input.waypoints.length < 2) {
        throw new BadRequestException('Маршрут має містити щонайменше дві точки');
      }
      const wps = RuptelaRoutingService.buildWaypointInputs(input.waypoints);
      parameters.route = {
        legs: wps.slice(0, -1).map((start, i) => ({ start, end: wps[i + 1] })),
      };
    }

    // Trip-level arrival window lives under settings on the update mutation.
    RuptelaRoutingService.assertArrivalWindow(
      input.plannedArrivalFrom,
      input.plannedArrivalTill,
      'Плановане прибуття',
    );
    if (input.plannedArrivalFrom) {
      parameters.settings = {
        plannedArrivalDatetimeFrom: input.plannedArrivalFrom,
        plannedArrivalDatetimeTill: input.plannedArrivalTill,
      };
    }

    if (Object.keys(parameters).length === 1) {
      throw new BadRequestException('Немає змін для збереження');
    }

    const data = await this.graphql<{ updateTrip: any }>(UPDATE_TRIP, { parameters });

console.log(parameters,'UPDATE TRIP PARAMETRS');
console.log(data,'data from TRIP PARAMETRS');


    console.log('Updating trip with data:', data);
    const trip = this.mapTrip(data.updateTrip);

    this.upsertCached(trip);
    this.logger.log(`RnT trip updated: ${trip.id}`);
    return trip;
  }

  async deleteTrip(id: string): Promise<{ success: boolean; id: string }> {
    if (!id?.trim()) throw new BadRequestException('Не вказано ID поїздки');

    const data = await this.graphql<{ deleteTrip: boolean }>(DELETE_TRIP, { id });

    // The mutation answers with a boolean; false means Ruptela declined it.
    if (data.deleteTrip !== true) {
      throw new BadGatewayException('Ruptela відхилила видалення поїздки');
    }

    this.removeCached(id);
    this.logger.log(`RnT trip deleted: ${id}`);
    return { success: true, id };
  }

  async listTasks(tripId?: string): Promise<RuptelaTodo[]> {
    if (tripId) {
      const trip = await this.getTrip(tripId);
      return trip?.tasks ?? [];
    }
    // Straight off the cache — listTrips() paginates, which would drop tasks.
    const { data } = await this.read('active');
    return data.flatMap((t) => t.tasks);
  }

  /**
   * Local-only. The RnT schema exposes no mutation for waypoint todo completion,
   * so this records a dispatcher-side flag and says so in the response.
   */
  async setTaskCompleted(
    tripId: string,
    taskId: string,
    completed: boolean,
  ): Promise<RuptelaTodo & { local_only: true }> {
    const trip = await this.getTrip(tripId);
    if (!trip) throw new BadRequestException(`Поїздку ${tripId} не знайдено`);

    const task = trip.tasks.find((t) => t.id === taskId);
    if (!task) throw new BadRequestException(`Завдання ${taskId} не знайдено`);

    this.localTodoOverrides.set(taskId, completed);
    task.completed = completed;

    return { ...task, local_only: true };
  }

  getStatus() {
    const active = this.cache.get('active');
    const archive = this.cache.get('archive');
    const age = (entry?: CacheEntry) =>
      entry && entry.fetchedAt > 0
        ? Math.round((Date.now() - entry.fetchedAt) / 1000)
        : null;

    return {
      configured: Boolean(this.apiKey),
      endpoint: `${this.client.defaults.baseURL}/routing`,
      active: {
        trips: active?.data.length ?? 0,
        ageSeconds: age(active),
        refreshing: active?.refreshing ?? false,
        error: active?.error ?? null,
      },
      archive: {
        loaded: Boolean(archive && archive.fetchedAt > 0),
        trips: archive?.data.length ?? 0,
        ageSeconds: age(archive),
        refreshing: archive?.refreshing ?? false,
        error: archive?.error ?? null,
      },
      localTaskOverrides: this.localTodoOverrides.size,
    };
  }
}
