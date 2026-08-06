/**
 * Публічні маршрути — ті, що не вимагають сесії.
 *
 * У `label` лежить КЛЮЧ, а не текст: масив оголошено на рівні модуля, тож
 * t() тут обчислився б один раз при імпорті й застряг першою мовою.
 * Переклад ставиться в місці рендеру — `{t(item.label)}`.
 */
export const MARKETING_NAV = [
  { href: '/', label: 'landing.navPlatform' },
  { href: '/integrations', label: 'landing.navIntegrations' },
  { href: '/future-plans', label: 'landing.navRoadmap' },
] as const;

/**
 * Назва компанії не перекладається — це юридичне найменування.
 * i18n-ignore-raw: BRAND
 */
export const BRAND = {
  name: 'VELES',
  legal: 'ТОВ «Велес Буковина»',
  tagline: 'БУКОВИНА FUELS',
  version: 'VELES ERP v1.0',
} as const;

/** Куди веде головна дія: у дашборд, якщо сесія вже є. */
export const appEntry = (authed: boolean) => (authed ? '/dashboard' : '/login');
