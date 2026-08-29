/** One vehicle to sync GPS history for (see GpsRepository.getVehicles). */
export interface GpsVehicle {
  kod: number;
  dernom: string;
  dn: string;
  /** Ruptela object id → pIdObj in AddGps. */
  idgps: string;
  /** Provider number; for Ruptela = 1. */
  provnum: number;
  /**
   * Last already-read point time, as a local wall-clock string
   * `YYYY-MM-DDTHH:MI:SS` (TO_CHAR, not a Date — avoids driver TZ ambiguity), or
   * null when nothing has been read yet (caller starts from GPS_DEFAULT_START).
   */
  datlast: string | null;
}

/**
 * Row for one p_gps.AddGps call. Bind names match the procedure parameters; `pDat`
 * is a `YYYY-MM-DD HH24:MI:SS` local string wrapped in TO_DATE inside the block.
 */
export interface AddGpsRow {
  pIdObj: string;
  pProvNum: number;
  pDat: string;
  pCountryCode: string;
  pCounty: string | null;
  pPunkt: string | null;
  pLon: number | null;
  pLat: number | null;
  pDir: number | null;
  pIgn: number | null;
  pSpeed: number | null;
  pKm: number | null;
  pFuelUsed: number | null;
  pFuelLevel: number | null;
  pEngineHour: number | null;
  pCruiseControl: number | null;
  pSpeedMax: number | null;
  pSpeedOverSec: number | null;
  pRpmOverSec: number | null;
  pRpmMax: number | null;
  pBrakingCount: number | null;
  pBrakingExtremeCount: number | null;
  pBrakingHarshCount: number | null;
  pAccelerationHarshCount: number | null;
  pIdleTimeSec: number | null;
  pEngineOnSec: number | null;
  pVolt: number | null;
  pTemperatureSensor0: number | null;
  pTemperatureSensor1: number | null;
  pTemperatureSensor2: number | null;
  pTemperatureSensor3: number | null;
  pRefDorOpen: number | null;
  pWeight: number | null;
  pCanbusAxleWeight2: number | null;
}
