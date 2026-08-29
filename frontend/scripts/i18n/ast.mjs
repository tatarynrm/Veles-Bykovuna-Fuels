/**
 * Спільна частина для scan.mjs і wrap-ast.mjs: як саме ми знаходимо
 * український текст у дереві TypeScript і як вирішуємо, чи його чіпати.
 */

import ts from 'typescript';

export const CYRILLIC = /[Ѐ-ӿ]/;

/** Не перекладаємо: механізм i18n і технічний довідник Ruptela для розробника. */
export const EXCLUDE = [
  'src/locales/',
  'src/lib/i18n.ts',
  'src/shared/config/ruptelaApiDocs.ts',
  'src/components/RuptelaApiDocs.tsx',
  'src/shared/config/vendorApiDocs.ts',
  'src/components/VendorApiDocs.tsx',
  'src/shared/ui/api-reference/ApiReference.tsx',
  'src/components/VendorLogos.tsx',
  'src/screens/calculator/index.tsx',
  'src/context/I18nContext.tsx',
];

/** Властивості, значення яких — не текст для людини. */
const SKIP_PROPS = new Set(['className', 'key', 'id', 'href', 'src']);

export const clean = (s) => s.replace(/\s+/g, ' ').trim();

export const isFunctionLike = (node) =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isGetAccessor(node) ||
  ts.isConstructorDeclaration(node);

/**
 * Чи лежить вузол у тілі функції. Рядок поза функцією обчислюється один раз
 * при імпорті модуля — там t() ставити не можна, переклад робиться в місці
 * рендеру.
 */
export function insideFunction(node) {
  for (let p = node.parent; p; p = p.parent) if (isFunctionLike(p)) return true;
  return false;
}

/** Уже загорнуто в t('…') або plural('…'). */
export function alreadyWrapped(node) {
  const p = node.parent;
  return Boolean(
    p &&
      ts.isCallExpression(p) &&
      ts.isIdentifier(p.expression) &&
      (p.expression.text === 't' || p.expression.text === 'plural') &&
      p.arguments[0] === node,
  );
}

/** Контексти, де переклад зламав би логіку, а не переклав інтерфейс. */
export function isUntranslatableContext(node) {
  const p = node.parent;
  if (!p) return true;

  if (ts.isBinaryExpression(p)) {
    const kind = p.operatorToken.kind;
    if (
      kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      kind === ts.SyntaxKind.EqualsEqualsToken ||
      kind === ts.SyntaxKind.ExclamationEqualsToken
    ) return true;
  }

  if (ts.isPropertyAssignment(p) && p.name === node) return true;
  if (ts.isElementAccessExpression(p)) return true;
  if (ts.isCaseClause(p)) return true;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
  if (ts.isLiteralTypeNode(p)) return true;

  if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && SKIP_PROPS.has(p.name.text)) return true;
  if (ts.isJsxAttribute(p) && SKIP_PROPS.has(p.name.getText())) return true;

  if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression)) {
    const method = p.expression.name.text;
    if (
      ['includes', 'startsWith', 'endsWith', 'indexOf', 'split', 'replace', 'match', 'localeCompare']
        .includes(method)
    ) return true;
  }

  return false;
}

/**
 * Файлова прагма для рядків, які є значенням типу, а не підписом:
 *
 *     i18n-ignore-props: group, Group
 *
 * Такий рядок лишається як є: t() для нього ставиться в місці рендеру
 * ({t(section.group)}), а сам ключ усе одно потрапляє у словник.
 */
export function ignoredProps(code) {
  const m = code.match(/i18n-ignore-props:\s*([^*\n]+)/);
  return new Set(m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : []);
}

export function isIgnoredByPragma(node, ignored) {
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

/** Ключ шаблонного літерала: `Знайдено ${n}` → 'Знайдено {v0}' + вирази. */
export function templateKey(node, source) {
  let key = node.head.text;
  const vars = [];
  node.templateSpans.forEach((span, index) => {
    const name = `v${index}`;
    vars.push({ name, expression: span.expression.getText(source) });
    key += `{${name}}` + span.literal.text;
  });
  return { key: clean(key), vars };
}

export function parse(fileName, code) {
  return ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
