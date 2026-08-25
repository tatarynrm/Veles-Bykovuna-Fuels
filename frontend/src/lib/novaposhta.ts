import { apiGet, apiSend } from '@/lib/api';

/**
 * Nova Poshta client layer — mirrors backend/src/novaposhta/novaposhta-api.service.ts.
 * All fetching goes through src/lib/api.ts; never hit the host directly.
 */

export interface NovaPoshtaTracking {
  number: string;
  status: string | null;
  status_code: string | null;
  city_sender: string | null;
  city_recipient: string | null;
  warehouse_recipient: string | null;
  recipient_full_name: string | null;
  document_cost: number | null;
  cost_on_site: number | null;
  backward_delivery_sum: number | null;
  weight: number | null;
  date_created: string | null;
  scheduled_delivery_date: string | null;
  actual_delivery_date: string | null;
  delivered: boolean;
  phone_recipient: string | null;
  error: string | null;
}

export interface NovaPoshtaShipment {
  ref: string | null;
  number: string;
  date_created: string | null;
  cost: number | null;
  weight: number | null;
  seats_amount: number | null;
  cost_on_site: number | null;
  recipient_name: string | null;
  recipient_company: string | null;
  recipient_phone: string | null;
  city_recipient: string | null;
  warehouse_recipient: string | null;
  state_name: string | null;
  payer_type: string | null;
  description: string | null;
  additional_information: string | null;
  note: string | null;
  scheduled_delivery_date: string | null;
}

export interface NovaPoshtaCity {
  ref: string;
  name: string;
  area: string | null;
  settlement_type: string | null;
}

export interface NovaPoshtaWarehouse {
  ref: string;
  number: string | null;
  description: string | null;
  short_address: string | null;
  city_ref: string | null;
  type_of_warehouse: string | null;
  category: string | null;
}

export interface NovaPoshtaSender {
  counterparty_ref: string | null;
  contact_ref: string | null;
  contact_name: string | null;
  phone: string | null;
  city_ref: string | null;
  city_name: string | null;
  warehouse_ref: string | null;
  warehouse_name: string | null;
}

export interface CreateShipmentInput {
  recipientFirstName: string;
  recipientLastName: string;
  recipientMiddleName?: string;
  recipientPhone: string;
  recipientCityRef: string;
  recipientWarehouseRef: string;
  weight: number;
  seatsAmount?: number;
  description: string;
  cost: number;
  serviceType?: string;
  payerType?: 'Sender' | 'Recipient';
  backwardMoney?: number;
  senderCityRef: string;
  senderWarehouseRef: string;
}

export interface CreateShipmentResult {
  ref: string;
  number: string;
  cost_on_site: number | null;
  estimated_delivery_date: string | null;
}

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

/**
 * Coarse phase for a tracking StatusCode — drives the status pill colour.
 * Codes per Nova Poshta's StatusCode reference.
 */
export type TrackingPhase = 'created' | 'in_transit' | 'arrived' | 'delivered' | 'problem';

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
