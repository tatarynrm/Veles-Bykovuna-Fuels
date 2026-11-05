import { UpgApiService } from './upg-api.service';

/** Підміняємо HTTP-клієнт сервісу: перевіряємо логін, пагінацію й повтор на 401 без мережі. */
function serviceWith(handler: (req: any) => any, env: Record<string, string> = { UPG_LOGIN: 'u', UPG_PASSWORD: 'p' }) {
  const service = new UpgApiService({ get: (key: string) => env[key] } as any);
  const calls: any[] = [];
  (service as any).client = {
    request: async (req: any) => {
      calls.push(req);
      return handler(req);
    },
    post: async (url: string, body: string) => {
      calls.push({ url, data: body, method: 'POST' });
      return handler({ url, data: body, method: 'POST' });
    },
  };
  return { service, calls };
}

const page = (data: any[], current: number, last: number, total: number) => ({
  data: {
    data,
    links: { next: current < last ? `https://x/api/fuel-card-history?page=${current + 1}` : null },
    meta: { total },
  },
});

describe('UpgApiService', () => {
  it('не працює без логіна й пароля', async () => {
    const { service } = serviceWith(() => ({}), {});
    expect(service.isConfigured()).toBe(false);
    await expect(service.getRawFuelCardHistory('2026-01-01', '2026-01-31')).rejects.toThrow('UPG_LOGIN');
  });

  it('логіниться один раз і збирає всі сторінки', async () => {
    const { service, calls } = serviceWith((req) => {
      if (req.url === '/login') return { data: { token: 'tok', token_type: 'bearer' } };
      const p = req.params.page;
      return p === 1 ? page([{ id: 1 }, { id: 2 }], 1, 2, 3) : page([{ id: 3 }], 2, 2, 3);
    });
    const rows = await service.getRawFuelCardHistory('2026-01-01', '2026-01-31');
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(calls.filter((c) => c.url === '/login')).toHaveLength(1);
    const history = calls.filter((c) => c.url === '/fuel-card-history');
    expect(history).toHaveLength(2);
    expect(history[0].headers.Authorization).toBe('Bearer tok');
    // date_to у UPG виключний, тож для включної межі 31.01 шлемо 01.02.
    expect(history[0].data).toBe('date_from=2026-01-01&date_to=2026-02-01');
  });

  it('переходить через межу року й місяця при виключному date_to', async () => {
    const { service, calls } = serviceWith((req) =>
      req.url === '/login' ? { data: { token: 't' } } : page([], 1, 1, 0),
    );
    await service.getRawFuelCardHistory('2026-12-01', '2026-12-31');
    expect(calls.find((c) => c.url === '/fuel-card-history').data).toBe('date_from=2026-12-01&date_to=2027-01-01');
  });

  it('кидає помилку, якщо отримано менше рядків, ніж заявлено', async () => {
    const { service } = serviceWith((req) =>
      req.url === '/login' ? { data: { token: 't' } } : page([{ id: 1 }], 1, 1, 5),
    );
    await expect(service.getRawFuelCardHistory('2026-01-01', '2026-01-31')).rejects.toThrow('1 з 5');
  });

  it('на 401 логіниться наново й повторює запит один раз', async () => {
    let logins = 0;
    let first = true;
    const { service } = serviceWith((req) => {
      if (req.url === '/login') return { data: { token: `t${++logins}` } };
      if (first) {
        first = false;
        throw Object.assign(new Error('unauthorized'), { response: { status: 401 } });
      }
      return page([{ id: 1 }], 1, 1, 1);
    });
    expect(await service.getRawFuelCardHistory('2026-01-01', '2026-01-02')).toHaveLength(1);
    expect(logins).toBe(2);
  });

  it('повідомлення про невдалий логін не містить пароля', async () => {
    const { service } = serviceWith(() => {
      throw Object.assign(new Error('boom'), { response: { status: 422 } });
    });
    await expect(service.getRawFuelCardHistory('2026-01-01', '2026-01-02')).rejects.toThrow('UPG /login: HTTP 422');
  });
});
