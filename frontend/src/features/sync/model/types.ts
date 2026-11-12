/**
 * Форми даних для розділу «Синхронізація з базою».
 *
 * Дзеркалять бекендні інтерфейси:
 *  - GpsProgress   ← backend/src/gps/gps-sync.service.ts (GET /api/gps/progress)
 *  - NpSyncStatus  ← backend/src/novaposhta/novaposhta-sync.service.ts
 *                    (GET /api/novaposhta/sync-status)
 *  - FuelSyncStatus ← backend/src/fuel-sync/fuel-sync.types.ts
 *                    (GET /api/fuel-sync/okko | /api/fuel-sync/shell | /api/fuel-sync/upg)
 * Тримаємо копію тут (див. CLAUDE.md — фронт і бек ведуть паралельні копії форм).
 */

export type VehicleSyncStatus = 'pending' | 'active' | 'done' | 'error';

export interface VehicleProgress {
  kod: number;
  dernom: string;
  idgps: string;
  status: VehicleSyncStatus;
  from: string | null;
  fetched: number;
  written: number;
  error: string | null;
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
  cooldownUntil: string | null;
  config: { tzOffsetHours: number; defaultStart: string; limit: number };
}

export interface NpSyncRun {
  at: string;
  from: string;
  to: string;
  collected: number;
  written: number;
  durationMs: number;
  ok: boolean;
  error: string | null;
}

export interface NpSyncStatus {
  enabled: boolean;
  running: boolean;
  startedAt: string | null;
  lastRun: NpSyncRun | null;
  config: { windowDays: number; cron: string; cronLabel: string };
}

/** Рядок виписки Привату у вигляді, в якому він іде в P_BANK.AddBankV (лише те, що показуємо). */
export interface PrivatSyncSampleRow {
  bank_trans_id: string;
  /** `1` — прихід, `2` — розхід. */
  dk: '1' | '2';
  doc_date: string;
  suma: number;
  suma_uah: number | null;
  valut_idnt: string | null;
  firma_iban: string | null;
  ur_name: string | null;
  prizn: string | null;
}

export type PrivatSyncMode = 'recent' | 'period';

/** Одне вікно періоду (≤ 7 днів) у живому прогресі проходу. Вікна йдуть чергою, від найстарішого. */
export interface PrivatSyncWindow {
  from: string;
  to: string;
  status: VehicleSyncStatus;
  fetched: number;
  skipped: number;
  alreadyStored: number;
  /** Передано процедурі (у пробному проході — скільки пішло б). */
  sent: number;
  inserted: number;
  failed: number;
  error: string | null;
  at: string | null;
}

export interface PrivatSyncRun {
  at: string;
  trigger: 'cron' | 'manual';
  mode: PrivatSyncMode;
  /** `true` — пробний прохід: нічого не записувалось. */
  dryRun: boolean;
  from: string;
  to: string;
  windowsTotal: number;
  windowsDone: number;
  fetched: number;
  skipped: number;
  alreadyStored: number;
  sent: number;
  inserted: number;
  failed: number;
  durationMs: number;
  ok: boolean;
  error: string | null;
  errors: string[];
  sample?: PrivatSyncSampleRow[];
}

/** GET /api/privat/sync-status ← backend/src/privat/privat-sync.service.ts */
export interface PrivatSyncStatus {
  enabled: boolean;
  oracleConfigured: boolean;
  bankConfigured: boolean;
  running: boolean;
  startedAt: string | null;
  /** Режим і період поточного (або останнього) проходу. */
  mode: PrivatSyncMode | null;
  period: { from: string; to: string } | null;
  windowsTotal: number;
  windowsDone: number;
  windows: PrivatSyncWindow[];
  lastRun: PrivatSyncRun | null;
  nextRunAt: string | null;
  config: {
    cron: string;
    cronLabel: string;
    lookbackDays: number;
    windowDays: number;
    maxPeriodDays: number;
    procedure: string;
    configFile: string;
  };
}

export type FuelVendorKey = 'okko' | 'shell' | 'upg';
export type FuelSyncMode = 'recent' | 'period' | 'full';
export type FuelSyncTrigger = 'cron' | 'manual';

export interface FuelSyncWindow {
  from: string;
  to: string;
  status: VehicleSyncStatus;
  fetched: number;
  skipped: number;
  alreadyStored: number;
  sent: number;
  inserted: number;
  failed: number;
  error: string | null;
  at: string | null;
}

export interface FuelSyncRun {
  at: string;
  mode: FuelSyncMode;
  trigger: FuelSyncTrigger;
  from: string;
  to: string;
  fetched: number;
  skipped: number;
  alreadyStored: number;
  sent: number;
  inserted: number;
  failed: number;
  durationMs: number;
  ok: boolean;
  error: string | null;
}

export interface FuelSyncStatus {
  vendor: 'OKKO' | 'SHELL' | 'UPG';
  enabled: boolean;
  oracleConfigured: boolean;
  running: boolean;
  startedAt: string | null;
  mode: FuelSyncMode | null;
  trigger: FuelSyncTrigger | null;
  period: { from: string; to: string } | null;
  windowsTotal: number;
  windowsDone: number;
  windows: FuelSyncWindow[];
  lastRun: FuelSyncRun | null;
  nextRunAt: string | null;
  config: {
    cron: string;
    cronLabel: string;
    startDate: string;
    lookbackDays: number;
    windowDays: number;
    procedure: string;
    /** Де лежить файл налаштувань — підказка на сторінці. */
    configFile: string;
    skippedLabel: string;
  };
}
