import { t, localizedMap, intlLocale } from '@/lib/i18n';
import type {
  RuptelaStatus,
  RuptelaDriver,
  RuptelaWaypoint,
  TripState,
  TripStatus,
  TripSortKey,
  WaypointType,
} from '@/shared/contracts/ruptela';

/**
 * Ruptela telematics — runtime helpers (i18n label maps, formatters).
 *
 * The data shapes live in `@/shared/contracts/ruptela` (single source of truth,
 * mirroring the backend adapters) and are re-exported below so existing
 * `@/lib/ruptela` type imports keep resolving.
 */

export type {
  RuptelaTelemetry,
  RuptelaStatus,
  RuptelaVehicle,
  RuptelaTripHistoryItem,
  RuptelaTrackPoint,
  RuptelaVehicleTrack,
  RuptelaDriver,
  TripState,
  TripStatus,
  TripScope,
  WaypointType,
  RuptelaTodo,
  RuptelaWaypoint,
  RuptelaTrip,
  TripSortKey,
  SortOrder,
  TripListFacets,
  TripListResult,
} from '@/shared/contracts/ruptela';

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
