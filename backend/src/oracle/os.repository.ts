import { Injectable } from '@nestjs/common';
import { OracleService } from './oracle.service';

export interface OsRow {
  kod: string | number | null;
  pip: string | null;
}

/** Data access for the `os` reference table — SQL for the /api/oracle/os demo. */
@Injectable()
export class OsRepository {
  constructor(private readonly oracle: OracleService) {}

  /** select kod, pip from os */
  async getOs(): Promise<OsRow[]> {
    const rows = await this.oracle.query<Record<string, any>>('SELECT kod, pip FROM os');
    // Oracle повертає ключі у верхньому регістрі (KOD/PIP) — нормалізуємо.
    return rows.map((r) => ({
      kod: r.KOD ?? r.kod ?? null,
      pip: r.PIP ?? r.pip ?? null,
    }));
  }
}
