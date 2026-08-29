import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { OracleService } from '../oracle/oracle.service';
import { RuptelaApiService } from '../ruptela/ruptela-api.service';
import { GpsRepository } from './gps.repository';
import { GpsVehicle } from './gps.types';
import { mapItemToAddGps, ruptelaFromDatetime } from './gps.mapper';

/**
 * True when a request never reached Ruptela (network-level failure) — as opposed to
 * a 429 (rate limit, retried upstream) or an HTTP error with a response body (the
 * server is up). Those are the cases where waiting minutes, not seconds, makes sense.
 */
function isConnectionError(error: any): boolean {
  if (!error) return false;
  const netCodes = [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNABORTED',
    'EHOSTUNREACH',
    'ENETUNREACH',
  ];
  // Axios sets isAxiosError; no `response` means the request never got a reply.
  if (error.isAxiosError && !error.response) return true;
  return typeof error.code === 'string' && netCodes.includes(error.code);
}

/** Per-vehicle live state, surfaced to the realtime-coordinates page. */
export interface VehicleProgress {
  kod: number;
  dernom: string;
  idgps: string;
  status: 'pending' | 'active' | 'done' | 'error';
  /** from_datetime (UTC ISO) used for this vehicle's fetch. */
  from: string | null;
  fetched: number;
  written: number;
  error: string | null;
  /** When this vehicle finished (ISO), or null while pending/active. */
  at: string | null;
}

export interface GpsProgress {
  enabled: boolean;
  running: boolean;
  cycleStartedAt: string | null;
  cycleFinishedAt: string | null;
  vehiclesTotal: number;
  vehiclesDone: number;
  totalWrittenThisCycle: number;
  currentIdgps: string | null;
  vehicles: VehicleProgress[];
  lastCycle: { at: string; vehicles: number; written: number; durationMs: number } | null;
  /** Set (ISO) when Ruptela was unreachable and the next attempt is paused until then. */
  cooldownUntil: string | null;
  config: { tzOffsetHours: number; defaultStart: string; limit: number };
}

/**
 * Periodic GPS-history sync: Ruptela coordinates → Oracle `p_gps.AddGps`.
 *
 * One cycle walks the vehicle list (from Oracle) **sequentially** — for each
 * vehicle it reads up to 999 points newer than that vehicle's last stored point
 * (`datlast`, or GPS_DEFAULT_START when empty), writes them via the procedure, then
 * moves to the next vehicle. Cycles never overlap (a `running` guard skips a tick
 * while one is in progress) and vehicles are done one at a time on purpose: the
 * Ruptela API rate-limits (429), so a fan-out would get throttled.
 *
 * A vehicle with a long backlog catches up over successive cycles: each pass moves
 * `datlast` forward by up to 999 points, and the next pass continues from there.
 *
 * Live progress is kept in memory (`getProgress()`) so the realtime-coordinates page
 * can visualise which vehicle is being written and how many points landed.
 *
 * Disabled unless `GPS_SYNC_ENABLED=true` — it writes to the live Oracle DB, so it
 * must be opted into explicitly. `RUPTELA_TZ_OFFSET_HOURS` (default 3) and
 * `GPS_DEFAULT_START` (default 2026-07-01) tune the timezone and cold-start point.
 */
@Injectable()
export class GpsSyncService implements OnModuleInit {
  private readonly logger = new Logger(GpsSyncService.name);
  private running = false;

  private readonly enabled: boolean;
  private readonly tzOffsetHours: number;
  private readonly defaultStart: string;
  private readonly limit: number;
  /** Back-off window after Ruptela is unreachable (default 10 min). */
  private readonly cooldownMs: number;
  /** Epoch ms until which cycles are paused; 0 when not cooling down. */
  private cooldownUntil = 0;

  private progress: GpsProgress;

