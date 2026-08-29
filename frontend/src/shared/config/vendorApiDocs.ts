/**
 * Довідник інтеграції паливних вендорів (OKKO та Shell) для сторінки «Документація API».
 *
 * Джерело правди — сам код шлюзу, не вигадані ендпоінти:
 *  - backend/src/okko/okko-api.service.ts        (OKKO ERP Gateway, REST)
 *  - backend/src/shell/shell-api.service.ts      (Shell Fleet Management, REST/POST)
 *  - крос-вендорні контролери: transactions / cards / merchants / analytics
 *
 * Кожен запис описує ДВА рівні: маршрут нашого NestJS-шлюзу і той запит, який шлюз
 * реально відправляє у вендора. Одиниці й нормалізація (копійки → грн, мілілітри → літри,
 * похідна ціна, 30-денний зсув OKKO; дати YYYYMMDD, EUR, пагінація та категорії Shell)
 * описані тут же — вони живуть в адаптері й не дублюються нижче за течією.
 *
 * УВАГА: назви полів, шляхи та JSON — це дані вендора, вони НЕ перекладаються.
 */

export type HttpVerb = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface DocParam {
  name: string;
  required?: boolean;
  note: string;
}

export interface DocMethod {
  id: string;
  title: string;
  verb: HttpVerb;
  /** Маршрут нашого NestJS-шлюзу. */
  path: string;
  summary: string;
  upstream: {
    verb: HttpVerb;
    /** Повний URL у вендора, як його формує сервіс. */
    url: string;
    note?: string;
  };
  params?: DocParam[];
  /** JSON-тіло запиту (для POST/PUT). */
  body?: string;
  /** Форма відповіді нашого шлюзу. */
  response?: string;
  notes?: string[];
}

export interface DocGroup {
  id: string;
  title: string;
  blurb: string;
  methods: DocMethod[];
}

export const OKKO_BASE = 'https://gw-online.okko.ua:9443/api/erp';
export const SHELL_BASE = 'https://api.shell.com';

/* ─────────────────────────────────────────────────────────────────────────
   Обгортки-відповіді, які гарантує наш шлюз
   ───────────────────────────────────────────────────────────────────────── */

/** Крос-вендорні колекції (cards / merchants / transactions) — пагінація в памʼяті. */
const PAGED_ENVELOPE = `{
  "items": [ { "…": "нормалізовані записи (snake_case)" } ],
  "total": 128,
  "page": 1,
  "size": 10,
  "totalPages": 13
}`;

/* ═════════════════════════════════════════════════════════════════════════
   OKKO — ERP Gateway (REST)
   ═════════════════════════════════════════════════════════════════════════ */

export const OKKO_TRANSPORT_NOTES: Array<{ title: string; text: string }> = [
  {
    title: 'Ключ — у заголовку X-API-KEY',
    text:
      'OKKO автентифікує кожен запит заголовком X-API-KEY. Наш шлюз підставляє його сам із ' +
      'backend/.env (OKKO_API_KEY) — у браузер ключ не потрапляє. Логін/пароль (OKKO_LOGIN / ' +
      'OKKO_PASSWORD) зберігаються для довідки, але сам шлюз ходить лише за ключем.',
  },
  {
    title: 'Самопідписаний сертифікат',
    text:
      'Продакшн-шлюз gw-online.okko.ua:9443 віддає сертифікат, що не проходить валідацію. Наш ' +
      'клієнт свідомо піднімає https.Agent з rejectUnauthorized:false. Прямий виклик із Delphi/curl ' +
      'теж доведеться робити з вимкненою перевіркою сертифіката.',
  },
  {
    title: 'Гроші — у копійках, обʼєм — у мілілітрах',
    text:
      'OKKO повертає суми в копійках (шлюз ділить на 100) і обʼєм у мілілітрах (ділить на 1000, коли ' +
      'значення > 100). Ціна за літр НЕ береться з відповіді — вона похідна: сума / обʼєм. Клієнту ' +
      'шлюз віддає вже гривні та літри.',
  },
  {
    title: 'Максимум 30 днів на запит транзакцій',
    text:
      'OKKO обмежує вікно транзакцій 30 днями. formatAndClampOkkoDates() тихо підтягує date_from ' +
      'уперед, якщо діапазон ширший або відʼємний — запит не відхиляється, а звужується до 30 днів ' +
      'назад від date_to.',
  },
  {
    title: 'Типи операцій — числові коди',
    text:
      'trans_type приходить числом (774/775/783/787/737…). parseTransactionType() перекладає його в ' +
      'український опис і виставляє is_return для повернень/сторно. Прапорець reversal обробляється ' +
      'окремо — навіть невідомий код зі reversal=true вважається поверненням.',
  },
  {
    title: 'Помилки невидимі: порожній масив замість збою',
    text:
      'Кожен виклик OKKO загорнутий у try/catch, що логує помилку й повертає []. Мертвий upstream ' +
      'дає занулені KPI, а не HTTP-помилку. «Немає даних» ніколи не кидає виняток — дивіться логи ' +
      'бекенду, а не код відповіді.',
  },
];

