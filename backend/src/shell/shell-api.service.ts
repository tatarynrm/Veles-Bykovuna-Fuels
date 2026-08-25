import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { CurrencyService } from '../common/currency.service';

export interface ShellAccount {
  AccountId: number;
  AccountNumber: string;
  AccountFullName: string;
  AccountShortName: string;
  ColCoCountryCode: string;
  CurrencyCode: string;
  CurrencySymbol: string;
  GrossAmount?: number; // баланс, НОРМАЛІЗОВАНИЙ у грн (для агрегації в дашборді)
  SourceGrossAmount?: number; // оригінал у валюті рахунку (CurrencyCode)
  ExchangeRate?: number;
  Status?: string;
}

export interface ShellCard {
  CardId: string;
  CardPAN: string;
  CardStatus: string;
  DriverName: string;
  VehicleRegistration: string;
  ExpiryDate: string;
  CardGroup: string;
  ProductRestriction: string;
  PayerNumber: string;
}

export interface ShellTransaction {
  TransactionId: string;
  SalesItemId: string;
  TransactionDate: string;
  PostingDate: string;
  AccountNumber: string;
  AccountName: string;
  CardPAN: string;
  DriverName: string;
  VehicleRegistration: string;
  SiteCode: string;
  SiteName: string;
  SiteCountry: string;
  ProductCode: string;
  ProductName: string;
  Quantity: number;
  // Суми НОРМАЛІЗОВАНІ у гривню (базова валюта звіту) за курсом НБУ. Оригінал — у полях Source*.
  UnitPrice: number;
  NetAmount: number;
  GrossAmount: number;
  CurrencyCode: string; // валюта інвойсу Shell (джерело сум, напр. 'EUR')
  SourceUnitPrice: number; // ціна за одиницю у валюті інвойсу
  SourceNetAmount: number;
  SourceGrossAmount: number;
  ExchangeRate: number; // курс, за яким конвертовано у UAH (UAH за 1 од. CurrencyCode)
  // Класифікація типу операції (див. parseShellTransactionType).
  Type: string; // 'SalesItem' | 'FeeItem' — верхній рівень із Shell
  ProductGroupId: number | null; // категорія Shell Product Group
  ProductGroupName: string; // англ. назва категорії від вендора (джерело істини)
  FuelProduct: boolean;
  IsFee: boolean;
  IsReturn: boolean; // повернення/сторно (відʼємна сума)
  TransactionTypeCode: string; // стабільний код: SHELL_G<id> / SHELL_FEE / SHELL_PURCHASE
  TransactionTypeDescription: string; // людяний опис українською
}

/**
 * Shell повертає багато типів операцій, а не лише «заправку»: пальне, AdBlue, збори за
 * картку, сервісні збори, грошові коригування тощо. Автентичне джерело категорії —
 * `ProductGroupName` (англ.) + `ProductGroupId` у відповіді. Документація (липень-2020)
 * перелічує групи 1..21, але реальні дані містять і 22..24 (Card related fees / Monetary
 * Adjustment / Service Fee), тож НЕ можна покладатися лише на числовий id. Ми:
 *   • беремо `ProductGroupName` від вендора як основу,
 *   • перекладаємо відомі назви українською (нижче), інакше показуємо назву як є,
 *   • даємо стабільний код `SHELL_G<id>` (або SHELL_FEE/SHELL_PURCHASE), щоб КОЖЕН тип
 *     став окремим пунктом фільтра — аналог OKKO parseTransactionType.
 * Переклад — не вигадування даних, а локалізація фіксованого довідника категорій.
 */
const SHELL_GROUP_NAME_UA: Record<string, string> = {
  'parent product group': 'Батьківська група товарів',
  'all fuels': 'Пальне (усі види)',
  'motor gasoline': 'Бензин',
  '2 stroke': 'Двотактне пальне',
  autogas: 'Автогаз (LPG)',
  cng: 'Стиснений газ (CNG)',
  'automotive gas oil': 'Дизельне пальне',
  'alternative fuel': 'Альтернативне пальне (AdBlue)',
  'industrial/domestic gas oil': 'Пічне/промислове пальне',
  'non-fuel': 'Непаливні товари',
  lubricants: 'Мастила',
  'non food': 'Непродовольчі товари',
  food: 'Продукти харчування',
  'non-alcoholic beverages': 'Безалкогольні напої',
  'alcoholic beverages': 'Алкогольні напої',
  tobacco: 'Тютюнові вироби',
  'controlled road services': 'Контрольовані дорожні послуги',
  'car wash': 'Мийка авто',
  parking: 'Паркування',
  'breakdown services': 'Послуги евакуації',
  fees: 'Збори та комісії',
  'card related fees': 'Комісії за картку',
  'monetary adjustment': 'Грошове коригування',
  'service fee': 'Сервісний збір',
  'toll charges': 'Дорожні збори (толлінг)',
  'essential road services': 'Основні дорожні послуги',
  'road services': 'Дорожні послуги',
  'tolls': 'Дорожні збори (толлінг)',
  'tunnel/bridges': 'Тунелі/мости',
  'motorway toll': 'Плата за автомагістраль',
  'ferries': 'Поромні переправи',
  'vignette': 'Віньєтка',
  'tmf charges': 'Комісія TMF',
  'adblue': 'AdBlue',
};

