#!/usr/bin/env node
/**
 * Присвоює ключі новому тексту.
 *
 * На вхід — TSV `<український текст>\t<ключ>`; скрипт замінює цей текст у коді
 * на ключ і додає запис у `uk.json`. Переклади en/pl/de лишаються порожніми —
 * їх заливає merge.mjs.
 *
 *     Відвідано\ttrip.visited
 *
 * Замінюються ВСІ рядкові літерали з таким вмістом, разом із порівняннями й
 * типами-літералами: значення константних масивів стають ключами, тож
 * `group === 'Нещодавні'` теж має стати `group === 'nav.recent'`.
 *
 *   node scripts/i18n/keyize.mjs --dry
 *   node scripts/i18n/keyize.mjs                     # scripts/i18n/new-keys.tsv
 *   node scripts/i18n/keyize.mjs шлях/до/файлу.tsv
 */

import ts from 'typescript';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXCLUDE, clean } from './ast.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');
const LOCALES = join(SRC, 'locales');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const input = args.find((a) => !a.startsWith('--')) ?? join(ROOT, 'scripts', 'i18n', 'new-keys.tsv');

if (!existsSync(input)) {
  console.error(`Немає файлу з ключами: ${input}`);
  console.error('Формат рядка: <український текст>\\t<ключ>');
  process.exit(1);
}

const KEY_RE = /^[a-z][a-zA-Z0-9]*\.[a-zA-Z0-9]+$/;

const keymap = new Map();
for (const line of readFileSync(input, 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('# ')) continue;
  const [text, key] = line.split('\t').map((s) => s?.replace(/\r$/, ''));
  if (!text || !key) continue;
  if (!KEY_RE.test(key)) {
    console.error(`Некоректний ключ «${key}» — очікується вигляд простір.назва`);
    process.exit(1);
  }
  keymap.set(clean(text), key);
}
console.log(`Ключів на присвоєння: ${keymap.size}`);

/* ── код ───────────────────────────────────────────────────────────────── */

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

const literal = (text) => (text.includes("'") ? `"${text}"` : `'${text}'`);

let touched = 0;
let replacements = 0;
const used = new Set();

for (const file of files) {
  const code = readFileSync(file, 'utf8');
  if (!/[Ѐ-ӿ]/.test(code)) continue;

  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];

  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const key = keymap.get(clean(node.text));
      if (key) {
        used.add(key);
        edits.push({ start: node.getStart(source), end: node.getEnd(), text: literal(key) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  if (!edits.length) continue;

  let out = code;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }

  touched++;
  replacements += edits.length;
  console.log(`${String(edits.length).padStart(4)}  ${relative(ROOT, file).replace(/\\/g, '/')}`);
  if (!dry) writeFileSync(file, out, 'utf8');
}

const unusedKeys = [...keymap.values()].filter((k) => !used.has(k));

/* ── uk.json ───────────────────────────────────────────────────────────── */

if (!dry) {
  const path = join(LOCALES, 'uk.json');
  const dict = JSON.parse(readFileSync(path, 'utf8'));
  for (const [text, key] of keymap) dict[key] = text;
  const sorted = Object.fromEntries(Object.keys(dict).sort().map((k) => [k, dict[k]]));
  writeFileSync(path, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

console.log(`\n${dry ? 'Буде замінено' : 'Замінено'}: ${replacements} у ${touched} файлах`);
if (!dry) console.log(`uk.json поповнено на ${keymap.size} записів.`);
if (unusedKeys.length) {
  console.log(`\nНе знайдено в коді (${unusedKeys.length}) — перевірте текст у TSV:`);
  for (const key of unusedKeys.slice(0, 15)) console.log(`  ${key}`);
}
