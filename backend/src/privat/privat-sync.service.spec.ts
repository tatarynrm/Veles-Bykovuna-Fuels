import { mapTransaction } from './privat.mapper';
import { MAX_PERIOD_DAYS, PrivatSyncService, WINDOW_DAYS } from './privat-sync.service';
import { addDays, localYmd } from '../fuel-sync/fuel-sync.utils';

const row = (id: string, over: Record<string, unknown> = {}) =>
  mapTransaction({
    AUT_MY_CRF: '12345678',
    AUT_MY_MFO: '305299',
    AUT_MY_ACC: 'UA000000000000000000000000001',
    AUT_MY_NAM: 'ТОВ ПРИКЛАД',
    AUT_CNTR_CRF: '87654321',
    AUT_CNTR_MFO: '300001',
    AUT_CNTR_ACC: 'UA000000000000000000000000002',
    AUT_CNTR_NAM: 'ТОВ КЛІЄНТ',
    CCY: 'UAH',
    PR_PR: 'r',
    DOC_TYP: 'p',
    NUM_DOC: '1',
    DAT_OD: '11.11.2026',
    OSND: 'оплата',
    SUM: '100.00',
    SUM_E: '100.00',
    REF: id.slice(0, 14),
    REFN: '1',
    TIM_P: '10:15',
    DATE_TIME_DAT_OD_TIM_P: '11.11.2026 10:15:00',
    ID: id,
    TRANTYPE: 'C',
    ...over,
  });

const ID = (n: number) => `DNH${String(n).padStart(11, '0')}111112026101500C`;

function build(opts: {
  rows: any[] | ((from: string, to: string) => any[] | Promise<any[]>);
  stored?: string[];
  enabled?: boolean;
  lookbackDays?: number;
  oracle?: boolean;
  addBatch?: any;
}) {
  const calls: {
    window?: [string, string];
    windows: [string, string][];
    stored?: string;
    storedWindows: [string, string][];
    batch?: any[];
    maxParallel: number;
  } = { windows: [], storedWindows: [], maxParallel: 0 };
  let inFlight = 0;
  const privat = {
    isConfigured: () => true,
    getTransactionsForSync: async (from: string, to: string) => {
      inFlight++;
      calls.maxParallel = Math.max(calls.maxParallel, inFlight);
      calls.window = [from, to];
      calls.windows.push([from, to]);
      try {
        await new Promise((r) => setTimeout(r, 1));
        return typeof opts.rows === 'function' ? await opts.rows(from, to) : opts.rows;
      } finally {
        inFlight--;
      }
    },
  } as any;
  const oracle = { isConfigured: () => opts.oracle ?? true } as any;
  const repo = {
    procedure: 'P_BANK.AddBankV',
    getStoredIds: async (from: string, to: string) => {
      calls.stored = from;
      calls.storedWindows.push([from, to]);
      return new Set((opts.stored ?? []).map((s) => s.toUpperCase()));
    },
    addBatch:
      opts.addBatch ??
      (async (batch: any[]) => {
        calls.batch = batch;
        return { sent: batch.length, inserted: batch.length, failed: 0, errors: [] };
      }),
  } as any;
  const syncConfig = {
    get: () => ({ privat: { enabled: opts.enabled ?? true, times: ['08:30', '11:30', '14:30', '17:30'], lookbackDays: opts.lookbackDays ?? 1 } }),
    getStatus: () => ({ file: 'sync-config.json', exists: true, loadedAt: null, error: null }),
    onChange: () => undefined,
  } as any;
  const service = new PrivatSyncService(privat, oracle, repo, syncConfig, {} as any);
  return { service, calls };
}

