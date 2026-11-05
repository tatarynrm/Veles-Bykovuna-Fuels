import {
  dedupeTransactions,
  isoToBankDate,
  mapBalance,
  mapTransaction,
  money,
  summarize,
  toIsoDate,
  toIsoDateTime,
} from './privat.mapper';

describe('privat.mapper', () => {
  describe('primitives', () => {
    it('parses money strings and keeps "no value" as null, not zero', () => {
      expect(money('1234.56')).toBe(1234.56);
      expect(money('1 234,56')).toBe(1234.56);
      expect(money('0.00')).toBe(0);
      expect(money('')).toBeNull();
      expect(money(undefined)).toBeNull();
      expect(money('abc')).toBeNull();
    });

    it('normalises bank dates to ISO', () => {
      expect(toIsoDate('05.03.2026')).toBe('2026-03-05');
      expect(toIsoDate('05-03-2026')).toBe('2026-03-05');
      expect(toIsoDate('2026-03-05')).toBe('2026-03-05');
      expect(toIsoDate('')).toBeNull();
      expect(toIsoDate('вчора')).toBeNull();
    });

    it('normalises datetimes without inventing a zone', () => {
      expect(toIsoDateTime('05.03.2026 14:07:09')).toBe('2026-03-05T14:07:09');
      expect(toIsoDateTime('05.03.2026 9:07')).toBe('2026-03-05T09:07:00');
      expect(toIsoDateTime('05.03.2026')).toBe('2026-03-05T00:00:00');
    });

    it('converts picker dates to the bank format and rejects junk', () => {
      expect(isoToBankDate('2026-03-05')).toBe('05-03-2026');
      expect(() => isoToBankDate('05-03-2026')).toThrow();
    });
  });

  describe('mapTransaction', () => {
    const raw = {
      REF: 'REGPO0000B0NW0',
      REFN: '1',
      AUT_MY_ACC: 'UA403052990000026000000000000',
      AUT_CNTR_NAM: 'ТОВ Контрагент',
      AUT_CNTR_CRF: '12345678',
      CCY: 'UAH',
      SUM: '1500.50',
      SUM_E: '1500.50',
      TRANTYPE: 'D',
      PR_PR: 'r',
      FL_REAL: 'r',
      OSND: 'Оплата за паливо',
      DAT_OD: '05.03.2026',
      TIM_P: '14:07',
      DATE_TIME_DAT_OD_TIM_P: '05.03.2026 14:07:00',
    };

    it('maps the identity, direction and signed amount', () => {
      const tx = mapTransaction(raw);
      expect(tx.id).toBe('REGPO0000B0NW01');
      expect(tx.direction).toBe('debit');
      expect(tx.amount).toBe(1500.5);
      expect(tx.amount_signed).toBe(-1500.5);
      expect(tx.counterparty.name).toBe('ТОВ Контрагент');
      expect(tx.counterparty.code).toBe('12345678');
      expect(tx.date).toBe('2026-03-05');
      expect(tx.datetime).toBe('2026-03-05T14:07:00');
      expect(tx.status_label).toBe('Проведена');
      expect(tx.real_flag).toBe('r');
    });

    it('treats a credit as positive and absent fields as null', () => {
      const tx = mapTransaction({ REF: 'A', REFN: '2', SUM: '10', TRANTYPE: 'C', CCY: 'UAH' });
      expect(tx.direction).toBe('credit');
      expect(tx.amount_signed).toBe(10);
      expect(tx.purpose).toBeNull();
      expect(tx.uetr).toBeNull();
      expect(tx.datetime).toBeNull();
    });

    it('does not guess a direction or sign from an unknown TRANTYPE', () => {
      const tx = mapTransaction({ REF: 'A', REFN: '1', SUM: '10' });
      expect(tx.direction).toBeNull();
      expect(tx.amount_signed).toBeNull();
    });
  });

  describe('mapBalance', () => {
    it('maps camelCase balance rows', () => {
      const b = mapBalance({
        acc: 'UA40305299',
        currency: 'UAH',
        balanceIn: '100.00',
        balanceOut: '250.50',
        turnoverDebt: '10',
        turnoverCred: '160.5',
        dpd: '04.03.2026',
        nameACC: 'Поточний',
        is_final_bal: 'true',
      });
      expect(b.account).toBe('UA40305299');
      expect(b.balance_out).toBe(250.5);
      expect(b.turnover_credit).toBe(160.5);
      expect(b.last_movement).toBe('2026-03-04');
      expect(b.is_final).toBe(true);
      expect(b.closed_at).toBeNull();
    });
  });

  describe('aggregation', () => {
    const tx = (over: Record<string, string>) =>
      mapTransaction({ REF: 'R', REFN: '1', CCY: 'UAH', SUM: '100', TRANTYPE: 'D', PR_PR: 'p', ...over });

    it('dedupes on REF+REFN and keeps identity-less rows', () => {
      const out = dedupeTransactions([
        tx({ REF: 'A', REFN: '1' }),
        tx({ REF: 'A', REFN: '1' }),
        tx({ REF: 'A', REFN: '2' }),
        tx({ REF: '', REFN: '' }),
        tx({ REF: '', REFN: '' }),
      ]);
      expect(out).toHaveLength(4);
    });

    it('sums per currency and ignores rejected and reversed payments', () => {
      const s = summarize([
        tx({ SUM: '100', TRANTYPE: 'D', PR_PR: 'r' }),
        tx({ SUM: '250.40', TRANTYPE: 'C', PR_PR: 'r' }),
        tx({ SUM: '999', TRANTYPE: 'D', PR_PR: 'n' }),
        tx({ SUM: '888', TRANTYPE: 'D', PR_PR: 't' }),
        tx({ SUM: '10', TRANTYPE: 'C', CCY: 'EUR' }),
      ]);
      const uah = s.find((r) => r.currency === 'UAH')!;
      expect(uah).toMatchObject({ count: 4, debit: 100, credit: 250.4, net: 150.4 });
      expect(s.find((r) => r.currency === 'EUR')).toMatchObject({ count: 1, credit: 10, net: 10 });
    });
  });
});
