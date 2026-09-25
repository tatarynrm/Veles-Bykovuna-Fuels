/**
 * Форми даних для розділу «Синхронізація з базою».
 *
 * Дзеркалять бекендні інтерфейси:
 *  - GpsProgress   ← backend/src/gps/gps-sync.service.ts (GET /api/gps/progress)
 *  - NpSyncStatus  ← backend/src/novaposhta/novaposhta-sync.service.ts
 *                    (GET /api/novaposhta/sync-status)
 *  - FuelSyncStatus ← backend/src/fuel-sync/fuel-sync.types.ts
 *                    (GET /api/fuel-sync/okko | /api/fuel-sync/shell)
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

export type FuelVendorKey = 'okko' | 'shell';
export type FuelSyncMode = 'incremental' | 'full';
export type FuelSyncTrigger = 'cron' | 'manual';

export interface FuelSyncWindow {
  from: string;
  to: string;
  status: VehicleSyncStatus;
  fetched: number;
  skipped: number;
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
  sent: number;
  inserted: number;
  failed: number;
  durationMs: number;
  ok: boolean;
  error: string | null;
}

export interface FuelSyncStatus {
  vendor: 'OKKO' | 'SHELL';
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
    skippedLabel: string;
  };
}
