import {
  clipText,
  mapOkkoToTruckPay,
  mapShellToTruckPay,
  okkoDateTime,
  shellDateTime,
  shouldSyncOkko,
  shouldSyncShell,
  toProcedureJson,
} from './fuel-sync.mapper';
import { addDays, incrementalFrom, nextEvenHourRun, splitPeriod } from './fuel-sync.utils';

/** Реальна форма рядка OKKO /v2/transactions (номер картки вигаданий). */
const okkoPurchase = {
  trans_id: '270247608',
  amnt_trans: 331600,
  card_num: '7825390000000001',
  trans_date: '2026-08-27T16:10:47.000',
  contract_id: '0010029571',
  acurr_acct: 'UAH',
  acurr_trans: 'UAH',
  org_device: 'T0C2802',
  trans_type: 774,
  reversal: false,
  amnt_acct: 315600,
  amount_discount: 16000,
  azs_name: 'АЗС 028 Франківськ ОККО-Драйв',
  ext_azs: '40563200',
  addr_name: 'Чернівецька, Чернівці, Калинівська, 1-А',
  available_balance: 18773389,
  processed_in_bo: 1,
  volume: 40000,
  price: 8290,
  product_id: '9009',
  product_desc: 'Бензин А-95',
  basket_of_goods: false,
  person_first_name: 'Default',
  person_last_name: 'SKODA',
  price_discount: 400,
  rrn: '000270247608',
  approval_code: '247608',
};

/** Поповнення договору: без картки, АЗС і продукту — ключі відсутні взагалі. */
const okkoTopUp = {
  trans_id: '154670758',
  amnt_trans: 20000000,
  trans_date: '2022-04-12T00:00:00.000',
  trans_type: 687,
  reversal: false,
  amnt_acct: 20000000,
  amount_discount: 0,
  volume: 0,
  price: 0,
  price_discount: 0,
};

/** Реальна форма рядка Shell pricedtransactions — дизель (номер картки вигаданий). */
const shellDiesel = {
  Type: 'SalesItem',
  TransactionId: '48F16F61C260827D626',
  TransactionLine: '1',
  TrnIdentifier: '374611686018933871270',
  TransactionDate: '20260827',
  TransactionTime: '08:59:36',
  InvoiceDate: '20260831 00:00:00',
  InvoiceNumber: '1500799260',
  IsInvoiced: true,
  CardPAN: '7077420000000000001',
  VehicleRegistration: 'CE5465BM',
  DriverName: '',
  OdometerInput: 0,
  SiteCode: '5012',
  SiteName: '5012 SHELL RUSSE DANUBE BRIDGE',
  SiteCountry: 'Bulgaria',
  PurchasedInCountryCode: 'BG',
  ProductCode: '30',
  ProductName: 'Diesel AGO',
  ProductGroupId: 7,
  ProductGroupName: 'Automotive Gas Oil',
  Quantity: 101.03,
  CustomerRetailPriceUnitGross: 1.88,
  CustomerRetailValueTotalGross: 189.94,
  InvoiceNetAmount: 153.57,
  InvoiceTax: 30.71,
  InvoiceGrossAmount: 184.28,
  InvoiceCurrencyCode: 'EUR',
  TransactionGrossAmount: 184.28,
  TransactionCurrencyCode: 'EUR',
  ReceiptNumber: '146558',
  CreditDebitCode: 'D',
  RefundFlag: 'N',
};

/** Комісія Shell: у PLN за транзакцією, в EUR в інвойсі; Quantity — база, не літри. */
const shellFee = {
  Type: 'FeeItem',
  TransactionId: '',
  TrnIdentifier: '3748235662',
  TransactionDate: '20260817',
  TransactionTime: '00:00:00',
  InvoiceDate: '20260817 00:00:00',
  InvoiceNumber: '3002079218',
  IsInvoiced: true,
  CardPAN: '7077420000000000002',
  VehicleRegistration: 'CE4279CA',
  DriverName: '',
  SiteCode: '',
  SiteName: '',
  PurchasedInCountryCode: '',
  ProductCode: '6',
  ProductName: 'Transaction Fee BG731 14',
  ProductGroupId: 22,
  ProductGroupName: 'Card related fees',
  Quantity: 354.34,
  CustomerRetailPriceUnitGross: null,
  CustomerRetailValueTotalGross: null,
  InvoiceNetAmount: 3.29,
  InvoiceTax: 0,
  InvoiceGrossAmount: 3.29,
  InvoiceCurrencyCode: 'EUR',
  TransactionGrossAmount: 14.17,
  TransactionCurrencyCode: 'PLN',
  ReceiptNumber: '48235662',
  CreditDebitCode: 'D',
  RefundFlag: '',
};

