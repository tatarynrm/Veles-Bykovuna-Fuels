import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * FMS REST API surface beyond live telemetry: reports, registries and account
 * resources. Source of truth: https://api.fm-track.com/swagger.json (a copy of
 * which is documented at fmsdocumentation.com).
 *
 * Conventions here:
 *  - Fields pass through in the vendor's snake_case — the UI consumes them as-is.
 *  - Collections normalize to `{ items, continuation_token }`.
 *  - Upstream failures become BadGateway with the vendor's text, matching the
 *    Routing & Tasking service — an anonymous 500 was how real errors used to
 *    get lost (see the arrival-window incident).
 *  - Registries that change rarely (geozones, groups, users, drivers) sit in a
 *    5-minute cache; parameterized reports are never cached.
 *
 * Deliberately NOT integrated: /object-coordinates-stream (a held-open stream;
 * the fleet view already polls /objects-last-coordinate) and /api/public/v1/trips
 * (duplicates the RnT GraphQL integration in ruptela-routing.service.ts).
 */

export interface FmCollection<T> {
  items: T[];
  continuation_token: string | number | null;
}

interface CacheEntry {
  data: unknown;
  at: number;
}

const REGISTRY_TTL_MS = 5 * 60_000;

@Injectable()
export class RuptelaInsightsService {
  private readonly logger = new Logger(RuptelaInsightsService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;

  private readonly registryCache = new Map<string, CacheEntry>();

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RUPTELA_API_KEY') ?? '';
    const baseUrl =
      this.configService.get<string>('RUPTELA_BASE_URL') ?? 'https://api.fm-track.com';

    this.client = axios.create({
      baseURL: baseUrl,
      // Country/violation reports over long ranges are the slow end of this API.
      timeout: 45_000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Veles-Bykovuna-Fuels-Ruptela-Client/1.0',
      },
    });
  }

  /* ── transport ──────────────────────────────────────────────────────── */

  private async fm<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    options: { version?: number; params?: Record<string, unknown>; body?: unknown } = {},
  ): Promise<T> {
    if (!this.apiKey) {
      throw new BadGatewayException('RUPTELA_API_KEY не налаштовано');
    }

    const params: Record<string, unknown> = {
      api_key: this.apiKey,
      ...(options.version !== undefined ? { version: options.version } : {}),
    };
    for (const [k, v] of Object.entries(options.params ?? {})) {
      if (v !== undefined && v !== null && v !== '') params[k] = v;
    }

    try {
      const res = await this.client.request<T>({
        method,
        url: path,
        params,
        data: options.body,
      });
      return res.data;
    } catch (err: any) {
      // fm-track error bodies carry `message` (sometimes `error_description`),
      // and validation failures hide the useful part in `fieldValidationErrors`.
      const data = err?.response?.data;
      let upstream: string =
        data?.message ?? data?.error_description ?? data?.error ?? err?.message ?? 'невідома помилка';
      // The body key is snake_case `field_validation_errors` with a `reason`
      // field — verified live; the camelCase name only appears in the message.
      const validations =
        data?.field_validation_errors ?? data?.fieldValidationErrors ?? data?.failedValidations;
      if (Array.isArray(validations) && validations.length > 0) {
        const details = validations
          .map((v: any) =>
            [v?.field ?? v?.name, v?.reason ?? v?.message ?? v?.error].filter(Boolean).join(': '),
          )
          .filter(Boolean)
          .join('; ');
        if (details) upstream = `${upstream} (${details})`;
      }
      const status = err?.response?.status;
      this.logger.warn(`FMS ${method.toUpperCase()} ${path} failed (${status ?? '—'}): ${upstream}`);
      throw new BadGatewayException(
        `Ruptela FMS: ${typeof upstream === 'string' ? upstream : JSON.stringify(upstream)}`,
      );
    }
  }

  /** Collection responses vary in their array key — normalize to `items`. */
  private static collect<T>(raw: any, arrayKey = 'items'): FmCollection<T> {
    return {
      items: Array.isArray(raw?.[arrayKey]) ? raw[arrayKey] : Array.isArray(raw) ? raw : [],
      continuation_token: raw?.continuation_token ?? raw?.continuationToken ?? null,
    };
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.registryCache.get(key);
    if (hit && Date.now() - hit.at < REGISTRY_TTL_MS) return hit.data as T;
    const data = await load();
    this.registryCache.set(key, { data, at: Date.now() });
    return data;
  }

  private static requireRange(from?: string, to?: string): { from: string; to: string } {
    if (!from || !to) {
      throw new BadRequestException('Вкажіть період: параметри from і to (ISO datetime)');
    }
    return { from, to };
  }

  /* ── fuel events — the reason a fuel ERP wants this API at all ──────── */

  /** GET /fuel-events?version=1 — refuels and drains detected from tank level. */
  getFuelEvents(objectId: string, from?: string, to?: string, limit?: number, token?: string) {
    if (!objectId) throw new BadRequestException('Вкажіть objectId');
    const range = RuptelaInsightsService.requireRange(from, to);
    // The swagger URI template advertises camelCase params here, but the live
    // endpoint 404s on them — it actually takes snake_case like its siblings.
    return this.fm<any>('get', '/fuel-events', {
      version: 1,
      params: {
        object_id: objectId,
        from_datetime: range.from,
        to_datetime: range.to,
        limit,
        continuation_token: token,
      },
    }).then((raw) => RuptelaInsightsService.collect(raw));
  }

  /* ── detected events (speeding, harsh driving, custom rules) ────────── */

  /** GET /detected-events?version=1 */
  getDetectedEvents(params: {
    objectId?: string;
    userId?: string;
    from?: string;
    to?: string;
    limit?: number;
    token?: string;
  }) {
    const range = RuptelaInsightsService.requireRange(params.from, params.to);
    return this.fm<any>('get', '/detected-events', {
      version: 1,
      params: {
        object_id: params.objectId,
        user_id: params.userId,
        from_datetime: range.from,
        to_datetime: range.to,
        limit: params.limit,
        continuation_token: params.token,
      },
    }).then((raw) => RuptelaInsightsService.collect(raw, 'events'));
  }

  /* ── ecodriving ─────────────────────────────────────────────────────── */

  /** GET /ecodriving/{object|driver}?version=1 — scores + fuel/idling breakdown. */
  getEcodriving(subject: 'object' | 'driver', id: string, from?: string, to?: string) {
    if (!id) throw new BadRequestException('Вкажіть id');
    const range = RuptelaInsightsService.requireRange(from, to);
    return this.fm<any>('get', `/ecodriving/${subject}`, {
      version: 1,
      params: { id, from_datetime: range.from, to_datetime: range.to },
    });
  }

  /* ── drivers ────────────────────────────────────────────────────────── */

  /** GET /drivers?version=2 */
  getDrivers(limit?: number, token?: string, identifier?: string, identifierType?: string) {
    const load = () =>
      this.fm<any>('get', '/drivers', {
        version: 2,
        params: {
          limit,
          continuation_token: token,
          identifier,
          identifier_type: identifierType,
        },
      }).then((raw) => RuptelaInsightsService.collect(raw));
    // Only the unfiltered first page is worth caching.
    return !limit && !token && !identifier ? this.cached('drivers', load) : load();
  }

  /** GET /drivers/{id}?version=2 */
  getDriver(driverId: string) {
    return this.fm<any>('get', `/drivers/${encodeURIComponent(driverId)}`, { version: 2 });
  }

  /** GET /driverstate/{id}?version=1 — tacho activity timeline. */
  getDriverStates(driverId: string, from?: string, to?: string, limit?: number, token?: string) {
    const range = RuptelaInsightsService.requireRange(from, to);
    return this.fm<any>('get', `/driverstate/${encodeURIComponent(driverId)}`, {
      version: 1,
      params: {
        from_datetime: range.from,
        to_datetime: range.to,
        limit,
        continuation_token: token,
      },
    }).then((raw) => ({
      driver_id: raw?.driver_id ?? driverId,
      ...RuptelaInsightsService.collect(raw),
    }));
  }

  /** GET /drivers/{id}/current-time-analysis?version=1 — live tacho budget. */
  getDriverTimeAnalysis(driverId: string) {
    return this.fm<any>('get', `/drivers/${encodeURIComponent(driverId)}/current-time-analysis`, {
      version: 1,
    });
  }

  /** GET /driver/assignations/last?version=1 — who is (was) behind the wheel. */
  getLastAssignation(byDriverId?: string, byObjectId?: string) {
    if (!byDriverId && !byObjectId) {
      throw new BadRequestException('Вкажіть byDriverId або byObjectId');
    }
    return this.fm<any>('get', '/driver/assignations/last', {
      version: 1,
      params: { byDriverId, byObjectId },
    });
  }

  /** POST /driver/assignations?version=1 — manual driver-to-vehicle assignation. */
  createAssignation(body: unknown) {
    return this.fm<any>('post', '/driver/assignations', { version: 1, body });
  }

  /* ── geozones ───────────────────────────────────────────────────────── */

  /** GET /geozones?version=1 */
  getGeozones(includeGeometry = false, limit?: number, token?: string) {
    const load = () =>
      this.fm<any>('get', '/geozones', {
        version: 1,
        params: {
          include_geometry: includeGeometry || undefined,
          limit,
          continuation_token: token,
        },
      }).then((raw) => RuptelaInsightsService.collect(raw));
    return !includeGeometry && !limit && !token ? this.cached('geozones', load) : load();
  }

  /**
   * POST /geozones/visits?version=1 — a query, not a mutation.
   * The vendor requires a non-empty `geozone_ids` (verified live: 422
   * "geozoneIds: must not be empty"), but "visits in ANY zone" is the natural
   * question — so an omitted list is filled with every zone in the account.
   */
  async findGeozoneVisits(body: {
    geozone_ids?: string[];
    object_ids?: string[];
    from_datetime?: string;
    to_datetime?: string;
    limit?: number;
    continuation_token?: number;
  }) {
    RuptelaInsightsService.requireRange(body?.from_datetime, body?.to_datetime);

    let geozoneIds = body.geozone_ids?.filter(Boolean) ?? [];
    if (geozoneIds.length === 0) {
      const zones = await this.getGeozones();
      geozoneIds = zones.items.map((z: any) => z.id).filter(Boolean);
      // An account with no zones has no visits by definition.
      if (geozoneIds.length === 0) return { items: [], continuation_token: null };
    }

    return this.fm<any>('post', '/geozones/visits', {
      version: 1,
      body: { ...body, geozone_ids: geozoneIds },
    }).then((raw) => RuptelaInsightsService.collect(raw));
  }

  /* ── country report ─────────────────────────────────────────────────── */

  /** GET /countries/{object|driver}?version=1 — border crossings + per-country totals. */
  getCountries(subject: 'object' | 'driver', id: string, from?: string, to?: string, limit?: number, token?: string) {
    if (!id) throw new BadRequestException('Вкажіть id');
    const range = RuptelaInsightsService.requireRange(from, to);
    return this.fm<any>('get', `/countries/${subject}`, {
      version: 1,
      params: {
        id,
        from_datetime: range.from,
        to_datetime: range.to,
        limit,
        continuation_token: token,
      },
    }).then((raw) => ({
      subject_id: raw?.subject_id ?? id,
      items: Array.isArray(raw?.country_visits) ? raw.country_visits : [],
      continuation_token: raw?.continuation_token ?? null,
    }));
  }

  /* ── coordinates history ────────────────────────────────────────────── */

  /**
   * GET /objects/{id}/coordinates?version=2 — the raw track.
   * v3 exists but requires FEATURE_ADDRESS_COMPONENT_IN_STREAM_AND_HISTORY_API,
   * which this account's plan does not include (verified live: 403).
   */
  getCoordinatesHistory(
    objectId: string,
    from?: string,
    to?: string,
    limit?: number,
    token?: string,
    includeGeozones = false,
  ) {
    const range = RuptelaInsightsService.requireRange(from, to);
    return this.fm<any>('get', `/objects/${encodeURIComponent(objectId)}/coordinates`, {
      version: 2,
      params: {
        from_datetime: range.from,
        to_datetime: range.to,
        limit,
        continuation_token: token,
        include_geozones: includeGeozones || undefined,
      },
    }).then((raw) => RuptelaInsightsService.collect(raw));
  }

  /** GET /objects/{id}/coordinates/{datetime}?version=2 — nearest single record. */
  getCoordinateAt(objectId: string, datetime: string) {
    if (!datetime) throw new BadRequestException('Вкажіть datetime (ISO)');
    return this.fm<any>(
      'get',
      `/objects/${encodeURIComponent(objectId)}/coordinates/${encodeURIComponent(datetime)}`,
      { version: 2 },
    );
  }

  /* ── registries: groups & users ─────────────────────────────────────── */

  /** GET /object-groups?version=1 */
  getObjectGroups(limit?: number, token?: string) {
    const load = () =>
      this.fm<any>('get', '/object-groups', {
        version: 1,
        params: { limit, continuation_token: token },
      }).then((raw) => RuptelaInsightsService.collect(raw));
    return !limit && !token ? this.cached('object-groups', load) : load();
  }

  /** GET /object-groups/{id}?version=1 */
  getObjectGroup(externalId: string) {
    return this.fm<any>('get', `/object-groups/${encodeURIComponent(externalId)}`, {
      version: 1,
    });
  }

  /** PUT /management/object-group/{id}?version=1 */
  updateObjectGroup(externalId: string, body: unknown) {
    this.registryCache.delete('object-groups');
    return this.fm<any>('put', `/management/object-group/${encodeURIComponent(externalId)}`, {
      version: 1,
      body,
    });
  }

  /** GET /users?version=1 */
  getUsers(limit?: number, token?: string) {
    const load = () =>
      this.fm<any>('get', '/users', {
        version: 1,
        params: { limit, continuation_token: token },
      }).then((raw) => RuptelaInsightsService.collect(raw));
    return !limit && !token ? this.cached('users', load) : load();
  }

  /* ── driver violations ──────────────────────────────────────────────── */

  /** POST /driver-violation?version=1 — tacho infringement report (a query). */
  findDriverViolations(body: {
    date_time_from?: string;
    date_time_to?: string;
    card_numbers?: string[];
    vehicles?: string[];
    countries?: string[];
    severities?: string[];
    types?: string[];
    page_descriptor?: { page?: number; size?: number };
  }) {
    RuptelaInsightsService.requireRange(body?.date_time_from, body?.date_time_to);
    return this.fm<any>('post', '/driver-violation', { version: 1, body }).then((raw) => ({
      items: Array.isArray(raw?.items) ? raw.items : [],
      next_page: raw?.next_page ?? null,
    }));
  }

  /* ── client events CRUD ─────────────────────────────────────────────── */

  /** GET /events?version=1 */
  getEvents(limit?: number, token?: string) {
    return this.fm<any>('get', '/events', {
      version: 1,
      params: { limit, continuation_token: token },
    }).then((raw) => RuptelaInsightsService.collect(raw));
  }

  /** GET /events/{id}?version=1 */
  getEvent(externalId: string) {
    return this.fm<any>('get', `/events/${encodeURIComponent(externalId)}`, { version: 1 });
  }

  /** POST /events?version=1 */
  createEvent(body: unknown) {
    return this.fm<any>('post', '/events', { version: 1, body });
  }

  /** PUT /events/{id}?version=1 */
  updateEvent(externalId: string, body: unknown) {
    return this.fm<any>('put', `/events/${encodeURIComponent(externalId)}`, {
      version: 1,
      body,
    });
  }

  /** DELETE /events/{id}?version=1 */
  deleteEvent(externalId: string) {
    return this.fm<any>('delete', `/events/${encodeURIComponent(externalId)}`, { version: 1 });
  }

  /* ── share links (public live-tracking URLs) ────────────────────────── */

  /** GET /share-links?version=1 */
  getShareLinks(limit?: number, token?: string) {
    return this.fm<any>('get', '/share-links', {
      version: 1,
      params: { limit, continuation_token: token },
    }).then((raw) => RuptelaInsightsService.collect(raw));
  }

  /** POST /share-links?version=1 */
  createShareLink(body: {
    objects?: Array<{ id: string }>;
    valid_from?: string;
    expires_at?: string;
  }) {
    if (!body?.objects?.length) {
      throw new BadRequestException('Вкажіть щонайменше один транспортний засіб (objects)');
    }
    if (!body.expires_at) {
      throw new BadRequestException('Вкажіть термін дії посилання (expires_at)');
    }
    return this.fm<any>('post', '/share-links', { version: 1, body });
  }

  /** PUT /share-links/{id}?version=1 */
  updateShareLink(linkId: string, body: unknown) {
    return this.fm<any>('put', `/share-links/${encodeURIComponent(linkId)}`, {
      version: 1,
      body,
    });
  }

  /** DELETE /share-links/{id}?version=1 */
  deleteShareLink(linkId: string) {
    return this.fm<any>('delete', `/share-links/${encodeURIComponent(linkId)}`, { version: 1 });
  }

  /* ── driver management CRUD ─────────────────────────────────────────── */

  /** POST /management/driver?version=1 */
  createDriver(body: unknown) {
    this.registryCache.delete('drivers');
    return this.fm<any>('post', '/management/driver', { version: 1, body });
  }

  /** GET /management/driver/{id}?version=1 */
  getManagedDriver(driverId: string) {
    return this.fm<any>('get', `/management/driver/${encodeURIComponent(driverId)}`, {
      version: 1,
    });
  }

  /** PUT /management/driver/{id}?version=1 */
  updateDriver(driverId: string, body: unknown) {
    this.registryCache.delete('drivers');
    return this.fm<any>('put', `/management/driver/${encodeURIComponent(driverId)}`, {
      version: 1,
      body,
    });
  }

  /** DELETE /management/driver/{id}?version=1 */
  deleteDriver(driverId: string) {
    this.registryCache.delete('drivers');
    return this.fm<any>('delete', `/management/driver/${encodeURIComponent(driverId)}`, {
      version: 1,
    });
  }

  /* ── tachograph downloads ───────────────────────────────────────────── */

  /** POST /tacho/requests?version=1 — list scheduled requests (a query). */
  findTachoRequests(body: unknown) {
    return this.fm<any>('post', '/tacho/requests', { version: 1, body: body ?? {} });
  }

  /** GET /tacho/request/{id}?version=1 */
  getTachoRequest(requestId: string) {
    return this.fm<any>('get', `/tacho/request/${encodeURIComponent(requestId)}`, {
      version: 1,
    });
  }

  /** POST /tacho/driver-card-download?version=1 — commands the device; use knowingly. */
  scheduleDriverCardDownload(body: unknown) {
    return this.fm<any>('post', '/tacho/driver-card-download', { version: 1, body });
  }

  /** POST /tacho/vehicle-download?version=1 */
  scheduleVehicleDownload(body: unknown) {
    return this.fm<any>('post', '/tacho/vehicle-download', { version: 1, body });
  }

  /** DELETE /tacho/request/{id}?version=1 */
  deleteTachoRequest(requestId: string) {
    return this.fm<any>('delete', `/tacho/request/${encodeURIComponent(requestId)}`, {
      version: 1,
    });
  }

  /**
   * GET /tacho/file/{id}?version=1 — the .ddd file itself. Returned as a
   * buffer with the vendor's filename so the controller can stream it through.
   */
  async downloadTachoFile(
    requestId: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    if (!this.apiKey) throw new BadGatewayException('RUPTELA_API_KEY не налаштовано');
    try {
      const res = await this.client.get(`/tacho/file/${encodeURIComponent(requestId)}`, {
        params: { api_key: this.apiKey, version: 1 },
        responseType: 'arraybuffer',
      });
      const disposition: string = res.headers['content-disposition'] ?? '';
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
      return {
        buffer: Buffer.from(res.data),
        filename: match?.[1] ?? `tacho-${requestId}.ddd`,
        contentType: String(res.headers['content-type'] ?? 'application/octet-stream'),
      };
    } catch (err: any) {
      const status = err?.response?.status;
      // The body is a buffer on failure too — decode it for the message.
      let upstream = err?.message ?? 'невідома помилка';
      try {
        const parsed = JSON.parse(Buffer.from(err?.response?.data ?? '').toString('utf8'));
        upstream = parsed?.message ?? upstream;
      } catch {
        /* non-JSON error body */
      }
      this.logger.warn(`FMS GET /tacho/file/${requestId} failed (${status ?? '—'}): ${upstream}`);
      throw new BadGatewayException(`Ruptela FMS: ${upstream}`);
    }
  }

  /* ── integrations ───────────────────────────────────────────────────── */

  /** GET /vehicle-integrations/{objectId}/sentgeo?version=1 */
  getSentGeoStatus(objectId: string) {
    return this.fm<any>('get', `/vehicle-integrations/${encodeURIComponent(objectId)}/sentgeo`, {
      version: 1,
    });
  }
}
