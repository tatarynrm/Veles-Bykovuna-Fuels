/**
 * Довідник інтеграції Ruptela для «Консолі API».
 *
 * Джерело правди — сам код шлюзу:
 *  - backend/src/ruptela/ruptela-insights.service.ts  (FMS REST)
 *  - backend/src/ruptela/ruptela-routing.service.ts   (Routing & Tasking GraphQL)
 *
 * Кожен запис описує ДВА рівні: маршрут нашого шлюзу і той запит, який шлюз
 * реально відправляє в api.fm-track.com. Приклади відповідей показують обгортку,
 * яку гарантує наш код; поля всередині `items` проходять від вендора без
 * перейменування (snake_case) — тому вони позначені як довільний набір.
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
    /** Повний URL у fm-track, як його формує сервіс. */
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

export const FMS_BASE = 'https://api.fm-track.com';

/* ─────────────────────────────────────────────────────────────────────────
   Загальні правила транспорту
   ───────────────────────────────────────────────────────────────────────── */

export const TRANSPORT_NOTES: Array<{ title: string; text: string }> = [
  {
    title: 'Ключ — у query, не в заголовку',
    text:
      'Ruptela FMS автентифікує запит параметром ?api_key=…. Наш шлюз додає його сам із backend/.env ' +
      '(RUPTELA_API_KEY) — у браузер і в клієнтські застосунки ключ не потрапляє. Якщо ви звертаєтесь ' +
      'до fm-track напряму з Delphi — ключ треба додавати до кожного URL.',
  },
  {
    title: 'version — обовʼязковий параметр',
    text:
      'Кожен ендпоінт FMS версіонується окремо: /drivers працює з version=2, /geozones і більшість ' +
      'звітів — з version=1, /objects/{id}/coordinates — version=2 (version=3 повертає 403 на нашому ' +
      'тарифі: потрібна фіча FEATURE_ADDRESS_COMPONENT_IN_STREAM_AND_HISTORY_API).',
  },
  {
    title: 'Дати — ISO 8601 в UTC',
    text:
      'from_datetime / to_datetime приймають вигляд 2026-08-04T00:00:00Z. Локальний час без зсуву ' +
      'вендор мовчки трактує як UTC — звіт «зʼїде» на різницю часових поясів.',
  },
  {
    title: 'Пагінація — continuation_token',
    text:
      'Колекції повертають continuation_token. Наступна сторінка — той самий запит із ' +
      '&continuation_token=<значення>. null означає, що сторінок більше немає.',
  },
  {
    title: 'Помилки',
    text:
      'Наш шлюз конвертує будь-яку відмову вендора у 502 з текстом «Ruptela FMS: …». Валідаційні ' +
      'помилки (field_validation_errors) дописуються в дужках. Відсутні обовʼязкові параметри дають ' +
      '400 з українським поясненням ще до звернення до вендора.',
  },
  {
    title: 'Гостьовий режим',
    text:
      'Токен із роллю GUEST глобальний guard відхиляє на будь-якому не-GET запиті з кодом 403. ' +
      'Для POST/PUT/DELETE потрібен звичайний сеанс: заголовок Authorization: Bearer veles_session_…',
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   FMS Insights — REST
   ───────────────────────────────────────────────────────────────────────── */

const PASSTHROUGH_ITEMS = `{
  "items": [
    { "…": "поля Ruptela без перейменування (snake_case)" }
  ],
  "continuation_token": "<токен наступної сторінки> | null"
}`;

export const INSIGHTS_GROUPS: DocGroup[] = [
  {
    id: 'fuel',
    title: 'Паливо та детектовані події',
    blurb:
      'Заради цих двох звітів паливний ERP і підключає FMS: заправки/зливи, зафіксовані по рівню в баку, ' +
      'і порушення, зафіксовані правилами.',
    methods: [
      {
        id: 'fuel-events',
        title: 'Паливні події',
        verb: 'GET',
        path: '/api/ruptela/insights/fuel-events',
        summary:
          'Заправки та зливи, детектовані Ruptela по зміні рівня палива в баку. Основне джерело для ' +
          'звірки з транзакціями OKKO/Shell.',
        upstream: {
          verb: 'GET',
          url: `${FMS_BASE}/fuel-events?version=1&api_key=…&object_id=…&from_datetime=…&to_datetime=…&limit=…&continuation_token=…`,
          note:
            'Swagger рекламує camelCase-параметри, але живий ендпоінт на них віддає 404 — реально він ' +
            'приймає snake_case, як і сусідні звіти.',
        },
        params: [
          { name: 'objectId', required: true, note: 'ID транспортного засобу у fm-track → object_id' },
          { name: 'from', required: true, note: 'Початок періоду, ISO UTC → from_datetime' },
          { name: 'to', required: true, note: 'Кінець періоду, ISO UTC → to_datetime' },
          { name: 'limit', note: 'Розмір сторінки' },
          { name: 'token', note: 'continuation_token попередньої сторінки' },
        ],
        response: PASSTHROUGH_ITEMS,
        notes: [
          'Без from/to шлюз відповідає 400 «Вкажіть період» — запит до вендора навіть не йде.',
          'Звіт ніколи не кешується: це параметризований запит.',
        ],
      },
      {
        id: 'detected-events',
        title: 'Детектовані події',
        verb: 'GET',
        path: '/api/ruptela/insights/detected-events',
        summary:
          'Перевищення швидкості, різке гальмування/прискорення та спрацювання власних правил ' +
          '(див. «Правила подій»).',
        upstream: {
          verb: 'GET',
          url: `${FMS_BASE}/detected-events?version=1&api_key=…&object_id=…&user_id=…&from_datetime=…&to_datetime=…`,
        },
        params: [
          { name: 'objectId', note: 'Фільтр по ТЗ → object_id' },
          { name: 'userId', note: 'Фільтр по користувачу → user_id' },
          { name: 'from', required: true, note: 'ISO UTC → from_datetime' },
          { name: 'to', required: true, note: 'ISO UTC → to_datetime' },
          { name: 'limit', note: 'Розмір сторінки' },
          { name: 'token', note: 'continuation_token' },
        ],
        response: PASSTHROUGH_ITEMS,
        notes: ['Вендор віддає масив під ключем events — шлюз перекладає його в items.'],
      },
      {
        id: 'ecodriving',
        title: 'Еко-водіння (ТЗ або водій)',
        verb: 'GET',
        path: '/api/ruptela/insights/ecodriving/object/:id  ·  /ecodriving/driver/:id',
        summary: 'Оцінка стилю водіння з розкладкою по витраті пального та холостому ходу.',
        upstream: {
          verb: 'GET',
          url: `${FMS_BASE}/ecodriving/{object|driver}?version=1&api_key=…&id=…&from_datetime=…&to_datetime=…`,
        },
        params: [
          { name: ':id', required: true, note: 'ID обʼєкта або водія (передається як query id)' },
          { name: 'from', required: true, note: 'ISO UTC' },
          { name: 'to', required: true, note: 'ISO UTC' },
        ],
        response: `{ "…": "обʼєкт вендора без обгортки — тут немає items" }`,
        notes: ['Єдина відмінність між двома маршрутами — сегмент object / driver у шляху вендора.'],
      },
    ],
  },

  {
    id: 'drivers',
    title: 'Водії та призначення',
    blurb:
      'Реєстр водіїв, тахографічна активність і звʼязка «водій ↔ транспорт». Частина водіїв ' +
      'зареєстрована під номером картки тахографа, а не під іменем.',
    methods: [
      {
        id: 'drivers-list',
        title: 'Список водіїв',
        verb: 'GET',
        path: '/api/ruptela/insights/drivers',
        summary: 'Реєстр водіїв акаунта. Перша сторінка без фільтрів кешується на 5 хвилин.',
        upstream: {
          verb: 'GET',
          url: `${FMS_BASE}/drivers?version=2&api_key=…&limit=…&continuation_token=…&identifier=…&identifier_type=…`,
        },
        params: [
          { name: 'limit', note: 'Розмір сторінки' },
          { name: 'token', note: 'continuation_token' },
          { name: 'identifier', note: 'Пошук за ідентифікатором (напр. номер картки)' },
          { name: 'identifierType', note: '→ identifier_type' },
        ],
        response: PASSTHROUGH_ITEMS,
      },
      {
        id: 'driver-one',
        title: 'Картка водія',
        verb: 'GET',
        path: '/api/ruptela/insights/drivers/:id',
        summary: 'Один водій за id.',
        upstream: { verb: 'GET', url: `${FMS_BASE}/drivers/{id}?version=2&api_key=…` },
      },
      {
        id: 'driver-states',
        title: 'Стани водія (тахограф)',
        verb: 'GET',
        path: '/api/ruptela/insights/drivers/:id/states',
        summary: 'Хронологія активності: кермування, робота, готовність, відпочинок.',
        upstream: {
          verb: 'GET',
          url: `${FMS_BASE}/driverstate/{id}?version=1&api_key=…&from_datetime=…&to_datetime=…`,
          note: 'Шлях у вендора — /driverstate/{id}, одним словом і без «s».',
        },
        params: [
          { name: 'from', required: true, note: 'ISO UTC' },
          { name: 'to', required: true, note: 'ISO UTC' },
          { name: 'limit', note: 'Розмір сторінки' },
          { name: 'token', note: 'continuation_token' },
        ],
        response: `{
  "driver_id": "<id водія>",
  "items": [ { "…": "стани як у вендора" } ],
  "continuation_token": "… | null"
}`,
      },
      {
        id: 'driver-time',
        title: 'Аналіз робочого часу',
        verb: 'GET',
        path: '/api/ruptela/insights/drivers/:id/time-analysis',
        summary: 'Поточний залишок часу кермування/відпочинку за режимом праці.',
        upstream: {
          verb: 'GET',
          url: `${FMS_BASE}/drivers/{id}/current-time-analysis?version=1&api_key=…`,
        },
      },
      {
        id: 'assignation-last',
        title: 'Останнє призначення',
        verb: 'GET',
        path: '/api/ruptela/insights/assignations/last',
        summary: 'Хто зараз (або востаннє) був за кермом цього ТЗ — чи на чому їздив цей водій.',
        upstream: {
          verb: 'GET',
          url: `${FMS_BASE}/driver/assignations/last?version=1&api_key=…&byDriverId=…&byObjectId=…`,
          note: 'Виняток із загального правила: тут параметри саме camelCase — byDriverId / byObjectId.',
        },
        params: [
          { name: 'driverId', note: '→ byDriverId' },
          { name: 'objectId', note: '→ byObjectId' },
        ],
        notes: ['Потрібен рівно один із двох параметрів; без жодного шлюз віддає 400.'],
      },
      {
        id: 'assignation-create',
        title: 'Призначити водія',
        verb: 'POST',
        path: '/api/ruptela/insights/assignations',
        summary: 'Ручна привʼязка водія до транспортного засобу.',
        upstream: { verb: 'POST', url: `${FMS_BASE}/driver/assignations?version=1&api_key=…` },
        body: `{
  "driverId": "<id водія>",
  "objectId": "<id ТЗ>",
  "datetime": "2026-08-06T07:30:00Z"
}`,
        notes: ['Тіло проходить у вендора як є — шлюз його не валідує і не перейменовує.'],
      },
    ],
  },

  {
    id: 'geo',
    title: 'Геозони, країни, трек',
    blurb: 'Просторові звіти: перебування в зонах, перетини кордонів і сира історія координат.',
    methods: [
      {
        id: 'geozones',
        title: 'Список геозон',
        verb: 'GET',
        path: '/api/ruptela/insights/geozones',
        summary: 'Реєстр зон. Без геометрії відповідь кешується на 5 хвилин.',
        upstream: {
          verb: 'GET',
          url: `${FMS_BASE}/geozones?version=1&api_key=…&include_geometry=true&limit=…&continuation_token=…`,
        },
        params: [
          { name: 'geometry', note: '1 | true → include_geometry=true (полігони; відповідь важка)' },
          { name: 'limit', note: 'Розмір сторінки' },
          { name: 'token', note: 'continuation_token' },
        ],
        response: PASSTHROUGH_ITEMS,
      },
      {
        id: 'geozone-visits',
        title: 'Відвідування геозон',
        verb: 'POST',
        path: '/api/ruptela/insights/geozones/visits',
        summary: 'Це запит, а не мутація: POST лише тому, що фільтр не влазить у query string.',
        upstream: { verb: 'POST', url: `${FMS_BASE}/geozones/visits?version=1&api_key=…` },
        body: `{
  "geozone_ids": ["<id зони>"],
  "object_ids": ["<id ТЗ>"],
  "from_datetime": "2026-08-01T00:00:00Z",
  "to_datetime": "2026-08-06T00:00:00Z",
  "limit": 100,
  "continuation_token": 0
}`,
        response: PASSTHROUGH_ITEMS,
        notes: [
          'Вендор вимагає непорожній geozone_ids (422 «geozoneIds: must not be empty»). Якщо список ' +
            'не передати, шлюз сам підставляє всі зони акаунта — тобто «візити в будь-яку зону» працюють.',
          'from_datetime / to_datetime обовʼязкові — перевіряються до звернення до вендора.',
        ],
      },
      {
        id: 'countries',
        title: 'Звіт по країнах',
        verb: 'GET',
        path: '/api/ruptela/insights/countries/object/:id  ·  /countries/driver/:id',
        summary: 'Перетини кордонів і підсумки по кожній країні — основа для добових і паливних звірок.',
        upstream: {
          verb: 'GET',
          url: `${FMS_BASE}/countries/{object|driver}?version=1&api_key=…&id=…&from_datetime=…&to_datetime=…`,
        },
        params: [
          { name: ':id', required: true, note: 'ID ТЗ або водія → query id' },
          { name: 'from', required: true, note: 'ISO UTC' },
          { name: 'to', required: true, note: 'ISO UTC' },
          { name: 'limit', note: 'Розмір сторінки' },
          { name: 'token', note: 'continuation_token' },
        ],
        response: `{
  "subject_id": "<id ТЗ або водія>",
  "items": [ { "…": "елементи country_visits вендора" } ],
  "continuation_token": "… | null"
}`,
        notes: ['Вендор віддає масив під ключем country_visits — шлюз перекладає його в items.'],
      },
      {
        id: 'coordinates',
        title: 'Історія координат',
        verb: 'GET',
        path: '/api/ruptela/insights/coordinates/:objectId',
        summary: 'Сирий трек за період: позиція + CAN-показники в одному записі.',
        upstream: {
          verb: 'GET',
          url: `${FMS_BASE}/objects/{id}/coordinates?version=2&api_key=…&from_datetime=…&to_datetime=…&limit=…&include_geozones=true`,
        },
        params: [
          { name: 'from', required: true, note: 'ISO UTC' },
          { name: 'to', required: true, note: 'ISO UTC' },
          { name: 'limit', note: 'Максимум 1000' },
          { name: 'token', note: 'continuation_token — тут це datetime' },
          { name: 'geozones', note: '1 | true → include_geozones' },
        ],
        response: `{
  "items": [
    {
      "datetime": "2026-08-05T11:42:10.000Z",
      "position": { "latitude": 48.29, "longitude": 25.93, "speed": 74, "altitude": 210 },
      "inputs": {
        "device_inputs": { "ignition": 1, "…": "…" },
        "calculated_inputs": { "canbus_distance": 412.5, "fuel_level": 380, "…": "…" }
      }
    }
  ],
  "continuation_token": "2026-08-05T11:42:10.000Z | null"
}`,
        notes: [
          'Записи приходять від найстарішого до найновішого. Якщо в вікні більше записів, ніж limit — ' +
            'лишаються найновіші.',
          'from_datetime інклюзивний: опорний запис повторюється при довантаженні — дедуплікуйте по datetime.',
          'version=3 недоступна на нашому тарифі (403).',
        ],
      },
      {
        id: 'coordinate-at',
        title: 'Координата на момент часу',
        verb: 'GET',
        path: '/api/ruptela/insights/coordinates/:objectId/at/:datetime',
        summary: 'Найближчий до вказаного моменту запис — зручно «де був ТЗ під час заправки».',
        upstream: {
          verb: 'GET',
          url: `${FMS_BASE}/objects/{id}/coordinates/{datetime}?version=2&api_key=…`,
        },
        notes: ['datetime у шляху має бути URL-екранований (двокрапки → %3A).'],
      },
    ],
  },

  {
    id: 'registries',
    title: 'Довідники та користувачі',
    blurb: 'Рідко змінювані реєстри — кешуються на 5 хвилин, запис скидає кеш.',
    methods: [
      {
        id: 'object-groups',
        title: 'Групи транспорту',
        verb: 'GET',
        path: '/api/ruptela/insights/object-groups  ·  /object-groups/:id',
        summary: 'Список груп і одна група за зовнішнім id.',
        upstream: {
          verb: 'GET',
          url: `${FMS_BASE}/object-groups?version=1&api_key=… · ${FMS_BASE}/object-groups/{id}?version=1`,
        },
        response: PASSTHROUGH_ITEMS,
      },
      {
        id: 'object-group-update',
        title: 'Оновити групу',
        verb: 'PUT',
        path: '/api/ruptela/insights/object-groups/:id',
        summary: 'Редагування групи. Шлях запису у вендора інший, ніж шлях читання.',
        upstream: {
          verb: 'PUT',
          url: `${FMS_BASE}/management/object-group/{id}?version=1&api_key=…`,
          note: 'Читання — /object-groups/{id}, запис — /management/object-group/{id}.',
        },
        body: `{ "name": "Тягачі", "…": "решта полів групи" }`,
        notes: ['Після успіху шлюз скидає кеш object-groups.'],
      },
      {
        id: 'users',
        title: 'Користувачі',
        verb: 'GET',
        path: '/api/ruptela/insights/users',
        summary: 'Користувачі акаунта fm-track (потрібні для user_id у детектованих подіях).',
        upstream: { verb: 'GET', url: `${FMS_BASE}/users?version=1&api_key=…` },
        response: PASSTHROUGH_ITEMS,
      },
      {
        id: 'sentgeo',
        title: 'Статус інтеграції SentGeo',
        verb: 'GET',
        path: '/api/ruptela/insights/sentgeo/:objectId',
        summary: 'Стан звʼязки ТЗ із SentGeo.',
        upstream: {
          verb: 'GET',
          url: `${FMS_BASE}/vehicle-integrations/{objectId}/sentgeo?version=1&api_key=…`,
        },
      },
    ],
  },

  {
    id: 'events',
    title: 'Правила подій (CRUD)',
    blurb:
      'Власні правила, спрацювання яких потім видно в «Детектованих подіях». Повний цикл створення/' +
      'редагування/видалення.',
    methods: [
      {
        id: 'events-list',
        title: 'Список правил',
        verb: 'GET',
        path: '/api/ruptela/insights/events',
        summary: 'Правила акаунта. Не кешується.',
        upstream: { verb: 'GET', url: `${FMS_BASE}/events?version=1&api_key=…` },
        response: PASSTHROUGH_ITEMS,
      },
      {
        id: 'event-one',
        title: 'Одне правило',
        verb: 'GET',
        path: '/api/ruptela/insights/events/:id',
        summary: 'Правило за зовнішнім id.',
        upstream: { verb: 'GET', url: `${FMS_BASE}/events/{id}?version=1&api_key=…` },
      },
      {
        id: 'event-create',
        title: 'Створити правило',
        verb: 'POST',
        path: '/api/ruptela/insights/events',
        summary: 'Тіло проходить у вендора без змін.',
        upstream: { verb: 'POST', url: `${FMS_BASE}/events?version=1&api_key=…` },
        body: `{ "…": "структура події за swagger fm-track" }`,
      },
      {
        id: 'event-update',
        title: 'Оновити правило',
        verb: 'PUT',
        path: '/api/ruptela/insights/events/:id',
        summary: 'Повна заміна правила.',
        upstream: { verb: 'PUT', url: `${FMS_BASE}/events/{id}?version=1&api_key=…` },
      },
      {
        id: 'event-delete',
        title: 'Видалити правило',
        verb: 'DELETE',
        path: '/api/ruptela/insights/events/:id',
        summary: 'Видалення за зовнішнім id.',
        upstream: { verb: 'DELETE', url: `${FMS_BASE}/events/{id}?version=1&api_key=…` },
      },
    ],
  },

  {
    id: 'share-links',
    title: 'Публічні посилання',
    blurb: 'Тимчасові URL стеження за ТЗ для контрагента без облікового запису.',
    methods: [
      {
        id: 'share-list',
        title: 'Список посилань',
        verb: 'GET',
        path: '/api/ruptela/insights/share-links',
        summary: 'Активні та прострочені посилання.',
        upstream: { verb: 'GET', url: `${FMS_BASE}/share-links?version=1&api_key=…` },
        response: PASSTHROUGH_ITEMS,
      },
      {
        id: 'share-create',
        title: 'Створити посилання',
        verb: 'POST',
        path: '/api/ruptela/insights/share-links',
        summary: 'Мінімум — перелік ТЗ і термін дії.',
        upstream: { verb: 'POST', url: `${FMS_BASE}/share-links?version=1&api_key=…` },
        body: `{
  "objects": [{ "id": "<id ТЗ>" }],
  "valid_from": "2026-08-06T00:00:00Z",
  "expires_at": "2026-08-13T00:00:00Z"
}`,
        notes: [
          'Порожній objects або відсутній expires_at шлюз відхиляє сам — 400 з українським текстом.',
        ],
      },
      {
        id: 'share-update',
        title: 'Оновити посилання',
        verb: 'PUT',
        path: '/api/ruptela/insights/share-links/:id',
        summary: 'Продовження терміну або зміна складу ТЗ.',
        upstream: { verb: 'PUT', url: `${FMS_BASE}/share-links/{id}?version=1&api_key=…` },
      },
      {
        id: 'share-delete',
        title: 'Видалити посилання',
        verb: 'DELETE',
        path: '/api/ruptela/insights/share-links/:id',
        summary: 'Негайно розриває публічний доступ.',
        upstream: { verb: 'DELETE', url: `${FMS_BASE}/share-links/{id}?version=1&api_key=…` },
      },
    ],
  },

  {
    id: 'driver-mgmt',
    title: 'Керування водіями (CRUD)',
    blurb: 'Запис у реєстр водіїв — окремий від читання простір /management.',
    methods: [
      {
        id: 'driver-create',
        title: 'Створити водія',
        verb: 'POST',
        path: '/api/ruptela/insights/management/drivers',
        summary: 'Після успіху кеш списку водіїв скидається.',
        upstream: { verb: 'POST', url: `${FMS_BASE}/management/driver?version=1&api_key=…` },
        body: `{ "name": "…", "…": "решта полів за swagger" }`,
      },
      {
        id: 'driver-read',
        title: 'Прочитати водія (management)',
        verb: 'GET',
        path: '/api/ruptela/insights/management/drivers/:id',
        summary: 'Розширена картка з простору керування.',
        upstream: { verb: 'GET', url: `${FMS_BASE}/management/driver/{id}?version=1&api_key=…` },
      },
      {
        id: 'driver-update',
        title: 'Оновити водія',
        verb: 'PUT',
        path: '/api/ruptela/insights/management/drivers/:id',
        summary: 'Повна заміна картки.',
        upstream: { verb: 'PUT', url: `${FMS_BASE}/management/driver/{id}?version=1&api_key=…` },
      },
      {
        id: 'driver-delete',
        title: 'Видалити водія',
        verb: 'DELETE',
        path: '/api/ruptela/insights/management/drivers/:id',
        summary: 'Видалення з реєстру.',
        upstream: { verb: 'DELETE', url: `${FMS_BASE}/management/driver/{id}?version=1&api_key=…` },
      },
      {
        id: 'driver-violations',
        title: 'Порушення режиму праці',
        verb: 'POST',
        path: '/api/ruptela/insights/driver-violations',
        summary: 'Тахографічні порушення. Знову ж таки запит, а не мутація.',
        upstream: { verb: 'POST', url: `${FMS_BASE}/driver-violation?version=1&api_key=…` },
        body: `{
  "date_time_from": "2026-07-01T00:00:00Z",
  "date_time_to": "2026-08-01T00:00:00Z",
  "card_numbers": [],
  "vehicles": [],
  "countries": [],
  "severities": [],
  "types": [],
  "page_descriptor": { "page": 0, "size": 50 }
}`,
        response: `{
  "items": [ { "…": "порушення як у вендора" } ],
  "next_page": "… | null"
}`,
        notes: ['Пагінація тут своя — next_page, а не continuation_token.'],
      },
    ],
  },

  {
    id: 'tacho',
    title: 'Тахограф — віддалене завантаження',
    blurb:
      'Ці виклики командують реальним пристроєм у машині. Запит ставиться в чергу, файл забирається ' +
      'окремо, коли вендор його підготує.',
    methods: [
      {
        id: 'tacho-requests',
        title: 'Список запитів',
        verb: 'POST',
        path: '/api/ruptela/insights/tacho/requests',
        summary: 'Перелік запланованих і виконаних завантажень (фільтр у тілі).',
        upstream: { verb: 'POST', url: `${FMS_BASE}/tacho/requests?version=1&api_key=…` },
        body: `{ }`,
      },
      {
        id: 'tacho-request',
        title: 'Статус запиту',
        verb: 'GET',
        path: '/api/ruptela/insights/tacho/request/:id',
        summary: 'Чи готовий файл до завантаження.',
        upstream: { verb: 'GET', url: `${FMS_BASE}/tacho/request/{id}?version=1&api_key=…` },
      },
      {
        id: 'tacho-driver-download',
        title: 'Завантажити картку водія',
        verb: 'POST',
        path: '/api/ruptela/insights/tacho/driver-card-download',
        summary: 'Ставить у чергу зчитування картки водія з пристрою.',
        upstream: { verb: 'POST', url: `${FMS_BASE}/tacho/driver-card-download?version=1&api_key=…` },
        body: `{ "objectId": "<id ТЗ>", "driverId": "<id водія>" }`,
        notes: ['Команда виконується на живому пристрої — використовувати свідомо.'],
      },
      {
        id: 'tacho-vehicle-download',
        title: 'Завантажити дані ТЗ',
        verb: 'POST',
        path: '/api/ruptela/insights/tacho/vehicle-download',
        summary: 'Ставить у чергу зчитування памʼяті тахографа.',
        upstream: { verb: 'POST', url: `${FMS_BASE}/tacho/vehicle-download?version=1&api_key=…` },
        body: `{ "objectId": "<id ТЗ>", "…": "діапазон дат за swagger" }`,
      },
      {
        id: 'tacho-delete',
        title: 'Скасувати запит',
        verb: 'DELETE',
        path: '/api/ruptela/insights/tacho/request/:id',
        summary: 'Знімає завдання з черги.',
        upstream: { verb: 'DELETE', url: `${FMS_BASE}/tacho/request/{id}?version=1&api_key=…` },
      },
      {
        id: 'tacho-file',
        title: 'Файл .ddd',
        verb: 'GET',
        path: '/api/ruptela/insights/tacho/file/:id',
        summary: 'Єдиний бінарний ендпоінт: шлюз віддає файл потоком із оригінальним імʼям.',
        upstream: { verb: 'GET', url: `${FMS_BASE}/tacho/file/{id}?version=1&api_key=…` },
        response: `Content-Type: application/octet-stream
Content-Disposition: attachment; filename="…​.ddd"

<бінарні дані>`,
        notes: [
          'Не намагайтесь парсити відповідь як JSON. У Delphi приймайте у TMemoryStream / TFileStream.',
        ],
      },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   Routing & Tasking — GraphQL
   ───────────────────────────────────────────────────────────────────────── */

export interface GqlOperation {
  id: string;
  title: string;
  kind: 'query' | 'mutation';
  summary: string;
  /** Маршрут нашого шлюзу, що виконує цю операцію. */
  proxy: string;
  document: string;
  variables: string;
  result: string;
  rules: string[];
  delphi: string;
}

export const GQL_ENDPOINT = `POST ${FMS_BASE}/routing?api_key=<КЛЮЧ>`;

export const GQL_TRANSPORT = `POST ${FMS_BASE}/routing?api_key=<КЛЮЧ> HTTP/1.1
Content-Type: application/json; charset=utf-8
Accept: application/json

{
  "query": "<GraphQL-документ одним рядком>",
  "variables": { "…": "змінні операції" }
}`;

export const GQL_ERROR_SHAPE = `HTTP/1.1 200 OK        ← так, 200 навіть коли операція провалилась

{
  "data": null,
  "errors": [
    { "message": "Both [arrivalPlannedFrom] and [arrivalPlannedTill] must be provided" }
  ]
}`;

export const WAYPOINT_TYPES_LIST = [
  'LOADING',
  'UNLOADING',
  'CUSTOMS',
  'REFUELLING',
  'REST',
  'BREAK',
  'SERVICE',
  'TRAIN',
  'FERRY',
  'TRAILER_SWITCH',
  'DRIVER_SWITCH',
  'VEHICLE_SWITCH',
  'PASS_THROUGH',
  'OTHER',
];

export const TRIP_STATES_LIST = [
  { state: 'NEW', scope: 'активні' },
  { state: 'SENT_TO_DRIVER', scope: 'активні' },
  { state: 'SEEN', scope: 'активні' },
  { state: 'ACCEPTED', scope: 'активні' },
  { state: 'IN_PROGRESS', scope: 'активні' },
  { state: 'ON_HOLD', scope: 'активні' },
  { state: 'COMPLETED', scope: 'архів' },
  { state: 'CANCELED', scope: 'архів' },
];

const TRIP_PROJECTION = `id
title
notes
eta
status { state completedAt }
vehicle { id name primaryDriver { id name } }
route {
  metadata { distance }          # метри; duration у Metadata НЕ існує
  legs {
    id
    start { ...WaypointFields }
    end   { ...WaypointFields }
  }
}

# WaypointFields:
#   id type notes visitedAt eta arrivalPlannedFrom arrivalPlannedTill
#   duration cargoWeight
#   location { latitude longitude }
#   address { locality street country }
#   todos { id description type completed completedAt }`;

export const GQL_OPERATIONS: GqlOperation[] = [
  {
    id: 'tripList',
    title: 'tripList — список поїздок',
    kind: 'query',
    summary:
      'Єдиний спосіб прочитати поїздки. Фільтрів, крім states і title, немає — ані дат, ані пагінації.',
    proxy: 'GET /api/ruptela/trips?scope=active|archive|all',
    document: `query tripList($parameters: Parameters!) {
  tripList(parameters: $parameters) {
    ${TRIP_PROJECTION.split('\n').join('\n    ')}
  }
}`,
    variables: `{
  "parameters": {
    "states": ["NEW", "SENT_TO_DRIVER", "SEEN", "ACCEPTED", "IN_PROGRESS", "ON_HOLD"]
  }
}`,
    result: `{
  "data": {
    "tripList": [
      {
        "id": "0f8f5a52-…-uuid",
        "title": "Чернівці → Гданськ",
        "eta": "2026-08-08T14:20:00Z",
        "status": { "state": "IN_PROGRESS", "completedAt": null },
        "vehicle": { "id": "…", "name": "142 Volvo AA1234BB", "primaryDriver": { "id": "…", "name": "…" } },
        "route": { "metadata": { "distance": 1184000 }, "legs": [ … ] }
      }
    ]
  }
}`,
    rules: [
      'Немає пагінації і немає фільтра за датою — вендор віддає ВСЕ, що підходить під states.',
      'Заміряно: усі стани + повний маршрут = 31 с / 146 КБ / 89 поїздок. Лише 6 активних станів = 4 с / 29 КБ / 11 поїздок. Тому архів запитують окремо і рідко.',
      'Запиту getTrip(id) у схемі немає — одну поїздку шукають у вже отриманому списку.',
      'route.metadata має тільки distance (у метрах). Поле duration не існує — запит із ним валить усю операцію.',
      'RouteStatistics ховає числа під plannedTotal / actualTotal — звертатись до них треба саме так.',
    ],
    delphi: `// Активні поїздки одним викликом
var
  Vars, Params: TJSONObject;
  States: TJSONArray;
  Res: TJSONObject;
  Trips: TJSONArray;
  I: Integer;
begin
  States := TJSONArray.Create;
  States.Add('NEW');
  States.Add('SENT_TO_DRIVER');
  States.Add('SEEN');
  States.Add('ACCEPTED');
  States.Add('IN_PROGRESS');
  States.Add('ON_HOLD');

  Params := TJSONObject.Create;
  Params.AddPair('states', States);

  Vars := TJSONObject.Create;
  Vars.AddPair('parameters', Params);

  Res := RuptelaGraphQL(GQL_TRIP_LIST, Vars);   // Vars звільняється всередині
  try
    Trips := Res.GetValue<TJSONArray>('tripList');
    for I := 0 to Trips.Count - 1 do
      Memo1.Lines.Add(Trips.Items[I].GetValue<string>('title'));
  finally
    Res.Free;
  end;
end;`,
  },

  {
    id: 'createTrip',
    title: 'createTrip — створити поїздку',
    kind: 'mutation',
    summary:
      'Створює рейс у Ruptela і (за бажанням) відправляє його водієві на планшет. Це запис у бойову ' +
      'систему — не тестуйте на живому транспорті.',
    proxy: 'POST /api/ruptela/trips',
    document: `mutation createTrip($parameters: TripCreateParameters!) {
  createTrip(parameters: $parameters) {
    ${TRIP_PROJECTION.split('\n').join('\n    ')}
  }
}`,
    variables: `{
  "parameters": {
    "id": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",   // ОБОВʼЯЗКОВО, і саме UUID
    "title": "Чернівці → Гданськ",
    "vehicleId": "<id ТЗ у fm-track>",
    "notes": "Паливо на «Веле́с» картку",
    "owner": "dispatcher@veles.ua",

    "plannedArrivalDateRange": {
      "plannedArrivalDateTimeFrom": "2026-08-08T12:00:00Z",
      "plannedArrivalDateTimeTill": "2026-08-08T18:00:00Z"
    },

    "manuallyAssignedDrivers": {
      "primaryDriverId": "<id водія>",
      "secondaryDriverId": "<id змінника>",
      "notifyDrivers": false        // true → водієві прилетить сповіщення
    },

    "waypoints": [
      {
        "type": "LOADING",
        "location": { "latitude": 48.2917, "longitude": 25.9354 },
        "notes": "Завантаження зі складу",
        "arrivalPlannedFrom": "2026-08-06T08:00:00Z",
        "arrivalPlannedTill": "2026-08-06T10:00:00Z",
        "duration": 60,             // хвилини
        "cargoWeight": 22000,       // кг — приймається ЛИШЕ на LOADING/UNLOADING
        "todos": [
          { "description": "Взяти CMR", "type": "OTHER", "orderNumber": 1 }
        ]
      },
      {
        "type": "UNLOADING",
        "location": { "address": "Gdańsk, Poland" }   // альтернатива координатам
      }
    ]
  }
}`,
    result: `{
  "data": {
    "createTrip": { "id": "3f2504e0-…", "title": "…", "status": { "state": "NEW" }, "route": { … } }
  }
}`,
    rules: [
      'parameters.id — обовʼязковий і має бути валідним UUID. Ідентифікатори виду trip-rup-<timestamp> вендор відхиляє.',
      'Точок маршруту мінімум дві. Кожна точка потребує АБО location{latitude,longitude}, АБО location{address} — інакше InputLocation не проходить валідацію.',
      'arrivalPlannedFrom і arrivalPlannedTill — нероздільна пара: одна половина валить мутацію («Both […] must be provided»). Те саме для plannedArrivalDateTimeFrom/Till.',
      'cargoWeight приймається лише на точках LOADING і UNLOADING.',
      'todos приймають description, type і orderNumber. Поля completed в InputWaypointTodo немає — відмітити виконання через API неможливо.',
      'notifyDrivers за замовчуванням false у нашому шлюзі: створення рейсу не має будити водія без явної вказівки.',
      'duration — у хвилинах, distance у відповіді — у метрах.',
    ],
    delphi: `// ── Створення поїздки ────────────────────────────────────────────────
function NewUuid: string;
begin
  // Delphi віддає GUID у вигляді {XXXXXXXX-...}; Ruptela чекає чистий UUID
  Result := LowerCase(Copy(TGUID.NewGuid.ToString, 2, 36));
end;

function CreateTrip(const ATitle, AVehicleId: string): string;
var
  Vars, Params, Wp1, Wp2, Loc, Drivers, Range_: TJSONObject;
  Waypoints, Todos: TJSONArray;
  Todo: TJSONObject;
  Res: TJSONObject;
begin
  Result := NewUuid;

  // 1) точка завантаження
  Loc := TJSONObject.Create;
  Loc.AddPair('latitude',  TJSONNumber.Create(48.2917));
  Loc.AddPair('longitude', TJSONNumber.Create(25.9354));

  Todo := TJSONObject.Create;
  Todo.AddPair('description', 'Взяти CMR');
  Todo.AddPair('type', 'OTHER');
  Todo.AddPair('orderNumber', TJSONNumber.Create(1));
  Todos := TJSONArray.Create;
  Todos.Add(Todo);

  Wp1 := TJSONObject.Create;
  Wp1.AddPair('type', 'LOADING');
  Wp1.AddPair('location', Loc);
  // обидві межі вікна або жодної
  Wp1.AddPair('arrivalPlannedFrom', '2026-08-06T08:00:00Z');
  Wp1.AddPair('arrivalPlannedTill', '2026-08-06T10:00:00Z');
  Wp1.AddPair('duration',    TJSONNumber.Create(60));      // хвилини
  Wp1.AddPair('cargoWeight', TJSONNumber.Create(22000));   // кг, лише LOADING/UNLOADING
  Wp1.AddPair('todos', Todos);

  // 2) точка розвантаження — за адресою замість координат
  Loc := TJSONObject.Create;
  Loc.AddPair('address', 'Gdansk, Poland');

  Wp2 := TJSONObject.Create;
  Wp2.AddPair('type', 'UNLOADING');
  Wp2.AddPair('location', Loc);

  Waypoints := TJSONArray.Create;
  Waypoints.Add(Wp1);
  Waypoints.Add(Wp2);

  // 3) вікно прибуття рейсу
  Range_ := TJSONObject.Create;
  Range_.AddPair('plannedArrivalDateTimeFrom', '2026-08-08T12:00:00Z');
  Range_.AddPair('plannedArrivalDateTimeTill', '2026-08-08T18:00:00Z');

  // 4) водії
  Drivers := TJSONObject.Create;
  Drivers.AddPair('primaryDriverId', '<id водія>');
  Drivers.AddPair('notifyDrivers', TJSONBool.Create(False));

  Params := TJSONObject.Create;
  Params.AddPair('id', Result);              // обовʼязковий UUID
  Params.AddPair('title', ATitle);
  Params.AddPair('vehicleId', AVehicleId);
  Params.AddPair('waypoints', Waypoints);    // мінімум дві точки
  Params.AddPair('plannedArrivalDateRange', Range_);
  Params.AddPair('manuallyAssignedDrivers', Drivers);

  Vars := TJSONObject.Create;
  Vars.AddPair('parameters', Params);

  Res := RuptelaGraphQL(GQL_CREATE_TRIP, Vars);
  try
    // Res.data.createTrip — уже створений рейс із розрахованим маршрутом
    Result := Res.GetValue<TJSONObject>('createTrip').GetValue<string>('id');
  finally
    Res.Free;
  end;
end;`,
  },

  {
    id: 'updateTrip',
    title: 'updateTrip — редагувати поїздку',
    kind: 'mutation',
    summary:
      'Часткове оновлення: надсилайте лише ті поля, які змінюєте. Маршрут — виняток, він замінюється ' +
      'цілком.',
    proxy: 'PUT /api/ruptela/trips/:id',
    document: `mutation updateTrip($parameters: TripUpdateParameters!) {
  updateTrip(parameters: $parameters) {
    ${TRIP_PROJECTION.split('\n').join('\n    ')}
  }
}`,
    variables: `{
  "parameters": {
    "id": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",

    "title": "Чернівці → Гданськ (через Люблін)",
    "notes": "Змінено місце розмитнення",
    "vehicle": { "id": "<новий id ТЗ>" },       // не vehicleId, як у createTrip!

    "manuallyAssignedDrivers": {
      "primaryDriverId": "<id водія>",
      "notifyDrivers": true
    },

    "settings": {                                // вікно прибуття на оновленні
      "plannedArrivalDatetimeFrom": "2026-08-09T12:00:00Z",
      "plannedArrivalDatetimeTill": "2026-08-09T18:00:00Z"
    },

    "route": {                                   // ПОВНА заміна маршруту
      "legs": [
        {
          "start": { "type": "LOADING",   "location": { "latitude": 48.2917, "longitude": 25.9354 } },
          "end":   { "type": "CUSTOMS",   "location": { "address": "Krakovets, Ukraine" } }
        },
        {
          "start": { "type": "CUSTOMS",   "location": { "address": "Krakovets, Ukraine" } },
          "end":   { "type": "UNLOADING", "location": { "address": "Gdansk, Poland" } }
        }
      ]
    }
  }
}`,
    result: `{ "data": { "updateTrip": { "id": "3f2504e0-…", "route": { "legs": [ … ] } } } }`,
    rules: [
      'Тут ТЗ передається як vehicle: { id }, а не vehicleId — на відміну від createTrip.',
      'Вікно прибуття рейсу живе під settings і має ІНШИЙ регістр: plannedArrivalDatetimeFrom/Till (у createTrip — plannedArrivalDateTimeFrom/Till).',
      'route.legs замінює весь маршрут: відрізки без id стирають попередній. Легів має бути ≥1, тобто точок ≥2.',
      'Сусідні відрізки перекриваються: end відрізка N — це start відрізка N+1. Ruptela сама зливає спільну точку в одну.',
      'Наш шлюз приймає плоский список waypoints і сам згортає його в пари legs — у чистому GraphQL це треба робити руками.',
      'Поля, які не надіслані, лишаються без змін. Порожній обʼєкт parameters (лише id) сенсу не має.',
    ],
    delphi: `// ── Редагування: заміна маршруту цілком ──────────────────────────────
function MakeWaypoint(const AType: string; ALat, ALon: Double): TJSONObject; overload;
var Loc: TJSONObject;
begin
  Loc := TJSONObject.Create;
  Loc.AddPair('latitude',  TJSONNumber.Create(ALat));
  Loc.AddPair('longitude', TJSONNumber.Create(ALon));
  Result := TJSONObject.Create;
  Result.AddPair('type', AType);
  Result.AddPair('location', Loc);
end;

function MakeWaypoint(const AType, AAddress: string): TJSONObject; overload;
var Loc: TJSONObject;
begin
  Loc := TJSONObject.Create;
  Loc.AddPair('address', AAddress);
  Result := TJSONObject.Create;
  Result.AddPair('type', AType);
  Result.AddPair('location', Loc);
end;

procedure UpdateTrip(const ATripId: string);
var
  Vars, Params, Route, Leg, Settings, Vehicle: TJSONObject;
  Legs: TJSONArray;
  Res: TJSONObject;
begin
  // Відрізок 1: завантаження → митниця
  Leg := TJSONObject.Create;
  Leg.AddPair('start', MakeWaypoint('LOADING', 48.2917, 25.9354));
  Leg.AddPair('end',   MakeWaypoint('CUSTOMS', 'Krakovets, Ukraine'));
  Legs := TJSONArray.Create;
  Legs.Add(Leg);

  // Відрізок 2: митниця → розвантаження (спільна точка дублюється навмисно)
  Leg := TJSONObject.Create;
  Leg.AddPair('start', MakeWaypoint('CUSTOMS', 'Krakovets, Ukraine'));
  Leg.AddPair('end',   MakeWaypoint('UNLOADING', 'Gdansk, Poland'));
  Legs.Add(Leg);

  Route := TJSONObject.Create;
  Route.AddPair('legs', Legs);

  Settings := TJSONObject.Create;   // увага на регістр: Datetime, не DateTime
  Settings.AddPair('plannedArrivalDatetimeFrom', '2026-08-09T12:00:00Z');
  Settings.AddPair('plannedArrivalDatetimeTill', '2026-08-09T18:00:00Z');

  Vehicle := TJSONObject.Create;    // на оновленні — обʼєкт, не рядок
  Vehicle.AddPair('id', '<id ТЗ>');

  Params := TJSONObject.Create;
  Params.AddPair('id', ATripId);
  Params.AddPair('title', 'Чернівці → Гданськ (через Люблін)');
  Params.AddPair('vehicle', Vehicle);
  Params.AddPair('settings', Settings);
  Params.AddPair('route', Route);

  Vars := TJSONObject.Create;
  Vars.AddPair('parameters', Params);

  Res := RuptelaGraphQL(GQL_UPDATE_TRIP, Vars);
  Res.Free;
end;`,
  },

  {
    id: 'deleteTrip',
    title: 'deleteTrip — видалити поїздку',
    kind: 'mutation',
    summary: 'Найпростіша мутація схеми: приймає рядок, повертає булеве значення.',
    proxy: 'DELETE /api/ruptela/trips/:id',
    document: `mutation deleteTrip($id: String!) {
  deleteTrip(id: $id)
}`,
    variables: `{ "id": "3f2504e0-4f89-11d3-9a0c-0305e82c3301" }`,
    result: `{ "data": { "deleteTrip": true } }`,
    rules: [
      'Відповідь true/false — false означає, що Ruptela відмовила, хоча HTTP-код 200 і масиву errors немає. Перевіряйте саме значення.',
      'Тип змінної — String!, а не ID!.',
      'Наш шлюз при false віддає 502 «Ruptela відхилила видалення поїздки» і не чіпає кеш.',
    ],
    delphi: `// ── Видалення ────────────────────────────────────────────────────────
function DeleteTrip(const ATripId: string): Boolean;
var
  Vars, Res: TJSONObject;
begin
  Vars := TJSONObject.Create;
  Vars.AddPair('id', ATripId);          // тип у схемі — String!

  Res := RuptelaGraphQL(GQL_DELETE_TRIP, Vars);
  try
    // Порожнього errors замало: сама відповідь може бути false
    Result := Res.GetValue<TJSONBool>('deleteTrip').AsBoolean;
  finally
    Res.Free;
  end;

  if not Result then
    raise Exception.Create('Ruptela відхилила видалення поїздки');
end;`,
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   Delphi — базові юніти
   ───────────────────────────────────────────────────────────────────────── */

export interface DelphiSnippet {
  id: string;
  title: string;
  intro: string;
  code: string;
  notes?: string[];
}

export const DELPHI_SNIPPETS: DelphiSnippet[] = [
  {
    id: 'graphql-core',
    title: 'Транспорт GraphQL — RuptelaGraphQL()',
    intro:
      'Одна функція, через яку йдуть усі чотири операції Routing & Tasking. Вона ж перевіряє errors — ' +
      'без цієї перевірки кожна відхилена мутація виглядає як успіх.',
    code: `unit Ruptela.Routing;

interface

uses
  System.SysUtils, System.Classes, System.JSON, System.NetEncoding,
  System.Net.HttpClient, System.Net.URLClient, System.Net.HttpClientComponent;

const
  RUPTELA_BASE = 'https://api.fm-track.com';
  // Ключ читати з конфігу/реєстру, а не «зашивати» в exe
  RUPTELA_API_KEY = '<ВАШ_КЛЮЧ>';

  GQL_TRIP_LIST =
    'query tripList($parameters: Parameters!) {' +
    '  tripList(parameters: $parameters) {' +
    '    id title notes eta' +
    '    status { state completedAt }' +
    '    vehicle { id name primaryDriver { id name } }' +
    '    route { metadata { distance } legs { id' +
    '      start { id type notes visitedAt eta arrivalPlannedFrom arrivalPlannedTill' +
    '              duration cargoWeight location { latitude longitude }' +
    '              address { locality street country }' +
    '              todos { id description type completed completedAt } }' +
    '      end   { id type notes visitedAt eta arrivalPlannedFrom arrivalPlannedTill' +
    '              duration cargoWeight location { latitude longitude }' +
    '              address { locality street country }' +
    '              todos { id description type completed completedAt } } } }' +
    '  }' +
    '}';

  GQL_CREATE_TRIP =
    'mutation createTrip($parameters: TripCreateParameters!) {' +
    '  createTrip(parameters: $parameters) { id title status { state } ' +
    '    route { metadata { distance } } }' +
    '}';

  GQL_UPDATE_TRIP =
    'mutation updateTrip($parameters: TripUpdateParameters!) {' +
    '  updateTrip(parameters: $parameters) { id title status { state } ' +
    '    route { metadata { distance } } }' +
    '}';

  GQL_DELETE_TRIP =
    'mutation deleteTrip($id: String!) { deleteTrip(id: $id) }';

/// Виконує GraphQL-операцію. AVariables переходить у власність функції.
/// Повертає вміст "data" — звільняє викликач.
function RuptelaGraphQL(const AQuery: string; AVariables: TJSONObject): TJSONObject;

implementation

function RuptelaGraphQL(const AQuery: string; AVariables: TJSONObject): TJSONObject;
var
  Http: THTTPClient;
  Body: TJSONObject;
  Payload: TStringStream;
  Resp: IHTTPResponse;
  Parsed, Data: TJSONObject;
  Errors: TJSONArray;
  Msg: string;
  I: Integer;
begin
  Body := TJSONObject.Create;
  try
    // Ніколи не склеюйте JSON рядками: у query є лапки й переноси,
    // а в назвах точок — кирилиця. TJSONObject екранує це коректно.
    Body.AddPair('query', AQuery);
    if Assigned(AVariables) then
      Body.AddPair('variables', AVariables);

    // UTF-8 обовʼязково, інакше кирилиця приїде «кракозябрами»
    Payload := TStringStream.Create(Body.ToJSON, TEncoding.UTF8);
    try
      Http := THTTPClient.Create;
      try
        Http.ConnectionTimeout := 15000;
        // Архівний tripList легально працює довше 30 с
        Http.ResponseTimeout := 60000;
        Http.ContentType := 'application/json; charset=utf-8';
        Http.CustomHeaders['Accept'] := 'application/json';

        Resp := Http.Post(
          RUPTELA_BASE + '/routing?api_key=' + TNetEncoding.URL.Encode(RUPTELA_API_KEY),
          Payload);

        Parsed := TJSONObject.ParseJSONValue(
          Resp.ContentAsString(TEncoding.UTF8)) as TJSONObject;
        if not Assigned(Parsed) then
          raise Exception.CreateFmt('Ruptela: не JSON (HTTP %d)', [Resp.StatusCode]);

        try
          // ГОЛОВНЕ: GraphQL відповідає 200 навіть на провалену операцію.
          // Помилка лежить у errors, а не в коді відповіді.
          if Parsed.TryGetValue<TJSONArray>('errors', Errors) and (Errors.Count > 0) then
          begin
            Msg := '';
            for I := 0 to Errors.Count - 1 do
              Msg := Msg + (Errors.Items[I] as TJSONObject).GetValue<string>('message') + '; ';
            raise Exception.Create('Ruptela: ' + Msg);
          end;

          if not Parsed.TryGetValue<TJSONObject>('data', Data) then
            raise Exception.Create('Ruptela: порожня відповідь');

          Result := Data.Clone as TJSONObject;
        finally
          Parsed.Free;
        end;
      finally
        Http.Free;
      end;
    finally
      Payload.Free;
    end;
  finally
    Body.Free;   // разом із ним звільняється і AVariables
  end;
end;

end.`,
    notes: [
      'AVariables додається в Body через AddPair — тому окремо його звільняти НЕ можна: Body.Free забирає всю гілку.',
      'Result — це клон гілки data, бо Parsed звільняється одразу.',
      'Якщо ви на старому Delphi з Indy: TIdHTTP + TIdSSLIOHandlerSocketOpenSSL, Request.ContentType := \'application/json\', Request.Charset := \'utf-8\' і потік теж TStringStream з TEncoding.UTF8.',
    ],
  },
  {
    id: 'rest-core',
    title: 'Транспорт REST — FmsGet() для Insights',
    intro:
      'Для FMS Insights GraphQL не потрібен — це звичайний REST. Ключ і version ідуть у query, ' +
      'значення параметрів обовʼязково URL-екрануються.',
    code: `unit Ruptela.Fms;

interface

uses
  System.SysUtils, System.Classes, System.JSON, System.DateUtils,
  System.NetEncoding, System.Net.HttpClient, System.Net.URLClient;

const
  RUPTELA_BASE = 'https://api.fm-track.com';
  RUPTELA_API_KEY = '<ВАШ_КЛЮЧ>';

function IsoUtc(const AWhen: TDateTime): string;
function FmsGet(const APath: string; AVersion: Integer;
  const AParams: array of string): TJSONValue;

implementation

/// Ruptela чекає 2026-08-06T09:15:00Z. Локальний час без Z вендор
/// мовчки вважає UTC — звіт зʼїде на різницю поясів.
function IsoUtc(const AWhen: TDateTime): string;
begin
  Result := FormatDateTime('yyyy-mm-dd"T"hh:nn:ss"Z"', TTimeZone.Local.ToUniversalTime(AWhen));
end;

/// AParams — плоский масив пар: ['object_id', Id, 'from_datetime', IsoUtc(D1)]
function FmsGet(const APath: string; AVersion: Integer;
  const AParams: array of string): TJSONValue;
var
  Http: THTTPClient;
  Url: string;
  Resp: IHTTPResponse;
  I: Integer;
begin
  Url := RUPTELA_BASE + APath +
         '?api_key=' + TNetEncoding.URL.Encode(RUPTELA_API_KEY) +
         '&version=' + IntToStr(AVersion);

  I := 0;
  while I < Length(AParams) - 1 do
  begin
    if AParams[I + 1] <> '' then       // порожні параметри не надсилаємо
      Url := Url + '&' + AParams[I] + '=' + TNetEncoding.URL.Encode(AParams[I + 1]);
    Inc(I, 2);
  end;

  Http := THTTPClient.Create;
  try
    Http.ConnectionTimeout := 15000;
    Http.ResponseTimeout := 45000;     // звіти по країнах бувають повільні
    Http.CustomHeaders['Accept'] := 'application/json';

    Resp := Http.Get(Url);
    if Resp.StatusCode >= 400 then
      raise Exception.CreateFmt('Ruptela FMS %d: %s',
        [Resp.StatusCode, Resp.ContentAsString(TEncoding.UTF8)]);

    Result := TJSONObject.ParseJSONValue(Resp.ContentAsString(TEncoding.UTF8));
  finally
    Http.Free;
  end;
end;

end.`,
    notes: [
      'Помилки FMS приходять як JSON із полем message; деталі валідації — у field_validation_errors[].reason.',
      'Пагінація: беріть continuation_token з відповіді і повторюйте запит із ним, доки він не null.',
    ],
  },
  {
    id: 'rest-usage',
    title: 'Приклад: паливні події за тиждень',
    intro: 'Типовий сценарій звірки — витягнути заправки по одному ТЗ і пройтись по сторінках.',
    code: `procedure LoadFuelEvents(const AObjectId: string; ADays: Integer);
var
  Page: TJSONObject;
  Items: TJSONArray;
  Token: string;
  I: Integer;
begin
  Token := '';
  repeat
    Page := FmsGet('/fuel-events', 1, [
      'object_id',          AObjectId,
      'from_datetime',      IsoUtc(Now - ADays),
      'to_datetime',        IsoUtc(Now),
      'limit',              '100',
      'continuation_token', Token
    ]) as TJSONObject;
    try
      Items := Page.GetValue<TJSONArray>('items');
      for I := 0 to Items.Count - 1 do
        Memo1.Lines.Add(Items.Items[I].ToJSON);

      // null → сторінок більше немає
      if not Page.TryGetValue<string>('continuation_token', Token) then
        Token := '';
    finally
      Page.Free;
    end;
  until Token = '';
end;`,
  },
  {
    id: 'proxy-usage',
    title: 'Через наш шлюз замість прямого fm-track',
    intro:
      'Якщо Delphi-клієнт ходить у наш NestJS, ключ Ruptela йому не потрібен — потрібен сеансовий ' +
      'токен. Зате доступні вже нормалізовані відповіді й кеш.',
    code: `const
  VELES_BASE = 'http://localhost:3001';

function VelesGet(const APath, AToken: string): TJSONValue;
var
  Http: THTTPClient;
  Resp: IHTTPResponse;
begin
  Http := THTTPClient.Create;
  try
    // Без цього заголовка серверна заборона для гостей не спрацює,
    // а POST/PUT/DELETE під гостьовим токеном повернуть 403.
    Http.CustomHeaders['Authorization'] := 'Bearer ' + AToken;
    Http.CustomHeaders['Accept'] := 'application/json';

    Resp := Http.Get(VELES_BASE + APath);
    if Resp.StatusCode >= 400 then
      raise Exception.CreateFmt('%d: %s',
        [Resp.StatusCode, Resp.ContentAsString(TEncoding.UTF8)]);

    Result := TJSONObject.ParseJSONValue(Resp.ContentAsString(TEncoding.UTF8));
  finally
    Http.Free;
  end;
end;

// Створення поїздки через шлюз: плоский список waypoints,
// UUID генерує сервер, розкладку на legs теж робить він.
// POST /api/ruptela/trips
// {
//   "title": "Чернівці → Гданськ",
//   "vehicleId": "<id ТЗ>",
//   "notifyDrivers": false,
//   "waypoints": [
//     { "type": "LOADING",   "latitude": 48.2917, "longitude": 25.9354 },
//     { "type": "UNLOADING", "address": "Gdansk, Poland" }
//   ]
// }`,
    notes: [
      'Токен видає POST /api/auth/login і має вигляд veles_session_<мс>_<РОЛЬ>.',
      'Шлюз приймає waypoints плоским списком і сам згортає його в legs для updateTrip.',
    ],
  },
];

export const DELPHI_PITFALLS: Array<{ title: string; text: string }> = [
  {
    title: 'Не склеюйте JSON рядками',
    text:
      'GraphQL-документ містить лапки, фігурні дужки й переноси рядків. Ручна конкатенація ламає ' +
      'екранування на першій же назві з апострофом. Будуйте тіло через TJSONObject.',
  },
  {
    title: 'UTF-8 у потоці, а не в ContentType',
    text:
      'TStringStream.Create(S) використовує ANSI. Для кирилиці — TStringStream.Create(S, TEncoding.UTF8), ' +
      'і читати відповідь теж як ContentAsString(TEncoding.UTF8).',
  },
  {
    title: 'UUID без фігурних дужок',
    text:
      'TGUID.NewGuid.ToString дає {8B1F…} у верхньому регістрі. Ruptela приймає лише чистий UUID — ' +
      'обрізайте дужки й переводьте в нижній регістр.',
  },
  {
    title: 'HTTP 200 ≠ успіх',
    text:
      'Для /routing завжди перевіряйте масив errors, а для deleteTrip — ще й саме значення true/false.',
  },
  {
    title: 'Таймаути',
    text:
      'tripList по архіву легально працює ~31 с. ResponseTimeout за замовчуванням обірве запит раніше — ' +
      'ставте 60 000 мс.',
  },
];
