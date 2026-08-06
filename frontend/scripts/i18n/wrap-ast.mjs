#!/usr/bin/env node
/**
 * Другий прохід кодмоду — по AST TypeScript. Як і wrap.mjs, дає ПРОМІЖНИЙ
 * стан `t('Український текст')`; ключі призначає keyize.mjs.
 *
 * Перший прохід (wrap.mjs) бере текст JSX і атрибути. Тут — усе інше:
 * рядки в тернарних виразах, у return, у локальних змінних, у полях обʼєктів,
 * зібраних усередині функції, і шаблонні літерали з підстановками:
 *
 *     `Знайдено ${n} записів`  →  t('Знайдено {v0} записів', { v0: n })
 *
 * Головне правило: чіпаємо тільки те, що всередині функції. Рядок на рівні
 * модуля (константні масиви навігації, колонок, довідників) лишається
 * українським — t() для нього має стояти в місці рендеру, інакше значення
 * обчислиться один раз при імпорті й застрягне мовою, активною на той момент.
 *
 *   node scripts/i18n/wrap-ast.mjs --dry
 *   node scripts/i18n/wrap-ast.mjs [шлях…]
 */

import ts from 'typescript';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');
const CYRILLIC = /[Ѐ-ӿ]/;

const EXCLUDE = [
  'src/locales/',
  'src/lib/i18n.ts',
  'src/lib/ruptelaApiDocs.ts',
  'src/components/RuptelaApiDocs.tsx',
  'src/context/I18nContext.tsx',
  'src/components/LanguageSwitcher.tsx',
];

/** Властивості, значення яких — не текст для людини. */
const SKIP_PROPS = new Set(['className', 'key', 'id', 'href', 'src']);

const isFunctionLike = (node) =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isGetAccessor(node) ||
  ts.isConstructorDeclaration(node);

/** Чи лежить вузол усередині тіла функції (а не на рівні модуля). */
function insideFunction(node) {
  for (let p = node.parent; p; p = p.parent) if (isFunctionLike(p)) return true;
  return false;
}

/** Уже загорнуто: t('…') */
function alreadyWrapped(node) {
  const p = node.parent;
  return (
    p &&
    ts.isCallExpression(p) &&
    ts.isIdentifier(p.expression) &&
    (p.expression.text === 't' || p.expression.text === 'plural') &&
    p.arguments[0] === node
  );
}

/** Контексти, де переклад зламав би логіку. */
function isUntranslatableContext(node) {
  const p = node.parent;
  if (!p) return true;

  // порівняння: if (state === 'Готово')
  if (ts.isBinaryExpression(p)) {
    const kind = p.operatorToken.kind;
    if (
      kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      kind === ts.SyntaxKind.EqualsEqualsToken ||
      kind === ts.SyntaxKind.ExclamationEqualsToken
    ) return true;
  }

  // ключ обʼєкта, елемент індексу, case у switch, import
  if (ts.isPropertyAssignment(p) && p.name === node) return true;
  if (ts.isElementAccessExpression(p)) return true;
  if (ts.isCaseClause(p)) return true;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
  if (ts.isLiteralTypeNode(p)) return true;

  // службові властивості (className, key, href…)
  if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && SKIP_PROPS.has(p.name.text)) {
    return true;
  }
  if (ts.isJsxAttribute(p) && SKIP_PROPS.has(p.name.getText())) return true;

  // includes('…'), startsWith('…') тощо — це порівняння, а не показ
  if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression)) {
    const method = p.expression.name.text;
    if (['includes', 'startsWith', 'endsWith', 'indexOf', 'split', 'replace', 'match', 'localeCompare'].includes(method)) {
      return true;
    }
  }

  return false;
}

/** Літерал JS із коректним екрануванням. */
const literal = (text) =>
  text.includes("'") ? `"${text.replace(/"/g, '\\"')}"` : `'${text}'`;

const clean = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * Файлова прагма для рядків, які є значенням типу, а не текстом:
 *
 *     /* i18n-ignore-props: group, Group *\/
 *
 * Такий рядок кодмод лишає як є (його все одно видно сканеру, тож переклад для
 * нього існує — просто t() ставиться в місці рендеру: {t(section.group)}).
 */
function ignoredProps(code) {
  const m = code.match(/i18n-ignore-props:\s*([^*\n]+)/);
  return new Set(m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : []);
}

