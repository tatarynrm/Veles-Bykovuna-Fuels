import {
  parseTransactionType,
  formatAndClampOkkoDates,
  mapTransaction,
  mapCard,
  OKKO_CARD_STATUS,
} from './okko.mapper';

describe('parseTransactionType', () => {
  it('maps known codes to descriptions and return flags', () => {
    expect(parseTransactionType(737, false)).toEqual({ desc: 'Заправка до повного бака', isReturn: false });
    expect(parseTransactionType(775, false).isReturn).toBe(true);
    expect(parseTransactionType(783, false).isReturn).toBe(true);
    expect(parseTransactionType(787, false).isReturn).toBe(true);
  });

  it('treats 774 as a reversal only when the reversal flag is set', () => {
    expect(parseTransactionType(774, false)).toEqual({ desc: 'Списання пального', isReturn: false });
    expect(parseTransactionType(774, true)).toEqual({ desc: 'Повне скасування транзакції', isReturn: true });
  });

  it('treats an unknown code with reversal=true as a return', () => {
    expect(parseTransactionType(9999, true).isReturn).toBe(true);
    expect(parseTransactionType(9999, false)).toEqual({ desc: 'Заправка пального', isReturn: false });
  });

  it('accepts the code as a string', () => {
    expect(parseTransactionType('737', false).desc).toBe('Заправка до повного бака');
  });
});

describe('formatAndClampOkkoDates', () => {
  it('returns YYYY-MM-DD for a valid in-range window', () => {
    expect(formatAndClampOkkoDates('2026-06-01', '2026-06-20')).toEqual({
      date_from: '2026-06-01',
      date_to: '2026-06-20',
    });
  });

  it('clamps a range wider than 30 days by pulling date_from forward', () => {
    const { date_from, date_to } = formatAndClampOkkoDates('2026-01-01', '2026-06-20');
    expect(date_to).toBe('2026-06-20');
    // 29 days before 2026-06-20
    expect(date_from).toBe('2026-05-22');
  });

  it('clamps an inverted (negative) range too', () => {
    const { date_from, date_to } = formatAndClampOkkoDates('2026-06-20', '2026-06-01');
    expect(date_to).toBe('2026-06-01');
    expect(date_from).toBe('2026-05-03');
  });
});

describe('mapTransaction — unit conversions', () => {
  it('converts kopiykas→UAH (/100), millilitres→litres (/1000) and derives unit price', () => {
    const t = mapTransaction({
      trans_id: 42,
      trans_type: 737,
      amnt_trans: 250000, // 2500.00 UAH
      volume: 50000, // 50 L
      volume_unit: 'ml',
    });
    expect(t.amnt_trans).toBe(2500);
    expect(t.volume).toBe(50);
    expect(t.price).toBe(50); // 2500 / 50, derived — not read from the payload
    expect(t.trans_id).toBe('42');
    expect(t.is_return).toBe(false);
  });

  it('leaves a small volume (litres already) unconverted and avoids divide-by-zero', () => {
    const t = mapTransaction({ trans_type: 737, amnt_trans: 10000, volume: 40 });
    expect(t.volume).toBe(40);
    expect(t.price).toBe(2.5);

    const zero = mapTransaction({ trans_type: 737, amnt_trans: 10000, volume: 0 });
    expect(zero.price).toBe(0);
  });

  it('carries the parsed type description and return flag onto the row', () => {
    const t = mapTransaction({ trans_type: 775, reversal: false, amnt_trans: 100, volume: 0 });
    expect(t.is_return).toBe(true);
    expect(t.trans_type_desc).toBe('Часткова або повна відміна');
  });
});

describe('mapCard', () => {
  it('resolves the CHST status label and is_active, and divides limit values by 100', () => {
    const card = mapCard(
      {
        card_num: '7777',
        card_status: 'CHST0',
        limits: [{ limit_id: 1, cycle_type: 0, limit_value: 500000, limit_remains: 200000, limit_used: 300000 }],
      },
      '0010029571',
    );
    expect(card.status_desc).toBe(OKKO_CARD_STATUS.CHST0);
    expect(card.is_active).toBe(true);
    expect(card.contract_id).toBe('0010029571');
    expect(card.limits[0]).toMatchObject({ limit_value: 5000, limit_remains: 2000, limit_used: 3000 });
  });

  it('marks a blocked card (CHST5) as not active', () => {
    const card = mapCard({ card_num: '1', card_status: 'CHST5', limits: [] }, 'c');
    expect(card.is_active).toBe(false);
    expect(card.status_desc).toBe('Заблоковано');
  });

  it('defaults an absent status to CHST0 (working)', () => {
    const card = mapCard({ card_num: '1', limits: [] }, 'c');
    expect(card.status).toBe('CHST0');
    expect(card.is_active).toBe(true);
  });
});