export const OKKO_GROUPS: DocGroup[] = [
  {
    id: 'okko-contracts',
    title: 'Договори',
    blurb:
      'Реєстр договорів OKKO і баланс по кожному. Ендпоінт віддає голий масив (не пагінована ' +
      'обгортка) — читайте його через unwrapList на клієнті.',
    methods: [
      {
        id: 'okko-contracts-list',
        title: 'Список договорів',
        verb: 'GET',
        path: '/api/contracts',
        summary:
          'Усі договори акаунта ТОВ «Велес Буковина». Баланс приходить у копійках і ділиться на 100; ' +
          'решта полів нормалізується до snake_case-форми OkkoContract.',
        upstream: {
          verb: 'GET',
          url: `${OKKO_BASE}/v2/contracts`,
          note: 'X-API-KEY у заголовку. Відповідь — масив без обгортки.',
        },
        response: `[
  {
    "contract_id": "0010029571",
    "contract_number": "27ПК-40868/23",
    "contract_name": "Договір 27ПК-40868/23",
    "client_id": "0600036165",
    "client_name": "ТОВ \\"Велес Буковина\\"",
    "contract_type": "ZWKO",
    "contract_status": "ACTIVE",
    "balance": 80011.39,          // грн (у вендора — копійки)
    "credit_limit": 0,
    "currency": "UAH",
    "created_at": "2023-08-04"
  }
]`,
        notes: [
          'balance = raw / 100. credit_limit береться з overdraft_limit.',
          'Це джерело contract_id для /api/cards: без явного contract_id шлюз бере перший договір зі списку.',
        ],
      },
      {
        id: 'okko-contract-one',
        title: 'Один договір',
        verb: 'GET',
        path: '/api/contracts/:id',
        summary: 'Договір за contract_id. Шлюз шукає його у вже завантаженому списку договорів.',
        upstream: {
          verb: 'GET',
          url: `${OKKO_BASE}/v2/contracts`,
          note: 'Окремого ендпоінта одного договору немає — фільтрується з масиву /v2/contracts.',
        },
        params: [{ name: ':id', required: true, note: 'contract_id договору' }],
        notes: ['Якщо id не знайдено, шлюз повертає перший договір списку, а не 404.'],
      },
    ],
  },

  {
    id: 'okko-cards',
    title: 'Паливні картки',
    blurb:
      'Картки договору з лімітами й статусами. Крос-вендорний ендпоінт /api/cards пагінує в памʼяті ' +
      'та зливає OKKO і Shell; brand=OKKO лишає тільки OKKO.',
    methods: [
      {
        id: 'okko-cards-list',
        title: 'Список карток',
        verb: 'GET',
        path: '/api/cards?brand=OKKO',
        summary:
          'Картки одного договору. Статус приходить кодом CHST (див. довідник нижче) і резолвиться в ' +
          'українську назву; is_active — true лише для обслуговуваних статусів (CHST0/CHST4/ACTV). ' +
          'Значення лімітів — у копійках, шлюз ділить на 100.',
        upstream: {
          verb: 'GET',
          url: `${OKKO_BASE}/v2/cards?contract_id=<id>&size=100&offset=0`,
          note: 'Без contract_id шлюз спершу тягне /v2/contracts і бере перший договір.',
        },
        params: [
          { name: 'brand', note: 'ALL | OKKO | SHELL — brand=OKKO лишає лише картки OKKO' },
          { name: 'contract_id', note: 'Договір; за замовчуванням — перший зі списку' },
          { name: 'page', note: 'Сторінка (пагінація в памʼяті шлюзу)' },
          { name: 'size', note: 'Розмір сторінки (типово 10)' },
        ],
        response: `{
  "items": [
    {
      "card_num": "7005830000000000",
      "contract_id": "0010029571",
      "status": "CHST0",
      "status_desc": "Активовано",
      "is_active": true,
      "card_owner_f_name": "Водій Велес",
      "exp_date": "2040-02-29",
      "limits": [
        {
          "limit_id": "1",
          "limit_type": "0",
          "limit_desc": "Ліміт доба",
          "limit_value": 5000.00,     // грн (у вендора — копійки)
          "limit_remains": 4200.00,
          "limit_used": 800.00,
          "cycle_type_desc": "доба"
        }
      ]
    }
  ],
  "total": 42, "page": 1, "size": 10, "totalPages": 5
}`,
        notes: [
          'card_status відсутній → трактується як CHST0 (робочий стан). CHST5 — «Заблоковано».',
          'Усі limit_* поля = raw / 100.',
        ],
      },
      {
        id: 'okko-cards-stats',
        title: 'Статистика карток',
        verb: 'GET',
        path: '/api/cards/stats',
        summary: 'Агреговані лічильники по картках OKKO: усього / активні / заблоковані / частка активних.',
        upstream: {
          verb: 'GET',
          url: `${OKKO_BASE}/v2/cards?contract_id=<перший договір>&size=100&offset=0`,
          note: 'Рахується поверх getCards(); Shell тут не враховується.',
        },
        response: `{
  "totalCards": 42,
  "activeCards": 40,
  "blockedCards": 2,
  "activeRatio": 95
}`,
      },
    ],
  },

  {
    id: 'okko-merchants',
    title: 'АЗС (мережа)',
    blurb: 'Довідник заправних станцій OKKO. Крос-вендорний /api/merchants пагінує в памʼяті.',
    methods: [
      {
        id: 'okko-merchants-list',
        title: 'Список АЗС',
        verb: 'GET',
        path: '/api/merchants?brand=OKKO',
        summary:
          'Станції мережі OKKO. Адреса чиститься від суфікса «UKR»; місто/регіон вендор не деталізує, ' +
          'тож шлюз ставить «Україна», а перелік послуг — типовий набір OKKO Drive.',
        upstream: {
          verb: 'GET',
          url: `${OKKO_BASE}/v2/merchants`,
          note: 'Відповідь вендора — масив; шлюз загортає його в пагіновану обгортку.',
        },
        params: [
          { name: 'brand', note: 'ALL | OKKO | SHELL' },
          { name: 'page', note: 'Сторінка' },
          { name: 'size', note: 'Розмір сторінки (типово 12)' },
        ],
        response: `{
  "items": [
    {
      "merchant_id": "12345",
      "merchant_sap_id": "SAP-12345",
      "merchant_name": "АЗС #12345",
      "merchant_address": "м. Чернівці, вул. ...",
      "city": "Україна",
      "region": "Україна",
      "services": ["Pulls Diesel", "Pulls 95", "OKKO Drive", "AdBlue", "Кафе ОККО"],
      "status": "OPEN"
    }
  ],
  "total": 400, "page": 1, "size": 12, "totalPages": 34
}`,
      },
    ],
  },

  {
    id: 'okko-transactions',
    title: 'Транзакції (заправки)',
    blurb:
      'Журнал списань пального. Тут живуть головні нормалізації OKKO: гроші/100, обʼєм/1000, похідна ' +
      'ціна та класифікація типу операції. Максимальне вікно — 30 днів.',
    methods: [
      {
        id: 'okko-tx-list',
        title: 'Список транзакцій',
        verb: 'GET',
        path: '/api/transactions?brand=OKKO',
        summary:
          'Заправки за період. amnt_trans — грн (копійки/100), volume — літри (мл/1000), price — ' +
          'похідна (сума/обʼєм), а не поле з відповіді. trans_type_desc і is_return виставляє ' +
          'parseTransactionType().',
        upstream: {
          verb: 'GET',
          url: `${OKKO_BASE}/v2/transactions?date_from=<YYYY-MM-DD>&date_to=<YYYY-MM-DD>&processed_in_bo=true&size=100&offset=0`,
          note:
            'date_from/date_to клампуються до 30-денного вікна перед відправкою. Формат дати — YYYY-MM-DD.',
        },
        params: [
          { name: 'brand', note: 'ALL | OKKO | SHELL' },
          { name: 'date_from', note: 'Початок періоду YYYY-MM-DD (клампується до 30 днів)' },
          { name: 'date_to', note: 'Кінець періоду YYYY-MM-DD' },
          { name: 'trans_type', note: 'Фільтр за кодом типу; ALL або відсутній — усі' },
          { name: 'page', note: 'Сторінка (пагінація в памʼяті)' },
          { name: 'size', note: 'Розмір сторінки (типово 10)' },
        ],
        response: `{
  "items": [
    {
      "trans_id": "987654321",
      "trans_date": "2026-08-05T11:42:10.000Z",
      "contract_id": "0010029571",
      "contract_name": "27ПК-40868/23",
      "card_num": "7005830000000000",
      "azs_name": "АЗС #12345",
      "addr_name": "м. Чернівці, вул. ...",
      "product_id": "DPP",
      "product_desc": "Дизельне паливо",
      "price": 54.90,          // грн/л — ПОХІДНА: amnt_trans / volume
      "volume": 420.50,        // л (у вендора — мл)
      "amnt_trans": 23085.45,  // грн (у вендора — копійки)
      "amount_discount": 210.00,
      "trans_type": 774,
      "trans_type_desc": "Списання пального",
      "reversal": false,
      "is_return": false,
      "processed_in_bo": true
    }
  ],
  "total": 128, "page": 1, "size": 10, "totalPages": 13
}`,
        notes: [
          'Коди типів: 737 «до повного бака», 774 «списання/повне скасування», 775 «часткова/повна відміна», 783 «повне повернення талону», 787 «часткове повернення талону».',
          'processed_in_bo=true — беруться лише проведені у бек-офісі операції.',
          'brand=SHELL підмінює джерело на Shell (див. вкладку Shell), а поля мапляться в цю ж форму.',
        ],
      },
      {
        id: 'okko-basket',
        title: 'Кошик товарів транзакції',
        verb: 'GET',
        path: '/api/transactions/basket/:id',
        summary: 'Позиції товарного чека (магазин/кафе), якщо операція мала basket_of_goods.',
        upstream: {
          verb: 'GET',
          url: `${OKKO_BASE}/v2/basket?trans_id=<id>&reversal=false`,
        },
        params: [{ name: ':id', required: true, note: 'trans_id транзакції' }],
        response: `[
  { "product_id": "…", "product_name": "…", "product_desc": "…", "quantity": 1, "price": 0, "amount": 0 }
]`,
        notes: ['Відповідь проходить від вендора як є, без нормалізації.'],
      },
      {
        id: 'okko-metadata',
        title: 'Метадані (довідники)',
        verb: 'GET',
        path: '/api/transactions/metadata',
        summary:
          'Службові словники OKKO (звідси взято, зокрема, довідник статусів карток CHST). Проходить ' +
          'від вендора без змін.',
        upstream: { verb: 'GET', url: `${OKKO_BASE}/v2/metadata` },
      },
    ],
  },

  {
    id: 'okko-analytics',
    title: 'Аналітика',
    blurb:
      'Похідні звіти поверх транзакцій та реєстрів. Ендпоінти віддають голі масиви/обʼєкти (не ' +
      'пагіновану обгортку). Параметр brand фанаутить у потрібні вендори.',
    methods: [
      {
        id: 'okko-analytics-summary',
        title: 'Зведені показники',
        verb: 'GET',
        path: '/api/analytics/summary?brand=OKKO',
        summary:
          'KPI за період: договори, баланс, картки, АЗС, кількість і сума транзакцій, обʼєм, знижки. ' +
          'brand=ALL додає Shell, brand=SHELL рахує лише Shell.',
        upstream: {
          verb: 'GET',
          url: `${OKKO_BASE}/v2/contracts · /v2/cards · /v2/merchants · /v2/transactions`,
          note: 'Це агрегат кількох викликів OKKO (і Shell при brand=ALL/SHELL), а не один ендпоінт.',
        },
        params: [
          { name: 'brand', note: 'ALL | OKKO | SHELL' },
          { name: 'date_from', note: 'YYYY-MM-DD' },
          { name: 'date_to', note: 'YYYY-MM-DD' },
        ],
        response: `{
  "brand": "OKKO",
  "totalContracts": 3,
  "totalBalanceUah": 240000.00,
  "totalCards": 42,
  "activeCards": 40,
  "totalMerchantsAZS": 400,
  "totalTransactions": 128,
  "totalSpendUah": 512000.00,
  "totalVolumeLiters": 9200.00,
  "totalDiscountsUah": 1800.00,
  "apiStatus": { "mode": "LIVE_OKKO_PRODUCTION_GATEWAY", "…": "…" }
}`,
      },
      {
        id: 'okko-analytics-breakdown',
        title: 'Розклад по паливу',
        verb: 'GET',
        path: '/api/analytics/fuel-breakdown?brand=OKKO',
        summary: 'Обʼєм / сума / кількість заправок у розрізі продукту, з тегом бренду (OKKO / Shell).',
        upstream: {
          verb: 'GET',
          url: `${OKKO_BASE}/v2/transactions  (+ Shell pricedtransactions при brand=ALL/SHELL)`,
        },
        params: [
          { name: 'brand', note: 'ALL | OKKO | SHELL' },
          { name: 'date_from', note: 'YYYY-MM-DD' },
          { name: 'date_to', note: 'YYYY-MM-DD' },
        ],
        response: `[
  { "product": "OKKO: Дизельне паливо", "volume": 9200, "spend": 512000, "count": 120, "brand": "OKKO" }
]`,
      },
      {
        id: 'okko-analytics-trends',
        title: 'Динаміка витрат',
        verb: 'GET',
        path: '/api/analytics/spending-trends?brand=OKKO',
        summary:
          'Витрати й обʼєм по днях. Ключ дати — YYYY-MM-DD; окремо тримаються okkoSpend і shellSpend, ' +
          'тому вісь коректно зводить обидва бренди.',
        upstream: {
          verb: 'GET',
          url: `${OKKO_BASE}/v2/transactions  (+ Shell pricedtransactions при brand=ALL/SHELL)`,
          note: 'Дати Shell нормалізуються з YYYYMMDD в ISO ще в адаптері, інакше вісь зламалася б.',
        },
        params: [
          { name: 'brand', note: 'ALL | OKKO | SHELL' },
          { name: 'date_from', note: 'YYYY-MM-DD' },
          { name: 'date_to', note: 'YYYY-MM-DD' },
        ],
        response: `[
  { "date": "2026-08-05", "spend": 42000, "volume": 760, "okkoSpend": 42000, "shellSpend": 0 }
]`,
      },
    ],
  },
];