/** Рядок належить полю або змінній, позначеній прагмою. */
function isIgnoredByPragma(node, ignored) {
  if (!ignored.size) return false;
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && ignored.has(p.name.text)) return true;
    if (ts.isVariableDeclaration(p) && p.type) {
      const typeText = p.type.getText();
      if ([...ignored].some((name) => typeText.includes(name))) return true;
    }
    if (ts.isAsExpression(p) && [...ignored].some((n) => p.type.getText().includes(n))) return true;
    if (isFunctionLike(p)) break;
  }
  return false;
}

function transform(fileName, code) {
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const ignored = ignoredProps(code);
  const edits = [];

  const visit = (node) => {
    // ── текст JSX упритул до виразу: <span>{n}</span> од. ──
    // Перший прохід (wrap.mjs) такі уривки не бачить, бо поруч стоїть {…}.
    if (ts.isJsxText(node)) {
      const text = clean(node.text);
      if (CYRILLIC.test(text) && text.length >= 1) {
        const raw = node.getFullText(source);
        const leading = raw.match(/^\s*/)[0];
        const trailing = raw.match(/\s*$/)[0];
        edits.push({
          start: node.getFullStart(),
          end: node.getEnd(),
          text: `${leading}{t(${literal(text)})}${trailing}`,
        });
      }
      return;
    }

    // ── звичайні рядки ──
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = clean(node.text);
      if (
        CYRILLIC.test(text) &&
        text.length >= 1 &&
        insideFunction(node) &&
        !alreadyWrapped(node) &&
        !isUntranslatableContext(node) &&
        !isIgnoredByPragma(node, ignored)
      ) {
        // Значення атрибута JSX — це рядок, а не вираз: t() без дужок дасть
        // синтаксичну помилку (buttonText=t('…')).
        const needsBraces = node.parent && ts.isJsxAttribute(node.parent);
        const call = `t(${literal(text)})`;
        edits.push({
          start: node.getStart(source),
          end: node.getEnd(),
          text: needsBraces ? `{${call}}` : call,
        });
      }
    }

    // ── шаблонні літерали з підстановками ──
    if (ts.isTemplateExpression(node)) {
      const staticText = node.head.text + node.templateSpans.map((s) => s.literal.text).join('');
      const parent = node.parent;
      const inClassName =
        parent && ts.isJsxExpression(parent) && parent.parent &&
        ts.isJsxAttribute(parent.parent) && parent.parent.name.getText() === 'className';

      if (
        CYRILLIC.test(staticText) &&
        insideFunction(node) &&
        !alreadyWrapped(node) &&
        !inClassName &&
        // вкладені шаблони всередині підстановок не чіпаємо
        !node.templateSpans.some((s) => s.expression.getText(source).includes('`'))
      ) {
        let key = node.head.text;
        const vars = [];
        node.templateSpans.forEach((span, index) => {
          const name = `v${index}`;
          vars.push(`${name}: ${span.expression.getText(source)}`);
          key += `{${name}}` + span.literal.text;
        });
        edits.push({
          start: node.getStart(source),
          end: node.getEnd(),
          text: `t(${literal(clean(key))}, { ${vars.join(', ')} })`,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);

  if (!edits.length) return { code, changes: 0 };

  // Прибираємо вкладені правки (шаблон уже містить свої підстановки)
  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const flat = [];
  let lastEnd = -1;
  for (const edit of edits) {
    if (edit.start < lastEnd) continue;
    flat.push(edit);
    lastEnd = edit.end;
  }

  let out = code;
  for (const edit of [...flat].reverse()) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return { code: out, changes: flat.length };
}

function ensureImport(code) {
  if (/from '@\/lib\/i18n'/.test(code)) return code;
  const lines = code.split('\n');
  let insertAt = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) insertAt = i;
    else if (/^(export|const|function|interface|type|class)\s/.test(lines[i])) break;
  }
  while (insertAt >= 0 && insertAt < lines.length && !/;\s*$/.test(lines[insertAt])) insertAt++;
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

const files = roots
  .flatMap((r) => (statSync(r).isDirectory() ? walk(r) : [r]))
  .filter((f) => {
    const rel = relative(ROOT, f).replace(/\\/g, '/');
    return !EXCLUDE.some((e) => rel.startsWith(e));
  });

let touched = 0;
let total = 0;
for (const file of files) {
  const original = readFileSync(file, 'utf8');
  if (!CYRILLIC.test(original)) continue;
  const { code, changes } = transform(file, original);
  if (!changes) continue;
  touched++;
  total += changes;
  console.log(`${String(changes).padStart(4)}  ${relative(ROOT, file).replace(/\\/g, '/')}`);
  if (!dry) writeFileSync(file, ensureImport(code), 'utf8');
}
console.log(`\n${dry ? 'Буде змінено' : 'Змінено'}: ${total} місць у ${touched} файлах`);
