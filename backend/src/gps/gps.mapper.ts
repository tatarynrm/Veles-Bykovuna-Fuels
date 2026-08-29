import { AddGpsRow } from './gps.types';

/**
 * Pure mapping + timezone math for the GPS-history sync. No axios/Nest, so the
 * tricky parts — the local↔UTC round-trip and the raw-item field extraction — are
 * unit-tested (gps.mapper.spec.ts).
 *
 * Timezone model (matches the original Pascal `lDatFrom - int3Hour + int1Sec`):
 *   - Oracle stores point times in **local** wall-clock (Ukraine, UTC+`tz`).
 *   - Ruptela's API speaks **UTC**.
 * So to ask Ruptela for records after the last stored point we convert local→UTC
 * (`- tz` hours) and add 1 s to skip the anchor; when writing a point back we
 * convert UTC→local (`+ tz` hours). Everything is done on string/number values,
 * never via JS Date timezone semantics, so it is independent of the server's TZ.
 */

const HOUR_MS = 3_600_000;

function num(value: any): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** Parse a local wall-clock string as its face value in ms (interpreted as UTC). */
function faceMs(local: string): number | null {
  let s = local.trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00:00';
  const ms = Date.parse(s + 'Z');
  return Number.isFinite(ms) ? ms : null;
}

const p2 = (n: number) => String(n).padStart(2, '0');

/**
 * `from_datetime` (ISO UTC) for the Ruptela coordinates query: the last stored
 * local time converted to UTC (`- tz`h) plus 1 s. Falls back to `defaultStartLocal`
 * (then to 2026-07-01) when `datlast` is absent or unparseable.
 */
export function ruptelaFromDatetime(
  datlast: string | null | undefined,
  tzOffsetHours: number,
  defaultStartLocal: string,
): string {
  const face =
    (datlast ? faceMs(datlast) : null) ?? faceMs(defaultStartLocal) ?? faceMs('2026-07-01');
  const realUtcMs = (face as number) - tzOffsetHours * HOUR_MS + 1000;
  return new Date(realUtcMs).toISOString();
}

/**
 * A Ruptela point's UTC datetime → Oracle local `YYYY-MM-DD HH24:MI:SS` string
 * (`+ tz`h), read with UTC getters so the result is process-TZ-independent.
 */
export function oracleLocalDateStr(utcIso: string, tzOffsetHours: number): string {
  const ms = Date.parse(utcIso);
  const d = new Date((Number.isFinite(ms) ? ms : Date.now()) + tzOffsetHours * HOUR_MS);
  return (
    `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ` +
    `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`
  );
}

export interface MapContext {
  idgps: string;
  provNum: number;
  tzOffsetHours: number;
  countryCode?: string;
}

/**
 * One raw `/objects/{id}/coordinates?version=2` item → AddGps row. Field names are
 * taken verbatim from the procedure's own comments (canbus_*, ecodrive_*). Ecodrive
 * values may sit in either `device_inputs` or `calculated_inputs`, so both are read.
 * Fields the tractors don't report (reefer temps, door, county/punkt) stay null.
 */
export function mapItemToAddGps(item: any, ctx: MapContext): AddGpsRow {
  const device = item?.inputs?.device_inputs ?? {};
  const calc = item?.inputs?.calculated_inputs ?? {};
  const pos = item?.position ?? {};

  const get = (field: string) => num(device[field] ?? calc[field]);
  const state01 = (field: string) => {
    const v = device[field] ?? calc[field];
    return v === 'ON' ? 1 : v === 'OFF' ? 0 : null;
  };
  const ign = item?.ignition_status === 'ON' ? 1 : item?.ignition_status === 'OFF' ? 0 : null;

  return {
    pIdObj: ctx.idgps,
    pProvNum: ctx.provNum ?? 1,
    pDat: oracleLocalDateStr(item?.datetime, ctx.tzOffsetHours),
    pCountryCode: ctx.countryCode ?? 'UA',
    pCounty: null,
    pPunkt: null,
    pLon: num(pos.longitude),
    pLat: num(pos.latitude),
    pDir: num(pos.direction),
    pIgn: ign,
    pSpeed: num(pos.speed),
    pKm: get('canbus_distance'),
    pFuelUsed: get('fuel_used'),
    pFuelLevel: get('fuel_level'),
    pEngineHour: get('engine_hours'),
    pCruiseControl: state01('canbus_cruise_control_state'),
    pSpeedMax: get('ecodrive_maximum_speed'),
    pSpeedOverSec: get('ecodrive_overspeed'),
    pRpmOverSec: get('ecodrive_rpm_on_red'),
    pRpmMax: get('ecodrive_maximum_rpm'),
    pBrakingCount: get('ecodrive_braking_events'),
    pBrakingExtremeCount: get('ecodrive_extreme_braking_count'),
    pBrakingHarshCount: get('ecodrive_harsh_braking_count'),
    pAccelerationHarshCount: get('ecodrive_harsh_acceleration'),
    pIdleTimeSec: get('ecodrive_idling_time'),
    pEngineOnSec: get('ecodrive_engine_on'),
    pVolt: get('power_supply_voltage') ?? get('battery_voltage'),
    pTemperatureSensor0: get('temperature_sensor_0'),
    pTemperatureSensor1: get('temperature_sensor_1'),
    pTemperatureSensor2: get('temperature_sensor_2'),
    pTemperatureSensor3: get('temperature_sensor_3'),
    pRefDorOpen: null,
    pWeight: get('canbus_axle_weight1') ?? get('canbus_vehicle_weight'),
    pCanbusAxleWeight2: get('canbus_axle_weight2'),
  };
}