describe('PrivatSyncService', () => {
  it('writes only new posted rows, with both legs of an internal transfer', async () => {
    const { service, calls } = build({
      rows: [
        row(ID(1)),
        row(ID(2)), // вже в базі
        row('DNH00000000003X111112026101500D', { TRANTYPE: 'D' }), // дебет-нога,
        row('DNH00000000003X111112026101500C', { TRANTYPE: 'C' }), // і кредит-нога одного переказу
        row(ID(4), { PR_PR: 'p' }), // ще не проведена
      ],
      stored: [ID(2)],
    });
    const run = await service.sync('manual');
    expect(run).toMatchObject({ ok: true, fetched: 5, skipped: 1, alreadyStored: 1, sent: 3, inserted: 3, failed: 0 });
    expect(calls.batch?.map((b) => b.bank_trans_id)).toEqual([
      ID(1),
      'DNH00000000003X111112026101500D',
      'DNH00000000003X111112026101500C',
    ]);
  });

  it('reads today plus lookbackDays, as local dates', async () => {
    const { service, calls } = build({ rows: [], lookbackDays: 2 });
    await service.sync('cron');
    const [from, to] = calls.window!;
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
    expect(days).toBe(2);
    expect(calls.stored).toBe(from);
  });

  it('with lookbackDays = 0 reads strictly today', async () => {
    const { service, calls } = build({ rows: [], lookbackDays: 0 });
    await service.sync('cron');
    expect(calls.window![0]).toBe(calls.window![1]);
  });

  it('does nothing when the sync is disabled', async () => {
    const { service, calls } = build({ rows: [row(ID(1))], enabled: false });
    expect(await service.sync('cron')).toBeNull();
    expect(calls.window).toBeUndefined();
    expect((await service.start()).started).toBe(false);
  });

  it('a dry run writes nothing, works while disabled, and shows a sample', async () => {
    const { service, calls } = build({ rows: [row(ID(1)), row(ID(2))], stored: [ID(2)], enabled: false });
    const res = await service.start({ dryRun: true });
    expect(res.started).toBe(true);
    expect(res.run).toMatchObject({ dryRun: true, ok: true, fetched: 2, alreadyStored: 1, sent: 1, inserted: 0 });
    expect(res.run?.sample).toHaveLength(1);
    expect(calls.batch).toBeUndefined();
  });

  it('records the error and stops when Privat is unreachable', async () => {
    const { service } = build({ rows: [] });
    (service as any).privat.getTransactionsForSync = async () => {
      throw new Error('ПриватБанк недоступний: ETIMEDOUT');
    };
    const run = await service.sync('cron');
    expect(run).toMatchObject({ ok: false, error: 'ПриватБанк недоступний: ETIMEDOUT', sent: 0 });
    expect(service.getStatus().lastRun?.ok).toBe(false);
    expect(service.getStatus().running).toBe(false);
  });

  it('fails the pass when the procedure rejects every row, but keeps partial success otherwise', async () => {
    const allBad = build({
      rows: [row(ID(1)), row(ID(2))],
      addBatch: async () => ({ sent: 0, inserted: 0, failed: 2, errors: ['x: ORA-12899'] }),
    });
    expect(await allBad.service.sync('cron')).toMatchObject({ ok: false, failed: 2 });

    const partial = build({
      rows: [row(ID(1)), row(ID(2))],
      addBatch: async () => ({ sent: 1, inserted: 1, failed: 1, errors: ['x: ORA-12899'] }),
    });
    expect(await partial.service.sync('cron')).toMatchObject({ ok: true, sent: 1, failed: 1 });
  });

  it('does not start a second pass while one is running', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { service } = build({ rows: [] });
    (service as any).privat.getTransactionsForSync = async () => {
      await gate;
      return [];
    };
    const first = service.sync('cron');
    expect(await service.sync('manual')).toBeNull();
    expect(service.getStatus().running).toBe(true);
    release();
    await first;
    expect(service.getStatus().running).toBe(false);
  });
});

