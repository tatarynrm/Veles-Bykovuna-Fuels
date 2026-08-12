import {
  Fuel, Gauge, Milestone, Wrench, Banknote,
  CreditCard, Receipt, BarChart3, Truck, Radio, Route, Download, ShieldCheck, Calculator,
  Coins, Timer, CalendarRange, ArrowLeftRight, FileText,
  type LucideIcon,
} from 'lucide-react';

/**
 * Дані сторінки «Облік витрат».
 *
 * Текстові поля — це КЛЮЧІ i18n, а не готовий текст: масиви оголошені на рівні
 * модуля, тож t() тут порахувався б один раз при імпорті й застряг мовою, яка
 * була активна на той момент. Переклад ставиться в місці рендеру.
 *
 * `status` тут не косметика. Сторінка стоїть у меню поруч із дорожньою картою
 * саме тому, що частина рядків собівартості ще не має джерела даних: 'live' —
 * це те, під чим є код і живий вендор, 'planned' — те, що чекає на інтеграцію
 * з відповідного горизонту. Жоден пункт не має права бути без цієї позначки.
 */
export type ExpenseStatus = 'live' | 'planned';
export type ExpenseTone = 'accent' | 'warn' | 'info' | 'muted';

export const TONE_VAR: Record<ExpenseTone, string> = {
  accent: 'var(--accent)',
  warn: 'var(--warn)',
  info: 'var(--info)',
  muted: 'var(--text-muted)',
};

export const TONE_SOFT: Record<ExpenseTone, string> = {
  accent: 'var(--accent-soft)',
  warn: 'var(--warn-soft)',
  info: 'var(--info-soft)',
  muted: 'var(--surface-hover)',
};

export interface CostLine {
  id: string;
  icon: LucideIcon;
  /** Ключ i18n — назва рядка витрат. */
  title: string;
  /** Ключ i18n — звідки береться цифра або чому її ще немає. */
  detail: string;
  status: ExpenseStatus;
  tone: ExpenseTone;
}

/**
 * Перша половина сцени — «рейс туди»: з чого складається вартість рейсу.
 * Порядок від того, що вже рахується автоматично, до того, що поки вводиться
 * руками, — це і є чесна картина стану обліку.
 */
export const COST_LINES: CostLine[] = [
  {
    id: 'fuel', icon: Fuel, status: 'live', tone: 'accent',
    title: 'landing.exp.cost.fuel.title',
    detail: 'landing.exp.cost.fuel.detail',
  },
  {
    id: 'mileage', icon: Gauge, status: 'live', tone: 'warn',
    title: 'landing.exp.cost.mileage.title',
    detail: 'landing.exp.cost.mileage.detail',
  },
  {
    id: 'toll', icon: Milestone, status: 'planned', tone: 'muted',
    title: 'landing.exp.cost.toll.title',
    detail: 'landing.exp.cost.toll.detail',
  },
  {
    id: 'service', icon: Wrench, status: 'planned', tone: 'muted',
    title: 'landing.exp.cost.service.title',
    detail: 'landing.exp.cost.service.detail',
  },
  {
    id: 'fixed', icon: Banknote, status: 'planned', tone: 'muted',
    title: 'landing.exp.cost.fixed.title',
    detail: 'landing.exp.cost.fixed.detail',
  },
];

export interface DataSource {
  id: string;
  icon: LucideIcon;
  /** Назва вендора лишається як є в усіх мовах — це ключ із власною назвою. */
  title: string;
  detail: string;
  tone: ExpenseTone;
}

/**
 * Друга половина сцени — «рейс назад»: що фізично повертається в систему.
 * Усі чотири джерела живі, тому статусу тут немає — він був би однаковий.
 */
export const DATA_SOURCES: DataSource[] = [
  {
    id: 'okko', icon: Receipt, tone: 'accent',
    title: 'landing.exp.src.okko.title',
    detail: 'landing.exp.src.okko.detail',
  },
  {
    id: 'shell', icon: CreditCard, tone: 'accent',
    title: 'landing.exp.src.shell.title',
    detail: 'landing.exp.src.shell.detail',
  },
  {
    id: 'can', icon: Truck, tone: 'warn',
    title: 'landing.exp.src.can.title',
    detail: 'landing.exp.src.can.detail',
  },
  {
    id: 'trips', icon: Route, tone: 'warn',
    title: 'landing.exp.src.trips.title',
    detail: 'landing.exp.src.trips.detail',
  },
];

/**
 * Рядки підсумкового звіту в кінці сцени — ті самі поля, що віддає
 * /api/analytics/summary. Цифри ілюстративні, про що сказано під карткою.
 *
 * Одиниця виміру живе в підписі (`Обʼєм, л`), а не у значенні: інакше літр
 * довелося б перекладати всередині числа, і в дев'яти мовах воно розʼїхалося б.
 */
export const RESULT_ROWS = [
  { id: 'spend',  label: 'landing.exp.resultRow0', value: '2 841 300' },
  { id: 'volume', label: 'landing.exp.resultRow1', value: '52 118' },
  { id: 'count',  label: 'landing.exp.resultRow2', value: '3 291' },
  { id: 'avg',    label: 'landing.exp.resultRow3', value: '54.52' },
] as const;

