import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { InflightMap, TtlCache } from '../common/swr-cache';
import {
  PrivatBalance,
  PrivatCurrencySummary,
  PrivatTransaction,
  dedupeTransactions,
  isoToBankDate,
  mapBalance,
  mapTransaction,
  summarize,
} from './privat.mapper';
import {
  PrivatCardCurrencySummary,
  PrivatCardSummary,
  PrivatCardTransaction,
  PrivatCorporation,
  cardJoinKey,
  dedupeCardTransactions,
  isoToCardDate,
  mapCardSummary,
  mapCardTransaction,
  mapCorporation,
  summarizeCardTransactions,
} from './privat-cards.mapper';

/**
 * PrivatBank «Автоклієнт» (Приват24 для бізнесу) — statements, read-only.
 *
 *   GET https://acp.privatbank.ua/api/statements/{balance|transactions}[/interim|/final]
 *   headers: token, User-Agent, Content-Type: application/json;charset=utf-8
 *
 * Facts that shape the design:
 *  - **~1 request per second** is the vendor's ceiling, so every call goes through one
 *    serial queue (`throttle`) with a minimum gap. A 4 000-row period is ~40 sequential
 *    pages; fanning them out would just get the token throttled.
 *  - **Cursor paging**: `exist_next_page` + `next_page_id` → pass back as `followId`.
 *    The vendor's own `limit` (≤500, "recommended ≤100") is used; the controller does not
 *    page again on top of it.
 *  - **The statements API is read-only.** Nothing in this class creates a payment — that
 *    lives behind other endpoints the project deliberately does not call.
 *  - Charset defaults to cp1251 when none is declared, so we ask for UTF-8 explicitly and
 *    still decode the answer by the charset the server reports.
 *  - Failures surface as `message` text (the frontend's `toError()` shows it verbatim).
 *    Unlike the fuel vendors this adapter does **not** swallow errors into an empty list:
 *    an empty bank statement that is really a dead token would be a dangerous lie.
 */

export type PrivatScope = 'period' | 'interim' | 'final';

export interface PrivatQuery {
  scope: PrivatScope;
  /** ISO `YYYY-MM-DD`; required for `period`. */
  startDate?: string;
  /** ISO `YYYY-MM-DD`; defaults to today for `period`. */
  endDate?: string;
  /** Account number (IBAN); omitted = every active account. */
  acc?: string;
  /** Skip the short-lived cache. */
  force?: boolean;
}

export interface PrivatList<T> {
  items: T[];
  total: number;
  /** Upstream pages walked to assemble the list. */
  pages: number;
  /** True when the page cap stopped the walk before the vendor ran out of data. */
  truncated: boolean;
  scope: PrivatScope;
  start_date: string | null;
  end_date: string | null;
  account: string | null;
  fetched_at: string;
}

export interface PrivatTransactionsResult extends PrivatList<PrivatTransaction> {
  summary: PrivatCurrencySummary[];
}

/** Corporate-cards API: separate from account statements (other endpoints, POST, dd.MM.yyyy). */
export interface PrivatCardsQuery {
  /** `o` open (default), `c` closed, `all`. */
  state?: 'o' | 'c' | 'all';
  force?: boolean;
}

export interface PrivatCardsResult {
  client_id: string | null;
  client_name: string | null;
  okpo: string | null;
  cards_total: number;
  corporations: PrivatCorporation[];
  fetched_at: string;
}

export interface PrivatCardTransactionsQuery {
  /** ISO `YYYY-MM-DD`. */
  startDate: string;
  endDate?: string;
  /** Limit to one corporation (`CorpCode`). */
  corp?: string;
  /** Limit to one card — its `pan_key`; switches to the per-card statement. */
  card?: string;
  force?: boolean;
}

export interface PrivatCardTransactionsResult {
  items: PrivatCardTransaction[];
  total: number;
  summary: PrivatCardCurrencySummary[];
  /** Per-card turnover blocks (only for the per-card mode). */
  card_summaries: PrivatCardSummary[];
  /** Corporations that could not be read; the rest are still returned. */
  errors: { corp: string | null; type: string | null; message: string }[];
  corporations_read: number;
  start_date: string;
  end_date: string;
  fetched_at: string;
}