/** Довідник статусів карток OKKO (CHST) — витяг із живого /v2/metadata. */
export const OKKO_CARD_STATUS_REF: Array<{ code: string; ua: string; active?: boolean }> = [
  { code: 'CHST0', ua: 'Активовано', active: true },
  { code: 'CHST1', ua: 'Неактивована' },
  { code: 'CHST3', ua: 'Анульовано' },
  { code: 'CHST4', ua: 'Обслуговувати з документом', active: true },
  { code: 'CHST5', ua: 'Заблоковано' },
  { code: 'CHST6', ua: 'Загублено' },
  { code: 'CHST7', ua: 'Викрадено' },
  { code: 'CHST13', ua: 'Заблоковано після невдалого вводу PIN' },
  { code: 'CHST19', ua: 'Підозра в шахрайстві' },
  { code: 'CHST20', ua: 'Тимчасово заблокована клієнтом' },
  { code: 'CHST21', ua: 'Заблокована клієнтом' },
  { code: 'CHST99', ua: 'Перенесено між контрактами' },
];

/** Класифікатор типів транзакцій OKKO (parseTransactionType). */
export const OKKO_TX_TYPES: Array<{ code: string; ua: string; isReturn?: boolean }> = [
  { code: '737', ua: 'Заправка до повного бака' },
  { code: '774', ua: 'Списання пального (reversal → повне скасування)' },
  { code: '775', ua: 'Часткова або повна відміна', isReturn: true },
  { code: '783', ua: 'Повне повернення талону', isReturn: true },
  { code: '787', ua: 'Часткове повернення талону', isReturn: true },
];

