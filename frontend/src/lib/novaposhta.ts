import { apiGet, apiSend } from '@/lib/api';
import type {
  NovaPoshtaTracking,
  NovaPoshtaShipment,
  NovaPoshtaCity,
  NovaPoshtaWarehouse,
  NovaPoshtaSender,
  CreateShipmentInput,
  CreateShipmentResult,
  TrackingPhase,
} from '@/shared/contracts/novaposhta';

/**
 * Nova Poshta client layer — fetching + formatting helpers.
 * All fetching goes through src/lib/api.ts; never hit the host directly.
 *
 * The data shapes live in `@/shared/contracts/novaposhta` (single source of truth,
 * mirroring backend/src/novaposhta/novaposhta-api.service.ts) and are re-exported
 * below so existing `@/lib/novaposhta` type imports keep resolving.
 */

export type {
  NovaPoshtaTracking,
  NovaPoshtaTrackingHistoryEntry,
  NovaPoshtaShipment,
  NovaPoshtaCity,
  NovaPoshtaWarehouse,
  NovaPoshtaSender,
  CreateShipmentInput,
  CreateShipmentResult,
  TrackingPhase,
} from '@/shared/contracts/novaposhta';

export const NO_DATA = '—';

/* ── API calls ──────────────────────────────────────────────────────────── */

export function trackParcels(numbers: string[], phone?: string) {
  return apiGet<NovaPoshtaTracking[]>('/api/novaposhta/track', {
    numbers: numbers.join(','),
    phone,
  });
}

export function listShipments(params: {
  dateFrom: string;
  dateTo: string;
  page?: number;
  limit?: number;
}) {
  return apiGet<{ items: NovaPoshtaShipment[]; page: number; limit: number }>(
    '/api/novaposhta/shipments',
    {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: params.page,
      limit: params.limit,
    },
  );
}

export function searchCities(find: string) {
  return apiGet<NovaPoshtaCity[]>('/api/novaposhta/cities', { find });
}

export function listWarehouses(cityRef: string, find?: string) {
  return apiGet<NovaPoshtaWarehouse[]>('/api/novaposhta/warehouses', {
    cityRef,
    find,
  });
}

export function getSender() {
  return apiGet<NovaPoshtaSender>('/api/novaposhta/sender');
}

export function createShipment(input: CreateShipmentInput) {
  return apiSend<CreateShipmentResult>('POST', '/api/novaposhta/shipments', input);
}

/* ── formatting helpers ─────────────────────────────────────────────────── */

/** DD.MM.YYYY — the only date format Nova Poshta's register endpoint accepts. */
export function toNovaPoshtaDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(
    d.getMonth() + 1,
  ).padStart(2, '0')}.${d.getFullYear()}`;
}

/** Ordered delivery phases for the progress graph. `problem` sits outside the line. */
export const DELIVERY_PHASES: TrackingPhase[] = [
  'created',
  'in_transit',
  'arrived',
  'delivered',
];

export function trackingPhase(code: string | null): TrackingPhase {
  switch (code) {
    case '1': // Нагадування
    case '2': // Видалено
      return 'created';
    case '3': // Номер не знайдено
    case '102': // Відмова від отримання
    case '103': // Відмова
    case '105': // Припинено зберігання
    case '108': // Знищено
      return 'problem';
    case '7': // Прибув на відділення
    case '8': // Прибув на відділення (завантажено в Поштомат)
      return 'arrived';
    case '9': // Відправлення отримано
    case '10': // Відправлення отримано, платіж
    case '11': // Відправлення отримано, грошовий переказ
      return 'delivered';
    default:
      return 'in_transit';
  }
}
