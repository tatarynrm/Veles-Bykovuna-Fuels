import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import oracledb = require('oracledb');
import { OracleService } from '../oracle/oracle.service';

/**
 * Oracle data access for Nova Poshta delivery-date write-back. Owns the
 * SetDateDelivered procedure call; OracleService only supplies the connection.
 */
@Injectable()
export class DeliveriesRepository {
  constructor(
    private readonly oracle: OracleService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Calls SetDateDelivered(pCodePost, pDocNumber, pDateDelivered) for each delivered
   * waybill (upsert by post code + number). One executeMany for the whole batch, one
   * commit. Rows without a valid delivery date are skipped.
   */
  async setDeliveredBatch(
    rows: Array<{ number: string; deliveredAt: Date }>,
    codePost?: string,
  ): Promise<number> {
    const valid = rows.filter(
      (r) => r.number && r.deliveredAt instanceof Date && !isNaN(r.deliveredAt.getTime()),
    );
    if (!valid.length) return 0;

    const proc = this.config.get<string>('ORACLE_DELIVERED_PROC') ?? 'P_POST.SetDateDelivered';
    const code = codePost ?? this.config.get<string>('ORACLE_POST_CODE') ?? 'NVP';

    return this.oracle.withConnection(async (conn) => {
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
    });
  }
}
