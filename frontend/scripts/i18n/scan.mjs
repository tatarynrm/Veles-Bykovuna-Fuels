#!/usr/bin/env node
/**
 * Сканер перекладів (по AST TypeScript).
 *
 * Ключ — семантичний ідентифікатор `простір.назва`, спільний для всіх мов.
 * Сканер відповідає на три питання:
 *
 *   used     — які ключі справді викликаються з коду;
 *   missing  — які з них не мають перекладу в конкретній мові;
 *   orphans  — які ключі є у словниках, але їх ніхто не викликає;
 *   raw      — де у коді лишився людський текст повз t() (це й є недоробка).
 *
 * Ключі, зібрані динамічно (`t(item.label)`, `localizedMap`), сканер не бачить
 * як виклики, тому додатково зараховує будь-який рядок виду `простір.назва`,
 * який збігається з наявним ключем словника, — саме так виглядають константи
 * навігації й довідники підписів.
 *
 * Запуск:
 *   node scripts/i18n/scan.mjs                # звіт
 *   node scripts/i18n/scan.mjs --json         # машинний вивід (для агента)
 *   node scripts/i18n/scan.mjs --todo pl      # неперекладені ключі однієї мови
 *   node scripts/i18n/scan.mjs --prune        # прибрати ключі, яких немає в коді
 *   node scripts/i18n/scan.mjs --check        # код виходу 1, якщо є прогалини (CI)
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { EXCLUDE, clean, parse } from './ast.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');
const LOCALES_DIR = join(SRC, 'locales');

/** Мова оригіналу + мови перекладу. */
export const SOURCE = 'uk';
export const TARGETS = ['en', 'pl', 'de'];

const KEY_RE = /^[a-z][a-zA-Z0-9]*\.[a-zA-Z0-9]+$/;
const CYRILLIC = /[Ѐ-ӿ]/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function loadDict(locale) {
  const file = join(LOCALES_DIR, `${locale}.json`);
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`Пошкоджений ${locale}.json: ${err.message}`);
    process.exit(1);
  }
}

function saveDict(locale, dict) {
  const sorted = Object.fromEntries(Object.keys(dict).sort().map((k) => [k, dict[k]]));
  writeFileSync(join(LOCALES_DIR, `${locale}.json`), JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

/* ── розбір файлу ──────────────────────────────────────────────────────── */

/**
 * Повертає { keys, raw } — ключі, які файл використовує, і людський текст,
 * що лишився поза словником.
 */
function inspect(fileName, code, known) {
  const source = parse(fileName, code);
  const keys = new Set();
  const raw = [];

  /**
   * Прагма для констант, де кирилиця — дані, а не підпис:
   *
   *     i18n-ignore-raw: KEYWORDS
   *
   * Так позначено список слів, за якими експорт впізнає тип колонки. Прагма
   * навмисно іменна: вимкнути перевірку для цілого файлу означало б проґавити
   * там наступний неперекладений рядок.
   */
  const ignoredMatch = code.match(/i18n-ignore-raw:\s*([^*\n]+)/);
  const ignoredVars = new Set(
    ignoredMatch ? ignoredMatch[1].split(',').map((s) => s.trim()).filter(Boolean) : [],
  );

  const insideIgnoredVar = (node) => {
    if (!ignoredVars.size) return false;
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && ignoredVars.has(p.name.text)) {
        return true;
      }
    }
    return false;
  };

  const lineOf = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

  const visit = (node) => {
    // t('ключ') / plural('ключ')
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === 't' || node.expression.text === 'plural')
    ) {
      const first = node.arguments[0];
      if (first && ts.isStringLiteral(first)) keys.add(first.text);
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = clean(node.text);
      // Ключ у константі модуля: { label: 'nav.dashboard' }
      if (KEY_RE.test(text) && known.has(text)) keys.add(text);
      // Кирилиця поза словником — текст, для якого ще немає ключа
      else if (CYRILLIC.test(text) && !insideIgnoredVar(node)) raw.push({ line: lineOf(node), text });
    }

    if (ts.isJsxText(node)) {
      const text = clean(node.text);
      if (CYRILLIC.test(text)) raw.push({ line: lineOf(node), text });
    }

    if (ts.isTemplateExpression(node)) {
      const staticText = node.head.text + node.templateSpans.map((s) => s.literal.text).join('');
      if (CYRILLIC.test(staticText)) raw.push({ line: lineOf(node), text: clean(staticText) });
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return { keys, raw };
}

