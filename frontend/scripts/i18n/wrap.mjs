#!/usr/bin/env node
/**
 * Кодмод, крок 1 із 2: загортає щойно написаний український текст у t().
 *
 * Результат — ПРОМІЖНИЙ стан `t('Український текст')`: ключем словника є
 * семантичний ідентифікатор, тому далі треба призначити ключі (keyize.mjs).
 * Порядок такий, бо писати JSX українською природніше, ніж одразу ключами.
 *
 * Робить рівно дві безпечні речі:
 *   1) текстові вузли JSX      >Текст<              →  >{t('Текст')}<
 *   2) атрибути зі списку       title="Текст"        →  title={t('Текст')}
 *
 * НЕ чіпає: коментарі, шаблонні літерали, властивості обʼєктів і константи
 * рівня модуля. Останні мають лишатись українськими — t() для них ставиться
 * у місці рендеру (`{t(item.label)}`), інакше значення застрягне тією мовою,
 * яка була активна на момент імпорту модуля.
 *
 *   node scripts/i18n/wrap.mjs --dry            # показати, що зміниться
 *   node scripts/i18n/wrap.mjs                  # застосувати до всього src
 *   node scripts/i18n/wrap.mjs src/components   # застосувати до частини
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');

const CYRILLIC = /[Ѐ-ӿ]/;

/** Атрибути, значення яких бачить користувач. */
const TEXT_ATTRS = [
  'title',
  'placeholder',
  'aria-label',
  'alt',
  'label',
  'subtitle',
  'description',
  'emptyMessage',
  'emptyText',
  'hint',
  'tooltip',
  'confirmLabel',
  'cancelLabel',
];

const EXCLUDE = [
  'src/locales/',
  'src/lib/i18n.ts',
  'src/shared/config/ruptelaApiDocs.ts',
  'src/components/RuptelaApiDocs.tsx',
  'src/shared/config/vendorApiDocs.ts',
  'src/components/VendorApiDocs.tsx',
  'src/shared/ui/api-reference/ApiReference.tsx',
  'src/context/I18nContext.tsx',
  'src/components/LanguageSwitcher.tsx',
];

/* ── маска файлу ───────────────────────────────────────────────────────── */

/**
 * Позначає кожен символ файлу: 0 — код/JSX, 1 — коментар, 2 — рядковий
 * літерал, 3 — шаблонний літерал. Кодмод працює тільки по нулях.
 */
function maskOf(code) {
  const mask = new Uint8Array(code.length);
  let i = 0;
  let state = 0;
  let quote = '';
  while (i < code.length) {
    const c = code[i];
    const next = code[i + 1];
    if (state === 0) {
      if (c === '/' && next === '/') { state = 1; mask[i] = mask[i + 1] = 1; i += 2; continue; }
      if (c === '/' && next === '*') { state = 4; mask[i] = mask[i + 1] = 1; i += 2; continue; }
      if (c === "'" || c === '"') { state = 2; quote = c; mask[i] = 2; i++; continue; }
      if (c === '`') { state = 3; mask[i] = 3; i++; continue; }
      mask[i] = 0; i++; continue;
    }
    if (state === 1) { // // до кінця рядка
      mask[i] = 1;
      if (c === '\n') state = 0;
      i++; continue;
    }
    if (state === 4) { // /* … */
      mask[i] = 1;
      if (c === '*' && next === '/') { mask[i + 1] = 1; state = 0; i += 2; continue; }
      i++; continue;
    }
    if (state === 2) {
      mask[i] = 2;
      if (c === '\\') { mask[i + 1] = 2; i += 2; continue; }
      if (c === quote) state = 0;
      i++; continue;
    }
    // шаблонний літерал
    mask[i] = 3;
    if (c === '\\') { mask[i + 1] = 3; i += 2; continue; }
    if (c === '`') state = 0;
    i++; continue;
  }
  return mask;
}