  constructor(
    config: ConfigService,
    private readonly oracle: OracleService,
    private readonly gpsRepository: GpsRepository,
    private readonly ruptela: RuptelaApiService,
  ) {
    this.enabled = (config.get<string>('GPS_SYNC_ENABLED') ?? 'false').toLowerCase() === 'true';
    const tz = Number(config.get<string>('RUPTELA_TZ_OFFSET_HOURS'));
    this.tzOffsetHours = Number.isFinite(tz) ? tz : 3;
    this.defaultStart = config.get<string>('GPS_DEFAULT_START') ?? '2026-07-01';
    const lim = Number(config.get<string>('GPS_SYNC_LIMIT'));
    this.limit = Number.isFinite(lim) && lim > 0 ? Math.min(lim, 1000) : 999;
    const cd = Number(config.get<string>('RUPTELA_RETRY_COOLDOWN_MIN'));
    this.cooldownMs = (Number.isFinite(cd) && cd > 0 ? cd : 10) * 60_000;

    this.progress = {
      enabled: this.enabled,
      running: false,
      cycleStartedAt: null,
      cycleFinishedAt: null,
      vehiclesTotal: 0,
      vehiclesDone: 0,
      totalWrittenThisCycle: 0,
      currentIdgps: null,
      vehicles: [],
      lastCycle: null,
      cooldownUntil: null,
      config: { tzOffsetHours: this.tzOffsetHours, defaultStart: this.defaultStart, limit: this.limit },
    };
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('GPS-синхронізацію вимкнено (GPS_SYNC_ENABLED != true)');
      return;
    }
    this.logger.log(
      `GPS-синхронізацію увімкнено: TZ+${this.tzOffsetHours}год, старт ${this.defaultStart}, ліміт ${this.limit}`,
    );
    // Warm shortly after boot so the first pass does not wait for the cron tick.
    setTimeout(() => this.runCycle().catch(() => undefined), 10_000);
  }

  /** Every minute; the running-guard makes back-to-back cycles when one runs long. */
  @Cron('0 * * * * *', { name: 'gps-sync' })
  handleCron() {
    if (!this.enabled) return;
    return this.runCycle();
  }

  getStatus() {
    return {
      enabled: this.enabled,
      running: this.running,
      tzOffsetHours: this.tzOffsetHours,
      defaultStart: this.defaultStart,
      limit: this.limit,
    };
  }

  /** Live snapshot for the realtime-coordinates page. */
  getProgress(): GpsProgress {
    return {
      ...this.progress,
      cooldownUntil:
        this.cooldownUntil > Date.now() ? new Date(this.cooldownUntil).toISOString() : null,
    };
  }

  /** One full pass over every vehicle. Safe to call manually (e.g. first backfill). */
  async runCycle(): Promise<{ vehicles: number; written: number; skipped?: boolean }> {
    if (!this.enabled) return { vehicles: 0, written: 0, skipped: true };
    if (this.running) {
      this.logger.warn('Цикл GPS ще триває — пропускаю тік');
      return { vehicles: 0, written: 0, skipped: true };
    }
    if (!this.oracle.isConfigured()) {
      this.logger.warn('Oracle не налаштовано — GPS-синхронізацію пропущено');
      return { vehicles: 0, written: 0, skipped: true };
    }
    if (Date.now() < this.cooldownUntil) {
      const leftMin = Math.ceil((this.cooldownUntil - Date.now()) / 60_000);
      this.logger.warn(`Немає зв'язку з Ruptela — пауза ще ~${leftMin} хв`);
      return { vehicles: 0, written: 0, skipped: true };
    }

    this.running = true;
    const started = Date.now();
    let totalWritten = 0;
    let vehicleCount = 0;
    try {
      const vehicles = await this.gpsRepository.getVehicles();
      vehicleCount = vehicles.length;
      this.logger.log(`GPS-цикл: ${vehicles.length} машин`);

      // Seed the live progress for this cycle (all pending).
      this.progress.running = true;
      this.progress.cycleStartedAt = new Date().toISOString();
      this.progress.cycleFinishedAt = null;
      this.progress.vehiclesTotal = vehicles.length;
      this.progress.vehiclesDone = 0;
      this.progress.totalWrittenThisCycle = 0;
      this.progress.currentIdgps = null;
      this.progress.vehicles = vehicles.map((v) => ({
        kod: v.kod,
        dernom: v.dernom,
        idgps: v.idgps,
        status: 'pending',
        from: null,
        fetched: 0,
        written: 0,
        error: null,
        at: null,
      }));

      for (let i = 0; i < vehicles.length; i++) {
        this.progress.currentIdgps = vehicles[i].idgps;
        this.progress.vehicles[i].status = 'active';
        try {
          totalWritten += await this.syncVehicle(vehicles[i], this.progress.vehicles[i]);
        } catch (error) {
          // No connection to Ruptela → pause the whole cycle and retry after the
          // cooldown, instead of hammering the remaining vehicles every minute.
          if (isConnectionError(error)) {
            this.cooldownUntil = Date.now() + this.cooldownMs;
            this.logger.warn(
              `Немає зв'язку з Ruptela — зупиняю цикл, повтор через ${Math.round(
                this.cooldownMs / 60_000,
              )} хв`,
            );
            break;
          }
          // Other errors are already handled inside syncVehicle; nothing else bubbles.
        }
        this.progress.vehiclesDone = i + 1;
        this.progress.totalWrittenThisCycle = totalWritten;
      }

      this.logger.log(
        `GPS-цикл завершено: ${totalWritten} точок по ${vehicles.length} машинах за ${Date.now() - started}ms`,
      );
      return { vehicles: vehicleCount, written: totalWritten };
    } catch (error) {
      this.logger.error(`GPS-цикл впав: ${error.message}`);
      return { vehicles: vehicleCount, written: totalWritten };
    } finally {
      this.running = false;
      this.progress.running = false;
      this.progress.currentIdgps = null;
      this.progress.cycleFinishedAt = new Date().toISOString();
      this.progress.lastCycle = {
        at: this.progress.cycleFinishedAt,
        vehicles: vehicleCount,
        written: totalWritten,
        durationMs: Date.now() - started,
      };
    }
  }

  /** One vehicle: fetch its next ≤`limit` points and write them. Errors stay local. */
  private async syncVehicle(vehicle: GpsVehicle, live: VehicleProgress): Promise<number> {
    try {
      const from = ruptelaFromDatetime(vehicle.datlast, this.tzOffsetHours, this.defaultStart);
      const to = new Date().toISOString();
      live.from = from;

      const items = await this.ruptela.getRawCoordinates(vehicle.idgps, from, to, this.limit);
      live.fetched = items.length;
      if (!items.length) {
        live.status = 'done';
        live.at = new Date().toISOString();
        return 0;
      }

      const rows = items
        .filter((it) => it?.datetime)
        .map((it) =>
          mapItemToAddGps(it, {
            idgps: vehicle.idgps,
            provNum: vehicle.provnum ?? 1,
            tzOffsetHours: this.tzOffsetHours,
          }),
        );

      const written = await this.gpsRepository.addGpsBatch(rows);
      live.written = written;
      live.status = 'done';
      live.at = new Date().toISOString();
      this.logger.log(
        `GPS ${vehicle.dernom} (${vehicle.idgps}): від ${from} → записано ${written}/${items.length}`,
      );
      return written;
    } catch (error) {
      const connLost = isConnectionError(error);
      live.status = 'error';
      live.error = connLost ? "Немає зв'язку з Ruptela" : error.message;
      live.at = new Date().toISOString();
      this.logger.error(`GPS ${vehicle.dernom} (${vehicle.idgps}) впала: ${error.message}`);
      // A lost Ruptela connection stops the cycle (→ cooldown); a per-vehicle data
      // error (bad point, one 404) is swallowed so the rest of the fleet continues.
      if (connLost) throw error;
      return 0;
    }
  }
}
