/**
 * Текстові поля тут — це КЛЮЧІ i18n, а не готовий текст: t() ставиться в
 * місці рендеру (`{t(h.title)}`). На рівні модуля переклад застряг би тією
 * мовою, яка була активна на момент імпорту.
 */
export interface Horizon {
  id: string;
  /** Ключ i18n. */
  phase: string;
  /** Ключ i18n. */
  title: string;
  /** Ключ i18n: чому саме ці інтеграції йдуть разом і саме в цій черзі. */
  rationale: string;
  /** Ключі i18n. Назви вендорів у перекладах лишаються як є. */
  items: string[];
  tone: 'accent' | 'warn' | 'info' | 'muted';
}

/**
 * Черга визначається не «що цікавіше», а залежностями: спершу дані
 * (усі мережі в одному звіті), потім гроші й документи навколо цих даних,
 * далі фізика рейсу, і лише потім регуляторика з відомими наперед датами.
 */
export const HORIZONS: Horizon[] = [
  {
    id: 'h1',
    phase: 'landing.rm.h1.phase',
    title: 'landing.rm.h1.title',
    rationale: 'landing.rm.h1.rationale',
    items: [
      'landing.rm.h1.i0',
      'landing.rm.h1.i1',
      'landing.rm.h1.i2',
      'landing.rm.h1.i3',
      'landing.rm.h1.i4',
      'landing.rm.h1.i5',
      'landing.rm.h1.i6',
    ],
    tone: 'accent',
  },
  {
    id: 'h2',
    phase: 'landing.rm.h2.phase',
    title: 'landing.rm.h2.title',
    rationale: 'landing.rm.h2.rationale',
    items: [
      'landing.rm.h2.i0',
      'landing.rm.h2.i1',
      'landing.rm.h2.i2',
      'landing.rm.h2.i3',
      'landing.rm.h2.i4',
      'landing.rm.h2.i5',
    ],
    tone: 'info',
  },
  {
    id: 'h3',
    phase: 'landing.rm.h3.phase',
    title: 'landing.rm.h3.title',
    rationale: 'landing.rm.h3.rationale',
    items: [
      'landing.rm.h3.i0',
      'landing.rm.h3.i1',
      'landing.rm.h3.i2',
      'landing.rm.h3.i3',
      'landing.rm.h3.i4',
      'landing.rm.h3.i5',
      'landing.rm.h3.i6',
      'landing.rm.h3.i7',
    ],
    tone: 'warn',
  },
  {
    id: 'h4',
    phase: 'landing.rm.h4.phase',
    title: 'landing.rm.h4.title',
    rationale: 'landing.rm.h4.rationale',
    items: [
      'landing.rm.h4.i0',
      'landing.rm.h4.i1',
      'landing.rm.h4.i2',
      'landing.rm.h4.i3',
      'landing.rm.h4.i4',
      'landing.rm.h4.i5',
      'landing.rm.h4.i6',
      'landing.rm.h4.i7',
    ],
    tone: 'muted',
  },
];

export interface RegulatoryDate {
  /** Дата подається як є — вона однакова в усіх мовах. */
  date: string;
  /** Ключ i18n. */
  title: string;
  /** Ключ i18n. */
  detail: string;
  /** Чи дедлайн уже настав. */
  active: boolean;
}

/**
 * Регуляторні віхи — єдиний блок на сторінці з конкретними датами, тому вони
 * мають бути перевірюваними. Джерело: чинні акти ЄС та оприлюднені плани ДПС.
 *
 * `date` подається як є — цифри однакові в усіх мовах.
 * i18n-ignore-props: date
 */
export const REGULATORY: RegulatoryDate[] = [
  {
    date: 'з 2025',
    title: 'landing.rm.reg0.title',
    detail: 'landing.rm.reg0.detail',
    active: true,
  },
  {
    date: 'з 08.2025',
    title: 'landing.rm.reg1.title',
    detail: 'landing.rm.reg1.detail',
    active: true,
  },
  {
    date: '01.2027',
    title: 'landing.rm.reg2.title',
    detail: 'landing.rm.reg2.detail',
    active: false,
  },
  {
    date: '07.2027',
    title: 'landing.rm.reg3.title',
    detail: 'landing.rm.reg3.detail',
    active: false,
  },
];

export const TONE_VAR: Record<Horizon['tone'], string> = {
  accent: 'var(--accent)',
  warn: 'var(--warn)',
  info: 'var(--info)',
  muted: 'var(--text-muted)',
};
