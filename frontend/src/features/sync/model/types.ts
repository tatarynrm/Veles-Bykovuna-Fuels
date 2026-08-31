/**
 * Форми даних для розділу «Синхронізація з базою».
 *
 * Дзеркалять бекендні інтерфейси:
 *  - GpsProgress   ← backend/src/gps/gps-sync.service.ts (GET /api/gps/progress)
 *  - NpSyncStatus  ← backend/src/novaposhta/novaposhta-sync.service.ts
 *                    (GET /api/novaposhta/sync-status)
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
