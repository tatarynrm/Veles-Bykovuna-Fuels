export type FuelVendor = 'OKKO' | 'SHELL';

/**
 * JSON-контракт процедури `VELDAT.P_API_TRUCK_PAY.save_transaction(p_json CLOB)`, що
 * пише в таблицю `TZ_TRANS`. Ключі — рівно ті, які процедура читає через
 * `JSON_OBJECT_T.get_*`, у нижньому регістрі. Дати — рядки `YYYY-MM-DDTHH:MM:SS`
 * (місцевий час вендора): цей формат приймають і `get_date`, і `get_timestamp`.
 * `null` у JSON не потрапляє — ключ просто пропускається (див. toProcedureJson).
 */
export interface TruckPayRow {
  /** Бренд: 'OKKO' | 'SHELL' — частина ключа дедуплікації cctrans. */
  api_brend: FuelVendor;
  /** Унікальний ID рядка у вендора — частина ключа дедуплікації cctrans. */
  api_transaction_id: string;
  /** Дата й час операції. */
  api_dat: string;
  /** № картки (повний). */
  api_cc: string | null;
  api_adresa: string | null;
  /** ID станції (код АЗС). */
  api_station: string | null;
  /** № чека. */
  api_chek: string | null;
  /** Кількість (літри для пального). */
  api_kil: number | null;
  api_km: number | null;
  /** ISO-код країни операції. */
  api_kraina: string | null;
  api_valut: string | null;
  /** Ціна для нас / повна / знижки — за одиницю. */
  api_cina: number | null;
  api_cinafull: number | null;
  api_cinazn: number | null;
  /** Сума для нас / повна / знижки. */
  api_suma: number | null;
  api_sumafull: number | null;
  api_sumazn: number | null;
  api_pdv: number | null;
  /** % знижки, NUMBER(5,2). */
  api_przn: number | null;
  /** 1 — сума додатна, але її треба відняти (повернення, кредит). */
  api_minus: 0 | 1;
  /** Операція: «код назва». */
  api_oper: string | null;
  /** Тип палива / товар: «код назва». */
  api_pal: string | null;
  api_os: string | null;
  api_tz: string | null;
  api_rahnum: string | null;
  api_rahdat: string | null;
}

export type SyncMode = 'incremental' | 'full';
export type SyncTrigger = 'cron' | 'manual';
export type SyncWindowStatus = 'pending' | 'active' | 'done' | 'error';

/** Одне вікно періоду (≤ 1 місяць) у живому прогресі проходу. */
export interface SyncWindowProgress {
  from: string;
  to: string;
  status: SyncWindowStatus;
  /** Рядків отримано від API вендора. */
  fetched: number;
  /** Відфільтровано — у TZ_TRANS не пишемо (див. config.skippedLabel). */
  skipped: number;
  /** Процедура прийняла без помилки (нові + ті, що вже були в базі). */
  sent: number;
  /** З них нових рядків у TZ_TRANS. */
  inserted: number;
  /** Процедура кинула помилку. */
  failed: number;
  error: string | null;
  /** Коли вікно завершилось (ISO). */
  at: string | null;
}

export interface FuelSyncRun {
  at: string;
  mode: SyncMode;
  trigger: SyncTrigger;
  from: string;
  to: string;
  fetched: number;
  skipped: number;
  sent: number;
  inserted: number;
  failed: number;
  durationMs: number;
  ok: boolean;
  error: string | null;
}

/** Знімок для сторінки /workflow/sync/{okko,shell} (GET /api/fuel-sync/:vendor). */
export interface FuelSyncStatus {
  vendor: FuelVendor;
  /** Прапорець OKKO_SYNC_ENABLED / SHELL_SYNC_ENABLED. */
  enabled: boolean;
  oracleConfigured: boolean;
  running: boolean;
  startedAt: string | null;
  mode: SyncMode | null;
  trigger: SyncTrigger | null;
  /** Період поточного або останнього проходу. */
  period: { from: string; to: string } | null;
  windowsTotal: number;
  windowsDone: number;
  windows: SyncWindowProgress[];
  lastRun: FuelSyncRun | null;
  nextRunAt: string | null;
  config: {
    cron: string;
    cronLabel: string;
    startDate: string;
    lookbackDays: number;
    windowDays: number;
    procedure: string;
    skippedLabel: string;
  };
}

export interface SaveBatchResult {
  sent: number;
  inserted: number;
  failed: number;
  /** Перші кілька помилок процедури, для сторінки й логів. */
  errors: string[];
}
