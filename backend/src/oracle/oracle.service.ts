import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// node-oracledb — це CommonJS `export =` модуль, а esModuleInterop вимкнено,
// тож default-імпорт дав би undefined. Використовуємо import-equals.
import oracledb = require('oracledb');

export interface OsRow {
  kod: string | number | null;
  pip: string | null;
}

/**
 * Підключення до Oracle через node-oracledb у THIN-режимі (без Oracle Instant Client —
 * чистий JS, працює на Node 14.6+). З'єднання беруться з пулу, який створюється лениво
 * при першому запиті. Креденшили — лише з .env, у коді жодних секретів.
 */
@Injectable()
export class OracleService implements OnModuleDestroy {
  private readonly logger = new Logger(OracleService.name);
  private pool: oracledb.Pool | null = null;
  private poolPromise: Promise<oracledb.Pool | null> | null = null;

  private readonly user: string;
  private readonly password: string;
  private readonly connectString: string;

  constructor(private readonly configService: ConfigService) {
    this.user = this.configService.get<string>('ORACLE_USER') ?? '';
    this.password = this.configService.get<string>('ORACLE_PASSWORD') ?? '';
    // Напр.: host:1521/SERVICE_NAME  або  host:1521/ORCL
    this.connectString =
      this.configService.get<string>('ORACLE_CONNECT_STRING') ??
      this.configService.get<string>('ORACLE_CONNECTION_STRING') ??
      '';

    if (!this.user || !this.password || !this.connectString) {
      this.logger.warn(
        'ORACLE_USER / ORACLE_PASSWORD / ORACLE_CONNECT_STRING не налаштовано — Oracle вимкнено',
      );
    }
  }

  private async getPool(): Promise<oracledb.Pool | null> {
    if (this.pool) return this.pool;
    if (!this.user || !this.password || !this.connectString) return null;
    if (this.poolPromise) return this.poolPromise;

    this.poolPromise = (async () => {
      try {
        this.logger.log(`Oracle: створюю пул з'єднань до ${this.connectString}`);
        this.pool = await oracledb.createPool({
          user: this.user,
          password: this.password,
          connectString: this.connectString,
          poolMin: 0,
          poolMax: 4,
          poolTimeout: 60,
        });
        return this.pool;
      } catch (error) {
        this.logger.error(`Oracle: не вдалося створити пул — ${error.message}`);
        this.poolPromise = null; // дозволяємо повторну спробу пізніше
        return null;
      }
    })();

    return this.poolPromise;
  }

  /** Чи налаштовано підключення (для статусу на сторінці). */
  isConfigured(): boolean {
    return Boolean(this.user && this.password && this.connectString);
  }

  /**
   * Виконати іменований запит. SQL — лише з коду (жодного довільного SQL ззовні),
   * binds — параметризовані. Повертає рядки як обʼєкти з нижнім регістром ключів.
   */
  private async run<T = any>(sql: string, binds: oracledb.BindParameters = {}): Promise<T[]> {
    const pool = await this.getPool();
    if (!pool) throw new Error('Oracle не налаштовано або пул недоступний');

    let conn: oracledb.Connection | undefined;
    try {
      conn = await pool.getConnection();
      const result = await conn.execute<T>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      return (result.rows ?? []) as T[];
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch {
          /* ignore close errors */
        }
      }
    }
  }

  /**
   * Викликає процедуру SetDateDelivered(pCodePost, pDocNumber, pDateDelivered) для
   * кожної доставленої накладної. Процедура працює як upsert (запис/оновлення дати
   * доставки за кодом пошти + номером). Один executeMany на весь батч, один commit.
   */
  async setDeliveredBatch(
    rows: Array<{ number: string; deliveredAt: Date }>,
    codePost?: string,
  ): Promise<number> {
    // Пишемо ЛИШЕ ті, де є дата доставки. Якщо дата null/невалідна — не викликаємо процедуру.
    const valid = rows.filter(
      (r) => r.number && r.deliveredAt instanceof Date && !isNaN(r.deliveredAt.getTime()),
    );
    if (!valid.length) return 0;

    const pool = await this.getPool();
    if (!pool) throw new Error('Oracle не налаштовано або пул недоступний');

    const proc = this.configService.get<string>('ORACLE_DELIVERED_PROC') ?? 'P_POST.SetDateDelivered';
    const code = codePost ?? this.configService.get<string>('ORACLE_POST_CODE') ?? 'NVP';

    const conn = await pool.getConnection();
    try {
      const sql = `BEGIN ${proc}(pCodePost => :code, pDocNumber => :doc, pDateDelivered => :dt); END;`;
      const binds = valid.map((r) => ({ code, doc: r.number, dt: r.deliveredAt }));
      await conn.executeMany(sql, binds, {
        autoCommit: true,
        bindDefs: {
          code: { type: oracledb.STRING, maxSize: 32 },
          doc: { type: oracledb.STRING, maxSize: 64 },
          dt: { type: oracledb.DATE },
        },
      });
      return valid.length;
    } finally {
      try {
        await conn.close();
      } catch {
        /* ignore */
      }
    }
  }

  /** select kod, pip from os */
  async getOs(): Promise<OsRow[]> {
    const rows = await this.run<Record<string, any>>('SELECT kod, pip FROM os');
    // Oracle повертає ключі у верхньому регістрі (KOD/PIP) — нормалізуємо.
    return rows.map((r) => ({
      kod: r.KOD ?? r.kod ?? null,
      pip: r.PIP ?? r.pip ?? null,
    }));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close(2);
      } catch {
        /* ignore */
      }
    }
  }
}
