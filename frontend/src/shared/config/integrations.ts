import { localizedMap } from '@/lib/i18n';

export type IntegrationCategory =
  | 'fuel' | 'telematics' | 'sensors' | 'accounting'
  | 'banking' | 'mapping' | 'comms' | 'bi' | 'compliance' | 'weather';

/**
 * Наскільки реальна інтеграція сьогодні:
 * `live`      — уже працює у продакшені;
 * `available` — публічна задокументована API, можна брати в роботу;
 * `partner`   — технічно можливо, але потрібен комерційний договір;
 * `unclear`   — сервіс існує, кабінет є, публічної API-документації немає;
 * `research`  — регуляторне або ринкове вікно ще не відкрилось.
 */
export type IntegrationStatus = 'live' | 'available' | 'partner' | 'unclear' | 'research';

export type ApiSurface = 'REST' | 'GraphQL' | 'webhook' | 'file-exchange' | 'CAN' | 'none';

export interface Integration {
  /** Назва вендора — не перекладається. */
  name: string;
  category: IntegrationCategory;
  /** Ключ i18n: що робить сервіс. t() ставиться в місці рендеру. */
  what: string;
  /** Ключ i18n: чому це має сенс саме для перевізника. */
  why: string;
  api: ApiSurface;
  effort: 'low' | 'medium' | 'high';
  status: IntegrationStatus;
}

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = localizedMap({
  fuel: 'landing.int.cat.fuel',
  telematics: 'landing.int.cat.telematics',
  sensors: 'landing.int.cat.sensors',
  accounting: 'landing.int.cat.accounting',
  banking: 'landing.int.cat.banking',
  mapping: 'landing.int.cat.mapping',
  comms: 'landing.int.cat.comms',
  bi: 'landing.int.cat.bi',
  compliance: 'landing.int.cat.compliance',
  weather: 'landing.int.cat.weather',
});

export const STATUS_LABEL: Record<IntegrationStatus, string> = localizedMap({
  live: 'landing.int.status.live',
  available: 'landing.int.status.available',
  partner: 'landing.int.status.partner',
  unclear: 'landing.int.status.unclear',
  research: 'landing.int.status.research',
});

export const STATUS_TONE: Record<IntegrationStatus, string> = {
  live: 'var(--accent)',
  available: 'var(--info)',
  partner: 'var(--warn)',
  unclear: 'var(--text-muted)',
  research: 'var(--text-muted)',
};

/**
 * Дані зібрані дослідженням українського ринку станом на 2026 рік.
 *
 * Головний висновок, який тут навмисно не приховано: більшість українських
 * паливних мереж публічного API не має. Чесний статус «API не опубліковано»
 * коштує дешевше, ніж логотип на сторінці, під який потім немає інтеграції.
 */
