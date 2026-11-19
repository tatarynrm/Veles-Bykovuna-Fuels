import { ConfigService } from '@nestjs/config';
import { OracleService } from './oracle.service';

/** Мінімальний пул: лічить зайняті з'єднання; `close(undefined)` кидає, як справжній node-oracledb (NJS-005). */
function fakePool() {
  const state = { inUse: 0, dropped: 0 };
  const pool: any = {
    connectionsOpen: 1,
    poolMax: 4,
    get connectionsInUse() {
      return state.inUse;
    },
    async getConnection() {
      state.inUse++;
      const conn: any = {
        callTimeout: 0,
        async close(...args: any[]) {
          if (args.length && args[0] === undefined) throw new Error('NJS-005: invalid value for parameter 1');
          if (args[0]?.drop) state.dropped++;
          state.inUse--;
        },
      };
      return conn;
    },
  };
  return { pool, state };
}

function service(pool: any) {
  const cfg = new ConfigService({ ORACLE_USER: 'u', ORACLE_PASSWORD: 'p', ORACLE_CONNECT_STRING: 'h:1/s' });
  const svc = new OracleService(cfg);
  (svc as any).pool = pool;
  return svc;
}

describe('OracleService.withConnection', () => {
  it('повертає з’єднання в пул після успіху (регресія: close(undefined) → NJS-005 → витік слота)', async () => {
    const { pool, state } = fakePool();
    const svc = service(pool);
    for (let i = 0; i < 10; i++) await svc.withConnection(async () => 'ok');
    expect(state.inUse).toBe(0);
  });

  it('повертає з’єднання й тоді, коли колбек кинув звичайну помилку', async () => {
    const { pool, state } = fakePool();
    const svc = service(pool);
    await expect(svc.withConnection(async () => { throw new Error('ORA-00001: unique constraint'); })).rejects.toThrow('ORA-00001');
    expect(state.inUse).toBe(0);
    expect(state.dropped).toBe(0);
  });

  it('відкидає (drop) з’єднання після таймауту виклику', async () => {
    const { pool, state } = fakePool();
    const svc = service(pool);
    await expect(svc.withConnection(async () => { throw new Error('NJS-123: call timeout of 1500 ms exceeded'); })).rejects.toThrow('NJS-123');
    expect(state.inUse).toBe(0);
    expect(state.dropped).toBe(1);
  });

  it('виставляє callTimeout на з’єднанні', async () => {
    const { pool } = fakePool();
    const svc = service(pool);
    let seen = 0;
    await svc.withConnection(async (c) => { seen = c.callTimeout; });
    expect(seen).toBe(120_000);
  });

  it('getPoolStats показує тих, хто тримає з’єднання, і чистить їх після завершення', async () => {
    const { pool } = fakePool();
    const svc = service(pool);
    let during: any;
    await svc.withConnection(async () => { during = svc.getPoolStats(); });
    expect(during.holders).toHaveLength(1);
    expect(svc.getPoolStats()?.holders).toHaveLength(0);
  });
});
