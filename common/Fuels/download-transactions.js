#!/usr/bin/env node
/**
 * Вивантаження СИРИХ транзакцій OKKO та Shell у JSON — рівно те, що віддає API вендора,
 * без маперів бекенду (копійки, мілілітри, дати yyyyMMdd лишаються як є).
 * Опис полів і порівняння вендорів — PORIVNYANNYA-OKKO-SHELL.md.
 *
 * Запуск (з кореня репозиторію):
 *   node common/Fuels/download-transactions.js                           # обидва вендори, останній місяць
 *   node common/Fuels/download-transactions.js okko  2026-08-15 2026-09-15
 *   node common/Fuels/download-transactions.js shell 2026-08-15 2026-09-15
 *
 * Ключі беруться з backend/.env (ті самі, що в бекенду) і в консоль не друкуються.
 * Результат: common/Fuels/data/<vendor>-transactions_<від>_<до>.json  →  { meta, transactions: [...] }
 *
 * УВАГА: у файлах номери карток, ПІБ водіїв і держномери — тека data/ виключена з git
 * (скрипт сам створює там .gitignore).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', '..');
const axios = require(path.join(ROOT, 'backend', 'node_modules', 'axios'));
const OUT_DIR = path.join(__dirname, 'data');
const DAY = 86_400_000;

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    env[m[1]] = v;
  }
  return env;
}

const fmt = (d) => d.toISOString().slice(0, 10);
const compact = (ymd) => ymd.replace(/-/g, '');
function parseYmd(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) throw new Error(`Дата має бути у форматі YYYY-MM-DD: ${s}`);
  return new Date(`${s}T00:00:00Z`);
}

/**
 * Ділить [from, to] на вікна по `days` днів. Сусідні вікна перекриваються на 1 день: чи
 * включна межа date_to/ToDate, вендори не документують, тож краще взяти день двічі й
 * прибрати дублікати, ніж загубити транзакції на стику.
 */
function windows(from, to, days) {
  const out = [];
  const end = parseYmd(to).getTime();
  let start = parseYmd(from).getTime();
  if (start > end) throw new Error(`Початок періоду ${from} пізніший за кінець ${to}`);
  for (;;) {
    const stop = Math.min(start + (days - 1) * DAY, end);
    out.push({ from: fmt(new Date(start)), to: fmt(new Date(stop)) });
    if (stop >= end) return out;
    start = stop;
  }
}

