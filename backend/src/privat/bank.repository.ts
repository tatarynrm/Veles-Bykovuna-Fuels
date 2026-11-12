import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import oracledb = require('oracledb');
import { oracleErrorText } from '../common/oracle-error';
import { OracleService } from '../oracle/oracle.service';
import { AddBankVParams, PRIVAT_BANK_IDNT } from './privat-bank.mapper';

const DEFAULT_PROC = 'P_BANK.AddBankV';

/**
 * Які транзакції банку вже лежать у BANKV (за ідентифікатором банку) у вікні [from, to] —
 * обидві межі включно. Вікно обмежене й зверху: при закачці за великий період кожне вікно
 * інакше вантажило б усю наступну історію. Ідентифікатор порівнюємо як є: процедура ключує за
 * `upper(банк_ID)`, а `ID` Привату — це великі літери й цифри, тож регістр не розходиться.
 */
const STORED_IDS_SQL = `select bank_trans_id as id
  from bankv
 where bank_idnt = :bank_idnt
   and doc_date >= to_date(:date_from, 'YYYY-MM-DD')
   and doc_date < to_date(:date_to, 'YYYY-MM-DD') + 1`;
const COUNT_SQL = `select count(*) as cnt from bankv where bank_idnt = :bank_idnt`;
/** Скільки збоїв підряд (без жодного успіху) вважаємо системною несправністю й зупиняємо пакет. */
const MAX_FAILURES_IN_A_ROW = 5;

export interface AddBankBatchResult {
  sent: number;
  /** Нових рядків у BANKV (різниця count до/після). */
  inserted: number;
  failed: number;
  /** Перші кілька помилок процедури — для статусу й логів. */
  errors: string[];
}

/**
 * Oracle-доступ для банківських транзакцій → `BANKV` через `P_BANK.AddBankV`. OracleService
 * лише позичає зʼєднання; увесь SQL — тут.
 *
 * Властивості процедури, що визначають цей код:
 *  - один виклик = одна транзакція;
 *  - дубль (`upper(банк_ID)`) вона мовчки пропускає й НЕ оновлює — тож «нові» рахуємо
 *    різницею count до/після;
 *  - COMMIT робить сама після кожного виклику, тому «одна транзакція на пакет» тут неможлива:
 *    збій посередині лишає вже записане записаним (це безпечно — повторний прохід дозапише решту).
 */
@Injectable()
export class BankRepository {
  private readonly logger = new Logger(BankRepository.name);
  readonly procedure: string;

  constructor(
    private readonly oracle: OracleService,
    config: ConfigService,
  ) {
    const proc = (config.get<string>('PRIVAT_BANK_PROC') ?? DEFAULT_PROC).trim();
    // Імʼя підставляється в PL/SQL-блок, тож пропускаємо лише ідентифікатор Oracle.
    const valid = /^[A-Za-z][\w$#]*(\.[A-Za-z][\w$#]*){0,2}$/.test(proc);
    if (!valid) this.logger.warn(`PRIVAT_BANK_PROC="${proc}" — некоректне імʼя, використовую ${DEFAULT_PROC}`);
    this.procedure = valid ? proc : DEFAULT_PROC;
  }

  /** Ідентифікатори Привату, уже записані в BANKV за вікно [dateFrom, dateTo] (YYYY-MM-DD, включно). */
  async getStoredIds(dateFrom: string, dateTo: string): Promise<Set<string>> {
    const rows = await this.oracle.query<{ ID: string }>(STORED_IDS_SQL, {
      bank_idnt: PRIVAT_BANK_IDNT,
      date_from: dateFrom,
      date_to: dateTo,
    });
    return new Set(rows.map((r) => String(r.ID).toUpperCase()));
  }

  /** Викликає `AddBankV` для кожного рядка на спільному зʼєднанні. Рядок, що впав, пропускається. */
  async addBatch(rows: AddBankVParams[]): Promise<AddBankBatchResult> {
    if (!rows.length) return { sent: 0, inserted: 0, failed: 0, errors: [] };

    // Дата іде рядком і перетворюється в самому блоці: так результат не залежить від
    // часового поясу процесу Node (як і в gps-синку).
    const sql = `BEGIN ${this.procedure}(
      pBankIdnt => :bank_idnt,
      pBankTransId => :bank_trans_id,
      pDk => :dk,
      pDocDate => TO_DATE(:doc_date, 'YYYY-MM-DD"T"HH24:MI:SS'),
      pDocNumber => :doc_number,
      pFirmaEdrpou => :firma_edrpou,
      pFirmaIban => :firma_iban,
      pFirmaMfo => :firma_mfo,
      pFirmaName => :firma_name,
      pPrizn => :prizn,
      pSuma => :suma,
      pSumaUah => :suma_uah,
      pUrBankCity => :ur_bank_city,
      pUrBankName => :ur_bank_name,
      pUrEdrpou => :ur_edrpou,
      pUrIban => :ur_iban,
      pUrMfo => :ur_mfo,
      pUrName => :ur_name,
      pValutIdnt => :valut_idnt
    ); END;`;

    return this.oracle.withConnection(async (conn) => {
      const count = async () => {
        const result = await conn.execute<{ CNT: number }>(
          COUNT_SQL,
          { bank_idnt: PRIVAT_BANK_IDNT },
          { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        return Number(result.rows?.[0]?.CNT ?? 0);
      };

      const before = await count();
      let failed = 0;
      let sent = 0;
      let streak = 0;
      const errors: string[] = [];
      for (const row of rows) {
        try {
          await conn.execute(sql, bindsOf(row), { autoCommit: false });
          sent++;
          streak = 0;
        } catch (error: any) {
          failed++;
          streak++;
          if (errors.length < 5) {
            errors.push(`${row.bank_trans_id}: ${oracleErrorText(error)}`);
          }
          // Кілька збоїв підряд — це не «поганий рядок», а несправна процедура/таблиця (напр. тригер
          // INVALID після перебудови BANKV). Далі гатити нею сотні рядків марно: наступний прохід
          // за розкладом спробує знову, а все, що не встигли, він дозапише.
          if (streak >= MAX_FAILURES_IN_A_ROW && sent === 0) {
            this.logger.error(
              `${this.procedure}: ${streak} збоїв підряд на самому початку — зупиняю пакет (решта ${rows.length - failed} рядків не пробувалась). ${errors[0]}`,
            );
            break;
          }
        }
      }
      const inserted = (await count()) - before;

      if (failed) {
        this.logger.warn(`${this.procedure}: ${failed}/${rows.length} рядків з помилкою, напр. ${errors[0]}`);
      }
      return { sent, inserted, failed, errors };
    });
  }
}

/** Типи вказуємо явно: для `null` node-oracledb не може вивести тип бінду сам. */
function bindsOf(row: AddBankVParams): Record<string, { val: string | number | null; type: number }> {
  const out: Record<string, { val: string | number | null; type: number }> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = {
      val: value === undefined ? null : value,
      type: typeof value === 'number' ? oracledb.NUMBER : oracledb.STRING,
    };
  }
  return out;
}
