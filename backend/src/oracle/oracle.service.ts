import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// node-oracledb — це CommonJS `export =` модуль, а esModuleInterop вимкнено,
// тож default-імпорт дав би undefined. Використовуємо import-equals.
import oracledb = require('oracledb');

/** Помилки, після яких з'єднання непридатне: таймаут виклику, обрив, «end-of-file on channel». */
const BROKEN_CONNECTION = /DPI-1067|NJS-123|DPI-1080|ORA-03113|ORA-03114|ORA-03135|ORA-01013|NJS-500|NJS-503|ORA-12170/;

function positiveInt(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

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
  private readonly holders = new Map<number, { caller: string; since: number }>();
  private holderSeq = 0;
  private readonly callTimeoutMs: number;
  private readonly queueTimeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.callTimeoutMs = positiveInt(this.configService.get('ORACLE_CALL_TIMEOUT_MS'), 120_000);
    this.queueTimeoutMs = positiveInt(this.configService.get('ORACLE_QUEUE_TIMEOUT_MS'), 60_000);
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
          // Вільне з'єднання закривається через 60 с простою.
          poolTimeout: 60,
          // Keepalive: кожну хвилину простою з'єднання «тикається» до БД, щоб фаєрвол / профіль
          // не рвав його мовчки (мертве з'єднання в пулі інакше висить до таймауту TCP).
          expireTime: 1,
          // Скільки (мс) запит чекає вільного слота, поки всі зайняті, — тоді NJS-040.
          queueTimeout: this.queueTimeoutMs,
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
    // Хто викликав: перший рядок стеку поза цим файлом — для діагностики «хто тримає слот».
    const caller = (new Error().stack ?? '')
      .split('\n')
      .slice(2)
      .find((l) => !l.includes('oracle.service'))
      ?.trim()
      .replace(/^at /, '')
      .replace(/\(.*[\\/]src[\\/]/, '(') ?? '?';
    const pool = await this.getPool();
    if (!pool) throw new Error('Oracle не налаштовано або пул недоступний');

    const waitStart = Date.now();
    let conn: oracledb.Connection;
    try {
      conn = await pool.getConnection();
    } catch (error: any) {
      if (/NJS-040/.test(String(error?.message))) {
        this.logger.error(`Oracle: слота не дочекались — ${this.describePool(pool)}; тримають: ${this.describeHolders()}`);
      }
      throw error;
    }
    const waited = Date.now() - waitStart;
    if (waited > 3000) {
      this.logger.warn(
        `Oracle: слот чекали ${waited} мс — ${this.describePool(pool)}; тримають: ${this.describeHolders()}`,
      );
    }
    const holderId = ++this.holderSeq;
    this.holders.set(holderId, { caller, since: Date.now() });
    // Верхня межа на ОДИН виклик до БД (мс): завислий виклик (блокування, обрив мережі) переривається
    // помилкою, а не тримає слот пулу вічно.
    conn.callTimeout = this.callTimeoutMs;

    let drop = false;
    try {
      return await fn(conn);
    } catch (error: any) {
      // Таймаут чи обрив — з'єднання в невизначеному стані: не повертаємо його в пул.
      if (BROKEN_CONNECTION.test(String(error?.message ?? error))) {
        drop = true;
        this.logger.error(
          `Oracle: з'єднання відкидаю (${String(error.message).split('\n')[0]}) — ${this.describePool(pool)}`,
        );
      }
      throw error;
    } finally {
      try {
        // УВАГА: `close(undefined)` кидає NJS-005 і тихо лишає з'єднання «зайнятим» назавжди —
        // тому два окремі виклики, а не `close(drop ? {drop:true} : undefined)`.
        if (drop) await conn.close({ drop: true });
        else await conn.close();
      } catch (closeError: any) {
        // Не ковтаємо мовчки: невдале закриття = слот пулу втрачено.
        this.logger.error(`Oracle: не вдалося повернути з'єднання в пул — ${closeError?.message}`);
      } finally {
        this.holders.delete(holderId);
      }
    }
  }

  /** Стан пулу для логів і діагностики: з'єднання відкрито / зайнято і хто саме їх тримає. */
  getPoolStats() {
    if (!this.pool) return null;
    return {
      open: this.pool.connectionsOpen,
      inUse: this.pool.connectionsInUse,
      max: this.pool.poolMax,
      holders: [...this.holders.values()].map((h) => ({
        caller: h.caller,
        heldSeconds: Math.round((Date.now() - h.since) / 1000),
      })),
    };
  }

  private describeHolders(): string {
    const list = [...this.holders.values()];
    return list.length
      ? list.map((h) => `${h.caller} (${Math.round((Date.now() - h.since) / 1000)} с)`).join('; ')
      : 'ніхто з withConnection (!)';
  }

  private describePool(pool: oracledb.Pool): string {
    return `пул: відкрито ${pool.connectionsOpen}, зайнято ${pool.connectionsInUse}/${pool.poolMax}`;
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
