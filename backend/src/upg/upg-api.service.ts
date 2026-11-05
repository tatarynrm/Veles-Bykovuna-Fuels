import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

const DEFAULT_BASE_URL = 'https://paycontainer.upg.ua/api';
/** Сторінка історії — 50 рядків (фіксовано вендором); стеля захищає від зациклення. */
const MAX_PAGES = 2000;

/** "2026-10-28" → "2026-10-29" (UTC-арифметика, без впливу часового поясу сервера). */
const nextDay = (ymd: string): string =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * UPG «Client Report API» (paycontainer.upg.ua) — звіт по паливних картках UPG.
 * Документація: common/UPG-Api/ClientReportAPI_Description2026.pdf.
 *
 * Авторизація: `POST /login` (login + password, form-urlencoded) → bearer-токен, далі
 * `Authorization: Bearer …`. Строк життя токена документація не вказує, тож токен кешується,
 * а на 401 робиться ОДИН повторний логін і повтор запиту.
 *
 * Лише читання. Для синхронізації з Oracle потрібна тільки `/fuel-card-history`; інші методи
 * вендора (баланс, перелік карток, талони) тут не використовуються.
 */
@Injectable()
export class UpgApiService {
  private readonly logger = new Logger(UpgApiService.name);
  private readonly client: AxiosInstance;
  private readonly login: string;
  private readonly password: string;
  private token: string | null = null;
  /** Спільний логін: паралельні запити не повинні логінитись по кілька разів. */
  private loginInFlight: Promise<string> | null = null;

  constructor(config: ConfigService) {
    this.login = (config.get<string>('UPG_LOGIN') ?? '').trim();
    this.password = config.get<string>('UPG_PASSWORD') ?? '';
    const baseURL = (config.get<string>('UPG_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');

    if (!this.isConfigured()) {
      this.logger.warn('UPG_LOGIN / UPG_PASSWORD не налаштовано — UPG API вимкнено');
    }

    this.client = axios.create({
      baseURL,
      timeout: 60_000,
      headers: { Accept: 'application/json', 'User-Agent': 'Veles-Bykovuna-Fuels-UPG-Client/1.0' },
    });
  }

  isConfigured(): boolean {
    return Boolean(this.login && this.password);
  }

  /**
   * Усі транзакції `/fuel-card-history` за [dateFrom, dateTo] (YYYY-MM-DD, обидві межі включні) з УСІМА сторінками —
   * для синхронізації в Oracle (fuel-sync). Помилку НЕ ковтає: збій має зупинити прохід, а не
   * виглядати як «транзакцій немає». Якщо вендор віддав менше рядків, ніж заявив у `meta.total`,
   * теж помилка — інакше неповне вікно мовчки вважалось би завершеним.
   */
  async getRawFuelCardHistory(dateFrom: string, dateTo: string): Promise<any[]> {
    if (!this.isConfigured()) throw new Error('UPG_LOGIN / UPG_PASSWORD не налаштовано');

    // УВАГА: `date_to` у UPG ВИКЛЮЧНИЙ — діапазон [date_from, date_to) (перевірено на живих даних:
    // 2026-10-27..2026-10-28 віддає лише 27-ме, а 27..29 — і 27-ме, і 28-ме). Решта синку вважає
    // обидві межі включними, тож тут додаємо добу, інакше остання доба кожного вікна випадала б.
    const body = new URLSearchParams({ date_from: dateFrom, date_to: nextDay(dateTo) }).toString();
    const rows: any[] = [];
    let total: number | null = null;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const response = await this.authorized<any>({
        method: 'POST',
        url: '/fuel-card-history',
        // Сторінку вендор бере з query (`links.next` = …/fuel-card-history?page=2), а діапазон
        // дат — з тіла, тож тіло шлемо на кожній сторінці. Власну URL ліпимо самі, а не йдемо
        // за `links.next`: токен не має потрапити на чужий хост.
        params: { page },
        data: body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const list: any[] = Array.isArray(response?.data) ? response.data : [];
      rows.push(...list);
      if (response?.meta?.total !== undefined) total = Number(response.meta.total);

      const hasNext = Boolean(response?.links?.next);
      if (!hasNext || !list.length) break;
    }

    if (total !== null && Number.isFinite(total) && rows.length < total) {
      throw new Error(`UPG ${dateFrom}..${dateTo}: отримано ${rows.length} з ${total} транзакцій`);
    }
    return rows;
  }

  /** Запит із bearer-токеном; на 401 — один повторний логін. Повертає тіло відповіді. */
  private async authorized<T>(request: { method: 'GET' | 'POST'; url: string; params?: any; data?: any; headers?: any }): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const token = await this.ensureToken();
      try {
        const response = await this.client.request<T>({
          ...request,
          headers: { ...request.headers, Authorization: `Bearer ${token}` },
        });
        return response.data;
      } catch (error: any) {
        if (error?.response?.status === 401 && attempt === 1) {
          this.token = null;
          continue;
        }
        throw error;
      }
    }
  }

  private ensureToken(): Promise<string> {
    if (this.token) return Promise.resolve(this.token);
    this.loginInFlight ??= this.doLogin().finally(() => {
      this.loginInFlight = null;
    });
    return this.loginInFlight;
  }

  private async doLogin(): Promise<string> {
    const body = new URLSearchParams({ login: this.login, password: this.password }).toString();
    try {
      const response = await this.client.post('/login', body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const token = response.data?.token;
      if (!token || typeof token !== 'string') throw new Error('у відповіді /login немає token');
      this.token = token;
      return token;
    } catch (error: any) {
      // Пароль у повідомлення не потрапляє: беремо лише статус і текст помилки вендора.
      const status = error?.response?.status;
      throw new Error(`UPG /login: ${status ? `HTTP ${status}` : (error?.message ?? error)}`);
    }
  }
}