/* ═════════════════════════════════════════════════════════════════════════
   Shell — Fleet Management / Card Transaction Data API (REST, POST)
   ═════════════════════════════════════════════════════════════════════════ */

export const SHELL_TRANSPORT_NOTES: Array<{ title: string; text: string }> = [
  {
    title: 'Дві авторизації в одному запиті',
    text:
      'Shell вимагає одразу Authorization: Basic base64(apiKey:secret) І окремий заголовок apikey. ' +
      'Шлюз збирає їх із backend/.env (SHELL_API_KEY + SHELL_SECRET, або готовий SHELL_BASIC_AUTH). ' +
      'Без обох заголовків вендор відповідає 401.',
  },
  {
    title: 'Усе — POST, база /fleetmanagement/v1',
    text:
      'Навіть «читання» транзакцій — це POST із JSON-тілом на api.shell.com/fleetmanagement/v1/*. ' +
      'Фільтри (діапазон дат, платник) передаються в тілі, а не в query.',
  },
  {
    title: 'PayerNumber і ColCoCode обовʼязкові',
    text:
      'Кожен запит даних адресується конкретному платнику (SHELL_PAYER_NUMBER) в конкретній країні ' +
      '(SHELL_COLCO_CODE). Без них шлюз логує попередження й повертає порожньо — Shell не знає, чиї ' +
      'дані віддавати.',
  },
  {
    title: 'Дати — компактний YYYYMMDD',
    text:
      'FromDate/ToDate ідуть у Shell рядком YYYYMMDD. У відповіді дати теж такі — toIsoDate() ' +
      'нормалізує їх в ISO ще в адаптері, інакше 20260608 стає поруч з ISO-ключами OKKO і ламає ' +
      'вісь графіка. За замовчуванням береться діапазон 90 днів.',
  },
  {
    title: 'Пагінація вручну: PageSize 1000 × CurrentPage',
    text:
      'pricedtransactions віддає сторінками по 1000 рядків. Шлюз ітерує CurrentPage, доки не вичерпає ' +
      'TotalPages (запобіжник — 30 сторінок ≈ 30 000 рядків). Продакшн повільний: одна сторінка ~18 с, ' +
      'тому таймаут клієнта — 30 с, а результат кешується на 60 с із дедупом паралельних запитів.',
  },
  {
    title: 'Помилка сидить у полі Error, не в HTTP-коді',
    text:
      'Shell може відповісти 200 з Error.Code ≠ "0000" — це збій. Адаптер кидає виняток на такому ' +
      'тілі. Як і в OKKO, зовнішній try/catch перетворює будь-який збій на порожній масив, а не на ' +
      'HTTP-помилку (кеш при цьому не отруюється порожнечею — віддається попередній успішний зріз).',
  },
  {
    title: 'Багато типів операцій, не лише «заправка»',
    text:
      'Shell повертає пальне, AdBlue, мийки, паркування, дорожні збори, комісії за картку та грошові ' +
      'коригування. parseShellTransactionType() класифікує кожен рядок за ProductGroupName/ProductGroupId ' +
      '(джерело істини), локалізує назву категорії й дає стабільний код SHELL_G<id> (або SHELL_FEE / ' +
      'SHELL_PURCHASE) — аналог OKKO parseTransactionType.',
  },
];

