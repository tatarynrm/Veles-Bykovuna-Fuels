/**
 * Nova Poshta parcel courier — the normalized shapes the frontend consumes.
 * **Single source of truth** for these types on the frontend.
 *
 * Mirrors backend/src/novaposhta/novaposhta-api.service.ts.
 *
 * Pure types only (no runtime): the API-call functions and formatting helpers
 * live in `@/lib/novaposhta`, which re-exports everything here.
 */

/** One movement-history entry of a parcel (TrackingUpdateHistory rows). */
export interface NovaPoshtaTrackingHistoryEntry {
  status_code: string | null;
  status: string | null;
  /** «YYYY-MM-DD HH:MM:SS» as Nova Poshta returns it. */
  datetime: string | null;
  city: string | null;
  warehouse: string | null;
}

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
  /** Movement timeline (TrackingUpdateHistory), oldest-first as НП returns it. */
  history: NovaPoshtaTrackingHistoryEntry[];
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
  /** StatusCode taxonomy id (StateId) — drives the delivery-phase graph. */
  state_id: string | null;
  payer_type: string | null;
  description: string | null;
  additional_information: string | null;
  note: string | null;
  scheduled_delivery_date: string | null;
  /** Movement timeline, embedded so the list needs no per-row tracking call. */
  history: NovaPoshtaTrackingHistoryEntry[];
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

/**
 * Coarse phase for a tracking StatusCode — drives the status pill colour.
 * Codes per Nova Poshta's StatusCode reference.
 */
export type TrackingPhase = 'created' | 'in_transit' | 'arrived' | 'delivered' | 'problem';
