import {
  cardJoinKey,
  compactToIso,
  dedupeCardTransactions,
  isoToCardDate,
  mapCard,
  mapCardSummary,
  mapCardTransaction,
  mapCorporation,
  summarizeCardTransactions,
} from './privat-cards.mapper';

describe('privat-cards.mapper', () => {
  it('converts dates for the cards API and its compact timestamps', () => {
    expect(isoToCardDate('2026-03-05')).toBe('05.03.2026');
    expect(() => isoToCardDate('05.03.2026')).toThrow();
    expect(compactToIso('20260305T00:00:00')).toBe('2026-03-05T00:00:00');
    expect(compactToIso('')).toBeNull();
  });

  it('maps a corporation with its cards', () => {
    const corp = mapCorporation({
      corpType: 'CORP',
      CorpCode: 'A1',
      Branch: 'CKHM',
      jurId: 1590653,
      cardsAmount: 2,
      cardsShown: 2,
      PanData: [
        { PanNumber: '1234****6789=123', MaskedPanNumber: '1234****6789', Balance: 150.5, PanStateS: '0', FioFiz: 'Іваненко І.', DateLastTran: '2012-11-17 15:54:09', main: 'Y' },
        { PanNumber: '9999****0000=1', Balance: null },
      ],
    });
    expect(corp.cards).toHaveLength(2);
    expect(corp.jur_id).toBe('1590653');
    expect(corp.cards[0]).toMatchObject({
      pan_key: '1234****6789=123',
      balance: 150.5,
      holder_name: 'Іваненко І.',
      last_transaction_at: '2012-11-17T15:54:09',
      is_main: true,
    });
    expect(corp.cards[1].balance).toBeNull();
  });

  it('maps a card operation: direction, sign, dates, optional rest', () => {
    const tx = mapCardTransaction(
      {
        idFront: '77',
        tranRef: 'R1',
        trandc: 'DB',
        amountAmt: '-1250.40',
        amountCcy: 'UAH',
        fee: '0',
        posted: '16.08.2019',
        valuedateValue: '15.08.2019',
        valuedateId: '20190815T00:00:00',
        descr: 'АЗС',
        mcc: '5541',
        account: { card: '1234****6789', ccy: 'UAH' },
      },
      { corpCode: 'A1', corpType: 'CORP' },
    );
    expect(tx.id).toBe('R1|77|1234****6789');
    expect(tx.direction).toBe('debit');
    expect(tx.amount).toBe(1250.4);
    expect(tx.amount_signed).toBe(-1250.4);
    expect(tx.date).toBe('2019-08-15');
    expect(tx.posted_date).toBe('2019-08-16');
    expect(tx.datetime).toBe('2019-08-15T00:00:00');
    expect(tx.rest).toBeNull();
    expect(tx.corp_code).toBe('A1');

    const refund = mapCardTransaction({ trandc: 'CR', amountAmt: 10, amountCcy: 'UAH' });
    expect(refund.amount_signed).toBe(10);
    expect(mapCardTransaction({ amountAmt: 10 }).amount_signed).toBeNull();
  });

  it('maps the per-card summary block', () => {
    const s = mapCardSummary({ acc: 'UA1', brest: '100', erest: '50.5', db: '60', cr: '10.5', fee: '0' });
    expect(s).toMatchObject({ account: 'UA1', opening_balance: 100, closing_balance: 50.5, debit: 60, credit: 10.5 });
  });

  it('joins masked cards on first4+last4 and tolerates the key suffix', () => {
    expect(cardJoinKey('1234****6789=123456789')).toBe('12346789');
    expect(cardJoinKey('1234****6789')).toBe('12346789');
    expect(cardJoinKey(null)).toBeNull();
  });

  it('dedupes and sums per currency', () => {
    const a = mapCardTransaction({ tranRef: 'R', idFront: '1', trandc: 'DB', amountAmt: '100', amountCcy: 'UAH', fee: '1.5' });
    const items = dedupeCardTransactions([a, a, mapCardTransaction({ tranRef: 'R', idFront: '2', trandc: 'CR', amountAmt: '40', amountCcy: 'UAH' })]);
    expect(items).toHaveLength(2);
    expect(summarizeCardTransactions(items)[0]).toMatchObject({ currency: 'UAH', count: 2, debit: 100, credit: 40, fee: 1.5, net: -60 });
  });
});
