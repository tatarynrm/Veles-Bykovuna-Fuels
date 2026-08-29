/**
 * Shell adapter — pure mapping, dictionaries and derivations. No axios/Nest, so
 * the PascalCase→snake_case normalization, the `YYYYMMDD`→ISO date fix and the
 * transaction-type classification are all unit-testable (see shell.mapper.spec.ts).
 *
 * Amounts are kept twice: the original in the invoice currency (`Source*`) and a
 * copy converted to UAH (so the dashboard can sum Shell beside OKKO). The currency
 * rate is passed in — currency lookup stays in the service (it is I/O).
 */

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

/**
 * Shell returns dates as compact `YYYYMMDD`. Left raw, those strings flow into
 * the analytics date grouping and render as `20260608` next to ISO keys from
 * OKKO, producing a broken, unsortable x-axis. Normalise at the adapter edge.
 */
export function toIsoDate(value?: string): string {
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
export function mapShellTransaction(t: any, rateToUah = 1): ShellTransaction {
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
    TransactionDate: toIsoDate(t.TransactionDate || t.InvoiceDate),
    PostingDate: toIsoDate(t.PostingDate),
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
 * There is no Shell cards endpoint — cards are derived by de-duplicating the
 * transaction list by `CardPAN`. A transaction existing means the card is live;
 * expiry/group are unknown so they are left blank.
 */
export function deriveShellCards(txs: ShellTransaction[], payerNumber: string): ShellCard[] {
  const cardMap = new Map<string, ShellCard>();
  for (const t of txs) {
    if (t.CardPAN && !cardMap.has(t.CardPAN)) {
      cardMap.set(t.CardPAN, {
        CardId: `SH-${t.CardPAN}`,
        CardPAN: t.CardPAN,
        CardStatus: 'ACTIVE',
        DriverName: t.DriverName || '',
        VehicleRegistration: t.VehicleRegistration || '',
        ExpiryDate: '',
        CardGroup: '',
        ProductRestriction: t.ProductName || '',
        PayerNumber: payerNumber,
      });
    }
  }
  return Array.from(cardMap.values());
}

/**
 * Likewise merchants are derived by de-duplicating transactions by `SiteCode`.
 * Only site code, name and country are available; city/address/services are absent.
 */
export function deriveShellMerchants(txs: ShellTransaction[]): Array<Record<string, unknown>> {
  const siteMap = new Map<string, Record<string, unknown>>();
  for (const t of txs) {
    if (t.SiteCode && !siteMap.has(t.SiteCode)) {
      siteMap.set(t.SiteCode, {
        merchant_id: `SH-AZS-${t.SiteCode}`,
        merchant_sap_id: `SH-${t.SiteCode}`,
        merchant_name: t.SiteName || `Shell ${t.SiteCode}`,
        merchant_address: '',
        city: '',
        region: t.SiteCountry || '',
        services: [],
        status: 'OPEN',
      });
    }
  }
  return Array.from(siteMap.values());
}