export interface PrivatEnvelope {
  status?: string;
  type?: string;
  exist_next_page?: boolean;
  next_page_id?: string | null;
  transactions?: Record<string, unknown>[];
  balances?: Record<string, unknown>[];
  [key: string]: unknown;
}

const MIN_GAP_MS = 1100;
const CACHE_TTL_MS = 60_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class PrivatApiService {
  private readonly logger = new Logger(PrivatApiService.name);
  private readonly http: AxiosInstance;
  private readonly token: string | undefined;
  private readonly pageSize: number;
  private readonly maxPages: number;

  /** Tail of the serial request queue. */
  private queue: Promise<unknown> = Promise.resolve();
  private lastCallAt = 0;

  private readonly cache = new TtlCache(CACHE_TTL_MS);
  private readonly inflight = new InflightMap<unknown>();

  constructor(private readonly config: ConfigService) {
    this.token = this.config.get<string>('PRIVAT_BANK_API_KEY') || undefined;
    this.pageSize = clamp(Number(this.config.get('PRIVAT_BANK_PAGE_SIZE')) || 100, 10, 500);
    this.maxPages = clamp(Number(this.config.get('PRIVAT_BANK_MAX_PAGES')) || 300, 1, 5000);

    this.http = axios.create({
      baseURL: this.config.get<string>('PRIVAT_BANK_BASE_URL') || 'https://acp.privatbank.ua',
      timeout: 60_000,
      responseType: 'arraybuffer',
      // 4xx/5xx are decoded and reported by us, with the vendor's own text.
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Veles-ERP',
        'Content-Type': 'application/json;charset=utf-8',
        Accept: 'application/json',
      },
    });

    if (!this.token) {
      this.logger.warn('PRIVAT_BANK_API_KEY не задано — інтеграція з ПриватБанком вимкнена.');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      pageSize: this.pageSize,
      maxPages: this.maxPages,
    };
  }

  /* ── public API ──────────────────────────────────────────────────────── */

  /** Server clock, work phase and final-statement date (`statements/settings`). */
  async getSettings(): Promise<PrivatEnvelope> {
    this.assertConfigured();
    return this.call('/api/statements/settings');
  }

  async getBalances(q: PrivatQuery): Promise<PrivatList<PrivatBalance>> {
    return this.cached('balances', q, async () => {
      const { items, pages, truncated } = await this.fetchAll('balances', q);
      const mapped = items.map(mapBalance);
      return { ...this.meta(q), items: mapped, total: mapped.length, pages, truncated };
    });
  }

  async getTransactions(q: PrivatQuery): Promise<PrivatTransactionsResult> {
    return this.cached('transactions', q, async () => {
      const { items, pages, truncated } = await this.fetchAll('transactions', q);
      const mapped = dedupeTransactions(items.map(mapTransaction)).sort(byNewest);
      return {
        ...this.meta(q),
        items: mapped,
        total: mapped.length,
        pages,
        truncated,
        summary: summarize(mapped),
      };
    });
  }

  /**
   * Corporations and their cards (`POST /api/corpcards/v2/cards/list`). Verified live.
   * When a corporation reports more cards than it sent (`cardsAmount > cardsShown`) the
   * rest are fetched in packets of 100 (`numOfEntr`/`packNum`), stopping if a packet adds nothing.
   */
  async getCards(q: PrivatCardsQuery = {}): Promise<PrivatCardsResult> {
    this.assertConfigured();
    const state = q.state ?? 'o';
    const key = `cards|${state}`;
    if (q.force) this.cache.delete(key);

    return this.inflight.run(key, () =>
      this.cache.wrap(key, async () => {
        const body = state === 'all' ? {} : { panState: state };
        const env = await this.call('/api/corpcards/v2/cards/list', undefined, body);
        const jur = ((env as any).Data?.JurData ?? {}) as Record<string, any>;
        const corporations: PrivatCorporation[] = [];

        for (const raw of (jur.CorpData ?? []) as Record<string, unknown>[]) {
          const corp = mapCorporation(raw);
          let packet = 1;
          while (corp.cards.length < corp.cards_total && packet <= 50) {
            const more = await this.call('/api/corpcards/v2/cards/list', undefined, {
              ...body,
              corpCod: corp.code,
              corpType: corp.type,
              numOfEntr: 100,
              packNum: packet,
              main: 'N',
              cardNumber: null,
              search: null,
            });
            const rows = ((more as any).Data?.JurData?.CorpData ?? []) as Record<string, unknown>[];
            const next = rows.find((r) => r.CorpCode === raw.CorpCode && r.corpType === raw.corpType);
            const have = new Set(corp.cards.map((c) => c.pan_key));
            const fresh = mapCorporation(next ?? {}).cards.filter((c) => !have.has(c.pan_key));
            if (fresh.length === 0) break;
            corp.cards.push(...fresh);
            packet += 1;
          }
          corp.cards_shown = corp.cards.length;
          corporations.push(corp);
        }

        return {
          client_id: jur.ClientIdJur === undefined ? null : String(jur.ClientIdJur),
          client_name: jur.NameClientJur ?? null,
          okpo: jur.OKPO ?? null,
          cards_total: corporations.reduce((n, c) => n + c.cards.length, 0),
          corporations,
          fetched_at: new Date().toISOString(),
        } as PrivatCardsResult;
      }),
    ) as Promise<PrivatCardsResult>;
  }

  /**
   * Card operations for a period. Default: one **corporation** statement per corporation that
   * has cards (`/v2/corp/statements`); with `card` — that single card's statement
   * (`/v2/card/statements`), which also returns the turnover summary.
   *
   * NOTE (verified 2026-11-03): the statement endpoints answered `501 DE022
   * COPR_CARDS_SERVICE_ERROR` after exactly 30 s for every `id` variant and for both the
   * 87-card and the 1-card corporation, while `cards/list` worked. The mapping below follows
   * the vendor document and has not yet been exercised against a real statement. A corporation
   * that fails is reported in `errors` and the others are still returned — never silently empty.
   */
  async getCardTransactions(q: PrivatCardTransactionsQuery): Promise<PrivatCardTransactionsResult> {
    this.assertConfigured();
    if (!q.startDate || !ISO_DATE.test(q.startDate)) {
      throw new BadRequestException('Вкажіть початок періоду у форматі РРРР-ММ-ДД.');
    }
    if (q.endDate && !ISO_DATE.test(q.endDate)) {
      throw new BadRequestException('Кінець періоду має бути у форматі РРРР-ММ-ДД.');
    }
    const endDate = q.endDate ?? today();
    if (endDate < q.startDate) throw new BadRequestException('Кінець періоду раніше за початок.');

    const key = `cardtx|${q.startDate}|${endDate}|${q.corp ?? ''}|${q.card ?? ''}`;
    if (q.force) this.cache.delete(key);

    return this.inflight.run(key, () =>
      this.cache.wrap(key, async () => {
        const cards = await this.getCards({ state: 'all' });
        const holders = new Map<string, string>();
        for (const c of cards.corporations.flatMap((x) => x.cards)) {
          const k = cardJoinKey(c.pan_masked) ?? cardJoinKey(c.pan_key);
          if (k && c.holder_name) holders.set(k, c.holder_name);
        }

        let targets = cards.corporations.filter((c) => c.cards.length > 0);
        if (q.corp) targets = targets.filter((c) => c.code === q.corp);
        if (q.card) {
          targets = targets.filter((c) => c.cards.some((x) => x.pan_key === q.card));
          if (targets.length === 0) throw new BadRequestException('Картку не знайдено серед корпорацій банку.');
        }

        const query = { dateStart: isoToCardDate(q.startDate), dateEnd: isoToCardDate(endDate) };
        const items: PrivatCardTransaction[] = [];
        const summaries: PrivatCardSummary[] = [];
        const errors: PrivatCardTransactionsResult['errors'] = [];
        let read = 0;

        for (const corp of targets) {
          const corporation = { id: corp.branch ?? corp.jur_id ?? '', code: corp.code, type: corp.type };
          const ctx = { corpCode: corp.code, corpType: corp.type };
          try {
            const env = q.card
              ? await this.call('/api/corpcards/v2/card/statements', query, { corporation, clientCard: q.card })
              : await this.call('/api/corpcards/v2/corp/statements', query, { corporation });
            const block = ((q.card ? (env as any).CardStatement : (env as any).CorpStatement) ?? {}) as Record<string, any>;
            for (const row of (block.statements ?? []) as Record<string, unknown>[]) {
              const tx = mapCardTransaction(row, ctx);
              const hk = cardJoinKey(tx.card);
              items.push(hk && holders.has(hk) ? { ...tx, card_holder: holders.get(hk)! } : tx);
            }
            if (block.summary) summaries.push(mapCardSummary(block.summary));
            read += 1;
          } catch (e: any) {
            errors.push({ corp: corp.code, type: corp.type, message: e?.message ?? String(e) });
          }
        }

        // Nothing readable at all: that is an outage, not an empty statement.
        if (read === 0 && errors.length > 0) {
          throw new BadGatewayException(errors.map((e) => `${e.corp ?? '?'}: ${e.message}`).join(' | '));
        }

        const merged = dedupeCardTransactions(items).sort(
          (a, b) => (b.datetime ?? b.date ?? '').localeCompare(a.datetime ?? a.date ?? ''),
        );
        return {
          items: merged,
          total: merged.length,
          summary: summarizeCardTransactions(merged),
          card_summaries: summaries,
          errors,
          corporations_read: read,
          start_date: q.startDate,
          end_date: endDate,
          fetched_at: new Date().toISOString(),
        } as PrivatCardTransactionsResult;
      }),
    ) as Promise<PrivatCardTransactionsResult>;
  }

  /* ── internals ───────────────────────────────────────────────────────── */

  private meta(q: PrivatQuery) {
    return {
      scope: q.scope,
      start_date: q.scope === 'period' ? (q.startDate ?? null) : null,
      end_date: q.scope === 'period' ? (q.endDate ?? today()) : null,
      account: q.acc?.trim() || null,
      fetched_at: new Date().toISOString(),
    };
  }

  private async cached<T>(kind: string, q: PrivatQuery, load: () => Promise<T>): Promise<T> {
    this.assertConfigured();
    this.validate(q);
    const key = `${kind}|${q.scope}|${q.startDate ?? ''}|${q.endDate ?? ''}|${q.acc ?? ''}`;
    if (q.force) this.cache.delete(key);
    // Two dispatchers opening the same period share one walk of the (slow) vendor.
    return this.inflight.run(key, () => this.cache.wrap(key, load)) as Promise<T>;
  }

  private validate(q: PrivatQuery): void {
    if (q.scope === 'period') {
      if (!q.startDate || !ISO_DATE.test(q.startDate)) {
        throw new BadRequestException('Вкажіть початок періоду у форматі РРРР-ММ-ДД.');
      }
      if (q.endDate && !ISO_DATE.test(q.endDate)) {
        throw new BadRequestException('Кінець періоду має бути у форматі РРРР-ММ-ДД.');
      }
      if (q.endDate && q.endDate < q.startDate) {
        throw new BadRequestException('Кінець періоду раніше за початок.');
      }
    }
  }

  private assertConfigured(): void {
    if (!this.token) {
      throw new ServiceUnavailableException(
        'ПриватБанк не налаштовано: задайте PRIVAT_BANK_API_KEY у backend/.env і перезапустіть бекенд.',
      );
    }
  }

  /** Walks every page of one feed and returns the raw rows. */
  private async fetchAll(kind: 'balances' | 'transactions', q: PrivatQuery) {
    const feed = kind === 'balances' ? 'balance' : 'transactions';
    const path =
      q.scope === 'interim'
        ? `/api/statements/${feed}/interim`
        : q.scope === 'final'
          ? `/api/statements/${feed}/final`
          : `/api/statements/${feed}`;

    // Interim feed caps at 100 per page; the others allow 500.
    const limit = q.scope === 'interim' ? Math.min(this.pageSize, 100) : this.pageSize;
    const params: Record<string, string | number> = { limit };
    if (q.acc?.trim()) params.acc = q.acc.trim();
    if (q.scope === 'period') {
      params.startDate = isoToBankDate(q.startDate!);
      params.endDate = isoToBankDate(q.endDate ?? today());
    }

    const items: Record<string, unknown>[] = [];
    let followId: string | undefined;
    let pages = 0;
    let truncated = false;

    for (;;) {
      const env = (await this.call(path, followId ? { ...params, followId } : params)) as PrivatEnvelope;
      pages += 1;
      const rows = (kind === 'balances' ? env.balances : env.transactions) ?? [];
      items.push(...rows);

      if (!env.exist_next_page || !env.next_page_id) break;
      if (pages >= this.maxPages) {
        truncated = true;
        this.logger.warn(`${path}: обірвано на ${pages} сторінках (PRIVAT_BANK_MAX_PAGES).`);
        break;
      }
      followId = String(env.next_page_id);
    }

    return { items, pages, truncated };
  }

  /** One call through the serial, rate-limited queue: GET, or POST when a `body` is given. */
  private call(path: string, params?: Record<string, string | number>, body?: unknown): Promise<PrivatEnvelope> {
    const run = this.queue.then(() => this.throttled(path, params, body));
    // A failed call must not poison the queue for the next one.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async throttled(
    path: string,
    params?: Record<string, string | number>,
    body?: unknown,
  ): Promise<PrivatEnvelope> {
    const wait = this.lastCallAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);

    let res;
    try {
      res = await this.http.request({
        method: body === undefined ? 'GET' : 'POST',
        url: path,
        params,
        data: body,
        headers: { token: this.token! },
      });
    } catch (e: any) {
      this.lastCallAt = Date.now();
      this.logger.error(`${body === undefined ? 'GET' : 'POST'} ${path} → ${e?.code ?? e?.message}`);
      throw new BadGatewayException(`ПриватБанк недоступний: ${e?.code ?? e?.message ?? 'помилка мережі'}`);
    }
    this.lastCallAt = Date.now();

    const text = decode(res.data, String(res.headers?.['content-type'] ?? ''));
    let payload: any;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }
    const verb = body === undefined ? 'GET' : 'POST';

    if (res.status < 200 || res.status >= 300) {
      const detail = vendorMessage(payload) ?? `HTTP ${res.status}`;
      this.logger.warn(`${verb} ${path} → ${res.status}: ${detail}`);
      if (payload?.code === 'DE022') {
        throw new BadGatewayException(
          `ПриватБанк не віддав виписку по картках (${res.status} ${payload.code} ${detail}, запит ${payload.requestId ?? '—'}). ` +
            'Це відмова на боці банку (він відповідає через ~30 с) — повідомте підтримку Приват24 для бізнесу, назвавши requestId.',
        );
      }
      if (res.status === 401 || res.status === 403) {
        throw new BadGatewayException(`ПриватБанк відхилив токен (${res.status}): ${detail}`);
      }
      if (res.status === 429) {
        throw new BadGatewayException('ПриватБанк: забагато запитів (429). Спробуйте за хвилину.');
      }
      throw new BadGatewayException(`ПриватБанк (${res.status}): ${detail}`);
    }

    // Statements answer 200 with `status: "ERROR"` for a rejected request.
    if (typeof payload?.status === 'string' && payload.status.toUpperCase() === 'ERROR') {
      throw new BadGatewayException(`ПриватБанк: ${vendorMessage(payload) ?? 'помилка запиту'}`);
    }
    return payload as PrivatEnvelope;
  }
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Newest first, by operation datetime then date; undated rows sink. */
const byNewest = (a: PrivatTransaction, b: PrivatTransaction) =>
  (b.datetime ?? b.date ?? '').localeCompare(a.datetime ?? a.date ?? '');

/** Decodes by the response's declared charset; cp1251 is the vendor's default. */
function decode(data: ArrayBuffer | Buffer | string, contentType: string): string {
  if (typeof data === 'string') return data;
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const charset = /charset=([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase() ?? 'utf-8';
  try {
    return new TextDecoder(charset === 'cp1251' ? 'windows-1251' : charset).decode(buf);
  } catch {
    return buf.toString('utf8');
  }
}

/** Pulls the human-readable reason out of whichever error shape the vendor used. */
function vendorMessage(body: any): string | null {
  if (!body || typeof body !== 'object') return null;
  const m = body.message ?? body.error ?? body.errorMessage ?? body.error_description ?? body.raw;
  if (typeof m === 'string' && m.trim()) return m.trim().slice(0, 300);
  if (Array.isArray(body.errors) && body.errors.length) {
    return body.errors.map((e: any) => (typeof e === 'string' ? e : (e?.message ?? JSON.stringify(e)))).join('; ');
  }
  return null;
}