export function parseShellTransactionType(raw: {
  Type?: string;
  ProductGroupId?: number | null;
  ProductGroupName?: string;
  ProductName?: string;
  FuelProduct?: boolean;
  CreditDebitCode?: string;
  RefundFlag?: string;
  GrossAmount?: number;
}): {
  code: string;
  description: string;
  isFee: boolean;
  isReturn: boolean;
} {
  const groupId = raw.ProductGroupId ?? null;
  const groupName = (raw.ProductGroupName || '').trim();

  // Повернення/сторно: кредитовий бік (C), явний прапорець рефанду або відʼємна сума.
  const isReturn =
    (raw.CreditDebitCode || '').trim().toUpperCase() === 'C' ||
    /^(y|yes|true|1)$/i.test((raw.RefundFlag || '').trim()) ||
    (raw.GrossAmount ?? 0) < 0;

  // Збір/комісія: пальним не є і назва групи говорить про збір/коригування.
  const isFee =
    !raw.FuelProduct && /\b(fee|fees|charge|charges|adjustment|rental)\b/i.test(groupName);

  // Стабільний код для фільтра: за id (кожна група — окремий пункт), або узагальнений.
  const code = groupId != null ? `SHELL_G${groupId}` : isFee ? 'SHELL_FEE' : 'SHELL_PURCHASE';

  if (raw.FuelProduct) {
    // Пальне лишаємо в «пальному»: категорію показуємо українською.
    const uaName = SHELL_GROUP_NAME_UA[groupName.toLowerCase()] || groupName || raw.ProductName || 'Пальне';
    const prefix = isReturn ? 'Повернення · ' : '';
    return { code, description: `Shell · ${prefix}${uaName}`, isFee, isReturn };
  }

  // Операції (не пальне): назву операції лишаємо АНГЛІЙСЬКОЮ — як її подає Shell,
  // без «українізації», щоб збігалося з первинними документами вендора.
  const enName = groupName || raw.ProductName || 'Operation';
  const prefix = isReturn ? 'Refund · ' : '';
  return { code, description: `Shell · ${prefix}${enName}`, isFee, isReturn };
}

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
  private txInflight = new Map<string, Promise<ShellTransaction[]>>();
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
   * Shell returns dates as compact `YYYYMMDD`. Left raw, those strings flow into
   * the analytics date grouping and render as `20260608` next to ISO keys from
   * OKKO, producing a broken, unsortable x-axis. Normalise at the adapter edge.
   */
  private toIsoDate(value?: string): string {
    if (!value) return new Date().toISOString();

    const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(value.trim());
    if (compact) {
      const [, y, m, d] = compact;
      return new Date(`${y}-${m}-${d}T00:00:00.000Z`).toISOString();
    }

    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  /**
   * Нормалізація одного «сирого» запису Shell у нашу форму ShellTransaction.
   * `rateToUah` — курс валюти інвойсу до гривні; суми зберігаємо і в оригіналі (Source*),
   * і сконвертовані у UAH (щоб дашборд коректно підсумовував їх разом з OKKO).
   */
  private mapTransaction(t: any, rateToUah = 1): ShellTransaction {
    const productGroupId =
      t.ProductGroupId !== undefined && t.ProductGroupId !== null ? Number(t.ProductGroupId) : null;
    const srcGross = Number(
      t.InvoiceGrossAmount ?? t.TransactionGrossAmount ?? t.GrossAmount ?? t.InvoiceAmount ?? t.NetAmount ?? 0,
    );
    const srcNet = Number(t.InvoiceNetAmount ?? t.TransactionNetAmount ?? t.NetAmount ?? 0);
    const srcUnit = Number(
      t.UnitPriceInInvoiceCurrency ?? t.UnitPriceInTransactionCurrency ?? t.UnitPrice ?? t.UnitDiscountedPrice ?? 0,
    );
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const grossAmount = round2(srcGross * rateToUah);
    const productName = t.ProductName ?? t.ProductDescription ?? '';
    const productGroupName = t.ProductGroupName ?? '';
    const typeInfo = parseShellTransactionType({
      Type: t.Type,
      ProductGroupId: productGroupId,
      ProductGroupName: productGroupName,
      ProductName: productName,
      FuelProduct: t.FuelProduct,
      CreditDebitCode: t.CreditDebitCode,
      RefundFlag: t.RefundFlag,
      GrossAmount: grossAmount,
    });

    return {
      TransactionId: String(t.TransactionId ?? t.SalesItemId ?? ''),
      SalesItemId: String(t.SalesItemId ?? ''),
      TransactionDate: this.toIsoDate(t.TransactionDate || t.InvoiceDate),
      PostingDate: this.toIsoDate(t.PostingDate),
      AccountNumber: t.AccountNumber ?? '',
      AccountName: t.AccountName ?? t.AccountShortName ?? '',
      CardPAN: t.CardPAN ?? '',
      DriverName: t.DriverName ?? '',
      VehicleRegistration: t.VehicleRegistration ?? t.VRN ?? '',
      SiteCode: String(t.SiteCode ?? t.SiteGroupId ?? ''),
      SiteName: t.SiteName ?? '',
      SiteCountry: t.SiteCountry ?? t.PurchasedInCountry ?? t.PurchasedInCountryCode ?? t.ColCoCountryCode ?? '',
      ProductCode: String(t.ProductCode ?? ''),
      ProductName: productName,
      Quantity: Number(t.Quantity ?? t.Volume ?? 0),
      // Суми у гривні (для агрегації в дашборді)…
      UnitPrice: round2(srcUnit * rateToUah),
      NetAmount: round2(srcNet * rateToUah),
      GrossAmount: grossAmount,
      // …та оригінал у валюті інвойсу Shell для прозорості.
      CurrencyCode: t.InvoiceCurrencyCode ?? t.TransactionCurrencyCode ?? t.CurrencyCode ?? '',
      SourceUnitPrice: srcUnit,
      SourceNetAmount: srcNet,
      SourceGrossAmount: srcGross,
      ExchangeRate: rateToUah,
      Type: t.Type ?? '',
      ProductGroupId: productGroupId,
      ProductGroupName: productGroupName,
      FuelProduct: Boolean(t.FuelProduct),
      IsFee: typeInfo.isFee,
      IsReturn: typeInfo.isReturn,
      TransactionTypeCode: typeInfo.code,
      TransactionTypeDescription: typeInfo.description,
    };
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
    const inflight = this.txInflight.get(key);
    if (inflight) return inflight;

    const promise = (async () => {
      try {
        this.logger.log(`Live Shell API: Priced Transactions ${fromYmd}-${toYmd}`);
        const rows = await this.fetchAllPages(fromYmd, toYmd);
        console.log(rows, 'rows tranbsactions');
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
          return this.mapTransaction(r, rates[cc] ?? 1);
        });
        this.txCache.set(key, { at: Date.now(), data });
        return data;
      } catch (error) {
        this.logger.error(`Shell Transactions API error: ${error.message}`);
        // Не отруюємо кеш порожнечею: якщо є попередній успішний результат — віддамо його.
        return this.txCache.get(key)?.data ?? [];
      } finally {
        this.txInflight.delete(key);
      }
    })();

    this.txInflight.set(key, promise);
    return promise;
  }

  async getCards(): Promise<ShellCard[]> {
    try {
      this.logger.log('Live Shell API: Extracting Cards from Transactions');
      const txs = await this.getPricedTransactions();
      if (txs && txs.length > 0) {
        const cardMap = new Map<string, ShellCard>();
        for (const t of txs) {
          if (t.CardPAN && !cardMap.has(t.CardPAN)) {
            cardMap.set(t.CardPAN, {
              CardId: `SH-${t.CardPAN}`,
              CardPAN: t.CardPAN,
              // Немає ендпоінта карток — картку виводимо з транзакцій; наявність
              // транзакції означає, що картка діюча. Термін дії/група невідомі → порожньо.
              CardStatus: 'ACTIVE',
              DriverName: t.DriverName || '',
              VehicleRegistration: t.VehicleRegistration || '',
              ExpiryDate: '',
              CardGroup: '',
              ProductRestriction: t.ProductName || '',
              PayerNumber: this.payerNumber
            });
          }
        }
        return Array.from(cardMap.values());
      }
      return [];
    } catch (error) {
      this.logger.error(`Shell Cards error: ${error.message}`);
      return [];
    }
  }

  async getShellMerchants() {
    try {
      const txs = await this.getPricedTransactions();
      if (txs && txs.length > 0) {
        const siteMap = new Map<string, any>();
        for (const t of txs) {
          if (t.SiteCode && !siteMap.has(t.SiteCode)) {
            // АЗС виводиться з транзакцій — доступні лише код, назва та країна сайту.
            // Місто/адреса/послуги у транзакціях відсутні → лишаємо порожніми.
            siteMap.set(t.SiteCode, {
              merchant_id: `SH-AZS-${t.SiteCode}`,
              merchant_sap_id: `SH-${t.SiteCode}`,
              merchant_name: t.SiteName || `Shell ${t.SiteCode}`,
              merchant_address: '',
              city: '',
              region: t.SiteCountry || '',
              services: [],
              status: 'OPEN'
            });
          }
        }
        return Array.from(siteMap.values());
      }
      return [];
    } catch (error) {
      return [];
    }
  }
}
