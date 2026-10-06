import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import oracledb = require('oracledb');
import { OracleService } from '../oracle/oracle.service';
import { toProcedureJson } from './fuel-sync.mapper';
import { FuelVendor, SaveBatchResult, TruckPayRow } from './fuel-sync.types';

const DEFAULT_PROC = 'P_API_TRUCK_PAY.save_transaction';

/** Остання записана дата бренду — від неї інкрементальний прохід рахує запас назад. */
const LAST_DAT_SQL = `select to_char(max(api_dat), 'YYYY-MM-DD') as last_dat from tz_trans where api_brend = :brend`;

/**
 * Ідентифікатори бренду, вже записані за цей період. Повторно їх не надсилаємо:
 * процедура й сама пропускає дублі за `cctrans`, але той ключ містить дату з часом, тож
 * будь-яка зміна `api_dat` робила б наявні рядки «невидимими» і вони вставлялись би вдруге.
 * Звірка за `api_transaction_id` від формату ключа не залежить (і економить тисячі викликів).
 */
const EXISTING_IDS_SQL = `select api_transaction_id as id
  from tz_trans
 where api_brend = :brend
   and api_dat >= to_date(:dat_from, 'YYYY-MM-DD')
   and api_dat < to_date(:dat_to, 'YYYY-MM-DD') + 1`;
const COUNT_SQL = `select count(*) as cnt from tz_trans where api_brend = :brend`;

/**
 * Oracle-доступ для транзакцій паливних карток → `TZ_TRANS` через
 * `P_API_TRUCK_PAY.save_transaction(p_json CLOB)`. OracleService лише позичає зʼєднання.
 *
 * Властивості процедури, що визначають цей код:
 *  - один виклик = одна транзакція (JSON-обʼєкт з ключами api_*);
 *  - дубль — за `cctrans = brend_дата_картка_transaction_id`; наявний рядок процедура
 *    мовчки пропускає і НЕ оновлює, тож «нові» рахуємо різницею count до/після;
 *  - COMMIT не робить — комітимо самі, одним на вікно.
 */
@Injectable()
export class TruckPayRepository {
  private readonly logger = new Logger(TruckPayRepository.name);
  readonly procedure: string;

  constructor(
    private readonly oracle: OracleService,
    config: ConfigService,
  ) {
    const proc = (config.get<string>('TRUCK_PAY_PROC') ?? DEFAULT_PROC).trim();
    // Імʼя підставляється в PL/SQL-блок, тож пропускаємо лише ідентифікатор Oracle.
    const valid = /^[A-Za-z][\w$#]*(\.[A-Za-z][\w$#]*){0,2}$/.test(proc);
    if (!valid) this.logger.warn(`TRUCK_PAY_PROC="${proc}" — некоректне імʼя, використовую ${DEFAULT_PROC}`);
    this.procedure = valid ? proc : DEFAULT_PROC;
  }

  async getLastDate(vendor: FuelVendor): Promise<string | null> {
    const rows = await this.oracle.query<{ LAST_DAT: string | null }>(LAST_DAT_SQL, { brend: vendor });
    return rows[0]?.LAST_DAT ?? null;
  }

  /** Які транзакції бренду за період уже лежать у TZ_TRANS (за вендорським id). */
  async getExistingIds(vendor: FuelVendor, from: string, to: string): Promise<Set<string>> {
    const rows = await this.oracle.query<{ ID: string }>(EXISTING_IDS_SQL, {
      brend: vendor,
      dat_from: from,
      dat_to: to,
    });
    return new Set(rows.map((r) => String(r.ID)));
  }
  /**
   * Передає рядки в процедуру по одному на спільному зʼєднанні й комітить раз у кінці.
   * Рядок, що впав, пропускається (перші помилки повертаються), решта комітиться.
   */
  async saveBatch(vendor: FuelVendor, rows: TruckPayRow[]): Promise<SaveBatchResult> {
    if (!rows.length) return { sent: 0, inserted: 0, failed: 0, errors: [] };

    const sql = `BEGIN ${this.procedure}(p_json => :p_json); END;`;
    return this.oracle.withConnection(async (conn) => {
      const count = async () => {
        const result = await conn.execute<{ CNT: number }>(COUNT_SQL, { brend: vendor }, {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        });
        return Number(result.rows?.[0]?.CNT ?? 0);
      };

      const before = await count();
      let failed = 0;
      const errors: string[] = [];
      for (const row of rows) {
        try {
          // JSON рядка ~1–2 КБ: STRING-бінд у CLOB-параметр PL/SQL конвертується неявно.
          await conn.execute(sql, { p_json: { val: toProcedureJson(row), type: oracledb.STRING } }, {
            autoCommit: false,
          });
        } catch (error) {
          failed++;
          if (errors.length < 5) {
            errors.push(`${row.api_transaction_id}: ${String(error?.message ?? error).split('\n')[0]}`);
          }
        }
      }
      await conn.commit();
      const inserted = (await count()) - before;

      if (failed) {
        this.logger.warn(`${this.procedure} (${vendor}): ${failed}/${rows.length} рядків з помилкою, напр. ${errors[0]}`);
      }
      return { sent: rows.length - failed, inserted, failed, errors };
    });
  }
}
