import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { FuelVendorConfig, SyncConfig, SyncConfigStatus } from './sync-config.types';

const FILE_NAME = 'sync-config.json';
const RELOAD_DEBOUNCE_MS = 300;

/** Значення, якщо файлу немає або ключ у ньому пропущено. */
const DEFAULTS: SyncConfig = {
  fuel: {
    times: ['09:00', '15:00'],
    lookbackDays: 7,
    okko: { enabled: false, startDate: '2025-01-01' },
    shell: { enabled: false, startDate: '2025-01-01' },
  },
  novaposhta: { enabled: true, everyHours: 3, windowDays: 40 },
  gps: { enabled: false, everyMinutes: 1 },
};

/**
 * Прибирає рядкові та блокові коментарі поза рядками — щоб конфіг можна було коментувати.
 * Саморобний сканер, а не регулярка: регулярка зіпсувала б «https://…» всередині значень.
 */
export function stripJsonComments(text: string): string {
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inLine) {
      if (c === '\n') {
        inLine = false;
        out += c;
      }
      continue;
    }
    if (inBlock) {
      if (c === '*' && next === '/') {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i++;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === '/' && next === '/') {
      inLine = true;
      i++;
      continue;
    }
    if (c === '/' && next === '*') {
      inBlock = true;
      i++;
      continue;
    }
    out += c;
  }
  return out;
}

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

const int = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : fallback;
};

const ymd = (v: unknown, fallback: string): string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : fallback;

/** "09:00" → { hour: 9, minute: 0 }; інакше null. */
export function parseTime(value: unknown): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : null;
}

const timeList = (v: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(v)) return fallback;
  const valid = [...new Set(v.filter((x) => parseTime(x)).map((x) => String(x).trim()))].sort();
  return valid.length ? valid : fallback;
};

/**
 * Налаштування фонових синхронізацій із локального файлу `backend/sync-config.json`
 * (шлях можна змінити через `SYNC_CONFIG_FILE`). Файл редагується руками просто на
 * сервері й перечитується на льоту, тож розклад міняється без перезапуску і без БД.
 *
 * Стійкість важливіша за строгість: биті або відсутні значення мовчки заміняються
 * дефолтами, а якщо файл узагалі не читається — лишаються попередні справні значення
 * (у статусі видно `error`). Прапорці `enabled` і стартові дати можна задавати й у .env:
 * файл має пріоритет, env лишається запасним варіантом для сумісності.
 */
@Injectable()
export class SyncConfigService implements OnModuleDestroy {
  private readonly logger = new Logger(SyncConfigService.name);
  private readonly file: string;
  private config: SyncConfig;
  private loadedAt: string | null = null;
  private error: string | null = null;
  private watcher: fs.FSWatcher | null = null;
  private reloadTimer: NodeJS.Timeout | null = null;
  private readonly listeners = new Set<(config: SyncConfig) => void>();

  constructor(private readonly env: ConfigService) {
    this.file = this.resolveFile();
    this.config = this.read();
    this.watch();
  }

  /** Поточні налаштування — уже з дефолтами, читати можна будь-коли. */
  get(): SyncConfig {
    return this.config;
  }

  getStatus(): SyncConfigStatus {
    return {
      file: this.file,
      exists: fs.existsSync(this.file),
      loadedAt: this.loadedAt,
      error: this.error,
    };
  }

  /** Підписка на зміни файлу — планувальник на неї перебудовує завдання. */
  onChange(listener: (config: SyncConfig) => void): void {
    this.listeners.add(listener);
  }

  /** Перечитати негайно (використовують і спостерігач за файлом, і тести). */
  reload(): SyncConfig {
    const next = this.read();
    const changed = JSON.stringify(next) !== JSON.stringify(this.config);
    this.config = next;
    if (changed) {
      this.logger.log('Налаштування синхронізацій перечитано');
      for (const listener of this.listeners) {
        try {
          listener(next);
        } catch (e) {
          this.logger.error(`Слухач налаштувань впав: ${e?.message ?? e}`);
        }
      }
    }
    return next;
  }