export interface Normalization {
  id: string;
  icon: LucideIcon;
  /** Ключі i18n: що приходить від вендора → що йде далі по системі. */
  from: string;
  to: string;
  note: string;
  tone: ExpenseTone;
}

/**
 * Перетворення, на яких облік ламається найтихіше. Кожне з них справді живе
 * в адаптері вендора — і рівно в одному місці, тому їх видно й можна показати.
 */
export const NORMALIZATIONS: Normalization[] = [
  {
    id: 'kop', icon: Coins, tone: 'accent',
    from: 'landing.exp.norm0.from',
    to: 'landing.exp.norm0.to',
    note: 'landing.exp.norm0.note',
  },
  {
    id: 'ml', icon: Fuel, tone: 'accent',
    from: 'landing.exp.norm1.from',
    to: 'landing.exp.norm1.to',
    note: 'landing.exp.norm1.note',
  },
  {
    id: 'date', icon: CalendarRange, tone: 'info',
    from: 'landing.exp.norm2.from',
    to: 'landing.exp.norm2.to',
    note: 'landing.exp.norm2.note',
  },
  {
    id: 'window', icon: Timer, tone: 'info',
    from: 'landing.exp.norm3.from',
    to: 'landing.exp.norm3.to',
    note: 'landing.exp.norm3.note',
  },
];

export interface PlatformBlock {
  id: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  status: ExpenseStatus;
  tone: ExpenseTone;
  /** Куди веде блок усередині застосунку — лише для того, що вже працює. */
  href?: string;
}

/**
 * Можливості платформи в розрізі обліку. Ніде не зашито, скільки їх: заголовок
 * секції рахує довжину масиву, а лічильник «працює / у черзі» — фільтр за
 * статусом. Новий блок міняє обидва числа сам.
 */
export const PLATFORM_BLOCKS: PlatformBlock[] = [
  {
    id: 'cards', icon: CreditCard, status: 'live', tone: 'accent', href: '/workflow/cards',
    title: 'landing.exp.plat.cards.title',
    desc: 'landing.exp.plat.cards.desc',
  },
  {
    id: 'tx', icon: Receipt, status: 'live', tone: 'accent', href: '/workflow/transactions',
    title: 'landing.exp.plat.tx.title',
    desc: 'landing.exp.plat.tx.desc',
  },
  {
    id: 'analytics', icon: BarChart3, status: 'live', tone: 'accent', href: '/workflow/analytics',
    title: 'landing.exp.plat.analytics.title',
    desc: 'landing.exp.plat.analytics.desc',
  },
  {
    id: 'vehicles', icon: Truck, status: 'live', tone: 'warn', href: '/workflow/ruptela/fleet',
    title: 'landing.exp.plat.vehicles.title',
    desc: 'landing.exp.plat.vehicles.desc',
  },
  {
    id: 'live', icon: Radio, status: 'live', tone: 'warn', href: '/workflow/ruptela/live',
    title: 'landing.exp.plat.live.title',
    desc: 'landing.exp.plat.live.desc',
  },
  {
    id: 'trips', icon: Route, status: 'live', tone: 'warn', href: '/workflow/ruptela/routes-tasks',
    title: 'landing.exp.plat.trips.title',
    desc: 'landing.exp.plat.trips.desc',
  },
  {
    id: 'export', icon: Download, status: 'live', tone: 'info',
    title: 'landing.exp.plat.export.title',
    desc: 'landing.exp.plat.export.desc',
  },
  {
    id: 'roles', icon: ShieldCheck, status: 'live', tone: 'info',
    title: 'landing.exp.plat.roles.title',
    desc: 'landing.exp.plat.roles.desc',
  },
  {
    id: 'perkm', icon: Calculator, status: 'planned', tone: 'muted',
    title: 'landing.exp.plat.perkm.title',
    desc: 'landing.exp.plat.perkm.desc',
  },
  {
    id: 'bank', icon: ArrowLeftRight, status: 'planned', tone: 'muted',
    title: 'landing.exp.plat.bank.title',
    desc: 'landing.exp.plat.bank.desc',
  },
];

export interface CtaFrame {
  id: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  tone: ExpenseTone;
}

/**
 * Розкадровка фінальної сцени (`ExpensesCta`): кожен запис — це один «кадр»
 * ролика `fules-reports.mp4` (каністра → рахунки → чеки → звітність), і текст
 * під ним зʼявляється рівно тоді, коли на відео відповідний кадр. Порядок
 * масиву — це порядок кадрів у ролику, змінювати один без іншого не можна.
 */
export const CTA_FRAMES: CtaFrame[] = [
  {
    id: 'fuel', icon: Fuel, tone: 'accent',
    title: 'landing.exp.story0.title',
    detail: 'landing.exp.story0.detail',
  },
  {
    id: 'invoices', icon: FileText, tone: 'info',
    title: 'landing.exp.story1.title',
    detail: 'landing.exp.story1.detail',
  },
  {
    id: 'receipts', icon: Receipt, tone: 'warn',
    title: 'landing.exp.story2.title',
    detail: 'landing.exp.story2.detail',
  },
  {
    id: 'report', icon: BarChart3, tone: 'accent',
    title: 'landing.exp.story3.title',
    detail: 'landing.exp.story3.detail',
  },
];
