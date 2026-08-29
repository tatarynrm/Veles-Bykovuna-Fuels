import { Injectable, Logger } from '@nestjs/common';
import oracledb = require('oracledb');
import { OracleService } from '../oracle/oracle.service';
import { GpsVehicle, AddGpsRow } from './gps.types';

/** Vehicles with a Ruptela id, sold no earlier than 180 days ago; datlast as a string. */
const GPS_VEHICLES_SQL = `
select a.kod,
       a.dernom,
       upper(p_utils.tolatin(a.dernom)) as dn,
       a.idgps,
       b.provnum,
       to_char((select max(dat) from gpsamlast where kod_am = a.kod),
               'YYYY-MM-DD"T"HH24:MI:SS') as datlast
from tz a
join gpsprov b on a.kod_gpsprov = b.kod
where a.idgps is not null and
      b.idnt_prov = 'RUPTELA' and
      (a.datprodazh is null or a.datprodazh >= sysdate - 180)
order by a.dernom`;

const ADD_GPS_SQL = `BEGIN
  p_gps.AddGps(
    pIdObj => :pIdObj,
    pProvNum => :pProvNum,
    pDat => TO_DATE(:pDat, 'YYYY-MM-DD HH24:MI:SS'),
    pCountryCode => :pCountryCode,
    pCounty => :pCounty,
    pPunkt => :pPunkt,
    pLon => :pLon,
    pLat => :pLat,
    pDir => :pDir,
    pIgn => :pIgn,
    pSpeed => :pSpeed,
    pKm => :pKm,
    pFuelUsed => :pFuelUsed,
    pFuelLevel => :pFuelLevel,
    pEngineHour => :pEngineHour,
    pCruiseControl => :pCruiseControl,
    pSpeedMax => :pSpeedMax,
    pSpeedOverSec => :pSpeedOverSec,
    pRpmOverSec => :pRpmOverSec,
    pRpmMax => :pRpmMax,
    pBrakingCount => :pBrakingCount,
    pBrakingExtremeCount => :pBrakingExtremeCount,
    pBrakingHarshCount => :pBrakingHarshCount,
    pAccelerationHarshCount => :pAccelerationHarshCount,
    pIdleTimeSec => :pIdleTimeSec,
    pEngineOnSec => :pEngineOnSec,
    pVolt => :pVolt,
    pTemperatureSensor0 => :pTemperatureSensor0,
    pTemperatureSensor1 => :pTemperatureSensor1,
    pTemperatureSensor2 => :pTemperatureSensor2,
    pTemperatureSensor3 => :pTemperatureSensor3,
    pRefDorOpen => :pRefDorOpen,
    pWeight => :pWeight,
    pCanbusAxleWeight2 => :pCanbusAxleWeight2
  );
END;`;

/** String-typed AddGps binds; everything else binds as NUMBER. */
const ADD_GPS_STRING_BINDS = new Set(['pIdObj', 'pCountryCode', 'pCounty', 'pPunkt', 'pDat']);

/**
 * GPS-history data access: the vehicle-list SELECT and the p_gps.AddGps procedure
 * call. All GPS SQL lives here; OracleService only supplies the connection.
 */
@Injectable()
export class GpsRepository {
  private readonly logger = new Logger(GpsRepository.name);

  constructor(private readonly oracle: OracleService) {}

  /**
   * Vehicles to sync GPS history for — those with a Ruptela id, plus the last
   * already-read point time (`datlast`) to start from. Keys come back UPPERCASE.
   */
  async getVehicles(): Promise<GpsVehicle[]> {
    const rows = await this.oracle.query<Record<string, any>>(GPS_VEHICLES_SQL);
    return rows.map((r) => ({
      kod: Number(r.KOD ?? r.kod),
      dernom: r.DERNOM ?? r.dernom ?? '',
      dn: r.DN ?? r.dn ?? '',
      idgps: String(r.IDGPS ?? r.idgps ?? ''),
      provnum: Number(r.PROVNUM ?? r.provnum ?? 1),
      datlast: (r.DATLAST ?? r.datlast) || null,
    }));
  }

  /**
   * Writes a batch of GPS points via p_gps.AddGps on one connection. A single bad
   * row is skipped (logged) rather than dropping the whole vehicle's batch; the rest
   * commit once at the end. Returns how many rows were written. `pDat` is bound as a
   * string and parsed with TO_DATE, so no JS/driver timezone conversion is involved.
   */
  async addGpsBatch(rows: AddGpsRow[]): Promise<number> {
    if (!rows.length) return 0;

    return this.oracle.withConnection(async (conn) => {
      let written = 0;
      for (const row of rows) {
        const binds: Record<string, oracledb.BindParameter> = {};
        for (const [key, value] of Object.entries(row)) {
          binds[key] = {
            val: value ?? null,
            type: ADD_GPS_STRING_BINDS.has(key) ? oracledb.STRING : oracledb.NUMBER,
          };
        }
        try {
          await conn.execute(ADD_GPS_SQL, binds, { autoCommit: false });
          written++;
        } catch (rowError) {
          this.logger.warn(
            `AddGps: пропущено точку ${row.pIdObj} @ ${row.pDat} — ${rowError.message}`,
          );
        }
      }
      await conn.commit();
      return written;
    });
  }
}
