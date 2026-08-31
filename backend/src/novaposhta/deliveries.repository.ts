import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import oracledb = require("oracledb");
import { OracleService } from "../oracle/oracle.service";
import { NovaPoshtaStatusUpsert } from "./novaposhta-api.service";

/**
 * Oracle data access for the Nova Poshta status write-back. Owns the
 * `p_post.SetStatus` procedure call; OracleService only supplies the connection.
 *
 * SetStatus is an upsert keyed by (post code + document number) and reports errors
 * through its `pErr` IN OUT argument rather than by raising — so we bind it and log
 * any non-empty message instead of relying on a thrown exception.
 */
@Injectable()
export class DeliveriesRepository {
  private readonly logger = new Logger(DeliveriesRepository.name);

  constructor(
    private readonly oracle: OracleService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Calls `p_post.SetStatus(...)` for each shipment (upsert by post code + number),
   * passing the full status: id, name, status/creation/delivery dates, city and
   * warehouse. One executeMany for the whole batch, one commit. Returns how many
   * rows the procedure accepted without an error.
   */
  async setStatusBatch(
    rows: NovaPoshtaStatusUpsert[],
    codePost?: string,
  ): Promise<number> {
    const valid = rows.filter((r) => r.number);
    if (!valid.length) return 0;

    const proc =
      this.config.get<string>("ORACLE_STATUS_PROC") ?? "P_POST.SetStatus";
    const code =
      codePost ?? this.config.get<string>("ORACLE_POST_CODE") ?? "NVP";

    return this.oracle.withConnection(async (conn) => {
      const sql = `BEGIN ${proc}(
        pCodePost => :code,
        pDocNumber => :doc,
        pStatusId => :statusId,
        pStatusName => :statusName,
        pDateStatus => :dateStatus,
        pDateStart => :dateStart,
        pDateDelivered => :dateDelivered,
        pCity => :city,
        pWareHouse => :warehouse,
        pErr => :err
      ); END;`;
      console.log(rows[0]);

      const binds = valid.map((r) => ({
        code,
        doc: r.number,
        statusId: r.statusId ?? null,
        statusName: r.statusName ?? null,
        dateStatus: r.dateStatus ?? null,
        dateStart: r.dateStart ?? null,
        dateDelivered: r.dateDelivered ?? null,
        city: r.city ?? null,
        warehouse: r.warehouse ?? null,
        err: "",
      }));

      const result = await conn.executeMany(sql, binds, {
        autoCommit: true,
        bindDefs: {
          code: { type: oracledb.STRING, maxSize: 32 },
          doc: { type: oracledb.STRING, maxSize: 64 },
          statusId: { type: oracledb.STRING, maxSize: 32 },
          statusName: { type: oracledb.STRING, maxSize: 256 },
          dateStatus: { type: oracledb.DATE },
          dateStart: { type: oracledb.DATE },
          dateDelivered: { type: oracledb.DATE },
          city: { type: oracledb.STRING, maxSize: 256 },
          warehouse: { type: oracledb.STRING, maxSize: 512 },
          err: {
            type: oracledb.STRING,
            maxSize: 4000,
            dir: oracledb.BIND_INOUT,
          },
        },
      });

      // SetStatus рапортує помилки через pErr, а не винятком — залогуємо непорожні.
      const outBinds =
        (result.outBinds as Array<{ err?: string }> | undefined) ?? [];
      const errors = outBinds
        .map((o, i) => ({ doc: valid[i]?.number, err: (o?.err ?? "").trim() }))
        .filter((x) => x.err);
      if (errors.length) {
        this.logger.warn(
          `SetStatus: ${errors.length} накладних повернули помилку, напр.: ${errors[0].doc} — ${errors[0].err}`,
        );
      }

      return valid.length - errors.length;
    });
  }
}
