import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SyncConfigService, stripJsonComments } from './sync-config.service';

const envOf = (values: Record<string, string> = {}) => ({ get: (key: string) => values[key] }) as any;

/** Пише тимчасовий конфіг і віддає службу, що його читає. */
function withFile(content: string, env: Record<string, string> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-config-'));
  const file = path.join(dir, 'sync-config.json');
  fs.writeFileSync(file, content, 'utf8');
  const service = new SyncConfigService(envOf({ ...env, SYNC_CONFIG_FILE: file }));
  return { service, file, cleanup: () => service.onModuleDestroy() };
}

describe('stripJsonComments', () => {
  it('прибирає коментарі, але не чіпає їх усередині рядків', () => {
    const text = '{\n // рядковий\n "a": "https://example.com", /* блоковий */ "b": "// не коментар"\n}';
    expect(JSON.parse(stripJsonComments(text))).toEqual({ a: 'https://example.com', b: '// не коментар' });
  });
});

describe('SyncConfigService', () => {
  it('читає файл із коментарями', () => {
    const { service, cleanup } = withFile(`{
      // розклад
      "fuel": { "times": ["06:30", "22:00"], "lookbackDays": 14,
                "okko": { "enabled": true, "startDate": "2025-03-01" } },
      "gps": { "enabled": true, "everyMinutes": 5 }
    }`);
    const config = service.get();
    expect(config.fuel.times).toEqual(['06:30', '22:00']);
    expect(config.fuel.lookbackDays).toBe(14);
    expect(config.fuel.okko).toEqual({ enabled: true, startDate: '2025-03-01' });
    expect(config.gps).toEqual({ enabled: true, everyMinutes: 5 });
    // Пропущені секції — зі значень за замовчуванням.
    expect(config.novaposhta).toEqual({ enabled: true, everyHours: 3, windowDays: 40 });
    cleanup();
  });

  it('ігнорує биті значення замість того, щоб падати', () => {
    const { service, cleanup } = withFile(`{
      "fuel": { "times": ["25:00", "вранці"], "lookbackDays": -5, "shell": { "startDate": "01.03.2025" } },
      "novaposhta": { "everyHours": 999 }
    }`);
    const config = service.get();
    expect(config.fuel.times).toEqual(['09:00', '15:00']);
    expect(config.fuel.lookbackDays).toBe(7);
    expect(config.fuel.shell.startDate).toBe('2025-01-01');
    expect(config.novaposhta.everyHours).toBe(3);
    cleanup();
  });

  it('бере значення з .env, доки їх немає у файлі', () => {
    const { service, cleanup } = withFile('{}', { OKKO_SYNC_ENABLED: 'true', OKKO_SYNC_START: '2024-06-01' });
    expect(service.get().fuel.okko).toEqual({ enabled: true, startDate: '2024-06-01' });
    cleanup();
  });

  it('перечитує змінений файл і повідомляє підписників', () => {
    const { service, file, cleanup } = withFile('{ "fuel": { "times": ["09:00"] } }');
    const seen: string[][] = [];
    service.onChange((c) => seen.push(c.fuel.times));

    fs.writeFileSync(file, '{ "fuel": { "times": ["07:45", "19:15"] } }', 'utf8');
    expect(service.reload().fuel.times).toEqual(['07:45', '19:15']);
    expect(seen).toEqual([['07:45', '19:15']]);
    cleanup();
  });

  it('тримає останні справні значення, якщо файл зіпсували', () => {
    const { service, file, cleanup } = withFile('{ "fuel": { "lookbackDays": 21 } }');
    expect(service.get().fuel.lookbackDays).toBe(21);

    fs.writeFileSync(file, '{ "fuel": { зламано', 'utf8');
    expect(service.reload().fuel.lookbackDays).toBe(21);
    expect(service.getStatus().error).toContain('sync-config.json');
    cleanup();
  });

  it('без файлу працює на значеннях за замовчуванням', () => {
    const service = new SyncConfigService(envOf({ SYNC_CONFIG_FILE: path.join(os.tmpdir(), 'немає-такого.json') }));
    expect(service.get().fuel.times).toEqual(['09:00', '15:00']);
    expect(service.getStatus().exists).toBe(false);
    service.onModuleDestroy();
  });
});
