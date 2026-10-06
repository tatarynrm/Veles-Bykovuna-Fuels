import { FuelSyncBase } from './fuel-sync.base';
import { TruckPayRow } from './fuel-sync.types';
import { SyncConfig } from '../config/sync-config.types';

const CONFIG_FILE = 'D:/проєкт/backend/sync-config.json';

const configOf = (enabled: boolean, times = ['09:00', '15:00'], lookbackDays = 7): SyncConfig => ({
  fuel: {
    times,
    lookbackDays,
    okko: { enabled, startDate: '2025-01-01' },
    shell: { enabled, startDate: '2025-01-01' },
  },
  novaposhta: { enabled: true, everyHours: 3, windowDays: 40 },
  gps: { enabled: false, everyMinutes: 1 },
});

/** Мінімальний нащадок із заглушками замість вендора й Oracle — перевіряємо лише запуск. */
class TestSync extends FuelSyncBase {
  windowsSeen: Array<{ from: string; to: string }> = [];

  constructor(enabled = true, config: SyncConfig = configOf(enabled)) {
    const syncConfig = {
      get: () => config,
      getStatus: () => ({ file: CONFIG_FILE, exists: true, loadedAt: null, error: null }),
      onChange: () => undefined,
    } as any;
    const oracle = { isConfigured: () => true } as any;
    const repo = {
      procedure: 'P_API_TRUCK_PAY.save_transaction',
      getLastDate: async () => null,
      getExistingIds: async () => new Set<string>(),
      saveBatch: async () => ({ sent: 0, inserted: 0, failed: 0, errors: [] }),
    } as any;
    super({ vendor: 'OKKO', key: 'okko', windowDays: 30, skippedLabel: 'тест' }, syncConfig, oracle, repo);
  }

  protected async fetchWindow(from: string, to: string): Promise<any[]> {
    this.windowsSeen.push({ from, to });
    return [];
  }
  protected shouldSync(): boolean {
    return true;
  }
  protected map(): TruckPayRow {
    throw new Error('не викликається — вендор повертає порожньо');
  }
}

describe('ручний запуск', () => {
  it('приймає коректний період', async () => {
    const sync = new TestSync();
    const res = sync.start('period', { from: '2026-10-01', to: '2026-10-06' });
    expect(res.started).toBe(true);
    expect(res.message).toContain('2026-10-01');
    await new Promise((r) => setTimeout(r, 10));
    expect(sync.windowsSeen).toEqual([{ from: '2026-10-01', to: '2026-10-06' }]);
  });

  it('відхиляє неправильні дати', () => {
    const sync = new TestSync();
    expect(sync.start('period', { from: '06.10.2026', to: '2026-10-06' }).started).toBe(false);
    expect(sync.start('period', {}).started).toBe(false);
    const reversed = sync.start('period', { from: '2026-10-07', to: '2026-10-01' });
    expect(reversed.started).toBe(false);
    expect(reversed.message).toContain('пізніший');
  });

  it('за замовчуванням бере останні дні з налаштувань', () => {
    const res = new TestSync().start('recent');
    expect(res.started).toBe(true);
    expect(res.message).toContain('останні 7 дн.');
  });

  it('не запускається, доки вимкнено у файлі налаштувань', () => {
    const res = new TestSync(false).start('recent');
    expect(res.started).toBe(false);
    expect(res.message).toContain('fuel.okko.enabled');
    expect(res.message).toContain(CONFIG_FILE);
  });
});

describe('статус', () => {
  it('показує розклад, наступний запуск і шлях до файлу налаштувань', () => {
    const status = new TestSync().getStatus();
    expect(status.config.cronLabel).toBe('щодня о 09:00 і 15:00');
    expect(status.config.cron).toBe('0 0 9 * * * · 0 0 15 * * *');
    expect(status.config.configFile).toBe(CONFIG_FILE);
    expect([9, 15]).toContain(new Date(status.nextRunAt as string).getHours());
  });

  it('підхоплює інші часи й період просто зі зміненого файлу', () => {
    const sync = new TestSync(true, configOf(true, ['06:30'], 14));
    const status = sync.getStatus();
    expect(status.config.cronLabel).toBe('щодня о 06:30');
    expect(status.config.cron).toBe('0 30 6 * * *');
    expect(status.config.lookbackDays).toBe(14);
    expect(new Date(status.nextRunAt as string).getHours()).toBe(6);
  });
});
