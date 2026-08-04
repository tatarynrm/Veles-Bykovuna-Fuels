import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * Every field here is read straight off the fm-track API. `null` means the device
 * did not report that value — it is never substituted with a placeholder, because a
 * plausible-looking constant is indistinguishable from a real reading in the UI.
 *
 * Sources:
 *   GPS block   — GET /objects-last-coordinate?version=2  (one call, whole fleet)
 *   CAN block   — GET /objects/{id}/coordinates?version=2 (per vehicle, `inputs`)
 */
export interface RuptelaTelemetry {
  // ── GPS (last known position) ──
  latitude: number | null;
  longitude: number | null;
  speed: number | null; // km/h
  heading: number | null; // degrees
  altitude: number | null; // m
  satellites: number | null;
  gps_datetime: string | null;

  // ── CAN bus / device inputs ──
  can_datetime: string | null; // timestamp of the record the CAN values came from
  ignition: boolean | null;
  engine_rpm: number | null;
  engine_hours: number | null; // h
  odometer_km: number | null; // km (canbus_distance)
  fuel_level_liters: number | null; // L (calculated_inputs.fuel_level)
  fuel_level_percent: number | null; // % (device_inputs.fuel_level_can)
  fuel_rate_lph: number | null; // L/h
  fuel_used_total_liters: number | null; // L, lifetime counter
  coolant_temp: number | null; // °C — reported as 0 while the engine is off, surfaced as null
  power_supply_voltage: number | null; // V — the vehicle's 24 V line
  device_battery_voltage: number | null; // V — the tracker's own backup cell
  pedal_position: number | null; // %
  parking_brake: boolean | null;
  cruise_control: boolean | null;
  gsm_signal: number | null;
  hdop: number | null; // GPS dilution of precision
  gprs_connected: boolean | null;
}

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
  status: 'moving' | 'idle' | 'stopped' | 'offline';
  /** Resolved from the vehicle's most recent trip (`driver_ids`) via GET /drivers/{id}. */
  driver_name: string | null;
  /** Tachograph card read off the CAN bus (`first_driver_id`). */
  driver_card: string | null;
  /** Tachograph working state: REST / DRIVE / WORK / AVAILABLE. */
  driver_state: string | null;
  driver_card_inserted: boolean | null;
  telemetry: RuptelaTelemetry;
}

export interface RuptelaVehicleTripHistoryItem {
  id: string;
  object_id: string;
  trip_type: string;
  duration_minutes: number;
  mileage_km: number;
  fuel_consumed_liters: number;
  start_time: string;
  start_address: string;
  start_latitude?: number;
  start_longitude?: number;
  end_time: string;
  end_address: string;
  end_latitude?: number;
  end_longitude?: number;
}

@Injectable()
export class RuptelaApiService {
  private readonly logger = new Logger(RuptelaApiService.name);
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;
  private isConnectedToLiveApi = false;
  private lastConnectionCheck: string = new Date().toISOString();

  // Assembled fleet snapshot (positions + CAN), stale-while-revalidate
  private fleetCache: RuptelaVehicle[] | null = null;
  private fleetCacheTimestamp = 0;
  private readonly FLEET_CACHE_TTL_MS = 30_000;
  private isFetchingFleet = false;

  // vehicle id -> driver full name, resolved from the last trip's driver_ids.
  // Refreshed far less often than telemetry: crew assignments change by the day, not the second.
  private vehicleDriverCache = new Map<string, string>();
  /** driver id -> full name. Names do not change, so this is memoised for the process lifetime. */
  private driverNameCache = new Map<string, string>();
  private vehicleDriverTimestamp = 0;
  private readonly DRIVER_CACHE_TTL_MS = 15 * 60_000;
  private isFetchingDrivers = false;

  private lastFleetError: string | null = null;

  // Persistent trips store with real trip records
  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RUPTELA_API_KEY') ?? '';