export const SHELL_GROUPS: DocGroup[] = [
  {
    id: 'shell-user',
    title: 'Користувач і платники',
    blurb: 'Профіль автентифікованого користувача Shell та групи платників, до яких він має доступ.',
    methods: [
      {
        id: 'shell-user',
        title: 'Поточний користувач',
        verb: 'GET',
        path: '/api/shell/user',
        summary: 'Профіль користувача Shell Fleet Hub разом із групою платників (для перевірки доступу).',
        upstream: {
          verb: 'POST',
          url: `${SHELL_BASE}/fleetmanagement/v1/user/LoggedInUser`,
          note: 'Тіло: { "IncludePayerGroup": true }.',
        },
        body: `{ "IncludePayerGroup": true }`,
        notes: ['Проходить від вендора як є. При збої повертається null, а не порожній масив.'],
      },
    ],
  },

  {
    id: 'shell-accounts',
    title: 'Клієнтські рахунки',
    blurb:
      'Єдиний «реальний» довідниковий ендпоінт Shell — рахунки платника. Картки й АЗС окремих ' +
      'ендпоінтів не мають і виводяться з транзакцій (див. нижче).',
    methods: [
      {
        id: 'shell-accounts',
        title: 'Рахунки платника',
        verb: 'GET',
        path: '/api/shell/accounts',
        summary:
          'Активні рахунки для SHELL_PAYER_NUMBER у країні SHELL_COLCO_CODE, з підсумком по картках. ' +
          'Проходить від вендора як масив Accounts (PascalCase не перейменовується).',
        upstream: {
          verb: 'POST',
          url: `${SHELL_BASE}/fleetmanagement/v1/customer/accounts`,
        },
        body: `{
  "PayerNumber": "<SHELL_PAYER_NUMBER>",
  "ColCoCode": "<SHELL_COLCO_CODE>",
  "Status": "ACTIVE",
  "IncludeCardSummary": true
}`,
        response: `[
  {
    "AccountId": 100200,
    "AccountNumber": "GB000000000",
    "AccountFullName": "VELES BUKOVYNA LLC",
    "AccountShortName": "VELES",
    "ColCoCountryCode": "PL",
    "CurrencyCode": "EUR",
    "CurrencySymbol": "€",
    "GrossAmount": 0,
    "Status": "ACTIVE"
  }
]`,
        notes: ['Шлюз повертає вміст response.data.Accounts; без нього — [].'],
      },
    ],
  },

  {
    id: 'shell-transactions',
    title: 'Priced Transactions',
    blurb:
      'Основне (і по суті єдине) джерело реальних даних Shell. Звідси похідні й картки, і АЗС, і вся ' +
      'аналітика Shell. Тут живе пагінація, кеш і класифікатор типів операцій.',
    methods: [
      {
        id: 'shell-tx-list',
        title: 'Список транзакцій',
        verb: 'GET',
        path: '/api/shell/transactions',
        summary:
          'Тарифіковані операції за період. Кожен рядок класифікується parseShellTransactionType(): ' +
          'FuelProduct, IsFee, IsReturn, стабільний TransactionTypeCode і локалізований опис. Суми — у ' +
          'валюті рахунку (типово EUR), обʼєм — Quantity.',
        upstream: {
          verb: 'POST',
          url: `${SHELL_BASE}/fleetmanagement/v1/transaction/pricedtransactions`,
          note:
            'Пагінація: PageSize=1000, CurrentPage=1..TotalPages (макс 30 сторінок). Дати — YYYYMMDD.',
        },
        params: [
          { name: 'date_from', note: 'Початок періоду YYYY-MM-DD (шлюз прибирає дефіси → YYYYMMDD)' },
          { name: 'date_to', note: 'Кінець періоду; за замовчуванням — останні 90 днів' },
        ],
        body: `// тіло, яке шлюз шле у Shell на кожну сторінку
{
  "ColCoCode": "<SHELL_COLCO_CODE>",
  "PayerNumber": "<SHELL_PAYER_NUMBER>",
  "InvoiceStatus": "A",
  "FromDate": "20260601",
  "ToDate": "20260630",
  "IncludeFees": true,
  "PageSize": "1000",
  "CurrentPage": "1"
}`,
        response: `[
  {
    "TransactionId": "…",
    "SalesItemId": "…",
    "TransactionDate": "2026-08-05T00:00:00.000Z",   // з YYYYMMDD → ISO
    "PostingDate": "2026-08-06T00:00:00.000Z",
    "AccountNumber": "GB000000000",
    "AccountName": "VELES",
    "CardPAN": "7002xxxxxxxxxxxx",
    "DriverName": "…",
    "VehicleRegistration": "AA1234BB",
    "SiteCode": "PL0123",
    "SiteName": "Shell Wrocław",
    "SiteCountry": "PL",
    "ProductCode": "…",
    "ProductName": "Shell Diesel",
    "Quantity": 480.5,
    "UnitPrice": 1.55,
    "NetAmount": 605.0,
    "GrossAmount": 744.8,          // валюта рахунку (типово EUR)
    "CurrencyCode": "EUR",
    "Type": "SalesItem",           // або "FeeItem"
    "ProductGroupId": 7,
    "ProductGroupName": "Automotive Gas Oil",
    "FuelProduct": true,
    "IsFee": false,
    "IsReturn": false,
    "TransactionTypeCode": "SHELL_G7",
    "TransactionTypeDescription": "Shell · Дизельне пальне"
  }
]`,
        notes: [
          'Верхній рівень Type: SalesItem (товар/пальне) або FeeItem (збір). IsFee вмикається, коли назва групи містить fee/charge/adjustment/rental і це не пальне.',
          'IsReturn = кредитовий бік (CreditDebitCode=C), прапорець RefundFlag або відʼємний GrossAmount; опис отримує префікс «Повернення · ».',
          'Стабільний код: SHELL_G<ProductGroupId> для кожної групи, інакше SHELL_FEE / SHELL_PURCHASE — кожен тип стає окремим пунктом фільтра.',
          'Результат кешується 60 с за ключем FromDate|ToDate; ідентичні паралельні запити чекають один політ (dedup).',
        ],
      },
      {
        id: 'shell-summary',
        title: 'Зведення Shell',
        verb: 'GET',
        path: '/api/shell/summary',
        summary:
          'Готове зведення бренду Shell: рахунки, картки, АЗС, кількість і сума транзакцій, обʼєм. ' +
          'Рахунки, картки й АЗС тут — похідні від транзакцій за замовчуванням.',
        upstream: {
          verb: 'POST',
          url: `${SHELL_BASE}/fleetmanagement/v1/customer/accounts · /transaction/pricedtransactions`,
          note: 'Агрегат кількох викликів Shell, а не окремий ендпоінт вендора.',
        },
        response: `{
  "brand": "SHELL",
  "totalAccounts": 2,
  "totalCards": 18,
  "activeCards": 18,
  "totalMerchantsAZS": 34,
  "totalTransactions": 512,
  "totalSpendUah": 96500.0,       // сума GrossAmount у валюті рахунку
  "totalVolumeLiters": 41000.0,
  "accountsSummary": [ { "…": "рахунки як у /api/shell/accounts" } ]
}`,
      },
    ],
  },

  {
    id: 'shell-derived',
    title: 'Похідні: картки та АЗС',
    blurb:
      'У Shell немає окремих ендпоінтів карток і станцій. Шлюз виводить їх, дедуплікуючи список ' +
      'транзакцій за CardPAN та SiteCode — тому доступні лише поля, наявні в транзакції.',
    methods: [
      {
        id: 'shell-cards',
        title: 'Картки (похідні)',
        verb: 'GET',
        path: '/api/shell/cards  ·  /api/cards?brand=SHELL',
        summary:
          'Унікальні CardPAN із транзакцій. Наявність транзакції означає, що картка діюча (CardStatus ' +
          'ACTIVE). Термін дії та група невідомі — лишаються порожніми.',
        upstream: {
          verb: 'POST',
          url: `${SHELL_BASE}/fleetmanagement/v1/transaction/pricedtransactions`,
          note: 'Окремого ендпоінта карток немає — дедуп транзакцій за CardPAN.',
        },
        response: `[
  {
    "CardId": "SH-7002xxxxxxxxxxxx",
    "CardPAN": "7002xxxxxxxxxxxx",
    "CardStatus": "ACTIVE",
    "DriverName": "…",
    "VehicleRegistration": "AA1234BB",
    "ExpiryDate": "",
    "CardGroup": "",
    "ProductRestriction": "Shell Diesel",
    "PayerNumber": "<SHELL_PAYER_NUMBER>"
  }
]`,
        notes: [
          'Крос-вендорний /api/cards?brand=SHELL мапить це у snake_case-форму OKKO (card_num, is_active, limits…) і додає демонстраційний добовий ліміт.',
        ],
      },
      {
        id: 'shell-merchants',
        title: 'АЗС (похідні)',
        verb: 'GET',
        path: '/api/shell/merchants  ·  /api/merchants?brand=SHELL',
        summary:
          'Унікальні SiteCode із транзакцій. Доступні лише код, назва та країна сайту; місто/адреса/' +
          'послуги в транзакціях відсутні й лишаються порожніми.',
        upstream: {
          verb: 'POST',
          url: `${SHELL_BASE}/fleetmanagement/v1/transaction/pricedtransactions`,
          note: 'Окремого ендпоінта станцій немає — дедуп транзакцій за SiteCode.',
        },
        response: `[
  {
    "merchant_id": "SH-AZS-PL0123",
    "merchant_sap_id": "SH-PL0123",
    "merchant_name": "Shell Wrocław",
    "merchant_address": "",
    "city": "",
    "region": "PL",
    "services": [],
    "status": "OPEN"
  }
]`,
      },
    ],
  },
];

