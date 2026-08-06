export interface FleetHour {
  hour: number;
  /** Автомобілів у русі одночасно. */
  active: number;
  /** Спалено пального за годину, л. */
  fuel: number;
  /** Пройдено за годину, км. */
  distance: number;
  /** Заправок по картках за годину. */
  tx: number;
}

/**
 * Демонстраційний профіль доби парку на 67 тягачів.
 *
 * Дані ІЛЮСТРАТИВНІ й зашиті в код — це вітрина на публічній сторінці, а не
 * витяг із бойової бази. Реальні цифри клієнта не мають потрапляти на
 * сторінку, доступну без авторизації; форма кривої взята з типового
 * профілю міжнародних рейсів (нічний мінімум, ранковий і пообідній піки).
 */
export const FLEET_DAY: FleetHour[] = [
  { hour: 0,  active: 9,  fuel: 41,  distance: 720,  tx: 0 },
  { hour: 1,  active: 8,  fuel: 36,  distance: 640,  tx: 0 },
  { hour: 2,  active: 7,  fuel: 32,  distance: 560,  tx: 1 },
  { hour: 3,  active: 8,  fuel: 36,  distance: 640,  tx: 1 },
  { hour: 4,  active: 12, fuel: 54,  distance: 960,  tx: 2 },
  { hour: 5,  active: 21, fuel: 95,  distance: 1680, tx: 4 },
  { hour: 6,  active: 34, fuel: 153, distance: 2720, tx: 7 },
  { hour: 7,  active: 43, fuel: 194, distance: 3440, tx: 9 },
  { hour: 8,  active: 51, fuel: 230, distance: 4080, tx: 11 },
  { hour: 9,  active: 55, fuel: 248, distance: 4400, tx: 8 },
  { hour: 10, active: 57, fuel: 257, distance: 4560, tx: 6 },
  { hour: 11, active: 56, fuel: 252, distance: 4480, tx: 5 },
  { hour: 12, active: 49, fuel: 221, distance: 3920, tx: 4 },
  { hour: 13, active: 44, fuel: 198, distance: 3520, tx: 6 },
  { hour: 14, active: 50, fuel: 225, distance: 4000, tx: 7 },
  { hour: 15, active: 54, fuel: 243, distance: 4320, tx: 6 },
  { hour: 16, active: 55, fuel: 248, distance: 4400, tx: 5 },
  { hour: 17, active: 52, fuel: 234, distance: 4160, tx: 7 },
  { hour: 18, active: 46, fuel: 207, distance: 3680, tx: 8 },
  { hour: 19, active: 38, fuel: 171, distance: 3040, tx: 6 },
  { hour: 20, active: 30, fuel: 135, distance: 2400, tx: 4 },
  { hour: 21, active: 23, fuel: 104, distance: 1840, tx: 2 },
  { hour: 22, active: 16, fuel: 72,  distance: 1280, tx: 1 },
  { hour: 23, active: 11, fuel: 50,  distance: 880,  tx: 0 },
];

export const FLEET_SIZE = 67;

/** Наростаючі підсумки — рахуються один раз, а не на кожному кадрі скролу. */
export const FLEET_CUMULATIVE = FLEET_DAY.reduce<
  { fuel: number; distance: number; tx: number }[]
>((acc, row, i) => {
  const prev = acc[i - 1] ?? { fuel: 0, distance: 0, tx: 0 };
  acc.push({
    fuel: prev.fuel + row.fuel,
    distance: prev.distance + row.distance,
    tx: prev.tx + row.tx,
  });
  return acc;
}, []);

export const MAX_HOUR_FUEL = Math.max(...FLEET_DAY.map(r => r.fuel));

/**
 * Найбільша кількість машин у русі одночасно за добу.
 *
 * Це стеля для декоративних «смужок водіїв» у FleetDayScrubber: скільки
 * слотів розмічати по ширині графіка. Береться з даних, а не задається
 * числом, щоб зміна профілю доби не лишала порожніх або зайвих слотів.
 */
export const MAX_HOUR_ACTIVE = Math.max(...FLEET_DAY.map(r => r.active));