describe('OKKO → TZ_TRANS', () => {
  it('converts kopiykas and millilitres, keeps charged vs full vs discount apart', () => {
    const row = mapOkkoToTruckPay(okkoPurchase);
    expect(row).toMatchObject({
      api_brend: 'OKKO',
      api_transaction_id: '270247608',
      api_dat: '2026-08-27T16:10:47',
      api_cc: '7825390000000001',
      api_kil: 40,
      api_cinafull: 82.9,
      api_cinazn: 4,
      api_cina: 78.9,
      api_sumafull: 3316,
      api_sumazn: 160,
      api_suma: 3156,
      api_przn: 4.83,
      api_minus: 0,
      api_valut: 'UAH',
      api_kraina: 'UA',
      api_station: '40563200',
      api_adresa: 'АЗС 028 Франківськ ОККО-Драйв, Чернівецька, Чернівці, Калинівська, 1-А',
      api_oper: '774 Заправка/покупка з карткою',
      api_pal: '9009 Бензин А-95',
      api_tz: 'SKODA',
      api_os: null,
      api_rahnum: null,
    });
  });

  it('marks refunds with api_minus while keeping the amount positive', () => {
    const row = mapOkkoToTruckPay({ ...okkoPurchase, trans_type: 775, amnt_trans: 377, amnt_acct: 401 });
    expect(row.api_minus).toBe(1);
    expect(row.api_suma).toBe(4.01);
    expect(row.api_oper).toBe('775 Часткове повернення');
  });

  it('skips contract operations and rows without a card', () => {
    expect(shouldSyncOkko(okkoPurchase)).toBe(true);
    expect(shouldSyncOkko(okkoTopUp)).toBe(false);
    expect(shouldSyncOkko({ ...okkoPurchase, trans_type: 688 })).toBe(false);
    expect(shouldSyncOkko({ ...okkoPurchase, card_num: undefined })).toBe(false);
    expect(shouldSyncOkko({ ...okkoPurchase, trans_type: 737 })).toBe(true);
  });

  it('normalises the date and drops the milliseconds', () => {
    expect(okkoDateTime('2022-04-21T21:03:51.000')).toBe('2022-04-21T21:03:51');
    expect(okkoDateTime('')).toBeNull();
  });
});