/**
 * Довідник груп товарів Shell (ProductGroupName → українська назва).
 * Документація (липень-2020) описує групи 1..21, але реальні дані містять і 22..24
 * (Card related fees / Monetary Adjustment / Service Fee), тож числовий id — не єдине
 * джерело: класифікатор спирається насамперед на ProductGroupName.
 */
export const SHELL_CATEGORY_REF: Array<{ en: string; ua: string; fuel?: boolean; fee?: boolean }> = [
  { en: 'All Fuels', ua: 'Пальне (усі види)', fuel: true },
  { en: 'Motor Gasoline', ua: 'Бензин', fuel: true },
  { en: 'Autogas (LPG)', ua: 'Автогаз (LPG)', fuel: true },
  { en: 'CNG', ua: 'Стиснений газ (CNG)', fuel: true },
  { en: 'Automotive Gas Oil', ua: 'Дизельне пальне', fuel: true },
  { en: 'Alternative Fuel (AdBlue)', ua: 'Альтернативне пальне (AdBlue)', fuel: true },
  { en: 'Lubricants', ua: 'Мастила' },
  { en: 'Food', ua: 'Продукти харчування' },
  { en: 'Non-alcoholic beverages', ua: 'Безалкогольні напої' },
  { en: 'Car Wash', ua: 'Мийка авто' },
  { en: 'Parking', ua: 'Паркування' },
  { en: 'Toll charges', ua: 'Дорожні збори (толлінг)' },
  { en: 'Motorway toll', ua: 'Плата за автомагістраль' },
  { en: 'Ferries', ua: 'Поромні переправи' },
  { en: 'Vignette', ua: 'Віньєтка' },
  { en: 'Card related fees', ua: 'Комісії за картку', fee: true },
  { en: 'Monetary Adjustment', ua: 'Грошове коригування', fee: true },
  { en: 'Service Fee', ua: 'Сервісний збір', fee: true },
  { en: 'TMF charges', ua: 'Комісія TMF', fee: true },
];
