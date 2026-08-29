import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// node-oracledb — це CommonJS `export =` модуль, а esModuleInterop вимкнено,
// тож default-імпорт дав би undefined. Використовуємо import-equals.
import oracledb = require('oracledb');

/**
 * Pure Oracle **access layer** (node-oracledb, THIN mode — no Instant Client).
 * Owns the lazy connection pool and generic execution primitives ONLY. It holds
 * **no business SQL**: every feature keeps its own SQL in a repository next to the
 * code that uses it (e.g. `gps/gps.repository.ts`, `novaposhta/deliveries.repository.ts`,
 * `oracle/os.repository.ts`) and calls `query` / `withConnection` here. Credentials
 * come from .env; nothing is hardcoded, and a missing config disables the vendor.
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
   * Borrow a pooled connection for one unit of work and always release it. The
   * callback owns commit/rollback (autoCommit is off unless it opts in), so a
   * repository can batch many statements in a single transaction.
   */
  async withConnection<T>(fn: (conn: oracledb.Connection) => Promise<T>): Promise<T> {
    const pool = await this.getPool();
    if (!pool) throw new Error('Oracle не налаштовано або пул недоступний');

    const conn = await pool.getConnection();
    try {
      return await fn(conn);
    } finally {
      try {
        await conn.close();
      } catch {
        /* ignore close errors */
      }
    }
  }

  /**
   * Run a parameterised query and return the rows as objects. SQL comes from the
   * calling repository (never arbitrary input); Oracle returns UPPERCASE keys.
   */
  async query<T = any>(sql: string, binds: oracledb.BindParameters = {}): Promise<T[]> {
    return this.withConnection(async (conn) => {
      const result = await conn.execute<T>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      return (result.rows ?? []) as T[];
    });
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