describe('Shell → TZ_TRANS', () => {
  it('uses invoice currency, gross amounts and the unique TrnIdentifier', () => {
    const row = mapShellToTruckPay(shellDiesel);
    expect(row).toMatchObject({
      api_brend: 'SHELL',
      api_transaction_id: '374611686018933871270',
      api_dat: '2026-08-27T08:59:36',
      api_cc: '7077420000000000001',
      api_kil: 101.03,
      api_valut: 'EUR',
      api_suma: 184.28,
      api_sumafull: 189.94,
      api_sumazn: 5.66,
      api_pdv: 30.71,
      api_cinafull: 1.88,
      api_cina: 1.824,
      api_cinazn: 0.056,
      api_przn: 2.98,
      api_minus: 0,
      api_kraina: 'BG',
      api_station: '5012',
      api_adresa: '5012 SHELL RUSSE DANUBE BRIDGE, Bulgaria',
      api_chek: '146558',
      api_oper: '7 Automotive Gas Oil',
      api_pal: '30 Diesel AGO',
      api_tz: 'CE5465BM',
      api_os: null,
      api_km: null,
      api_rahnum: '1500799260',
      api_rahdat: '2026-08-31T00:00:00',
    });
  });

  it('writes fees without quantity or pump price, amount as invoiced in EUR', () => {
    const row = mapShellToTruckPay(shellFee);
    expect(row).toMatchObject({
      api_kil: null,
      api_cina: null,
      api_cinafull: null,
      api_suma: 3.29,
      api_sumafull: 3.29,
      api_sumazn: 0,
      api_valut: 'EUR',
      api_station: null,
      api_kraina: null,
      api_oper: '22 Card related fees',
      api_pal: '6 Transaction Fee BG731 14',
    });
  });

  it('treats credit lines as minus with a positive amount', () => {
    const row = mapShellToTruckPay({
      ...shellFee,
      CreditDebitCode: 'C',
      InvoiceGrossAmount: -70,
      InvoiceNetAmount: -70,
    });
    expect(row.api_minus).toBe(1);
    expect(row.api_suma).toBe(70);
  });

  it('keeps a real driver name only when it is not the plate number', () => {
    expect(mapShellToTruckPay({ ...shellDiesel, DriverName: 'CE5465BM' }).api_os).toBeNull();
    expect(mapShellToTruckPay({ ...shellDiesel, DriverName: 'IVAN PETRENKO' }).api_os).toBe('IVAN PETRENKO');
  });

  it('syncs only rows that are already invoiced', () => {
    expect(shouldSyncShell(shellDiesel)).toBe(true);
    expect(shouldSyncShell(shellFee)).toBe(true);
    expect(shouldSyncShell({ ...shellDiesel, IsInvoiced: false, InvoiceNumber: '' })).toBe(false);
  });

  it('parses Shell date formats', () => {
    expect(shellDateTime('20260827', '08:59:36')).toBe('2026-08-27T08:59:36');
    expect(shellDateTime('20260831 00:00:00')).toBe('2026-08-31T00:00:00');
    expect(shellDateTime('20260819 000530')).toBe('2026-08-19T00:05:30');
    expect(shellDateTime('20260819')).toBe('2026-08-19T00:00:00');
    expect(shellDateTime(null)).toBeNull();
  });
});

describe('procedure payload', () => {
  it('omits null fields and keeps lowercase api_* keys', () => {
    const json = JSON.parse(toProcedureJson(mapOkkoToTruckPay(okkoPurchase)));
    expect(json).not.toHaveProperty('api_pdv');
    expect(json).not.toHaveProperty('api_rahdat');
    expect(json.api_suma).toBe(3156);
    expect(Object.keys(json).every((k) => /^api_[a-z_]+$/.test(k))).toBe(true);
  });

  it('clips text by UTF-8 bytes without cutting a character', () => {
    expect(clipText('Бензин', 5)).toBe('Бе');
    expect(clipText('  ', 10)).toBeNull();
    expect(clipText('ABC', 10)).toBe('ABC');
  });
});

describe('sync schedule helpers', () => {
  it('splits a period into inclusive, non-overlapping windows', () => {
    expect(splitPeriod('2025-01-01', '2025-03-05', 31)).toEqual([
      { from: '2025-01-01', to: '2025-01-31' },
      { from: '2025-02-01', to: '2025-03-03' },
      { from: '2025-03-04', to: '2025-03-05' },
    ]);
    expect(splitPeriod('2026-09-15', '2026-09-15', 30)).toEqual([{ from: '2026-09-15', to: '2026-09-15' }]);
  });

  it('starts incremental passes from the last stored date minus the lookback, never before start', () => {
    expect(incrementalFrom(null, '2025-01-01', 40)).toBe('2025-01-01');
    expect(incrementalFrom('2026-09-10', '2025-01-01', 40)).toBe(addDays('2026-09-10', -40));
    expect(incrementalFrom('2025-01-20', '2025-01-01', 40)).toBe('2025-01-01');
  });

  it('finds the next even-hour cron run', () => {
    const at = (h: number, m: number) => new Date(2026, 8, 15, h, m, 30);
    const hm = (d: Date) => `${d.getHours()}:${d.getMinutes()}`;
    expect(hm(nextEvenHourRun(at(13, 20), 0))).toBe('14:0');
    expect(hm(nextEvenHourRun(at(14, 5), 0))).toBe('16:0');
    expect(hm(nextEvenHourRun(at(14, 10), 15))).toBe('14:15');
    expect(hm(nextEvenHourRun(at(13, 10), 15))).toBe('14:15');
    expect(nextEvenHourRun(at(23, 30), 0).getDate()).toBe(16);
  });
});