/* ── головне ───────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const check = args.includes('--check');
const shouldPrune = args.includes('--prune');
const todoLocale = args.includes('--todo') ? args[args.indexOf('--todo') + 1] : null;

const dicts = Object.fromEntries([SOURCE, ...TARGETS].map((l) => [l, loadDict(l)]));
const known = new Set(Object.keys(dicts[SOURCE]));

const files = walk(SRC).filter((f) => {
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  return !EXCLUDE.some((e) => rel.startsWith(e));
});

const used = new Set();
const raw = [];

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const code = readFileSync(file, 'utf8');
  const result = inspect(file, code, known);
  for (const key of result.keys) used.add(key);
  for (const hit of result.raw) raw.push({ file: rel, ...hit });
}

const usedKeys = [...used].sort();
const undefinedKeys = usedKeys.filter((k) => !known.has(k));
const orphans = [...known].filter((k) => !used.has(k)).sort();

const report = {
  totalKeys: known.size,
  usedKeys: usedKeys.length,
  undefinedKeys,
  orphanKeys: orphans,
  rawTextCount: raw.length,
  locales: {},
};

for (const locale of TARGETS) {
  const missing = [...known].filter((k) => !dicts[locale][k]).sort();
  report.locales[locale] = {
    translated: known.size - missing.length,
    missing: missing.length,
    missingKeys: missing,
  };
}

if (shouldPrune) {
  for (const locale of [SOURCE, ...TARGETS]) {
    const next = { ...dicts[locale] };
    for (const key of orphans) delete next[key];
    saveDict(locale, next);
  }
}

/* ── вивід ─────────────────────────────────────────────────────────────── */

if (todoLocale) {
  const l = report.locales[todoLocale];
  if (!l) {
    console.error(`Невідома мова: ${todoLocale}. Доступні: ${TARGETS.join(', ')}`);
    process.exit(1);
  }
  console.log(JSON.stringify(l.missingKeys, null, 2));
} else if (asJson) {
  console.log(JSON.stringify({ ...report, raw }, null, 2));
} else {
  console.log(`Ключів у словниках: ${report.totalKeys} · використано в коді: ${report.usedKeys}`);
  for (const locale of TARGETS) {
    const l = report.locales[locale];
    const pct = report.totalKeys ? Math.round((l.translated / report.totalKeys) * 100) : 100;
    console.log(
      `  ${locale}: ${l.translated}/${report.totalKeys} (${pct}%)` +
        `${l.missing ? `, без перекладу: ${l.missing}` : ''}`,
    );
  }

  if (undefinedKeys.length) {
    console.log(`\nКлючі без запису у словнику (${undefinedKeys.length}):`);
    for (const key of undefinedKeys.slice(0, 20)) console.log(`  ${key}`);
  }

  if (orphans.length) {
    console.log(`\nКлючі, яких немає в коді (${orphans.length}) — прибрати через --prune:`);
    for (const key of orphans.slice(0, 15)) console.log(`  ${key}`);
  }

  console.log(`\nТекст поза словником (${raw.length}) — потребує ключа:`);
  const byFile = new Map();
  for (const r of raw) byFile.set(r.file, (byFile.get(r.file) ?? 0) + 1);
  for (const [file, count] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(count).padStart(4)}  ${file}`);
  }
}

if (check) {
  const gaps =
    undefinedKeys.length > 0 ||
    raw.length > 0 ||
    TARGETS.some((l) => report.locales[l].missing > 0);
  process.exit(gaps ? 1 : 0);
}