    if (!this.apiKey) {
      this.logger.warn('RUPTELA_API_KEY не налаштовано — телематика вимкнена');
    }
    this.baseUrl = this.configService.get<string>('RUPTELA_BASE_URL') || 'https://api.fm-track.com';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Veles-Bykovuna-Fuels-Ruptela-Client/1.0',
      },
    });

    // Prefetch in background on service startup so the first UI request is instant.
    // Trips live in RuptelaRoutingService, which warms its own cache on boot.
    this.logger.log('Prefetching Ruptela fleet snapshot in background...');
    this.refreshFleet().catch(() => {});
  }

  getApiStatus() {
    return {
      service: 'Ruptela FMS Telematics Gateway (fm-track)',
      apiKey: `${this.apiKey.substring(0, 6)}...${this.apiKey.substring(this.apiKey.length - 4)}`,
      baseUrl: this.baseUrl,
      isLiveConnected: this.isConnectedToLiveApi,
      lastCheck: this.lastConnectionCheck,
      documentationUrl: 'https://www.fmsdocumentation.com/uk/api/',
      status: this.isConnectedToLiveApi ? 'ONLINE' : 'UNREACHABLE',
      vehiclesInSnapshot: this.fleetCache?.length ?? 0,
      snapshotAgeSeconds: this.fleetCacheTimestamp
        ? Math.round((Date.now() - this.fleetCacheTimestamp) / 1000)
        : null,
      driversResolved: this.vehicleDriverCache.size,
      lastError: this.lastFleetError,
    };
  }

  /** Numeric coercion that preserves a real 0 but turns absent/garbage values into null. */
  private static num(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * fm-track sits behind an nginx rate limiter that answers 429 once the fleet is
   * fanned out too fast — at concurrency 8 it rejected roughly two thirds of the
   * per-vehicle calls, which is what silently blanked the CAN columns. Retry those
   * with backoff instead of treating a throttled request as "no data".
   */
  private async getWithRetry(url: string, params: Record<string, any>, attempts = 4): Promise<any> {
    let lastError: any;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await this.client.get(url, { params });
      } catch (error) {
        lastError = error;
        if (error.response?.status !== 429) throw error;
        // Exponential backoff with jitter so the retries do not resynchronise.
        const delay = 400 * 2 ** attempt + Math.floor(Math.random() * 250);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /** Runs `worker` over `items` with a bounded number of in-flight requests. */
  private static async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]);
      }
    });

    await Promise.all(runners);
    return results;
  }

  // ── 1. Fleet snapshot ───────────────────────────────────────────────────────
  /**
   * Positions come from one batched call; CAN telemetry is not part of that payload,
   * so it is fetched per vehicle from /objects/{id}/coordinates. The assembled snapshot
   * is cached for 30 s with stale-while-revalidate, which keeps the page's 5 s polling
   * from turning into ~65 upstream requests a tick.
   */
  async getVehicles(): Promise<RuptelaVehicle[]> {
    const age = Date.now() - this.fleetCacheTimestamp;

    if (this.fleetCache !== null && age < this.FLEET_CACHE_TTL_MS) {
      return this.fleetCache;
    }

    if (this.fleetCache !== null) {
      // Serve the stale snapshot now, refresh behind it.
      this.refreshFleet().catch(() => {});
      return this.fleetCache;
    }

    await this.refreshFleet();
    return this.fleetCache ?? [];
  }

  private async refreshFleet(): Promise<void> {
    if (this.isFetchingFleet) return;
    this.isFetchingFleet = true;

    try {
      const objects = await this.fetchLastCoordinates();
      this.isConnectedToLiveApi = true;
      this.lastConnectionCheck = new Date().toISOString();
      this.lastFleetError = null;

      const nowMs = Date.now();

      const vehicles = await RuptelaApiService.mapWithConcurrency(objects, 3, async (obj: any) => {
        const vParams = obj.vehicle_params || {};
        const coord = obj.last_coordinate || {};
        const gpsDatetime: string | null =
          coord.datetime || coord.last_valid_gps_datetime || null;

        const can = await this.fetchLatestCanRecord(obj.id, gpsDatetime);
        const device = can?.inputs?.device_inputs || {};
        const calculated = can?.inputs?.calculated_inputs || {};

        const speed = RuptelaApiService.num(coord.speed);
        const ignition =
          can?.ignition_status === 'ON'
            ? true
            : can?.ignition_status === 'OFF'
              ? false
              : null;

        // The API reports coolant as 0 whenever the engine is off — that is "no reading",
        // not a 0 °C engine, so it is surfaced as null rather than as a number.
        const rawCoolant = RuptelaApiService.num(device.canbus_engine_coolant_temperature);
        const coolant = ignition === true && rawCoolant !== null && rawCoolant > 0 ? rawCoolant : null;

        const isOffline =
          gpsDatetime !== null && nowMs - new Date(gpsDatetime).getTime() > 24 * 60 * 60 * 1000;

        let status: RuptelaVehicle['status'];
        if (isOffline || gpsDatetime === null) {
          status = 'offline';
        } else if ((speed ?? 0) > 5) {
          status = 'moving';
        } else if (ignition === true) {
          status = 'idle';
        } else {
          status = 'stopped';
        }

        const make = String(vParams.make || '').trim();
        const model = String(vParams.model || '').trim();

        // second_driver_id comes back as 0xFF filler when no card is present; ignore non-printable ids.
        const rawCard = typeof device.first_driver_id === 'string' ? device.first_driver_id.trim() : '';
        const driverCard = /^[\x20-\x7E]+$/.test(rawCard) ? rawCard : null;

        return {
          id: obj.id,
          device_imei: String(obj.imei ?? ''),
          name: obj.name || vParams.plate_number || '',
          plate: vParams.plate_number || '',
          type: [make, model].filter(Boolean).join(' '),
          make,
          model,
          vin: vParams.vin || null,
          fuel_type: vParams.fuel_type || null,
          status,
          driver_name: this.vehicleDriverCache.get(obj.id) ?? null,
          driver_card: driverCard,
          driver_state: device.driver_1_state || device.tco_first_driver_state || null,
          driver_card_inserted:
            device.tco_first_driver_card === undefined
              ? null
              : device.tco_first_driver_card === 'INSERTED',
          telemetry: {
            latitude: RuptelaApiService.num(coord.latitude),
            longitude: RuptelaApiService.num(coord.longitude),
            speed,
            heading: RuptelaApiService.num(coord.direction),
            altitude: RuptelaApiService.num(coord.altitude),
            satellites: RuptelaApiService.num(coord.satellites_count),
            gps_datetime: gpsDatetime,

            can_datetime: can?.datetime ?? null,
            ignition,
            engine_rpm: RuptelaApiService.num(device.engine_rpm),
            engine_hours: RuptelaApiService.num(device.engine_hours),
            odometer_km: RuptelaApiService.num(device.canbus_distance),
            fuel_level_liters: RuptelaApiService.num(calculated.fuel_level),
            fuel_level_percent: RuptelaApiService.num(device.fuel_level_can),
            fuel_rate_lph: RuptelaApiService.num(device.canbus_fuel_rate),
            fuel_used_total_liters: RuptelaApiService.num(device.fuel_used),
            coolant_temp: coolant,
            power_supply_voltage: RuptelaApiService.num(device.power_supply_voltage),
            device_battery_voltage: RuptelaApiService.num(device.battery_voltage),
            pedal_position: RuptelaApiService.num(device.pedal_pos),
            parking_brake:
              device.canbus_parking_brake_switch === undefined
                ? null
                : device.canbus_parking_brake_switch === 'ON',
            cruise_control:
              device.canbus_cruise_control_state === undefined
                ? null
                : device.canbus_cruise_control_state === 'ON',
            gsm_signal: RuptelaApiService.num(device.gsm_signal_strength),
            hdop: RuptelaApiService.num(device.hdop),
            gprs_connected:
              device.gprs_status === undefined ? null : device.gprs_status === 'CONNECTED',
          },
        } as RuptelaVehicle;
      });

      this.fleetCache = vehicles;
      this.fleetCacheTimestamp = Date.now();
      this.logger.log(`Ruptela fleet snapshot refreshed: ${vehicles.length} vehicles`);

      // Driver names are resolved on a slower clock and merged into the next snapshot.
      if (Date.now() - this.vehicleDriverTimestamp > this.DRIVER_CACHE_TTL_MS) {
        this.refreshVehicleDrivers(vehicles.map((v) => v.id)).catch(() => {});
      }
    } catch (error) {
      this.isConnectedToLiveApi = false;
      this.lastFleetError = error.message;
      this.logger.error(`Ruptela fleet refresh failed: ${error.message}`);
      if (this.fleetCache === null) this.fleetCache = [];
    } finally {
      this.isFetchingFleet = false;
    }
  }

  /** Batched positions for the whole fleet, following continuation tokens. */
  private async fetchLastCoordinates(): Promise<any[]> {
    const pageSize = 100;
    const collected: any[] = [];
    let continuationToken: string | undefined;

    for (let page = 0; page < 10; page++) {
      const response = await this.getWithRetry('/objects-last-coordinate', {
        version: '2',
        limit: pageSize,
        api_key: this.apiKey,
        ...(continuationToken ? { continuation_token: continuationToken } : {}),
      });

      const batch = response.data?.results ?? [];
      collected.push(...batch);

      continuationToken = response.data?.continuation_token;
      if (!continuationToken || batch.length < pageSize) break;
    }

    return collected;
  }

  /**
   * The batched endpoint carries position only. CAN values live in the coordinate
   * history, so this pulls a short window ending at the vehicle's last fix and takes
   * the newest record (the API returns them oldest-first).
   */
  private async fetchLatestCanRecord(objectId: string, gpsDatetime: string | null): Promise<any | null> {
    const anchor = gpsDatetime ? new Date(gpsDatetime).getTime() : Date.now();
    if (!Number.isFinite(anchor)) return null;

    // The anchor is itself a coordinate timestamp, so a tight window around it already
    // contains the newest record. Keep it small: a 30 min window returns up to 100
    // records per vehicle, which times out once 65 of them run concurrently.
    for (const windowMinutes of [6, 60]) {
      try {
        const response = await this.getWithRetry(`/objects/${objectId}/coordinates`, {
          version: '2',
          from_datetime: new Date(anchor - windowMinutes * 60_000).toISOString(),
          to_datetime: new Date(anchor + 2 * 60_000).toISOString(),
          api_key: this.apiKey,
        });

        const items = response.data?.items ?? [];
        if (items.length > 0) return items[items.length - 1];
      } catch (error) {
        this.logger.debug(`CAN fetch failed for ${objectId} (${windowMinutes}m): ${error.message}`);
      }
    }

    return null;
  }

  /** Resolves one driver id to a name, falling back to the per-driver endpoint. */
  private async resolveDriverName(driverId: string): Promise<string | null> {
    const cached = this.driverNameCache.get(driverId);
    if (cached !== undefined) return cached || null;

    try {
      const res = await this.getWithRetry(`/drivers/${driverId}`, {
        version: '1',
        api_key: this.apiKey,
      });
      const full = [res.data?.first_name, res.data?.last_name].filter(Boolean).join(' ').trim();
      // Cache the miss too ('' means "looked up, has no name") so it is not retried each cycle.
      this.driverNameCache.set(driverId, full);
      return full || null;
    } catch {
      return null;
    }
  }

  /**
   * fm-track exposes no vehicle→driver assignment endpoint, but each trip carries
   * `driver_ids`, and /drivers resolves those to names. The most recent trip therefore
   * gives the crew currently on the vehicle.
   */
  private async refreshVehicleDrivers(vehicleIds: string[]): Promise<void> {
    if (this.isFetchingDrivers) return;
    this.isFetchingDrivers = true;

    try {
      // Seed from the directory, but it does not list every driver, so unknown ids are
      // resolved individually below rather than dropped.
      try {
        const directoryRes = await this.getWithRetry('/drivers', {
          version: '1',
          limit: 1000,
          api_key: this.apiKey,
        });
        for (const d of directoryRes.data ?? []) {
          const full = [d.first_name, d.last_name].filter(Boolean).join(' ').trim();
          if (d.id && full) this.driverNameCache.set(d.id, full);
        }
      } catch (error) {
        this.logger.debug(`Ruptela driver directory unavailable: ${error.message}`);
      }

      const to = new Date();
      const from = new Date(to.getTime() - 3 * 86400000);

      await RuptelaApiService.mapWithConcurrency(vehicleIds, 2, async (id) => {
        try {
          const res = await this.getWithRetry(`/objects/${id}/trips`, {
            version: '1',
            from_datetime: from.toISOString(),
            to_datetime: to.toISOString(),
            api_key: this.apiKey,
          });

          const trips = res.data?.trips ?? [];
          for (let i = trips.length - 1; i >= 0; i--) {
            const driverId = trips[i]?.driver_ids?.[0];
            if (!driverId) continue;

            const name = await this.resolveDriverName(driverId);
            if (name) {
              this.vehicleDriverCache.set(id, name);
              return;
            }
          }
        } catch {
          /* leave this vehicle's driver unresolved rather than guessing one */
        }
      });

      this.vehicleDriverTimestamp = Date.now();
      this.logger.log(`Ruptela driver assignments resolved for ${this.vehicleDriverCache.size} vehicles`);
    } catch (error) {
      this.logger.warn(`Ruptela driver resolution failed: ${error.message}`);
    } finally {
      this.isFetchingDrivers = false;
    }
  }

  // 2. Real Vehicle Trip History from Ruptela API
  async getVehicleTripHistory(objectId: string, fromDatetime?: string, toDatetime?: string): Promise<RuptelaVehicleTripHistoryItem[]> {
    try {
      const now = new Date();
      const to = toDatetime || now.toISOString();
      const from = fromDatetime || new Date(now.getTime() - 14 * 86400000).toISOString();

      this.logger.log(`Fetching LIVE Ruptela trip history for vehicle ${objectId} from ${from} to ${to}`);
      const response = await this.getWithRetry(`/objects/${objectId}/trips`, {
        version: '1',
        from_datetime: from,
        to_datetime: to,
        api_key: this.apiKey,
      });

      const formatAddr = (addr: any) => {
        if (!addr) return 'Україна';
        if (typeof addr === 'string') return addr;
        const parts = [addr.locality, addr.street, addr.region].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : 'Україна';
      };

      const tripsData = response.data?.trips || response.data || [];
      if (Array.isArray(tripsData)) {
        return tripsData.map((t: any, idx: number) => ({
          id: `history-trip-${t.object_id}-${idx}`,
          object_id: t.object_id,
          trip_type: t.trip_type || 'WORK',
          duration_minutes: Math.round((t.trip_duration || 0) / 60),
          mileage_km: Number(((t.mileage || 0) / 1000).toFixed(1)),
          fuel_consumed_liters: Number((t.total_fuel_consumption || 0).toFixed(1)),
          start_time: t.trip_start?.datetime || '',
          start_address: formatAddr(t.trip_start?.address),
          start_latitude: t.trip_start?.latitude,
          start_longitude: t.trip_start?.longitude,
          end_time: t.trip_end?.datetime || '',
          end_address: formatAddr(t.trip_end?.address),
          end_latitude: t.trip_end?.latitude,
          end_longitude: t.trip_end?.longitude,
        }));
      }
    } catch (error) {
      this.logger.error(`Error fetching Ruptela trip history for ${objectId}: ${error.message}`);
    }

    return [];
  }

}
