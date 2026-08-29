import {
  toIsoDate,
  parseShellTransactionType,
  mapShellTransaction,
  deriveShellCards,
  deriveShellMerchants,
  ShellTransaction,
} from './shell.mapper';

describe('toIsoDate', () => {
  it('expands compact YYYYMMDD into a full ISO timestamp', () => {
    expect(toIsoDate('20260608')).toBe('2026-06-08T00:00:00.000Z');
  });

  it('passes through a parseable ISO string', () => {
    expect(toIsoDate('2026-06-08T12:30:00.000Z')).toBe('2026-06-08T12:30:00.000Z');
  });

  it('falls back to now for empty/garbage input (does not throw)', () => {
    expect(() => toIsoDate('')).not.toThrow();
    expect(() => toIsoDate('not-a-date')).not.toThrow();
    expect(toIsoDate('not-a-date')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('parseShellTransactionType', () => {
  it('classifies fuel with a Ukrainian category and a per-group code', () => {
    const r = parseShellTransactionType({
      ProductGroupId: 7,
      ProductGroupName: 'Automotive gas oil',
      FuelProduct: true,
    });
    expect(r.code).toBe('SHELL_G7');
    expect(r.isFee).toBe(false);
    expect(r.description).toBe('Shell · Дизельне пальне');
  });

  it('keeps non-fuel operation names in English and flags fees', () => {
    const r = parseShellTransactionType({
      ProductGroupName: 'Card related fees',
      FuelProduct: false,
    });
    expect(r.isFee).toBe(true);
    expect(r.description).toBe('Shell · Card related fees');
  });

  it('detects a return from the credit/debit code, refund flag, or a negative amount', () => {
    expect(parseShellTransactionType({ CreditDebitCode: 'C' }).isReturn).toBe(true);
    expect(parseShellTransactionType({ RefundFlag: 'yes' }).isReturn).toBe(true);
    expect(parseShellTransactionType({ GrossAmount: -5 }).isReturn).toBe(true);
    expect(parseShellTransactionType({ GrossAmount: 5 }).isReturn).toBe(false);
  });

  it('prefixes a returned fuel row', () => {
    const r = parseShellTransactionType({
      ProductGroupName: 'Motor gasoline',
      FuelProduct: true,
      GrossAmount: -10,
    });
    expect(r.description).toBe('Shell · Повернення · Бензин');
    expect(r.isReturn).toBe(true);
  });
});

describe('mapShellTransaction', () => {
  it('normalises PascalCase, converts amounts to UAH by the rate, and keeps the source', () => {
    const t = mapShellTransaction(
      {
        TransactionId: 5,
        TransactionDate: '20260608',
        CardPAN: 'PAN1',
        SiteCode: 'S1',
        ProductGroupId: 7,
        ProductGroupName: 'Automotive gas oil',
        FuelProduct: true,
        InvoiceGrossAmount: 100,
        InvoiceNetAmount: 80,
        UnitPriceInInvoiceCurrency: 2,
        InvoiceCurrencyCode: 'EUR',
      },
      45, // 1 EUR = 45 UAH
    );
    expect(t.TransactionDate).toBe('2026-06-08T00:00:00.000Z');
    expect(t.GrossAmount).toBe(4500); // 100 * 45
    expect(t.NetAmount).toBe(3600); // 80 * 45
    expect(t.UnitPrice).toBe(90); // 2 * 45
    expect(t.SourceGrossAmount).toBe(100);
    expect(t.ExchangeRate).toBe(45);
    expect(t.CurrencyCode).toBe('EUR');
    expect(t.TransactionTypeCode).toBe('SHELL_G7');
  });

  it('defaults the rate to 1 (no conversion) when omitted', () => {
    const t = mapShellTransaction({ GrossAmount: 12.5, TransactionDate: '20260101' });
    expect(t.GrossAmount).toBe(12.5);
    expect(t.ExchangeRate).toBe(1);
  });
});

describe('deriveShellCards / deriveShellMerchants', () => {
  const txs = [
    { CardPAN: 'A', SiteCode: 'S1', SiteName: 'Shell One', SiteCountry: 'PL', DriverName: 'Ivan' },
    { CardPAN: 'A', SiteCode: 'S1' }, // duplicate PAN + site
    { CardPAN: 'B', SiteCode: 'S2', SiteName: 'Shell Two', SiteCountry: 'UA' },
  ] as ShellTransaction[];

  it('de-duplicates cards by CardPAN', () => {
    const cards = deriveShellCards(txs, 'PAYER1');
    expect(cards.map((c) => c.CardPAN)).toEqual(['A', 'B']);
    expect(cards[0]).toMatchObject({ CardId: 'SH-A', CardStatus: 'ACTIVE', PayerNumber: 'PAYER1' });
  });

  it('de-duplicates merchants by SiteCode', () => {
    const sites = deriveShellMerchants(txs);
    expect(sites.map((s) => s.merchant_id)).toEqual(['SH-AZS-S1', 'SH-AZS-S2']);
    expect(sites[1]).toMatchObject({ merchant_name: 'Shell Two', region: 'UA' });
  });

  it('returns an empty list for no transactions', () => {
    expect(deriveShellCards([], 'P')).toEqual([]);
    expect(deriveShellMerchants([])).toEqual([]);
  });
});