  private resolveFile(): string {
    const fromEnv = this.env.get<string>('SYNC_CONFIG_FILE');
    if (fromEnv) return path.resolve(fromEnv);
    // PM2 і dev-режим запускають бекенд із cwd=backend/, зібраний код лежить у dist/.
    const candidates = [
      path.resolve(process.cwd(), FILE_NAME),
      path.resolve(__dirname, '..', '..', FILE_NAME),
      path.resolve(__dirname, '..', '..', '..', FILE_NAME),
    ];
    return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
  }

  private read(): SyncConfig {
    let raw: any = {};
    try {
      if (fs.existsSync(this.file)) {
        raw = JSON.parse(stripJsonComments(fs.readFileSync(this.file, 'utf8'))) ?? {};
        this.error = null;
        this.loadedAt = new Date().toISOString();
      } else {
        this.error = `Файл ${this.file} не знайдено — працюю на значеннях за замовчуванням`;
        this.logger.warn(this.error);
      }
    } catch (e) {
      // Битий файл не має зупиняти синхронізації — лишаємо попередні справні значення.
      this.error = `${path.basename(this.file)}: ${e?.message ?? e}`;
      this.logger.error(`Не вдалося прочитати налаштування — ${this.error}`);
      return this.config ?? DEFAULTS;
    }

    const fuel = raw.fuel ?? {};
    const np = raw.novaposhta ?? {};
    const gps = raw.gps ?? {};
    return {
      fuel: {
        times: timeList(fuel.times, DEFAULTS.fuel.times),
        lookbackDays: int(fuel.lookbackDays, DEFAULTS.fuel.lookbackDays, 0, 365),
        okko: this.vendor(fuel.okko, 'OKKO_SYNC_ENABLED', 'OKKO_SYNC_START', DEFAULTS.fuel.okko),
        shell: this.vendor(fuel.shell, 'SHELL_SYNC_ENABLED', 'SHELL_SYNC_START', DEFAULTS.fuel.shell),
      },
      novaposhta: {
        enabled: bool(np.enabled, DEFAULTS.novaposhta.enabled),
        everyHours: int(np.everyHours, DEFAULTS.novaposhta.everyHours, 1, 24),
        windowDays: int(np.windowDays, DEFAULTS.novaposhta.windowDays, 1, 365),
      },
      gps: {
        enabled: bool(gps.enabled, this.envBool('GPS_SYNC_ENABLED', DEFAULTS.gps.enabled)),
        everyMinutes: int(gps.everyMinutes, DEFAULTS.gps.everyMinutes, 1, 1440),
      },
    };
  }

  private vendor(raw: any, enabledEnv: string, startEnv: string, fallback: FuelVendorConfig): FuelVendorConfig {
    return {
      enabled: bool(raw?.enabled, this.envBool(enabledEnv, fallback.enabled)),
      startDate: ymd(raw?.startDate, ymd(this.env.get<string>(startEnv), fallback.startDate)),
    };
  }

  private envBool(key: string, fallback: boolean): boolean {
    const value = this.env.get<string>(key);
    return value === undefined ? fallback : String(value).trim().toLowerCase() === 'true';
  }

  private watch(): void {
    try {
      // Редактори часто зберігають через тимчасовий файл, тож стежимо за текою.
      this.watcher = fs.watch(path.dirname(this.file), (_event, name) => {
        if (name && path.basename(name) !== path.basename(this.file)) return;
        if (this.reloadTimer) clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(() => this.reload(), RELOAD_DEBOUNCE_MS);
      });
      this.logger.log(`Налаштування синхронізацій: ${this.file} (зміни підхоплюються без перезапуску)`);
    } catch (e) {
      this.logger.warn(`Не вдалося стежити за ${this.file}: ${e?.message ?? e}`);
    }
  }

  onModuleDestroy(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.watcher?.close();
  }
}
