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
    what: 'Паливні картки, транзакції, АЗС і залишки по картках мережі OKKO.',
    why: 'Основна мережа для внутрішніх рейсів — саме з неї починався зведений звіт.',
  },
  {
    name: 'Shell Mobility B2B', category: 'fuel', api: 'REST', effort: 'medium', status: 'live',
    what: 'Транзакції по картках Shell із європейських заправок за форматом YYYYMMDD.',
    why: 'Закриває міжнародне плече рейсів, де українські картки не приймають.',
  },
  {
    name: 'Ruptela fm-track', category: 'telematics', api: 'REST', effort: 'high', status: 'live',
    what: 'Позиція, запалювання, оберти, мотогодини та рівень пального з CAN-шини тягача.',
    why: 'Дає фізичну правду про рейс поруч із фінансовою — витрату проти оплати.',
  },
  {
    name: 'Ruptela Routing & Tasking', category: 'telematics', api: 'GraphQL', effort: 'high', status: 'live',
    what: 'Планування рейсів, точки завантаження й розвантаження, призначення водіїв.',
    why: 'Завдання доходить водієві в кабіну, а не в телефонну розмову з диспетчером.',
  },

  // ── Паливні мережі ────────────────────────────────────────────────────
  {
    name: 'SOCAR sCard', category: 'fuel', api: 'REST', effort: 'medium', status: 'partner',
    what: 'Картки мережі SOCAR із віртуальним аналогом і клієнтським API для синхронізації з ERP.',
    why: 'Єдина українська мережа після OKKO, що прямо декларує API, — найближчий третій вендор.',
  },
  {
    name: 'Агрегатори карток (e-Kard, SC Formula)', category: 'fuel', api: 'none', effort: 'medium', status: 'partner',
    what: 'Одна картка на 8+ мереж: WOG, SOCAR, KLO, Укрнафта, Shell, Маршал, Паралель.',
    why: 'Покриває майже весь ринок однією інтеграцією замість шести окремих адаптерів.',
  },
  {
    name: 'WOG', category: 'fuel', api: 'none', effort: 'medium', status: 'unclear',
    what: 'Смарт-картки та B2B-кабінет із лімітами, балансами й рахунками.',
    why: 'Одна з найбільших мереж — без неї зведений звіт по пальному завжди неповний.',
  },
  {
    name: 'Укрнафта', category: 'fuel', api: 'none', effort: 'medium', status: 'unclear',
    what: 'Картки й талони з кабінетом для транзакцій, аналітики витрат і звітів.',
    why: 'Найширше покриття в регіонах, де OKKO і Shell представлені слабко.',
  },
  {
    name: 'UPG', category: 'fuel', api: 'REST', effort: 'medium', status: 'unclear',
    what: 'Електронні паливні картки й талони з контролем активів у реальному часі.',
    why: 'Активно працює з великими автопарками, інтеграція через API згадується для корпоративних клієнтів.',
  },
  {
    name: 'AMIC Energy', category: 'fuel', api: 'none', effort: 'medium', status: 'unclear',
    what: 'Картки для юросіб: баланси, транзакції, переказ коштів, блокування карток.',
    why: 'Сильне покриття на заході України — там, де починається кожен рейс із Буковини.',
  },

  // ── Телематика й датчики ──────────────────────────────────────────────
  {
    name: 'flespi', category: 'telematics', api: 'REST', effort: 'medium', status: 'available',
    what: 'Приймає дані 1000+ протоколів трекерів і віддає їх єдиним JSON через REST і MQTT.',
    why: 'Один адаптер замість окремого коду під кожен трекер, який завтра зʼявиться в парку.',
  },
  {
    name: 'Wialon (Gurtam)', category: 'telematics', api: 'REST', effort: 'medium', status: 'available',
    what: 'Обʼєкти, повідомлення, звіти й події платформи з підтримкою 3600+ моделей трекерів.',
    why: 'Дозволяє підключити парк, який уже сидить на Wialon, не змінюючи жодного трекера.',
  },
  {
    name: 'Teltonika FOTA WEB', category: 'telematics', api: 'REST', effort: 'low', status: 'available',
    what: 'Віддалене керування конфігураціями та прошивками трекерів.',
    why: 'Оновлення обладнання без заганяння тягача на базу.',
  },
  {
    name: 'Technoton DUT-E / DFM', category: 'sensors', api: 'CAN', effort: 'low', status: 'available',
    what: 'Ємнісні датчики рівня та витратоміри з похибкою 1% по шині CAN J1939.',
    why: 'Обсяг у баку поруч із транзакцією по картці — саме на цій різниці ловлять зливи.',
  },
  {
    name: 'Omnicomm LLS / Escort', category: 'sensors', api: 'CAN', effort: 'low', status: 'available',
    what: 'Датчики з відкритим протоколом LLS по RS-232/RS-485 через телематичний блок.',
    why: 'Альтернатива Technoton у вже обладнаних тягачах — незалежність від попереднього підрядника.',
  },

  // ── Облік, ЕДО, банки ─────────────────────────────────────────────────
  {
    name: 'Вчасно (ЕДО)', category: 'accounting', api: 'REST', effort: 'medium', status: 'available',
    what: 'Відкрите API для вивантаження документів і надсилання нових на підпис контрагенту.',
    why: 'Акти й рахунки за пальне підписуються з ERP, без окремого вікна документообігу.',
  },
  {
    name: 'BAS ERP / 1С (OData)', category: 'accounting', api: 'REST', effort: 'medium', status: 'available',
    what: 'Автоматичний REST-інтерфейс OData до довідників і документів облікової системи.',
    why: 'Бухгалтерія отримує готові документи замість щомісячного перенесення виписок руками.',
  },
  {
    name: 'M.E.Doc «Інтеграція»', category: 'accounting', api: 'REST', effort: 'medium', status: 'partner',
    what: 'Офіційний модуль обміну первинними документами та звітністю з обліковою системою.',
    why: 'Стоїть у переважної більшості українських бухгалтерій — найкоротший шлях до податкового обліку.',
  },
  {
    name: 'Paperless (ПриватБанк)', category: 'accounting', api: 'REST', effort: 'medium', status: 'partner',
    what: 'Безкоштовний обмін електронними документами з окремою послугою інтеграції.',
    why: 'Нульова вартість робить його найдешевшим каналом для дрібних контрагентів.',
  },
  {
    name: 'ПриватБанк «Автоклієнт»', category: 'banking', api: 'REST', effort: 'medium', status: 'available',
    what: 'Виписки, залишки по рахунках та ініціювання платежів через ключі з Приват24 для бізнесу.',
    why: 'Автоматично зіставляє поповнення паливних балансів із банківськими списаннями.',
  },
  {
    name: 'monobank Corporate', category: 'banking', api: 'webhook', effort: 'low', status: 'available',
    what: 'Виписки, залишки й вебхуки на нові транзакції без обмежень за частотою запитів.',
    why: 'Вебхуки оновлюють витрати миттєво, а не раз на добу файлом виписки.',
  },

  // ── Карти, звʼязок, аналітика ─────────────────────────────────────────
  {
    name: 'HERE Routing v8', category: 'mapping', api: 'REST', effort: 'medium', status: 'available',
    what: 'Маршрут із урахуванням маси, висоти, навантаження на вісь і категорій тунелів для ADR.',
    why: 'Для парку тягачів це різниця між планом рейсу і штрафом на мосту з обмеженням висоти.',
  },
  {
    name: 'Visicom', category: 'mapping', api: 'REST', effort: 'low', status: 'available',
    what: 'Українська картографія: геокодування, пошук обʼєктів і маршрутизація по Україні та сусідніх країнах.',
    why: 'Детальніша за глобальні сервіси адресна база — точніша прив’язка АЗС і точок розвантаження.',
  },
  {
    name: 'OpenRouteService (HGV)', category: 'mapping', api: 'REST', effort: 'low', status: 'available',
    what: 'Відкрита маршрутизація для важкого транспорту з габаритами й типом небезпечного вантажу.',
    why: 'Безкоштовна перевірка гіпотез, поки не окупився платний контракт із HERE.',
  },
  {
    name: 'Telegram Bot API', category: 'comms', api: 'REST', effort: 'low', status: 'available',
    what: 'Сповіщення, звіти й кнопки підтвердження для водіїв і диспетчерів.',
    why: 'Безкоштовний канал, яким водії користуються щодня, — попередження доходить за секунди.',
  },
  {
    name: 'Viber Business', category: 'comms', api: 'REST', effort: 'medium', status: 'partner',
    what: 'Транзакційні повідомлення із зображеннями та кнопками через Infobip або Київстар.',
    why: 'Основний месенджер частини водіїв, для яких Telegram не є звичним.',
  },
  {
    name: 'Power BI', category: 'bi', api: 'REST', effort: 'medium', status: 'available',
    what: 'Push-набори даних із пачками до 10 000 рядків і автентифікацією через service principal.',
    why: 'Витрати на пальне поруч із рештою фінансової звітності групи.',
  },
  {
    name: 'Metabase', category: 'bi', api: 'REST', effort: 'medium', status: 'available',
    what: 'Self-hosted BI з вбудовуванням дашбордів через підписаний JWT.',
    why: 'Глибока аналітика без вивезення даних про рейси за межі власного сервера.',
  },
  {
    name: 'OpenWeather Road Risk', category: 'weather', api: 'REST', effort: 'low', status: 'available',
    what: 'Прогноз по точках маршруту з температурою покриття та ризиком ожеледиці.',
    why: 'Попередження про ожеледицю на конкретній ділянці, а не про погоду в місті загалом.',
  },

  // ── Комплаєнс ─────────────────────────────────────────────────────────
  {
    name: 'Тахограф — віддалене зчитування (DDD)', category: 'compliance', api: 'REST', effort: 'medium', status: 'partner',
    what: 'Автоматичне завантаження файлів тахографа й карток водіїв за розкладом через уже встановлений термінал Ruptela.',
    why: 'Знімає поїздки водія в офіс із карткою і закриває вимоги Регламенту ЄС 165/2014.',
  },
  {
    name: 'Opendatabot', category: 'compliance', api: 'REST', effort: 'low', status: 'available',
    what: 'Перевірка контрагента за ЄДРПОУ: реєстраційні дані, податковий борг, санкції, повноваження директора.',
    why: 'Перевіряє замовника до виїзду машини, а не після несплаченого рахунку.',
  },
  {
    name: 'е-ТТН', category: 'compliance', api: 'REST', effort: 'high', status: 'research',
    what: 'Державна система електронних товарно-транспортних накладних через акредитованого провайдера.',
    why: 'Обовʼязковість очікується з 2027 року, а спецформи для пального стартують тоді ж.',
  },
  {
    name: 'SAF-T UA', category: 'compliance', api: 'file-exchange', effort: 'high', status: 'available',
    what: 'Вивантаження облікових даних у стандартизований XML за форматом ОЕСР для е-аудиту ДПС.',
    why: 'Великі платники подають його вже зараз, а пальне — часта зона запитань під час перевірок.',
  },
  {
    name: 'e-CMR / eFTI', category: 'compliance', api: 'REST', effort: 'high', status: 'research',
    what: 'Електронна міжнародна накладна та цифровий обмін транспортною інформацією з органами ЄС.',
    why: 'З липня 2027 усі компетентні органи ЄС зобовʼязані приймати ці дані цифрово.',
  },
];
