import {
  Injectable,
  Logger,
  BadGatewayException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * Nova Poshta (Нова Пошта) integration.
 *
 * One JSON-RPC-ish endpoint does everything:
 *   POST https://api.novaposhta.ua/v2.0/json/
 *   body: { apiKey, modelName, calledMethod, methodProperties }
 *
 * Two facts about this API shape the design here, mirroring how the Ruptela
 * adapter is written:
 *
 * 1. **Every response is HTTP 200** — even a rejected call. Success lives in the
 *    boolean `success` field and the reason in `errors[]`. A plain try/catch
 *    around axios therefore reports success for every failed request, so
 *    `call()` throws a BadGateway carrying Nova Poshta's own `errors`/`warnings`
 *    text (frontend `toError()` reads `message` verbatim). Never bypass it.
 * 2. **The API key identifies the sender.** The counterparty/contact/city/
 *    warehouse a parcel ships *from* all belong to the key's own account, so
 *    `resolveSender()` reads them from the key rather than asking the dispatcher
 *    to type refs by hand.
 *
 * All money is UAH, all weights kg, all dimensions cm — Nova Poshta's own units,
 * passed through unchanged.
 */

/* ── wire envelope ───────────────────────────────────────────────────────── */

interface NpEnvelope<T> {
  success: boolean;
  data: T[];
  errors: string[];
  warnings: string[];
  info: unknown;
  messageCodes: string[];
  errorCodes: string[];
  warningCodes: string[];
}

/* ── normalized shapes returned to the controller ───────────────────────── */

/** One parcel's live status (TrackingDocument.getStatusDocuments). */
export interface NovaPoshtaTracking {
  number: string;
  status: string | null;
  status_code: string | null;
  /** Human recipient/sender cities. */
  city_sender: string | null;
  city_recipient: string | null;
  warehouse_recipient: string | null;
  recipient_full_name: string | null;
  /** Declared cost + COD (backward delivery / кеш) in UAH. */
  document_cost: number | null;
  cost_on_site: number | null;
  /** Cash-on-delivery amount held for the sender, if any. */
  backward_delivery_sum: number | null;
  weight: number | null;
  date_created: string | null;
  scheduled_delivery_date: string | null;
  actual_delivery_date: string | null;
  /** True once the parcel is delivered/handed over. */
  delivered: boolean;
  /** Raw phone tail Nova Poshta echoes back, when a phone was supplied. */
  phone_recipient: string | null;
  error: string | null;
}

/** One shipment from the account's own register (InternetDocument.getDocumentList). */
export interface NovaPoshtaShipment {
  ref: string | null;
  number: string;
  date_created: string | null;
  cost: number | null;
  weight: number | null;
  seats_amount: number | null;
  cost_on_site: number | null;
  /** Recipient contact person — the human client, not a city ref. */
  recipient_name: string | null;
  /** Recipient counterparty (company / ФОП), when it differs from the person. */
  recipient_company: string | null;
  recipient_phone: string | null;
  /** Human city name — getDocumentList also returns the bare CityRecipient Ref,
   *  which is a UUID; the *Description fields carry the readable name. */
  city_recipient: string | null;
  warehouse_recipient: string | null;
  state_name: string | null;
  payer_type: string | null;
  /** Cargo description and any dispatcher notes / extra instructions. */
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
  /** Постамат / відділення / вантажне — surfaced so the UI can label it. */
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
  /** Recipient (private person). */
  recipientFirstName: string;
  recipientLastName: string;
  recipientMiddleName?: string;
  recipientPhone: string;
  /** Destination — refs come from the city/warehouse lookups. */
  recipientCityRef: string;
  recipientWarehouseRef: string;
  /** Cargo. */
  weight: number;
  seatsAmount?: number;
  description: string;
  cost: number;
  /** WarehouseWarehouse (склад-склад) by default. */
  serviceType?: string;
  /** Who pays: Sender | Recipient (default Recipient). */
  payerType?: 'Sender' | 'Recipient';
  /** Cash on delivery amount, UAH — 0/undefined = none. */
  backwardMoney?: number;
}

export interface CreateShipmentResult {
  ref: string;
  number: string;
  cost_on_site: number | null;
  estimated_delivery_date: string | null;
}

@Injectable()
export class NovaPoshtaApiService {
  private readonly logger = new Logger(NovaPoshtaApiService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('NOVAPOSHTA_API_KEY') ?? '';
    const baseUrl =
      this.configService.get<string>('NOVAPOSHTA_BASE_URL') ??
      'https://api.novaposhta.ua/v2.0/json/';

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 20_000,
      headers: { 'Content-Type': 'application/json' },
    });

    if (!this.apiKey) {
      this.logger.warn(
        'NOVAPOSHTA_API_KEY is not set — Nova Poshta integration is disabled',
      );
    }
  }

  /* ── transport ──────────────────────────────────────────────────────── */

  private async call<T>(
    modelName: string,
    calledMethod: string,
    methodProperties: Record<string, unknown> = {},
  ): Promise<T[]> {
    if (!this.apiKey) {
      throw new BadRequestException('NOVAPOSHTA_API_KEY не налаштовано');
    }

    const response = await this.client.post<NpEnvelope<T>>('', {
      apiKey: this.apiKey,
      modelName,
      calledMethod,
      methodProperties,
    });

    const body = response.data;
    // Nova Poshta answers 200 even on failure — the truth is in `success`.
    if (!body?.success) {
      const message =
        [...(body?.errors ?? []), ...(body?.warnings ?? [])].join('; ') ||
        'Нова Пошта відхилила запит без пояснення';
      throw new BadGatewayException(`Нова Пошта: ${message}`);
    }

    return body.data ?? [];
  }

  /* ── helpers ────────────────────────────────────────────────────────── */

  private static num(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'string' ? Number(value) : (value as number);
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  }

  private static text(value: unknown): string | null {
    if (typeof value !== 'string') return value == null ? null : String(value);
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  /** Delivered statuses in Nova Poshta's StatusCode taxonomy. */
  private static DELIVERED_CODES = new Set(['9', '10', '11']);

  /**
   * `getDocumentList` уже містить StateId і RecipientDateTime (фактичну дату вручення),
   * тож окремий трекінг не потрібен. StateId 9/10/11 = отримано.
   */
  private static DELIVERED_STATE_IDS = new Set(['9', '10', '11']);

  /** Парсер дати НП «DD.MM.YYYY HH:MM:SS» (RecipientDateTime) → Date, або null. */
  private static parseNpDateTime(value?: string): Date | null {
    const s = (value ?? '').trim();
    if (!s || s.startsWith('0001')) return null;
    const m = /^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(s);
    if (m) {
      const [, d, mo, y, h, mi, se] = m;
      return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se));
    }
    const iso = new Date(s.replace(' ', 'T'));
    return isNaN(iso.getTime()) ? null : iso;
  }

  /**
   * Наші доставлені відправлення за період: пагінує getDocumentList і повертає
   * пари { номер ТТН, дата вручення } лише для отриманих (StateId 9/10/11).
   * Використовується крон-джобом синхронізації дат доставки в Oracle.
   */
  async collectDeliveries(
    dateFrom: string, // DD.MM.YYYY
    dateTo: string, // DD.MM.YYYY
  ): Promise<Array<{ number: string; deliveredAt: Date }>> {
    const out: Array<{ number: string; deliveredAt: Date }> = [];
    const limit = 200;
    let page = 1;

    for (;;) {
      const rows = await this.call<any>('InternetDocument', 'getDocumentList', {
        DateTimeFrom: dateFrom,
        DateTimeTo: dateTo,
        Page: String(page),
        GetFullList: '0',
        Limit: String(limit),
      });

      for (const r of rows) {
        if (!NovaPoshtaApiService.DELIVERED_STATE_IDS.has(String(r.StateId ?? ''))) continue;
        const number = NovaPoshtaApiService.text(r.IntDocNumber ?? r.Number);
        const deliveredAt = NovaPoshtaApiService.parseNpDateTime(r.RecipientDateTime);
        if (number && deliveredAt) out.push({ number, deliveredAt });
      }

      if (rows.length < limit) break; // остання сторінка
      page += 1;
      if (page > 100) break; // запобіжник (до 20 000 накладних за вікно)
    }

    return out;
  }

  /* ── tracking (monitoring) ──────────────────────────────────────────── */

  async track(
    parcels: Array<{ number: string; phone?: string }>,
  ): Promise<NovaPoshtaTracking[]> {
    const documents = parcels
      .map((p) => ({
        DocumentNumber: NovaPoshtaApiService.text(p.number),
        Phone: NovaPoshtaApiService.text(p.phone) ?? '',
      }))
      .filter((d) => d.DocumentNumber);

    if (documents.length === 0) {
      throw new BadRequestException('Вкажіть щонайменше один номер ТТН');
    }

    const rows = await this.call<any>(
      'TrackingDocument',
      'getStatusDocuments',
      { Documents: documents },
    );

    return rows.map((r) => {
      const statusCode = NovaPoshtaApiService.text(r.StatusCode);
      return {
        number: NovaPoshtaApiService.text(r.Number) ?? '',
        status: NovaPoshtaApiService.text(r.Status),
        status_code: statusCode,
        city_sender: NovaPoshtaApiService.text(r.CitySender),
        city_recipient: NovaPoshtaApiService.text(r.CityRecipient),
        warehouse_recipient: NovaPoshtaApiService.text(r.WarehouseRecipient),
        recipient_full_name: NovaPoshtaApiService.text(r.RecipientFullName),
        document_cost: NovaPoshtaApiService.num(r.DocumentCost),
        cost_on_site: NovaPoshtaApiService.num(r.CostOnSite),
        backward_delivery_sum: NovaPoshtaApiService.num(r.BackwardDeliverySum),
        weight: NovaPoshtaApiService.num(r.DocumentWeight ?? r.FactualWeight),
        date_created: NovaPoshtaApiService.text(r.DateCreated),
        scheduled_delivery_date: NovaPoshtaApiService.text(
          r.ScheduledDeliveryDate,
        ),
        actual_delivery_date: NovaPoshtaApiService.text(r.ActualDeliveryDate),
        delivered: statusCode
          ? NovaPoshtaApiService.DELIVERED_CODES.has(statusCode)
          : false,
        phone_recipient: NovaPoshtaApiService.text(r.PhoneRecipient),
        // Per-document errors ride in an `error` field on the row itself.
        error: NovaPoshtaApiService.text(r.Error),
      };
    });
  }

  /* ── own register (monitoring) ──────────────────────────────────────── */

  async listShipments(params: {
    dateFrom: string; // DD.MM.YYYY
    dateTo: string; // DD.MM.YYYY
    page?: number;
    limit?: number;
  }): Promise<{ items: NovaPoshtaShipment[]; page: number; limit: number }> {
    const page = Math.max(1, Math.trunc(params.page ?? 1) || 1);
    const limit = Math.min(Math.max(Math.trunc(params.limit ?? 50) || 50, 1), 100);

    const rows = await this.call<any>('InternetDocument', 'getDocumentList', {
      DateTimeFrom: params.dateFrom,
      DateTimeTo: params.dateTo,
      Page: String(page),
      GetFullList: '0',
      Limit: String(limit),
    });
    setTimeout(() => {
      console.log(rows, 'ROWS ------ ')
    }, 3000)
    const items = rows.map((r) => {
      const settlement = r.SettlmentAddressData ?? {};
      return {
        ref: NovaPoshtaApiService.text(r.Ref),
        number: NovaPoshtaApiService.text(r.IntDocNumber ?? r.Number) ?? '',
        date_created: NovaPoshtaApiService.text(r.DateTime),
        cost: NovaPoshtaApiService.num(r.CostOnSite ?? r.Cost),
        weight: NovaPoshtaApiService.num(r.Weight),
        seats_amount: NovaPoshtaApiService.num(r.SeatsAmount),
        cost_on_site: NovaPoshtaApiService.num(r.CostOnSite),
        // The person is RecipientContactPerson; RecipientName is not returned here.
        recipient_name:
          NovaPoshtaApiService.text(r.RecipientContactPerson) ??
          NovaPoshtaApiService.text(r.RecipientFullName),
        recipient_company: NovaPoshtaApiService.text(r.RecipientDescription),
        recipient_phone: NovaPoshtaApiService.text(
          r.RecipientsPhone ?? r.RecipientContactPhone,
        ),
        // CityRecipient is a UUID Ref — the readable name is in *Description.
        city_recipient:
          NovaPoshtaApiService.text(r.CityRecipientDescription) ??
          NovaPoshtaApiService.text(settlement.RecipientSettlementDescription),
        warehouse_recipient: NovaPoshtaApiService.text(
          r.RecipientAddressDescription,
        ),
        state_name: NovaPoshtaApiService.text(r.StateName),
        payer_type: NovaPoshtaApiService.text(r.PayerType),
        description: NovaPoshtaApiService.text(r.Description),
        additional_information: NovaPoshtaApiService.text(
          r.AdditionalInformation,
        ),
        note: NovaPoshtaApiService.text(r.Note),
        scheduled_delivery_date: NovaPoshtaApiService.text(
          r.ScheduledDeliveryDate,
        ),
      };
    });

    return { items, page, limit };
  }

  /* ── reference lookups (create) ─────────────────────────────────────── */

  async searchCities(find: string, limit = 20): Promise<NovaPoshtaCity[]> {
    const query = NovaPoshtaApiService.text(find);
    if (!query) return [];

    const rows = await this.call<any>('Address', 'getCities', {
      FindByString: query,
      Limit: String(Math.min(Math.max(limit, 1), 50)),
      Page: '1',
    });

    return rows.map((r) => ({
      ref: NovaPoshtaApiService.text(r.Ref) ?? '',
      name: NovaPoshtaApiService.text(r.Description) ?? '',
      area: NovaPoshtaApiService.text(r.AreaDescription),
      settlement_type: NovaPoshtaApiService.text(r.SettlementTypeDescription),
    }));
  }

  async listWarehouses(
    cityRef: string,
    find?: string,
    limit = 50,
  ): Promise<NovaPoshtaWarehouse[]> {
    const ref = NovaPoshtaApiService.text(cityRef);
    if (!ref) {
      throw new BadRequestException('Не вказано місто (CityRef)');
    }

    const rows = await this.call<any>('Address', 'getWarehouses', {
      CityRef: ref,
      FindByString: NovaPoshtaApiService.text(find) ?? '',
      Limit: String(Math.min(Math.max(limit, 1), 100)),
      Page: '1',
    });

    return rows.map((r) => ({
      ref: NovaPoshtaApiService.text(r.Ref) ?? '',
      number: NovaPoshtaApiService.text(r.Number),
      description: NovaPoshtaApiService.text(r.Description),
      short_address: NovaPoshtaApiService.text(r.ShortAddress),
      city_ref: NovaPoshtaApiService.text(r.CityRef),
      type_of_warehouse: NovaPoshtaApiService.text(r.TypeOfWarehouse),
      category: NovaPoshtaApiService.text(r.CategoryOfWarehouse),
    }));
  }

  /**
   * The sender is whoever owns the API key. Resolve the counterparty, its first
   * contact person, and the account's default city/warehouse so the create form
   * is pre-filled instead of asking a dispatcher to paste refs.
   */
  async resolveSender(): Promise<NovaPoshtaSender> {
    const counterparties = await this.call<any>(
      'Counterparty',
      'getCounterparties',
      { CounterpartyProperty: 'Sender', Page: '1' },
    );
    const sender = counterparties[0];
    const counterpartyRef = NovaPoshtaApiService.text(sender?.Ref);

    let contactRef: string | null = null;
    let contactName: string | null = null;
    let phone: string | null = null;
    if (counterpartyRef) {
      const contacts = await this.call<any>(
        'Counterparty',
        'getCounterpartyContactPersons',
        { Ref: counterpartyRef, Page: '1' },
      );
      const contact = contacts[0];
      contactRef = NovaPoshtaApiService.text(contact?.Ref);
      contactName = NovaPoshtaApiService.text(contact?.Description);
      phone = NovaPoshtaApiService.text(contact?.Phones);
    }

    return {
      counterparty_ref: counterpartyRef,
      contact_ref: contactRef,
      contact_name: contactName,
      phone,
      // City/warehouse of the sender are account settings; the dispatcher picks
      // them in the form when they are not exposed on the counterparty.
      city_ref: NovaPoshtaApiService.text(sender?.CityRef),
      city_name: NovaPoshtaApiService.text(sender?.City),
      warehouse_ref: null,
      warehouse_name: null,
    };
  }

  /* ── create a shipment ──────────────────────────────────────────────── */

  /**
   * Creates the recipient as a private-person counterparty, then saves the
   * express waybill (InternetDocument.save). Nova Poshta returns the new TTN
   * number and the price computed on its side.
   */
  async createShipment(
    input: CreateShipmentInput,
    senderCityRef: string,
    senderWarehouseRef: string,
  ): Promise<CreateShipmentResult> {
    const sender = await this.resolveSender();
    if (!sender.counterparty_ref || !sender.contact_ref || !sender.phone) {
      throw new BadGatewayException(
        'Не вдалося визначити відправника за API-ключем Нової Пошти',
      );
    }

    const senderCity = NovaPoshtaApiService.text(senderCityRef);
    const senderWarehouse = NovaPoshtaApiService.text(senderWarehouseRef);
    if (!senderCity || !senderWarehouse) {
      throw new BadRequestException('Оберіть місто та відділення відправника');
    }

    // 1. Recipient counterparty (private person). Nova Poshta returns the
    //    counterparty ref plus a ContactPerson ref in the same response.
    const recipients = await this.call<any>('Counterparty', 'save', {
      FirstName: input.recipientFirstName,
      MiddleName: input.recipientMiddleName ?? '',
      LastName: input.recipientLastName,
      Phone: input.recipientPhone,
      CounterpartyType: 'PrivatePerson',
      CounterpartyProperty: 'Recipient',
    });
    const recipient = recipients[0];
    const recipientRef = NovaPoshtaApiService.text(recipient?.Ref);
    const recipientContactRef = NovaPoshtaApiService.text(
      recipient?.ContactPerson?.data?.[0]?.Ref,
    );
    if (!recipientRef || !recipientContactRef) {
      throw new BadGatewayException(
        'Нова Пошта не повернула отримувача — перевірте ПІБ і телефон',
      );
    }

    // 2. The waybill itself.
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}.${String(
      today.getMonth() + 1,
    ).padStart(2, '0')}.${today.getFullYear()}`;

    const properties: Record<string, unknown> = {
      PayerType: input.payerType ?? 'Recipient',
      PaymentMethod: 'Cash',
      DateTime: dateStr,
      CargoType: 'Parcel',
      Weight: String(input.weight),
      ServiceType: input.serviceType ?? 'WarehouseWarehouse',
      SeatsAmount: String(input.seatsAmount ?? 1),
      Description: input.description,
      Cost: String(input.cost),

      CitySender: senderCity,
      Sender: sender.counterparty_ref,
      SenderAddress: senderWarehouse,
      ContactSender: sender.contact_ref,
      SendersPhone: sender.phone,

      CityRecipient: input.recipientCityRef,
      Recipient: recipientRef,
      RecipientAddress: input.recipientWarehouseRef,
      ContactRecipient: recipientContactRef,
      RecipientsPhone: input.recipientPhone,
    };

    // Cash on delivery (грошовий переказ) — an optional backward-delivery leg.
    if (input.backwardMoney && input.backwardMoney > 0) {
      properties.BackwardDeliveryData = [
        {
          PayerType: 'Recipient',
          CargoType: 'Money',
          RedeliveryString: String(input.backwardMoney),
        },
      ];
    }

    const created = await this.call<any>(
      'InternetDocument',
      'save',
      properties,
    );
    const doc = created[0];
    const number = NovaPoshtaApiService.text(doc?.IntDocNumber);
    const ref = NovaPoshtaApiService.text(doc?.Ref);
    if (!number || !ref) {
      throw new BadGatewayException('Нова Пошта не повернула номер накладної');
    }

    this.logger.log(`Nova Poshta shipment created: ${number}`);
    return {
      ref,
      number,
      cost_on_site: NovaPoshtaApiService.num(doc?.CostOnSite),
      estimated_delivery_date: NovaPoshtaApiService.text(
        doc?.EstimatedDeliveryDate,
      ),
    };
  }

  getStatus() {
    return {
      configured: Boolean(this.apiKey),
      endpoint: this.client.defaults.baseURL,
    };
  }
}
