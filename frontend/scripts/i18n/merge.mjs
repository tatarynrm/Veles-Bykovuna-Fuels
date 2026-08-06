#!/usr/bin/env node
/**
 * Заливає переклади з TSV у словники.
 *
 * Формат рядка: <ключ>\t<en>\t<pl>\t<de>
 * Порожня колонка означає «не чіпати» — уже наявний переклад лишиться.
 * Коментар — рядок, що починається з «# ».
 *
 *   node scripts/i18n/merge.mjs scripts/i18n/translations/07-reports.tsv
 *   node scripts/i18n/merge.mjs scripts/i18n/translations
 *
 * Навіщо TSV, а не редагування JSON руками: так усі три мови одного ключа
 * стоять поруч — і видно, що переклад узгоджений між ними. Український текст
 * (uk.json) сюди не входить: він задається під час присвоєння ключа (keyize).
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCALES_DIR = join(ROOT, 'src', 'locales');
const TARGETS = ['en', 'pl', 'de'];

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Вкажіть .tsv файл або теку з ними');
  process.exit(1);
}

const source = JSON.parse(readFileSync(join(LOCALES_DIR, 'uk.json'), 'utf8'));

const dicts = Object.fromEntries(
  TARGETS.map((l) => {
    const p = join(LOCALES_DIR, `${l}.json`);
    return [l, existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}];
  }),
);

const expand = (pattern) => {
  if (existsSync(pattern) && statSync(pattern).isDirectory()) {
    return readdirSync(pattern).filter((f) => f.endsWith('.tsv')).map((f) => join(pattern, f));
  }
  return [pattern];
};

let applied = 0;
const unknown = [];

for (const file of files.flatMap(expand)) {
  for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim() || line.startsWith('# ')) continue;

    const [key, en, pl, de] = line.split('\t');
    if (!key) continue;

    // Ключ, якого немає в uk.json, — майже завжди друкарська помилка
    if (!(key in source)) {
      unknown.push(key);
      continue;
    }

    const values = { en, pl, de };
    let touched = false;
    for (const locale of TARGETS) {
      const value = (values[locale] ?? '').trim();
      if (!value) continue;
      dicts[locale][key] = value;
      touched = true;
    }
    if (touched) applied++;
  }
}

for (const locale of TARGETS) {
  const sorted = Object.fromEntries(
    Object.keys(dicts[locale]).sort().map((k) => [k, dicts[locale][k]]),
  );
  writeFileSync(join(LOCALES_DIR, `${locale}.json`), JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

console.log(`Застосовано ключів: ${applied}`);
if (unknown.length) {
  console.log(`\nНевідомі ключі (${unknown.length}) — немає в uk.json:`);
  for (const key of unknown.slice(0, 15)) console.log(`  ${key}`);
  process.exitCode = 1;
}
