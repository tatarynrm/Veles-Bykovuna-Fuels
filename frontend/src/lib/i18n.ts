/**
 * Локальний i18n — без мережі, без зовнішніх сервісів, без маршрутів /en, /pl.
 *
 * Ключ — семантичний ідентифікатор `простір.назва`, однаковий для всіх мов:
 *
 *     t('common.fuelCards')
 *       uk → 'Паливні картки'   en → 'Fuel cards'
 *       pl → 'Karty paliwowe'   de → 'Tankkarten'
 *
 * Простори імен збігаються з розділами застосунку: `nav`, `auth`, `cards`,
 * `tx`, `analytics`, `merchants`, `telematics`, `live`, `trip`, `insights`,
 * `diag`, `console`, `tour`, `guest`, `export`, `ui`, `unit`, `error`,
 * `common` (те, що вживається у кількох розділах).
 *
 * Мова оригіналу — українська, вона лежить у `uk.json` як звичайний словник.
 * Якщо переклад відсутній, показуємо українську, а не голий ключ: краще
 * зрозумілий текст «не тією мовою», ніж `common.fuelCards` на екрані.
 *
 * `t()` навмисно НЕ хук: його викликають і з компонентів, і з утиліт на кшталт
 * exportManager, які нічого не знають про React. Перемальовування після зміни
 * мови робить I18nProvider — він перемонтовує піддерево.
 *
 * ВАЖЛИВО: не викликайте t() на рівні модуля (у константних масивах) — таке
 * значення обчислиться один раз при імпорті й застрягне однією мовою. Тримайте
 * у таких масивах КЛЮЧ, а t() ставте в місці рендеру: `{t(item.label)}`.
 */

import uk from '@/locales/uk.json';
import en from '@/locales/en.json';
import pl from '@/locales/pl.json';
import de from '@/locales/de.json';
import ro from '@/locales/ro.json';
import cs from '@/locales/cs.json';
import sk from '@/locales/sk.json';
import hu from '@/locales/hu.json';
import fr from '@/locales/fr.json';
import es from '@/locales/es.json';

/*
  Порядок визначає вигляд перемикача: спершу мова компанії, далі англійська
  як спільна для міжнародних перевезень, потім країни за напрямками рейсів —
  Польща, Німеччина, Румунія, Чехія, Словаччина, Угорщина, і наостанок
  Франція та Іспанія.
*/
export const LOCALES = [
  'uk', 'en', 'pl', 'de', 'ro', 'cs', 'sk', 'hu', 'fr', 'es',
] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Мова оригіналу й запасний варіант перекладу: якщо ключа немає в обраній мові,
 * показуємо українську. Це НЕ мова, яку побачить новий відвідувач.
 */
export const DEFAULT_LOCALE: Locale = 'uk';

/**
 * Мова для гостя, чиєї мови ми не підтримуємо. Англійська зрозуміліша
 * міжнародному водієві чи партнерові, ніж українська, якої він не читає;
 * українець отримає українську через detectLocale() за мовою браузера.
 */
export const FALLBACK_LOCALE: Locale = 'en';

/**
 * Вибір мови живе у cookie, а не лише в localStorage.
 *
 * Причина суто практична: сервер має намалювати розмітку одразу потрібною
 * мовою. localStorage він не бачить, тому SSR завжди віддавав українську, а
 * клієнт після гідратації перемикав мову й перемонтовував усе дерево — на
 * кожному завантаженні сторінки було видно спалах чужої мови.
 *
 * Ключ той самий, `veles_locale`, тож джерело правди лишається одне.
 */
export const LOCALE_STORAGE_KEY = 'veles_locale';
export const LOCALE_COOKIE = 'veles_locale';
/** Рік: вибір мови не має злітати сам собою. */
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Читає мову з cookie документа (клієнт). На сервері їх читає layout. */
export function readLocaleCookie(): Locale | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  const value = match ? decodeURIComponent(match[1]) : null;
  return isLocale(value) ? value : null;
}

export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

export interface LocaleMeta {
  /** Код у перемикачі. */
  code: Locale;
  /** Назва мови її ж мовою. */
  native: string;
  /**
   * Двобуквений ярлик для перемикача.
   *
   * Прапор поруч малює компонент <Flag> інлайновим SVG, а НЕ емодзі:
   * Windows не має гліфів для регіональних індикаторів і замість 🇺🇦 показує
   * літери «UA», через що кнопка колись виглядала як «UA UA». SVG однаковий
   * у всіх системах.
   */
  short: string;
  /** Код країни для прапорця — не завжди збігається з кодом мови. */
  region: string;
  /** BCP-47 для Intl: числа, валюта, дати. */
  intl: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  uk: { code: 'uk', native: 'Українська', short: 'UA', region: 'UA', intl: 'uk-UA' },
  en: { code: 'en', native: 'English',    short: 'EN', region: 'GB', intl: 'en-GB' },
  pl: { code: 'pl', native: 'Polski',     short: 'PL', region: 'PL', intl: 'pl-PL' },
  de: { code: 'de', native: 'Deutsch',    short: 'DE', region: 'DE', intl: 'de-DE' },
  ro: { code: 'ro', native: 'Română',     short: 'RO', region: 'RO', intl: 'ro-RO' },
  cs: { code: 'cs', native: 'Čeština',    short: 'CS', region: 'CZ', intl: 'cs-CZ' },
  sk: { code: 'sk', native: 'Slovenčina', short: 'SK', region: 'SK', intl: 'sk-SK' },
  hu: { code: 'hu', native: 'Magyar',     short: 'HU', region: 'HU', intl: 'hu-HU' },
  fr: { code: 'fr', native: 'Français',   short: 'FR', region: 'FR', intl: 'fr-FR' },
  es: { code: 'es', native: 'Español',    short: 'ES', region: 'ES', intl: 'es-ES' },
};

