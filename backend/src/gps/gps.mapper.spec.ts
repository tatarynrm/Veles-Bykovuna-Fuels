import { ruptelaFromDatetime, oracleLocalDateStr, mapItemToAddGps } from './gps.mapper';

describe('ruptelaFromDatetime (local → UTC, +1s)', () => {
  it('converts a stored local time to UTC minus tz plus one second', () => {
    expect(ruptelaFromDatetime('2026-08-01T12:00:00', 3, '2026-07-01')).toBe(
      '2026-08-01T09:00:01.000Z',
    );
  });

  it('falls back to the default start (date-only → midnight) when datlast is null', () => {
    expect(ruptelaFromDatetime(null, 3, '2026-07-01')).toBe('2026-06-30T21:00:01.000Z');
  });

  it('accepts a space-separated datlast (TO_CHAR without the T)', () => {
    expect(ruptelaFromDatetime('2026-08-01 12:00:00', 3, '2026-07-01')).toBe(
      '2026-08-01T09:00:01.000Z',
    );
  });

  it('honours a different tz offset (winter = 2)', () => {
    expect(ruptelaFromDatetime('2026-01-15T10:00:00', 2, '2026-07-01')).toBe(
      '2026-01-15T08:00:01.000Z',
    );
  });
});

describe('oracleLocalDateStr (UTC → local wall-clock string)', () => {
  it('adds the tz offset and formats YYYY-MM-DD HH24:MI:SS', () => {
    expect(oracleLocalDateStr('2026-07-01T09:00:00Z', 3)).toBe('2026-07-01 12:00:00');
  });

  it('rolls the date over correctly near midnight', () => {
    expect(oracleLocalDateStr('2026-07-01T22:30:00Z', 3)).toBe('2026-07-02 01:30:00');
  });

  it('round-trips: a stored point read back as datlast excludes itself on the next fetch', () => {
    const pointUtc = '2026-07-01T09:00:00Z';
    const stored = oracleLocalDateStr(pointUtc, 3); // '2026-07-01 12:00:00' (local)
    const nextFrom = ruptelaFromDatetime(stored, 3, '2026-07-01'); // back to UTC +1s
    // 09:00:01Z is strictly after the 09:00:00Z point → not re-read.
    expect(nextFrom).toBe('2026-07-01T09:00:01.000Z');
  });
});

describe('mapItemToAddGps', () => {
  const item = {
    datetime: '2026-07-01T09:00:00Z',
    ignition_status: 'ON',
    position: { latitude: 48.3, longitude: 25.9, speed: 60, direction: 180 },
    inputs: {
      device_inputs: {
        canbus_distance: 123456,
        engine_hours: 5000,
        fuel_used: 200,
        canbus_cruise_control_state: 'OFF',
        power_supply_voltage: 27.5,
        ecodrive_maximum_speed: 90,
        ecodrive_braking_events: 3,
      },
      calculated_inputs: { fuel_level: 300, ecodrive_idling_time: 120 },
    },
  };

  it('maps position, ignition and the fixed context fields', () => {
    const row = mapItemToAddGps(item, { idgps: 'RUP1', provNum: 1, tzOffsetHours: 3 });
    expect(row).toMatchObject({
      pIdObj: 'RUP1',
      pProvNum: 1,
      pCountryCode: 'UA',
      pDat: '2026-07-01 12:00:00',
      pLat: 48.3,
      pLon: 25.9,
      pSpeed: 60,
      pDir: 180,
      pIgn: 1,
      pCounty: null,
      pPunkt: null,
      pRefDorOpen: null,
    });
  });

  it('reads CAN + ecodrive from either device_inputs or calculated_inputs', () => {
    const row = mapItemToAddGps(item, { idgps: 'RUP1', provNum: 1, tzOffsetHours: 3 });
    expect(row.pKm).toBe(123456);
    expect(row.pEngineHour).toBe(5000);
    expect(row.pFuelUsed).toBe(200);
    expect(row.pFuelLevel).toBe(300); // calculated_inputs
    expect(row.pVolt).toBe(27.5);
    expect(row.pCruiseControl).toBe(0); // 'OFF'
    expect(row.pSpeedMax).toBe(90);
    expect(row.pBrakingCount).toBe(3);
    expect(row.pIdleTimeSec).toBe(120); // calculated_inputs
  });

  it('nulls out absent readings and maps ignition OFF/unknown', () => {
    const off = mapItemToAddGps(
      { datetime: '2026-07-01T00:00:00Z', ignition_status: 'OFF', position: {}, inputs: {} },
      { idgps: 'X', provNum: 1, tzOffsetHours: 3 },
    );
    expect(off.pIgn).toBe(0);
    expect(off.pLat).toBeNull();
    expect(off.pKm).toBeNull();
    expect(off.pTemperatureSensor0).toBeNull();
    expect(off.pCruiseControl).toBeNull();

    const unknown = mapItemToAddGps(
      { datetime: '2026-07-01T00:00:00Z', position: {}, inputs: {} },
      { idgps: 'X', provNum: 1, tzOffsetHours: 3 },
    );
    expect(unknown.pIgn).toBeNull();
  });
});
