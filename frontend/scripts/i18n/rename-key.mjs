#!/usr/bin/env node
/**
 * Перейменування ключів у коді й у всіх словниках одночасно.
 *
 *   node scripts/i18n/rename-key.mjs old.key new.key
 *   node scripts/i18n/rename-key.mjs --file renames.tsv     # пари через табуляцію
 *   node scripts/i18n/rename-key.mjs --dry old.key new.key
 *
 * Пари застосовуються послідовно, тому обмін іменами теж працює:
 *
 *   nav.navigation      nav.navigationWord
 *   nav.navigation2     nav.navigation
 *
 * Ключ у коді — це звичайний рядковий літерал, тож заміна робиться по точному
 * збігу вмісту лапок. Часткові збіги (ключ як підрядок) не чіпаються.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXCLUDE } from './ast.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');
const LOCALES = join(SRC, 'locales');
const TARGETS = ['uk', 'en', 'pl', 'de'];

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const rest = args.filter((a) => a !== '--dry');

let pairs = [];
if (rest[0] === '--file') {
  for (const line of readFileSync(rest[1], 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('# ')) continue;
    const [from, to] = line.split('\t').map((s) => s?.trim());
    if (from && to) pairs.push([from, to]);
  }
} else if (rest.length === 2) {
  pairs = [[rest[0], rest[1]]];
} else {
  console.error('Вкажіть пару ключів або --file <renames.tsv>');
  process.exit(1);
}

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

const files = walk(SRC).filter((f) => {
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  return !EXCLUDE.some((e) => rel.startsWith(e));
});

const dicts = Object.fromEntries(
  TARGETS.map((l) => {
    const p = join(LOCALES, `${l}.json`);
    return [l, existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}];
  }),
);

const contents = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));

let codeHits = 0;
for (const [from, to] of pairs) {
  if (!(from in dicts.uk)) {
    console.error(`Немає такого ключа: ${from}`);
    process.exit(1);
  }
  if (to in dicts.uk) {
    console.error(`Ключ ${to} уже зайнятий — спершу звільніть його`);
    process.exit(1);
  }

  // Код: тільки повний вміст лапок, щоб не зачепити довші ключі з тим самим початком
  for (const [file, code] of contents) {
    const next = code
      .split(`'${from}'`).join(`'${to}'`)
      .split(`"${from}"`).join(`"${to}"`);
    if (next !== code) {
      codeHits += (code.split(`'${from}'`).length - 1) + (code.split(`"${from}"`).length - 1);
      contents.set(file, next);
    }
  }

  for (const locale of TARGETS) {
    dicts[locale][to] = dicts[locale][from];
    delete dicts[locale][from];
  }
  console.log(`${from} → ${to}`);
}

if (!dry) {
  for (const [file, code] of contents) {
    if (code !== readFileSync(file, 'utf8')) writeFileSync(file, code, 'utf8');
  }
  for (const locale of TARGETS) {
    const sorted = Object.fromEntries(
      Object.keys(dicts[locale]).sort().map((k) => [k, dicts[locale][k]]),
    );
    writeFileSync(join(LOCALES, `${locale}.json`), JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  }
}

console.log(`\n${dry ? 'Буде змінено' : 'Змінено'}: ${pairs.length} ключів, ${codeHits} місць у коді`);