export const INTEGRATIONS: Integration[] = [
  // ── Уже в продакшені ──────────────────────────────────────────────────
  {
    name: 'OKKO', category: 'fuel', api: 'REST', effort: 'medium', status: 'live',
    what: 'landing.int.okko.what',
    why: 'landing.int.okko.why',
  },
  {
    name: 'Shell Mobility B2B', category: 'fuel', api: 'REST', effort: 'medium', status: 'live',
    what: 'landing.int.shell.what',
    why: 'landing.int.shell.why',
  },
  {
    name: 'Ruptela fm-track', category: 'telematics', api: 'REST', effort: 'high', status: 'live',
    what: 'landing.int.ruptelaFmTrack.what',
    why: 'landing.int.ruptelaFmTrack.why',
  },
  {
    name: 'Ruptela Routing & Tasking', category: 'telematics', api: 'GraphQL', effort: 'high', status: 'live',
    what: 'landing.int.ruptelaRnt.what',
    why: 'landing.int.ruptelaRnt.why',
  },

  // ── Паливні мережі ────────────────────────────────────────────────────
  {
    name: 'SOCAR sCard', category: 'fuel', api: 'REST', effort: 'medium', status: 'partner',
    what: 'landing.int.socar.what',
    why: 'landing.int.socar.why',
  },
  {
    name: 'Агрегатори карток (e-Kard, SC Formula)', category: 'fuel', api: 'none', effort: 'medium', status: 'partner',
    what: 'landing.int.cardAggregators.what',
    why: 'landing.int.cardAggregators.why',
  },
  {
    name: 'WOG', category: 'fuel', api: 'none', effort: 'medium', status: 'unclear',
    what: 'landing.int.wog.what',
    why: 'landing.int.wog.why',
  },
  {
    name: 'Укрнафта', category: 'fuel', api: 'none', effort: 'medium', status: 'unclear',
    what: 'landing.int.ukrnafta.what',
    why: 'landing.int.ukrnafta.why',
  },
  {
    name: 'UPG', category: 'fuel', api: 'REST', effort: 'medium', status: 'unclear',
    what: 'landing.int.upg.what',
    why: 'landing.int.upg.why',
  },
  {
    name: 'AMIC Energy', category: 'fuel', api: 'none', effort: 'medium', status: 'unclear',
    what: 'landing.int.amic.what',
    why: 'landing.int.amic.why',
  },

  // ── Телематика й датчики ──────────────────────────────────────────────
  {
    name: 'flespi', category: 'telematics', api: 'REST', effort: 'medium', status: 'available',
    what: 'landing.int.flespi.what',
    why: 'landing.int.flespi.why',
  },
  {
    name: 'Wialon (Gurtam)', category: 'telematics', api: 'REST', effort: 'medium', status: 'available',
    what: 'landing.int.wialon.what',
    why: 'landing.int.wialon.why',
  },
  {
    name: 'Teltonika FOTA WEB', category: 'telematics', api: 'REST', effort: 'low', status: 'available',
    what: 'landing.int.teltonika.what',
    why: 'landing.int.teltonika.why',
  },
  {
    name: 'Technoton DUT-E / DFM', category: 'sensors', api: 'CAN', effort: 'low', status: 'available',
    what: 'landing.int.technoton.what',
    why: 'landing.int.technoton.why',
  },
  {
    name: 'Omnicomm LLS / Escort', category: 'sensors', api: 'CAN', effort: 'low', status: 'available',
    what: 'landing.int.omnicomm.what',
    why: 'landing.int.omnicomm.why',
  },

  // ── Облік, ЕДО, банки ─────────────────────────────────────────────────
  {
    name: 'Вчасно (ЕДО)', category: 'accounting', api: 'REST', effort: 'medium', status: 'available',
    what: 'landing.int.vchasno.what',
    why: 'landing.int.vchasno.why',
  },
  {
    name: 'BAS ERP / 1С (OData)', category: 'accounting', api: 'REST', effort: 'medium', status: 'available',
    what: 'landing.int.basErp.what',
    why: 'landing.int.basErp.why',
  },
  {
    name: 'M.E.Doc «Інтеграція»', category: 'accounting', api: 'REST', effort: 'medium', status: 'partner',
    what: 'landing.int.medoc.what',
    why: 'landing.int.medoc.why',
  },
  {
    name: 'Paperless (ПриватБанк)', category: 'accounting', api: 'REST', effort: 'medium', status: 'partner',
    what: 'landing.int.paperless.what',
    why: 'landing.int.paperless.why',
  },
  {
    name: 'ПриватБанк «Автоклієнт»', category: 'banking', api: 'REST', effort: 'medium', status: 'available',
    what: 'landing.int.privatAutoclient.what',
    why: 'landing.int.privatAutoclient.why',
  },
  {
    name: 'monobank Corporate', category: 'banking', api: 'webhook', effort: 'low', status: 'available',
    what: 'landing.int.monobank.what',
    why: 'landing.int.monobank.why',
  },

  // ── Карти, звʼязок, аналітика ─────────────────────────────────────────
  {
    name: 'HERE Routing v8', category: 'mapping', api: 'REST', effort: 'medium', status: 'available',
    what: 'landing.int.here.what',
    why: 'landing.int.here.why',
  },
  {
    name: 'Visicom', category: 'mapping', api: 'REST', effort: 'low', status: 'available',
    what: 'landing.int.visicom.what',
    why: 'landing.int.visicom.why',
  },
  {
    name: 'OpenRouteService (HGV)', category: 'mapping', api: 'REST', effort: 'low', status: 'available',
    what: 'landing.int.ors.what',
    why: 'landing.int.ors.why',
  },
  {
    name: 'Telegram Bot API', category: 'comms', api: 'REST', effort: 'low', status: 'available',
    what: 'landing.int.telegram.what',
    why: 'landing.int.telegram.why',
  },
  {
    name: 'Viber Business', category: 'comms', api: 'REST', effort: 'medium', status: 'partner',
    what: 'landing.int.viber.what',
    why: 'landing.int.viber.why',
  },
  {
    name: 'Power BI', category: 'bi', api: 'REST', effort: 'medium', status: 'available',
    what: 'landing.int.powerbi.what',
    why: 'landing.int.powerbi.why',
  },
  {
    name: 'Metabase', category: 'bi', api: 'REST', effort: 'medium', status: 'available',
    what: 'landing.int.metabase.what',
    why: 'landing.int.metabase.why',
  },
  {
    name: 'OpenWeather Road Risk', category: 'weather', api: 'REST', effort: 'low', status: 'available',
    what: 'landing.int.openweather.what',
    why: 'landing.int.openweather.why',
  },

  // ── Комплаєнс ─────────────────────────────────────────────────────────
  {
    name: 'Тахограф — віддалене зчитування (DDD)', category: 'compliance', api: 'REST', effort: 'medium', status: 'partner',
    what: 'landing.int.tachographDdd.what',
    why: 'landing.int.tachographDdd.why',
  },
  {
    name: 'Opendatabot', category: 'compliance', api: 'REST', effort: 'low', status: 'available',
    what: 'landing.int.opendatabot.what',
    why: 'landing.int.opendatabot.why',
  },
  {
    name: 'е-ТТН', category: 'compliance', api: 'REST', effort: 'high', status: 'research',
    what: 'landing.int.ettn.what',
    why: 'landing.int.ettn.why',
  },
  {
    name: 'SAF-T UA', category: 'compliance', api: 'file-exchange', effort: 'high', status: 'available',
    what: 'landing.int.saftUa.what',
    why: 'landing.int.saftUa.why',
  },
  {
    name: 'e-CMR / eFTI', category: 'compliance', api: 'REST', effort: 'high', status: 'research',
    what: 'landing.int.ecmr.what',
    why: 'landing.int.ecmr.why',
  },
];
