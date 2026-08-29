import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { CurrencyService } from '../common/currency.service';
import { InflightMap } from '../common/swr-cache';
import {
  ShellAccount,
  ShellCard,
  ShellTransaction,
  mapShellTransaction,
  deriveShellCards,
  deriveShellMerchants,
} from './shell.mapper';

// Normalized shapes, the category dictionary, date/type parsing and the row/card/
// merchant mappers live in ./shell.mapper (unit-tested there). Re-exported so
// existing `ShellApiService` consumers keep resolving these from this module.
export type { ShellAccount, ShellCard, ShellTransaction } from './shell.mapper';
export { parseShellTransactionType } from './shell.mapper';

@Injectable()
export class ShellApiService {
  private readonly logger = new Logger(ShellApiService.name);
  private client: AxiosInstance;
  private basicAuth: string;
  private apiKey: string;
  private targetUrl: string;
  private payerNumber: string;
  private colCoCode: string;

  constructor(
    private configService: ConfigService,
    private readonly currencyService: CurrencyService,
  ) {
    this.apiKey = this.configService.get<string>('SHELL_API_KEY') ?? '';
    const secret = this.configService.get<string>('SHELL_SECRET') ?? '';

    // Shell авторизує кожен запит заголовком `Authorization: Basic base64(apiKey:secret)`
    // (див. common/Shell-Api-Documentation, «Quick Start Guide»). Дозволяємо або передати
    // готовий заголовок через SHELL_BASIC_AUTH, або зібрати його з ключа та секрета.
    const rawBasic = this.configService.get<string>('SHELL_BASIC_AUTH') ?? '';
    if (rawBasic) {
      this.basicAuth = rawBasic;
    } else if (this.apiKey && secret) {
      const encoded = Buffer.from(`${this.apiKey}:${secret}`).toString('base64');
      this.basicAuth = `Basic ${encoded}`;
    } else {
      this.basicAuth = '';
    }

    this.targetUrl = this.configService.get<string>('SHELL_BASE_URL') ?? 'https://api.shell.com';
    this.payerNumber = this.configService.get<string>('SHELL_PAYER_NUMBER') ?? '';
    this.colCoCode = this.configService.get<string>('SHELL_COLCO_CODE') ?? '';

    if (!this.basicAuth || !this.apiKey) {
      this.logger.warn('SHELL_API_KEY / SHELL_SECRET (або SHELL_BASIC_AUTH) не налаштовано — Shell API вимкнено');
    }
    if (!this.payerNumber || !this.colCoCode) {
      this.logger.warn('SHELL_PAYER_NUMBER / SHELL_COLCO_CODE не налаштовано — запити до Shell повернуть порожньо');
    }

    this.client = axios.create({
      baseURL: this.targetUrl,
      // Продакшн Shell повільний: одна сторінка на 1000 рядків повертається ~18 с,
      // тож 12 с таймаут її «зрізав» і перетворював реальні дані на порожній масив.
      timeout: 30000,
      headers: {
        'Authorization': this.basicAuth,
        'apikey': this.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  // Короткий кеш агрегованих транзакцій за діапазоном дат + дедуп паралельних запитів.
  // analytics.service викликає getPricedTransactions кілька разів за один рендер
  // (summary/breakdown/trends), а кожен виклик — це кілька повільних сторінок Shell.
  private txCache = new Map<string, { at: number; data: ShellTransaction[] }>();
  private readonly txInflight = new InflightMap<ShellTransaction[]>();
  private static readonly TX_TTL_MS = 60_000;
  private static readonly PAGE_SIZE = 1000;
  private static readonly MAX_PAGES = 30; // запобіжник: до 30 000 рядків за діапазон

  async getLoggedInUser(): Promise<any> {
    try {
      this.logger.log('Live Shell API: LoggedInUser');
      const response = await this.client.post('/fleetmanagement/v1/user/LoggedInUser', {
        IncludePayerGroup: true,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Shell LoggedInUser API error: ${error.message}`);
      return null;
    }
  }

  async getCustomerAccounts(): Promise<ShellAccount[]> {
    try {
      this.logger.log('Live Shell API: Customer Accounts');
      const response = await this.client.post('/fleetmanagement/v1/customer/accounts', {
        PayerNumber: this.payerNumber,
        ColCoCode: this.colCoCode,
        Status: 'ACTIVE',
        IncludeCardSummary: true,
      });
      if (response.data && response.data.Accounts) {
        const accounts: ShellAccount[] = response.data.Accounts;
        // Баланс рахунку — у валюті рахунку (EUR тощо). Нормалізуємо у грн, як і суми транзакцій.
        return Promise.all(
          accounts.map(async (a) => {
            const src = Number(a.GrossAmount ?? 0);
            if (!src) return a;
            const rate = await this.currencyService.getRateToUah(a.CurrencyCode);
            return {
              ...a,
              GrossAmount: Math.round(src * rate * 100) / 100,
              SourceGrossAmount: src,
              ExchangeRate: rate,
            };
          }),
        );
      }
      return [];
    } catch (error) {
      this.logger.error(`Shell Accounts API error: ${error.message}`);
      return [];
    }
  }

  /**
   * Тягне ВСІ сторінки транзакцій за діапазоном. Shell повільний і не віддає «-1»
   * миттєво, тож ідемо посторінково (PageSize 1000) через параметр `CurrentPage`,
   * поки не вичерпаємо `TotalPages` (із запобіжником MAX_PAGES).
   */
  private async fetchAllPages(fromYmd: string, toYmd: string): Promise<any[]> {
    const rows: any[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const response = await this.client.post('/fleetmanagement/v1/transaction/pricedtransactions', {
        ColCoCode: this.colCoCode,
        PayerNumber: this.payerNumber,
        InvoiceStatus: 'A',
        FromDate: fromYmd,
        ToDate: toYmd,
        IncludeFees: true,
        PageSize: String(ShellApiService.PAGE_SIZE),
        CurrentPage: String(page),
      });

      const data = response.data;
      if (data?.Error?.Code && data.Error.Code !== '0000') {
        throw new Error(`Shell API: ${data.Error.Description || data.Error.Code}`);
      }

      const pageRows: any[] = data?.Transactions ?? [];
      rows.push(...pageRows);

      totalPages = Number(data?.TotalPages ?? 1) || 1;
      if (pageRows.length < ShellApiService.PAGE_SIZE) break; // остання (неповна) сторінка
      page += 1;
    } while (page <= totalPages && page <= ShellApiService.MAX_PAGES);

    if (totalPages > ShellApiService.MAX_PAGES) {
      this.logger.warn(
        `Shell: діапазон ${fromYmd}-${toYmd} має ${totalPages} сторінок, завантажено перші ${ShellApiService.MAX_PAGES}`,
      );
    }
    return rows;
  }

  async getPricedTransactions(dateFrom?: string, dateTo?: string): Promise<ShellTransaction[]> {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 90 * 86400000); // 90 днів за замовчуванням
    const formatYmd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

    const fromYmd = dateFrom ? dateFrom.replace(/-/g, '') : formatYmd(defaultFrom);
    const toYmd = dateTo ? dateTo.replace(/-/g, '') : formatYmd(now);
    const key = `${fromYmd}|${toYmd}`;

    // Свіжий кеш — віддаємо одразу (analytics робить кілька викликів за рендер).
    const cached = this.txCache.get(key);
    if (cached && now.getTime() - cached.at < ShellApiService.TX_TTL_MS) {
      return cached.data;
    }
    // Дедуп: якщо ідентичний запит уже в польоті — чекаємо його, а не дублюємо.
    return this.txInflight.run(key, async () => {
      try {
        this.logger.log(`Live Shell API: Priced Transactions ${fromYmd}-${toYmd}`);
        const rows = await this.fetchAllPages(fromYmd, toYmd);
        // Курси валют інвойсу → UAH (набір валют невеликий, кеш робить це дешевим).
        const currencies = rows.map(
          (r) => r.InvoiceCurrencyCode ?? r.TransactionCurrencyCode ?? r.CurrencyCode ?? '',
        );
        const rates = await this.currencyService.getRatesToUah(currencies);
        const data = rows.map((r) => {
          const cc = (r.InvoiceCurrencyCode ?? r.TransactionCurrencyCode ?? r.CurrencyCode ?? '')
            .toString()
            .trim()
            .toUpperCase();
          return mapShellTransaction(r, rates[cc] ?? 1);
        });
        this.txCache.set(key, { at: Date.now(), data });
        return data;
      } catch (error) {
        this.logger.error(`Shell Transactions API error: ${error.message}`);
        // Не отруюємо кеш порожнечею: якщо є попередній успішний результат — віддамо його.
        return this.txCache.get(key)?.data ?? [];
      }
    });
  }

  async getCards(): Promise<ShellCard[]> {
    try {
      this.logger.log('Live Shell API: Extracting Cards from Transactions');
      const txs = await this.getPricedTransactions();
      return deriveShellCards(txs ?? [], this.payerNumber);
    } catch (error) {
      this.logger.error(`Shell Cards error: ${error.message}`);
      return [];
    }
  }

  async getShellMerchants() {
    try {
      const txs = await this.getPricedTransactions();
      return deriveShellMerchants(txs ?? []);
    } catch (error) {
      return [];
    }
  }
}
