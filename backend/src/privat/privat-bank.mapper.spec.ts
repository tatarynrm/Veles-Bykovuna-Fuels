import { mapTransaction } from './privat.mapper';
import { dkOf, mapPrivatToAddBankV, shouldSyncPrivat } from './privat-bank.mapper';

/** Форма рядка виписки (значення вигадані, структура справжня). */
const raw = (over: Record<string, unknown> = {}) => ({
  AUT_MY_CRF: '12345678',
  AUT_MY_MFO: '305299',
  AUT_MY_ACC: 'UA000000000000000000000000001',
  AUT_MY_NAM: "ТОВ 'ПРИКЛАД'",
  AUT_MY_MFO_NAME: 'АТ КБ "ПРИВАТБАНК"',
  AUT_MY_MFO_CITY: 'ДНІПРО',
  AUT_CNTR_CRF: '87654321',
  AUT_CNTR_MFO: '300001',
  AUT_CNTR_ACC: 'UA000000000000000000000000002',
  AUT_CNTR_NAM: 'ТОВ "КЛІЄНТ"',
  AUT_CNTR_MFO_NAME: 'АТ "ІНШИЙ БАНК"',
  AUT_CNTR_MFO_CITY: 'КИЇВ',
  CCY: 'UAH',
  FL_REAL: 'r',
  PR_PR: 'r',
  DOC_TYP: 'p',
  NUM_DOC: '1234',
  DAT_KL: '10.11.2026',
  DAT_OD: '11.11.2026',
  OSND: 'оплата за транспортні послуги',
  SUM: '30000.00',
  SUM_E: '30000.00',
  REF: 'DNHAAAAAAAAAAA',
  REFN: 'P',
  TIM_P: '10:15',
  DATE_TIME_DAT_OD_TIM_P: '11.11.2026 10:15:00',
  ID: 'DNHAAAAAAAAAAAP11112026101500C',
  TRANTYPE: 'C',
  ...over,
});

const tx = (over: Record<string, unknown> = {}) => mapTransaction(raw(over));

describe('Privat → AddBankV', () => {
  it('maps every parameter of the procedure', () => {
    expect(mapPrivatToAddBankV(tx())).toEqual({
      bank_idnt: 'PRIVATBANK',
      bank_trans_id: 'DNHAAAAAAAAAAAP11112026101500C',
      dk: '1',
      doc_date: '2026-11-11T10:15:00',
      doc_number: '1234',
      firma_edrpou: '12345678',
      firma_iban: 'UA000000000000000000000000001',
      firma_mfo: '305299',
      firma_name: "ТОВ 'ПРИКЛАД'",
      prizn: 'оплата за транспортні послуги',
      suma: 30000,
      suma_uah: 30000,
      ur_bank_city: 'КИЇВ',
      ur_bank_name: 'АТ "ІНШИЙ БАНК"',
      ur_edrpou: '87654321',
      ur_iban: 'UA000000000000000000000000002',
      ur_mfo: '300001',
      ur_name: 'ТОВ "КЛІЄНТ"',
      valut_idnt: 'UAH',
    });
  });

  it('pDk follows the business meaning: money in → 1, money out → 2', () => {
    // У виписці TRANTYPE C = на наш рахунок прийшли гроші, D = пішли.
    expect(mapPrivatToAddBankV(tx({ TRANTYPE: 'C' })).dk).toBe('1');
    expect(mapPrivatToAddBankV(tx({ TRANTYPE: 'D' })).dk).toBe('2');
    expect(dkOf('credit')).toBe('1');
    expect(dkOf('debit')).toBe('2');
    expect(dkOf(null)).toBeNull();
  });

  it('identifies the transaction by the bank ID, so both legs of an internal transfer survive', () => {
    const debit = mapPrivatToAddBankV(tx({ TRANTYPE: 'D', ID: 'DNHAAAAAAAAAAA111112026101500D' }));
    const credit = mapPrivatToAddBankV(tx({ TRANTYPE: 'C', ID: 'DNHAAAAAAAAAAA111112026101500C' }));
    // REF+REFN у цих двох однакові, а ID — різні.
    expect(debit.bank_trans_id).not.toBe(credit.bank_trans_id);
  });

  it('keeps the UAH equivalent for a foreign-currency row', () => {
    const row = mapPrivatToAddBankV(tx({ CCY: 'EUR', SUM: '1600.00', SUM_E: '80772.80' }));
    expect(row).toMatchObject({ valut_idnt: 'EUR', suma: 1600, suma_uah: 80772.8 });
  });

  it('clips text by UTF-8 bytes to the BANKV column sizes (ORA-12899 guard)', () => {
    // Назва банку 73 символи ≈ 131 байт, а UR_BANK_NAME — 100 байт.
    const longBank = 'АКЦІОНЕРНЕ ТОВАРИСТВО КОМЕРЦІЙНИЙ БАНК ІМЕНІ ВЕЛИКОГО УКРАЇНСЬКОГО БАНКІРА НА ПРИКЛАД';
    const row = mapPrivatToAddBankV(tx({ AUT_CNTR_MFO_NAME: longBank, AUT_CNTR_NAM: 'Я'.repeat(150), OSND: 'Ж'.repeat(700) }));
    const bytes = (s: string | null) => Buffer.byteLength(s ?? '', 'utf8');
    expect(bytes(row.ur_bank_name)).toBeLessThanOrEqual(100);
    expect(bytes(row.ur_name)).toBeLessThanOrEqual(200);
    expect(bytes(row.prizn)).toBeLessThanOrEqual(1000);
    // Обрізка не ріже символ навпіл.
    expect(row.ur_bank_name).toBe(longBank.slice(0, row.ur_bank_name!.length));
  });

  it('turns blank optional fields into null instead of empty strings', () => {
    const row = mapPrivatToAddBankV(tx({ NUM_DOC: '', AUT_CNTR_MFO_CITY: null, OSND: '   ' }));
    expect(row.doc_number).toBeNull();
    expect(row.ur_bank_city).toBeNull();
    expect(row.prizn).toBeNull();
  });
});

describe('what is worth writing', () => {
  it('accepts a posted row', () => {
    expect(shouldSyncPrivat(tx())).toBe(true);
  });

  it('skips rows that are not posted yet, reversed or rejected', () => {
    for (const status of ['p', 't', 'n']) expect(shouldSyncPrivat(tx({ PR_PR: status }))).toBe(false);
  });

  it('skips rows without a bank ID, direction, time or amount', () => {
    expect(shouldSyncPrivat(tx({ ID: '' }))).toBe(false);
    expect(shouldSyncPrivat(tx({ TRANTYPE: '' }))).toBe(false);
    expect(shouldSyncPrivat(tx({ DATE_TIME_DAT_OD_TIM_P: '', DAT_OD: '', TIM_P: '' }))).toBe(false);
    expect(shouldSyncPrivat(tx({ SUM: '' }))).toBe(false);
  });
});
