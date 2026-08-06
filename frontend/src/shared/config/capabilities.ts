import {
  CreditCard, BarChart3, Truck, Route, Radio, Globe, Download,
  ShieldCheck, Languages, Zap, Command, Map,
  type LucideIcon,
} from 'lucide-react';

export type CapabilityTone = 'accent' | 'warn' | 'info';

/** Ідентифікатор визначає, яку сцену інфографіки малювати. */
export type CapabilityId =
  | 'fuel-cards' | 'analytics' | 'telematics' | 'live-track'
  | 'trips' | 'data-model' | 'export' | 'roles'
  | 'cache' | 'maps' | 'i18n' | 'palette';

export interface Capability {
  id: CapabilityId;
  icon: LucideIcon;
  /** Ключ перекладу — назва. */
  title: string;
  /** Ключ перекладу — короткий опис. */
  desc: string;
  /** Ключ перекладу — розгорнутий опис для слайда. */
  long: string;
  /** Ключі перекладу — конкретика, яку видно в коді. */
  points: string[];
  /** amber зарезервовано за телематикою — правило дизайн-системи. */
  tone: CapabilityTone;
}

/**
 * Усе тут — те, що справді реалізовано в застосунку. Маркетингова сторінка
 * не має жодного пункту, під яким немає коду.
 *
 * Зберігаються КЛЮЧІ, а не текст: масив оголошено на рівні модуля, тож t()
 * тут застряг би мовою, активною на момент імпорту. Переклад ставиться в
 * місці рендеру.
 *
 * Кількість пунктів ніде не зашита числом: заголовок секції рахує довжину
 * цього масиву, тож новий пункт одразу змінює й лічильник.
 */
export const CAPABILITIES: Capability[] = [
  {
    id: 'fuel-cards', icon: CreditCard, tone: 'accent',
    title: 'landing.cap.fuelCards.title',
    desc: 'landing.cap.fuelCards.desc',
    long: 'landing.cap.fuelCards.long',
    points: [
      'landing.cap.fuelCards.p0',
      'landing.cap.fuelCards.p1',
      'landing.cap.fuelCards.p2',
    ],
  },
  {
    id: 'analytics', icon: BarChart3, tone: 'accent',
    title: 'landing.cap.analytics.title',
    desc: 'landing.cap.analytics.desc',
    long: 'landing.cap.analytics.long',
    points: [
      'landing.cap.analytics.p0',
      'landing.cap.analytics.p1',
      'landing.cap.analytics.p2',
    ],
  },
  {
    id: 'telematics', icon: Truck, tone: 'warn',
    title: 'landing.cap.telematics.title',
    desc: 'landing.cap.telematics.desc',
    long: 'landing.cap.telematics.long',
    points: [
      'landing.cap.telematics.p0',
      'landing.cap.telematics.p1',
      'landing.cap.telematics.p2',
    ],
  },
  {
    id: 'live-track', icon: Radio, tone: 'warn',
    title: 'landing.cap.liveTrack.title',
    desc: 'landing.cap.liveTrack.desc',
    long: 'landing.cap.liveTrack.long',
    points: [
      'landing.cap.liveTrack.p0',
      'landing.cap.liveTrack.p1',
      'landing.cap.liveTrack.p2',
    ],
  },
  {
    id: 'trips', icon: Route, tone: 'warn',
    title: 'landing.cap.trips.title',
    desc: 'landing.cap.trips.desc',
    long: 'landing.cap.trips.long',
    points: [
      'landing.cap.trips.p0',
      'landing.cap.trips.p1',
      'landing.cap.trips.p2',
    ],
  },
  {
    id: 'data-model', icon: Globe, tone: 'accent',
    title: 'landing.cap.dataModel.title',
    desc: 'landing.cap.dataModel.desc',
    long: 'landing.cap.dataModel.long',
    points: [
      'landing.cap.dataModel.p0',
      'landing.cap.dataModel.p1',
      'landing.cap.dataModel.p2',
    ],
  },
  {
    id: 'export', icon: Download, tone: 'accent',
    title: 'landing.cap.export.title',
    desc: 'landing.cap.export.desc',
    long: 'landing.cap.export.long',
    points: [
      'landing.cap.export.p0',
      'landing.cap.export.p1',
      'landing.cap.export.p2',
    ],
  },
  {
    id: 'roles', icon: ShieldCheck, tone: 'info',
    title: 'landing.cap.roles.title',
    desc: 'landing.cap.roles.desc',
    long: 'landing.cap.roles.long',
    points: [
      'landing.cap.roles.p0',
      'landing.cap.roles.p1',
      'landing.cap.roles.p2',
    ],
  },
  {
    id: 'cache', icon: Zap, tone: 'accent',
    title: 'landing.cap.cache.title',
    desc: 'landing.cap.cache.desc',
    long: 'landing.cap.cache.long',
    points: [
      'landing.cap.cache.p0',
      'landing.cap.cache.p1',
      'landing.cap.cache.p2',
    ],
  },
  {
    id: 'maps', icon: Map, tone: 'warn',
    title: 'landing.cap.maps.title',
    desc: 'landing.cap.maps.desc',
    long: 'landing.cap.maps.long',
    points: [
      'landing.cap.maps.p0',
      'landing.cap.maps.p1',
      'landing.cap.maps.p2',
    ],
  },
  {
    id: 'i18n', icon: Languages, tone: 'info',
    title: 'landing.cap.i18n.title',
    desc: 'landing.cap.i18n.desc',
    long: 'landing.cap.i18n.long',
    points: [
      'landing.cap.i18n.p0',
      'landing.cap.i18n.p1',
      'landing.cap.i18n.p2',
    ],
  },
  {
    id: 'palette', icon: Command, tone: 'info',
    title: 'landing.cap.palette.title',
    desc: 'landing.cap.palette.desc',
    long: 'landing.cap.palette.long',
    points: [
      'landing.cap.palette.p0',
      'landing.cap.palette.p1',
      'landing.cap.palette.p2',
    ],
  },
];

export const TONE_VAR: Record<CapabilityTone, string> = {
  accent: 'var(--accent)',
  warn: 'var(--warn)',
  info: 'var(--info)',
};

export const TONE_SOFT: Record<CapabilityTone, string> = {
  accent: 'var(--accent-soft)',
  warn: 'var(--warn-soft)',
  info: 'var(--info-soft)',
};