async function withRetry(label, fn, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const status = e.response?.status;
      const retriable = !status || status === 429 || status >= 500;
      if (!retriable || i >= attempts) throw e;
      const wait = 3000 * 2 ** (i - 1);
      console.warn(`  ${label}: ${status || e.code || e.message} — повтор через ${wait / 1000} с`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

/**
 * JSON.parse без втрати точності. Shell віддає SalesItemId як 64-бітне ЧИСЛО (~2^62), а
 * звичайний JSON.parse округлює все, що більше 2^53: сусідні id зливаються в один (з 5803
 * рядків лишалось 3038 різних SalesItemId). Такі цілі зберігаємо рядком — їхнім точним
 * текстом із відповіді. Потрібен Node 21+ (reviver із `context.source`).
 */
function parseJsonLossless(text, bigKeys) {
  return JSON.parse(text, (key, value, context) => {
    if (typeof value === 'number' && !Number.isSafeInteger(value) && /^-?\d+$/.test(context?.source ?? '')) {
      bigKeys.add(key);
      return context.source;
    }
    return value;
  });
}

// Відповіді беремо сирим текстом, щоб axios не розібрав їх звичайним JSON.parse.
const RAW_TEXT = { responseType: 'text', transformResponse: [(data) => data] };

/** Прибирає лише ТОЧНІ копії рядків (з перекриття вікон); різні рядки з однаковим id лишаються. */
function dropExactDuplicates(rows) {
  const seen = new Set();
  const out = rows.filter((r) => {
    const key = JSON.stringify(r);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { rows: out, removed: rows.length - out.length };
}

async function downloadOkko(env, from, to) {
  if (!env.OKKO_API_KEY) throw new Error('OKKO_API_KEY не задано в backend/.env');
  const baseURL = env.OKKO_BASE_URL || 'https://gw-online.okko.ua:9443/api/erp';
  const client = axios.create({
    baseURL,
    timeout: 60_000,
    // Сертифікат OKKO не проходить валідацію — так само вимкнено і в бекенді.
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    headers: { Accept: 'application/json', 'X-API-KEY': env.OKKO_API_KEY },
    ...RAW_TEXT,
  });

  const PAGE = 100;
  const bigKeys = new Set();
  // processed_in_bo=false — надмножина: і рознесені в SVBO, і ще «онлайн» (SVFE) транзакції.
  // early_first вендор ігнорує (завжди від новіших до старіших), але передаємо як у доках.
  const fixed = { processed_in_bo: false, early_first: true };
  const all = [];
  const log = [];

  // Ліміт API — 31 день на запит, тож ідемо вікнами по 30 днів і посторінково.
  for (const w of windows(from, to, 30)) {
    let page = 0;
    let total = 0;
    let fetched = 0;
    do {
      // ПАСТКА: `offset` у OKKO — це НОМЕР СТОРІНКИ з нуля, а не зсув у рядках (перевірено:
      // size=50&offset=1 → рядки 51–100, а offset=100 → порожньо). Swagger описує інакше.
      const params = { date_from: w.from, date_to: w.to, ...fixed, size: PAGE, offset: page };
      const res = await withRetry(`OKKO ${w.from}..${w.to}`, () => client.get('/v2/transactions', { params }));
      const data = parseJsonLossless(res.data, bigKeys);
      // Swagger описує масив як `transactions`, реальна відповідь — `{ total, items }`.
      const list = data?.items ?? data?.transactions ?? [];
      total = Number(data?.total ?? 0);
      all.push(...list);
      fetched += list.length;
      page += 1;
      if (list.length === 0) break;
    } while (fetched < total);

    if (fetched < total) console.warn(`  OKKO ${w.from}..${w.to}: отримано ${fetched} з ${total}!`);
    if (total) console.log(`  OKKO ${w.from}..${w.to}: ${fetched}/${total}`);
    log.push({ ...w, total, fetched });
  }

  const { rows, removed } = dropExactDuplicates(all);
  return {
    meta: {
      vendor: 'OKKO',
      request: `GET ${baseURL}/v2/transactions`,
      params: { ...fixed, size: PAGE, windows_days: 30 },
      period: { from, to },
      fetched_at: new Date().toISOString(),
      count: rows.length,
      exact_duplicates_removed: removed,
      big_integers_as_strings: [...bigKeys],
      windows: log.filter((w) => w.total > 0),
      note: 'Сирі дані API без перетворень. Одиниці виміру та значення полів — у PORIVNYANNYA-OKKO-SHELL.md.',
    },
    transactions: rows,
  };
}

async function downloadShell(env, from, to, { includeFees = true } = {}) {
  const basic =
    env.SHELL_BASIC_AUTH ||
    (env.SHELL_API_KEY && env.SHELL_SECRET
      ? `Basic ${Buffer.from(`${env.SHELL_API_KEY}:${env.SHELL_SECRET}`).toString('base64')}`
      : '');
  if (!basic || !env.SHELL_API_KEY) throw new Error('SHELL_API_KEY / SHELL_SECRET не задано в backend/.env');
  if (!env.SHELL_PAYER_NUMBER || !env.SHELL_COLCO_CODE) {
    throw new Error('SHELL_PAYER_NUMBER / SHELL_COLCO_CODE не задано в backend/.env');
  }
  const baseURL = env.SHELL_BASE_URL || 'https://api.shell.com';
  const client = axios.create({
    baseURL,
    // Режим IncludeFees=true дуже повільний (десятки секунд на сторінку).
    timeout: 300_000,
    headers: { Authorization: basic, apikey: env.SHELL_API_KEY, 'Content-Type': 'application/json' },
    ...RAW_TEXT,
  });

  const PAGE = 1000;
  const bigKeys = new Set();
  const fixed = {
    ColCoCode: env.SHELL_COLCO_CODE,
    PayerNumber: env.SHELL_PAYER_NUMBER,
    InvoiceStatus: 'A', // A = і виставлені в інвойс, і ще ні
    IncludeFees: includeFees, // true = продажі + збори (FeeItem) в одній відповіді
  };
  const all = [];
  const log = [];

  // Ліміт API — 210 днів на запит; ідемо помісячними вікнами, щоб одна сторінка не впиралась у таймаут.
  for (const w of windows(from, to, 31)) {
    let page = 1;
    let totalPages = 1;
    let rowCount = 0;
    let fetched = 0;
    do {
      const body = { ...fixed, FromDate: compact(w.from), ToDate: compact(w.to), PageSize: String(PAGE), CurrentPage: String(page) };
      const started = Date.now();
      const res = await withRetry(`Shell ${w.from}..${w.to} стор.${page}`, () =>
        client.post('/fleetmanagement/v1/transaction/pricedtransactions', body),
      );
      const d = parseJsonLossless(res.data, bigKeys);
      // Shell відповідає HTTP 200 і на помилку — справжній результат у Error.Code ('0000' = успіх).
      if (d?.Error?.Code && d.Error.Code !== '0000') {
        throw new Error(`Shell ${w.from}..${w.to}: ${d.Error.Code} ${d.Error.Description}`);
      }
      const list = d?.Transactions ?? [];
      all.push(...list);
      fetched += list.length;
      totalPages = Number(d?.TotalPages ?? 1) || 1;
      rowCount = Number(d?.RowCount ?? fetched);
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`  Shell ${w.from}..${w.to} стор. ${page}/${totalPages}: ${list.length} рядків, ${secs} с`);
      page += 1;
    } while (page <= totalPages);

    if (fetched < rowCount) console.warn(`  Shell ${w.from}..${w.to}: отримано ${fetched} з ${rowCount}!`);
    log.push({ ...w, row_count: rowCount, fetched });
  }

  const { rows, removed } = dropExactDuplicates(all);
  return {
    meta: {
      vendor: 'SHELL',
      request: `POST ${baseURL}/fleetmanagement/v1/transaction/pricedtransactions`,
      params: { ...fixed, PageSize: PAGE, windows_days: 31 },
      period: { from, to },
      fetched_at: new Date().toISOString(),
      count: rows.length,
      exact_duplicates_removed: removed,
      big_integers_as_strings: [...bigKeys],
      windows: log,
      note: 'Сирі дані API без перетворень. Одиниці виміру та значення полів — у PORIVNYANNYA-OKKO-SHELL.md.',
    },
    transactions: rows,
  };
}

function save(vendor, payload) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ignore = path.join(OUT_DIR, '.gitignore');
  if (!fs.existsSync(ignore)) {
    fs.writeFileSync(ignore, '# Сирі вивантаження транзакцій: номери карток, ПІБ водіїв, держномери — не комітимо.\n*\n!.gitignore\n');
  }
  const { from, to } = payload.meta.period;
  const file = path.join(OUT_DIR, `${vendor}-transactions_${from}_${to}.json`);
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  const mb = (fs.statSync(file).size / 1024 / 1024).toFixed(1);
  console.log(`✔ ${path.relative(ROOT, file)} — ${payload.meta.count} транзакцій, ${mb} МБ`);
  return file;
}

async function main() {
  const [vendor = 'all', fromArg, toArg] = process.argv.slice(2);
  if (!['all', 'okko', 'shell'].includes(vendor)) throw new Error(`Невідомий вендор: ${vendor} (okko | shell | all)`);
  const env = loadEnv(path.join(ROOT, 'backend', '.env'));
  const to = toArg || fmt(new Date());
  // За замовчуванням — останній місяць: від того ж числа попереднього місяця до `to`.
  const monthAgo = new Date(parseYmd(to));
  monthAgo.setUTCMonth(monthAgo.getUTCMonth() - 1);
  const from = fromArg || fmt(monthAgo);

  if (vendor === 'all' || vendor === 'okko') {
    console.log(`OKKO: ${from} → ${to}`);
    save('okko', await downloadOkko(env, from, to));
  }
  if (vendor === 'all' || vendor === 'shell') {
    console.log(`Shell: ${from} → ${to}`);
    save('shell', await downloadShell(env, from, to));
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`✖ ${e.response ? `HTTP ${e.response.status}` : ''} ${e.message}`);
    process.exit(1);
  });
}

module.exports = { loadEnv, downloadOkko, downloadShell, windows, ROOT };
