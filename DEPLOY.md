# Деплой Veles Bykovuna Fuels ERP

Два сервіси під PM2: **NestJS backend** (порт **7001**) і **Next.js frontend** (порт **7002**).
Порти задаються в `ecosystem.config.js`; локальна розробка й далі на 3001/3000.

## 1. Приватний репозиторій

Репозиторій уже ініціалізовано локально. Створіть **приватний** репозиторій на GitHub
(Repositories → New → Visibility: **Private**) і запуште:

```bash
git remote add origin git@github.com:<ВАШ_АКАУНТ>/veles-bykovuna-fuels.git
git push -u origin main
```

`.gitignore` виключає `backend/.env` та всі секрети — перед першим push перевірте:
`git status --ignored` має показувати `backend/.env` серед ignored.

## 2. Підготовка сервера (один раз)

```bash
# Node.js 20 LTS (приклад для Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# PM2
sudo npm i -g pm2
```

## 3. Перший деплой

```bash
git clone git@github.com:<ВАШ_АКАУНТ>/veles-bykovuna-fuels.git
cd veles-bykovuna-fuels

# Секрети бекенда — файл НЕ в репозиторії, створіть із шаблону:
cp backend/.env.example backend/.env
nano backend/.env        # впишіть реальні ключі OKKO/Shell/Ruptela, пароль адміна,
                         # CORS_ORIGIN=https://ваш-домен

# Адреса бекенда для браузера (вшивається у бандл при збірці!):
cp frontend/.env.example frontend/.env.production
nano frontend/.env.production   # NEXT_PUBLIC_API_URL=http://<IP_або_домен>:7001

# Збірка та запуск
chmod +x deploy.sh
./deploy.sh

# Автозапуск PM2 після перезавантаження сервера
pm2 startup            # виконайте команду, яку він надрукує
pm2 save
```

## 4. Оновлення

З кореня репозиторію тепер працює `npm run …` — root `package.json` оркеструє обидва
застосунки (нічого встановлювати в корені не треба, скрипти лише делегують у `backend/`
та `frontend/`):

```bash
cd veles-bykovuna-fuels
git pull --ff-only
npm run deploy          # npm run build (backend + frontend) → pm2 restart all
```

`npm run build` збирає **сервер** (`backend` → `dist/`) і **клієнт** (`frontend` → `.next/`),
далі `pm2 restart all` перезапускає процеси на новій збірці.

Повний перелік root-скриптів:

| Команда | Що робить |
|---|---|
| `npm run build` | збірка backend + frontend |
| `npm run build:backend` / `build:frontend` | збірка лише одного |
| `npm run install:all` | `npm ci` в обох застосунках (після зміни залежностей) |
| `npm run start` | перший запуск: `pm2 start ecosystem.config.js` + `pm2 save` |
| `npm run deploy` | **build → `pm2 restart all`** (те, що потрібно щодня) |
| `npm run deploy:reload` | build → `pm2 startOrReload ecosystem.config.js` (нуль-даунтайм) |
| `npm run restart` / `reload` / `stop` / `status` / `logs` | обгортки над PM2 |
| `npm test` | юніт-тести бекенда |

**`restart all` vs `reload`:**
- `npm run deploy` (`pm2 restart all`) — просто й швидко; перезапускає **всі** PM2-процеси
  на машині й підхоплює нову збірку. Не перечитує `ecosystem.config.js`, тож зміни портів/env
  у ньому не застосує. Годиться, коли міняється лише код.
- `npm run deploy:reload` (`pm2 startOrReload ecosystem.config.js`) — зачіпає **лише** процеси
  цього застосунку, перечитує конфіг (застосовує нові порти/env), працює без даунтайму й
  піднімає процеси, якщо їх ще не запущено. Якщо на сервері крутяться й інші PM2-застосунки —
  користуйтесь цим варіантом, а не `restart all`.

Або одразу з git-pull і `npm ci` — старий скрипт лишається робочим:

```bash
cd veles-bykovuna-fuels && ./deploy.sh
```

Скрипт робить `git pull`, `npm ci`, збірку обох застосунків і `pm2 startOrReload`.

## 5. Корисні команди PM2

```bash
pm2 status                     # стан процесів
pm2 logs veles-backend         # логи бекенда (також backend/logs/*.log)
pm2 logs veles-frontend
pm2 restart veles-backend      # ручний рестарт
pm2 monit                      # моніторинг у реальному часі
```

## Важливе

- **`NEXT_PUBLIC_API_URL`** вшивається у фронтенд-бандл під час `next build`.
  Змінили адресу бекенда → редагуйте `frontend/.env.production` і перезбирайте
  (`./deploy.sh`).
- **`AUTH_DEMO_ENABLED`** у `backend/.env` на продакшені має бути `false`
  (вимикає безпарольні демо-входи okko/shell/demo).
- **`CORS_ORIGIN`** на продакшені задайте явно (домен фронтенда), не лишайте `*`.
- Порти 7001/7002 назовні краще не відкривати — поставте попереду nginx/Caddy
  з TLS і проксуйте: `/` → 7002 (фронтенд), а бекенд або на піддомен, або
  відкрийте 7001 лише для потрібних мереж.
- Ключі вендорів довго лежали у вихідному коді до цього рефакторингу — якщо
  архів проєкту комусь передавався, перевипустіть ключі перед виходом у продакшен.