type Dictionary = Record<string, string>;

const DICTIONARIES: Record<Locale, Dictionary> = {
  uk: uk as Dictionary,
  en: en as Dictionary,
  pl: pl as Dictionary,
  de: de as Dictionary,
  ro: ro as Dictionary,
  cs: cs as Dictionary,
  sk: sk as Dictionary,
  hu: hu as Dictionary,
  fr: fr as Dictionary,
  es: es as Dictionary,
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

/* ── поточна мова ──────────────────────────────────────────────────────── */

let current: Locale = DEFAULT_LOCALE;
const listeners = new Set<(locale: Locale) => void>();

export const getLocale = (): Locale => current;

/** Застосовує мову до модуля. Зберігання й перемальовування — на провайдері. */
export function applyLocale(next: Locale): void {
  current = next;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
  }
  listeners.forEach((fn) => fn(next));
}

export function onLocaleChange(fn: (locale: Locale) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Мова браузера, коли користувач ще нічого не обирав.
 *
 * `navigator.languages` іде за спаданням пріоритету («uk-UA», «en-US», «ru»),
 * тож перша підтримувана мова у списку й перемагає. Регіон відкидаємо:
 * «de-AT» і «de-CH» — та сама наша `de`.
 *
 * Якщо жодна з мов користувача не підтримується — англійська, а не українська
 * (див. FALLBACK_LOCALE). На сервері navigator немає: там повертаємо
 * FALLBACK_LOCALE, але реального значення це не має — I18nProvider викликає
 * detectLocale() лише в layout-ефекті, тобто вже в браузері.
 */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return FALLBACK_LOCALE;

  const preferred = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const lang of preferred) {
    const code = lang?.split('-')[0]?.toLowerCase();
    if (isLocale(code)) return code;
  }
  return FALLBACK_LOCALE;
}

/* ── переклад ──────────────────────────────────────────────────────────── */

/**
 * Перекладає ключ. Підстановки — фігурними дужками:
 *
 *     t('tx.foundRecords', { count: 12 })
 *
 * Ланцюжок запасних варіантів: обрана мова → українська → сам ключ. Показати
 * `tx.foundRecords` користувачеві — найгірший з результатів, тому це остання
 * ланка; у режимі розробки такий випадок ще й пишеться в консоль, щоб
 * непроставлений ключ не загубився.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  let out = DICTIONARIES[current]?.[key] || DICTIONARIES.uk[key];

  if (!out) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[i18n] немає ключа: ${key}`);
    }
    out = key;
  }

  if (vars) {
    out = out.replace(/\{(\w+)\}/g, (match, name) =>
      name in vars ? String(vars[name]) : match,
    );
  }
  return out;
}

/** Множина за правилами поточної мови (укр. має 3 форми, en/de — 2, pl — 3). */
export function plural(
  count: number,
  forms: { one: string; few?: string; many?: string; other: string },
): string {
  const rule = new Intl.PluralRules(LOCALE_META[current].intl).select(count);
  const picked =
    (rule === 'one' && forms.one) ||
    (rule === 'few' && (forms.few ?? forms.other)) ||
    (rule === 'many' && (forms.many ?? forms.other)) ||
    forms.other;
  return t(picked, { count });
}

/** BCP-47 поточної мови — для Intl у format.ts і компонентах графіків. */
export const intlLocale = (): string => LOCALE_META[current].intl;

/**
 * Довідник підписів рівня модуля, який перекладається при читанні.
 *
 *     export const TRIP_STATE_LABEL = localizedMap({ NEW: 'telematics.new', … });
 *     TRIP_STATE_LABEL['NEW']  →  'Нова' | 'New' | 'Nowa' | 'Neu'
 *
 * Обгортка потрібна саме тут: такі мапи оголошуються на рівні модуля, тому
 * t() у їхніх значеннях застряг би на мові, активній під час імпорту. Proxy
 * переносить переклад на момент звертання — і жодне місце виклику міняти не
 * доводиться. Object.keys/entries теж працюють: значення приходять уже
 * перекладеними.
 *
 * Значення мапи — КЛЮЧІ, а не текст. Для порівнянь беріть ключ мапи
 * (`state === 'NEW'`), а не перекладений підпис.
 */
export function localizedMap<T extends Record<string, string>>(map: T): T {
  return new Proxy(map, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'string' ? t(value) : value;
    },
  });
}