const isCode = (mask, start, end) => {
  for (let i = start; i < end; i++) if (mask[i] !== 0) return false;
  return true;
};

/** Рядок як літерал JS: апостроф у тексті → подвійні лапки. */
function literal(text) {
  return text.includes("'") ? `"${text.replace(/"/g, '\\"')}"` : `'${text}'`;
}

/* ── перетворення ──────────────────────────────────────────────────────── */

function transform(code) {
  let changes = 0;
  const edits = []; // { start, end, text }
  const mask = maskOf(code);

  // 1. текстові вузли JSX
  const jsxRe = />([^<>{}]*[Ѐ-ӿ][^<>{}]*)</g;
  let m;
  while ((m = jsxRe.exec(code))) {
    const inner = m[1];
    const start = m.index + 1;
    const end = start + inner.length;
    if (!isCode(mask, start, end)) continue;

    const text = inner.replace(/\s+/g, ' ').trim();
    if (!CYRILLIC.test(text)) continue;

    // Зберігаємо відступ навколо тексту, щоб не зламати перенос рядків
    const leading = inner.match(/^\s*/)[0];
    const trailing = inner.match(/\s*$/)[0];
    edits.push({ start, end, text: `${leading}{t(${literal(text)})}${trailing}` });
    changes++;
  }

  // 2. атрибути JSX
  const attrRe = new RegExp(`\\b(${TEXT_ATTRS.join('|')})=("([^"]*)"|'([^']*)')`, 'g');
  while ((m = attrRe.exec(code))) {
    const value = m[3] ?? m[4] ?? '';
    if (!CYRILLIC.test(value)) continue;
    const valueStart = m.index + m[1].length + 1;
    // Значення атрибута — рядковий літерал, тож перевіряємо саме його краї
    if (mask[m.index] !== 0) continue;
    edits.push({
      start: valueStart,
      end: m.index + m[0].length,
      text: `{t(${literal(value.replace(/\s+/g, ' ').trim())})}`,
    });
    changes++;
  }

  if (!changes) return { code, changes };

  // Застосовуємо з кінця, щоб індекси лишались чинними
  edits.sort((a, b) => b.start - a.start);
  let out = code;
  let lastStart = Infinity;
  for (const edit of edits) {
    if (edit.end > lastStart) continue; // перекриття — пропускаємо
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
    lastStart = edit.start;
  }

  return { code: out, changes };
}

/** Додає імпорт t(), якщо його ще немає. */
function ensureImport(code) {
  if (/from '@\/lib\/i18n'/.test(code)) return code;

  const lines = code.split('\n');
  // після останнього import на початку файлу
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) insertAt = i;
    if (/^(export|const|function|interface|type|class)\s/.test(lines[i])) break;
  }
  // імпорт може бути багаторядковим — дійдемо до його кінця
  while (insertAt < lines.length && !/;\s*$/.test(lines[insertAt])) insertAt++;

  lines.splice(insertAt + 1, 0, "import { t } from '@/lib/i18n';");
  return lines.join('\n');
}

/* ── запуск ────────────────────────────────────────────────────────────── */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const targets = args.filter((a) => !a.startsWith('--'));

const roots = targets.length ? targets.map((t) => join(ROOT, t)) : [SRC];
const files = roots.flatMap((r) => (statSync(r).isDirectory() ? walk(r) : [r])).filter((f) => {
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  return !EXCLUDE.some((e) => rel.startsWith(e));
});

let touched = 0;
let total = 0;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  if (!CYRILLIC.test(original)) continue;

  const { code, changes } = transform(original);
  if (!changes) continue;

  const next = ensureImport(code);
  touched++;
  total += changes;
  console.log(`${String(changes).padStart(4)}  ${relative(ROOT, file).replace(/\\/g, '/')}`);
  if (!dry) writeFileSync(file, next, 'utf8');
}

console.log(`\n${dry ? 'Буде змінено' : 'Змінено'}: ${total} місць у ${touched} файлах`);
