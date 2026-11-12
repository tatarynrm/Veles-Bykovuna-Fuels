/** Налаштування синхронізації одного паливного вендора. */
export interface FuelVendorConfig {
  enabled: boolean;
  /** Звідки качати при повній закачці або порожній таблиці, YYYY-MM-DD. */
  startDate: string;
}

export interface FuelSyncConfig {
  /** Коли запускати, місцевий час: ["09:00", "15:00"]. */
  times: string[];
  /** Скільки останніх днів перечитувати щоразу. */
  lookbackDays: number;
  okko: FuelVendorConfig;
  shell: FuelVendorConfig;
  upg: FuelVendorConfig;
}

export interface NovaPoshtaSyncConfig {
  enabled: boolean;
  everyHours: number;
  windowDays: number;
}

export interface GpsSyncConfig {
  enabled: boolean;
  everyMinutes: number;
}

export interface PrivatSyncConfig {
  enabled: boolean;
  /** Крок запуску, годин (1 = щогодини о :00). */
  everyHours: number;
  /** Скільки ПОПЕРЕДНІХ днів читати разом із сьогоднішнім (0 = лише сьогодні). */
  lookbackDays: number;
}

export interface SyncConfig {
  fuel: FuelSyncConfig;
  novaposhta: NovaPoshtaSyncConfig;
  gps: GpsSyncConfig;
  privat: PrivatSyncConfig;
}

/** Стан читання файлу — показуємо на сторінках синхронізації. */
export interface SyncConfigStatus {
  file: string;
  exists: boolean;
  loadedAt: string | null;
  /** Помилка останньої спроби читання; значення при цьому лишаються попередні справні. */
  error: string | null;
}
