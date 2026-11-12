import { BankRepository } from './bank.repository';
import { AddBankVParams } from './privat-bank.mapper';

const row = (n: number): AddBankVParams => ({
  bank_idnt: 'PRIVATBANK',
  bank_trans_id: `ID${n}`,
  dk: '1',
  doc_date: '2026-11-11T10:00:00',
  doc_number: null,
  firma_edrpou: null,
  firma_iban: null,
  firma_mfo: null,
  firma_name: null,
  prizn: null,
  suma: 1,
  suma_uah: 1,
  ur_bank_city: null,
  ur_bank_name: null,
  ur_edrpou: null,
  ur_iban: null,
  ur_mfo: null,
  ur_name: null,
  valut_idnt: 'UAH',
});

/** Підмінне з'єднання: `failWhen(n)` вирішує, чи виклик процедури №n (з 1) падає. */
function repoWith(failWhen: (call: number) => boolean) {
  let calls = 0;
  let stored = 0;
  const conn = {
    execute: async (sql: string) => {
      if (sql.includes('count(*)')) return { rows: [{ CNT: stored }] };
      calls++;
      if (failWhen(calls)) throw new Error('ORA-04098: trigger is invalid\nORA-06512');
      stored++;
      return {};
    },
  };
  const oracle = { withConnection: async (fn: any) => fn(conn), query: async () => [] } as any;
  const repo = new BankRepository(oracle, { get: () => undefined } as any);
  return { repo, calls: () => calls };
}

describe('BankRepository.addBatch', () => {
  it('counts sent, inserted and failed rows, and keeps going after a single bad row', async () => {
    const { repo } = repoWith((n) => n === 2);
    const res = await repo.addBatch([row(1), row(2), row(3)]);
    expect(res).toMatchObject({ sent: 2, inserted: 2, failed: 1 });
    expect(res.errors).toEqual(['ID2: ORA-04098: trigger is invalid']);
  });

  it('stops after 5 failures in a row at the start — a broken procedure is not hammered 188 times', async () => {
    const { repo, calls } = repoWith(() => true);
    const res = await repo.addBatch(Array.from({ length: 188 }, (_, i) => row(i)));
    expect(calls()).toBe(5);
    expect(res).toMatchObject({ sent: 0, inserted: 0, failed: 5 });
    expect(res.errors).toHaveLength(5);
  });

  it('does not stop once something has succeeded: scattered failures are bad rows, not a broken procedure', async () => {
    const { repo, calls } = repoWith((n) => n > 1 && n <= 8); // 1 успіх, потім 7 збоїв підряд
    const res = await repo.addBatch(Array.from({ length: 12 }, (_, i) => row(i)));
    expect(calls()).toBe(12);
    expect(res).toMatchObject({ sent: 5, failed: 7 });
  });

  it('does nothing for an empty batch', async () => {
    const { repo, calls } = repoWith(() => false);
    expect(await repo.addBatch([])).toEqual({ sent: 0, inserted: 0, failed: 0, errors: [] });
    expect(calls()).toBe(0);
  });
});