describe('period and the queue of windows', () => {
  const today = localYmd();
  const ago = (n: number) => addDays(today, -n);

  it('splits a chosen period into windows and walks them one after another, oldest first', async () => {
    const { service, calls } = build({ rows: [] });
    const res = await service.start({ from: ago(20), to: ago(0) });
    expect(res.started).toBe(true);
    expect(res.message).toContain('вікон 3');
    // Прохід у фоні: дочекаємось завершення.
    while (service.getStatus().running) await new Promise((r) => setTimeout(r, 2));

    expect(calls.windows).toEqual([
      [ago(20), ago(14)],
      [ago(13), ago(7)],
      [ago(6), ago(0)],
    ]);
    expect(calls.windows.every(([from, to]) => (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1 <= WINDOW_DAYS)).toBe(true);
    // Черга: жодних двох вікон одночасно.
    expect(calls.maxParallel).toBe(1);
    // Відсів «вже записаного» теж по вікнах, а не по всій історії.
    expect(calls.storedWindows).toEqual(calls.windows);

    const status = service.getStatus();
    expect(status).toMatchObject({ mode: 'period', windowsTotal: 3, windowsDone: 3, running: false });
    expect(status.windows.map((w) => w.status)).toEqual(['done', 'done', 'done']);
    expect(status.lastRun).toMatchObject({ mode: 'period', from: ago(20), to: ago(0), windowsTotal: 3, windowsDone: 3, ok: true });
  });

  it('adds up the totals of every window', async () => {
    const { service } = build({
      rows: (from) => [row(`DNH${from.replace(/-/g, '')}A`.padEnd(30, '0') + 'C')],
    });
    const run = await service.sync('manual', false, { mode: 'period', from: ago(14), to: ago(0) });
    expect(run).toMatchObject({ ok: true, windowsTotal: 3, fetched: 3, sent: 3, inserted: 3 });
  });

  it('stops at the first failing window and leaves the later ones pending, so the next run resumes there', async () => {
    const { service, calls } = build({
      rows: [row(ID(1))],
      addBatch: async (batch: any[]) =>
        calls.windows.length >= 2
          ? { sent: 0, inserted: 0, failed: 1, errors: ['x: ORA-20000: Вкажіть фірму !'] }
          : { sent: batch.length, inserted: batch.length, failed: 0, errors: [] },
    });
    const run = await service.sync('manual', false, { mode: 'period', from: ago(20), to: ago(0) });
    expect(calls.windows).toHaveLength(2); // третє вікно навіть не пробувалось
    expect(run).toMatchObject({ ok: false, windowsTotal: 3, windowsDone: 2 });
    expect(run?.error).toContain('Вкажіть фірму');
    expect(service.getStatus().windows.map((w) => w.status)).toEqual(['done', 'error', 'pending']);
    expect(service.getStatus().windows[1].error).toContain('Вкажіть фірму');
  });

  it('a multi-window dry run goes to the background, a single-window one returns its report', async () => {
    const wide = build({ rows: [row(ID(1))], enabled: false });
    const a = await wide.service.start({ dryRun: true, from: ago(20), to: ago(0) });
    expect(a).toMatchObject({ started: true });
    expect(a.run).toBeUndefined();
    while (wide.service.getStatus().running) await new Promise((r) => setTimeout(r, 2));
    expect(wide.service.getStatus().lastRun).toMatchObject({ dryRun: true, windowsTotal: 3, sent: 3, inserted: 0 });
    expect(wide.calls.batch).toBeUndefined();

    const one = build({ rows: [row(ID(1))], enabled: false });
    const b = await one.service.start({ dryRun: true, from: ago(2), to: ago(0) });
    expect(b.run).toMatchObject({ dryRun: true, windowsTotal: 1, sent: 1 });
    expect(b.run?.sample).toHaveLength(1);
  });

  it('refuses a bad period with a clear reason and does not touch the bank', async () => {
    const { service, calls } = build({ rows: [] });
    const bad = async (opts: { from?: string; to?: string }) => service.start(opts);
    expect(await bad({ from: '11.11.2026', to: today })).toMatchObject({ started: false, message: expect.stringContaining('РРРР-ММ-ДД') });
    expect(await bad({ from: ago(0), to: ago(3) })).toMatchObject({ started: false, message: expect.stringContaining('пізніший') });
    expect(await bad({ from: addDays(today, 3), to: addDays(today, 5) })).toMatchObject({ started: false, message: expect.stringContaining('майбутньому') });
    expect(await bad({ from: ago(MAX_PERIOD_DAYS + 5), to: today })).toMatchObject({ started: false, message: expect.stringContaining('завеликий') });
    expect(await bad({ to: today })).toMatchObject({ started: false }); // кінець без початку — теж невалідний період
    expect(calls.windows).toHaveLength(0);
  });

  it('clamps an end date in the future to today', async () => {
    const { service, calls } = build({ rows: [] });
    await service.start({ from: ago(1), to: addDays(today, 9) });
    while (service.getStatus().running) await new Promise((r) => setTimeout(r, 2));
    expect(service.getStatus().period).toEqual({ from: ago(1), to: today });
    expect(calls.windows).toEqual([[ago(1), today]]);
  });

  it('a period run respects the enabled flag too, but a recent run is unchanged', async () => {
    const off = build({ rows: [], enabled: false });
    expect(await off.service.start({ from: ago(3), to: ago(0) })).toMatchObject({ started: false });
    const on = build({ rows: [], lookbackDays: 1 });
    expect((await on.service.start({})).message).toContain('вікон 1');
  });
});
