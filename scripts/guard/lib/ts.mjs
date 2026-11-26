// TypeScript AST access for the guard. Uses the `typescript` package that the workspace already
// installs for its own builds (no new dependency). Only the parser is used: no program, no type checker.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
// Workspace packages that declare `typescript` as a devDependency, in a fixed order.
export const TS_HOSTS = ['packages/contracts', 'backend', 'frontend'];

function load() {
  for (const host of TS_HOSTS) {
    try { return createRequire(path.join(ROOT, host, 'package.json'))('typescript'); } catch { /* try the next host */ }
  }
  return null;
}

/** The TypeScript API, or null when it is not installed (rules that need it then fail as ERROR). */
export const ts = load();
export const K = ts?.SyntaxKind ?? {};

/** Parse one file. A syntax error is thrown, never ignored: an unreadable file must not pass silently. */
export function parse(file, text) {
  if (!ts) throw new Error(`typescript 패키지를 찾을 수 없습니다(${TS_HOSTS.join(', ')}). pnpm install 을 먼저 실행하세요.`);
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false);
  const bad = sf.parseDiagnostics?.[0];
  if (bad) {
    const line = sf.getLineAndCharacterOfPosition(bad.start ?? 0).line + 1;
    throw new Error(`${file}:${line} 를 읽을 수 없습니다(구문 오류: ${ts.flattenDiagnosticMessageText(bad.messageText, ' ')})`);
  }
  return sf;
}

export const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf, false)).line + 1;
export const textOf = (sf, node) => sf.text.slice(node.getStart(sf, false), node.end);

/** Depth-first walk in source order. `visit(node, parent)`. */
export function walk(node, visit, parent = null) {
  visit(node, parent);
  ts.forEachChild(node, child => walk(child, visit, node));
}

/**
 * Strip syntax that does not change the value: `(x)`, `x as T`, `<T>x`, `x!`, `x satisfies T`, `await x`,
 * and the comma operator `(0, x)`. Every rule compares unwrapped nodes, so these spellings are equal.
 */
export function unwrap(node) {
  let n = node;
  for (;;) {
    if (n.kind === K.ParenthesizedExpression || n.kind === K.AsExpression || n.kind === K.TypeAssertionExpression
      || n.kind === K.NonNullExpression || n.kind === K.SatisfiesExpression || n.kind === K.AwaitExpression
      || n.kind === K.PartiallyEmittedExpression) n = n.expression;
    else if (n.kind === K.BinaryExpression && n.operatorToken.kind === K.CommaToken) n = n.right;
    else return n;
  }
}

const isAccess = n => n.kind === K.PropertyAccessExpression || n.kind === K.ElementAccessExpression;
const STRING_METHODS = ['toUpperCase', 'toLowerCase', 'trim', 'trimStart', 'trimEnd', 'toString', 'valueOf', 'normalize'];

/**
 * The string an expression is known to hold, or null. Understands quotes of any kind, templates,
 * `'a' + 'b'`, `'kr'.toUpperCase()`, `String('KR')`, `['K','R'].join('')`, `'K'.concat('R')`,
 * `String.fromCharCode(75, 82)`, String.raw, and (through `consts`) a same-file `const`, const-object member or enum member.
 */
export function staticString(node, consts = null) {
  const n = unwrap(node);
  if (n.kind === K.StringLiteral || n.kind === K.NoSubstitutionTemplateLiteral) return n.text;
  if (n.kind === K.TemplateExpression) {
    let out = n.head.text;
    for (const span of n.templateSpans) {
      const value = staticText(span.expression, consts);
      if (value === null) return null;
      out += value + span.literal.text;
    }
    return out;
  }
  if (n.kind === K.BinaryExpression && n.operatorToken.kind === K.PlusToken) {
    const left = staticText(n.left, consts);
    const right = left === null ? null : staticText(n.right, consts);
    return right === null || (isNumber(n.left) && isNumber(n.right)) ? null : left + right;
  }
  if (n.kind === K.Identifier) return consts?.get(n.text) ?? null;
  if (isAccess(n)) {
    const owner = unwrap(n.expression);
    const name = memberName(n, consts);
    return owner.kind === K.Identifier && name !== null ? consts?.get(`${owner.text}.${name}`) ?? null : null;
  }
  // String.raw`KR`
  if (n.kind === K.TaggedTemplateExpression && n.template.kind === K.NoSubstitutionTemplateLiteral) {
    const tag = unwrap(n.tag);
    return isAccess(tag) && memberName(tag, consts) === 'raw' ? n.template.text : null;
  }
  return n.kind === K.CallExpression ? staticCall(n, consts) : null;
}

const isNumber = node => unwrap(node).kind === K.NumericLiteral;
/** Like staticString, but a number literal also counts (for template parts and concatenation). */
const staticText = (node, consts) => (isNumber(node) ? String(Number(unwrap(node).text)) : staticString(node, consts));

function staticCall(call, consts) {
  const callee = unwrap(call.expression);
  const args = call.arguments.map(arg => staticText(arg, consts));
  if (callee.kind === K.Identifier) return callee.text === 'String' && args.length === 1 ? args[0] : null;
  const name = isAccess(callee) ? memberName(callee, consts) : null;
  if (name === null) return null;
  const owner = unwrap(callee.expression);
  if (name === 'fromCharCode' || name === 'fromCodePoint') {
    const codes = call.arguments.map(arg => (isNumber(arg) ? Number(unwrap(arg).text) : NaN));
    return owner.kind === K.Identifier && owner.text === 'String' && codes.length && codes.every(Number.isInteger)
      ? String.fromCodePoint(...codes) : null;
  }
  if (name === 'join' && owner.kind === K.ArrayLiteralExpression) {
    const parts = owner.elements.map(item => staticText(item, consts));
    const glue = call.arguments.length ? args[0] : ',';
    return parts.includes(null) || glue === null ? null : parts.join(glue);
  }
  const self = staticString(owner, consts);
  if (self === null) return null;
  if (name === 'concat') return args.includes(null) ? null : self + args.join('');
  if (!STRING_METHODS.includes(name) || args.length) return null;
  return name === 'toString' || name === 'valueOf' ? self : self[name]();
}

/** Name of a member access: `a.b` and `a?.b` -> 'b'; `a['b']`, `a[`b`]`, `a['b' as string]` -> 'b'; computed -> null. */
export function memberName(node, consts = null) {
  if (node.kind === K.PropertyAccessExpression) return node.name.text;
  if (node.kind === K.ElementAccessExpression) return staticString(node.argumentExpression, consts);
  return null;
}

/** Name of a property key or binding key: `skip`, `'skip'`, `['skip']`, `[`skip`]` -> 'skip'; computed -> null. */
export function keyName(name, consts = null) {
  if (!name) return null;
  if (name.kind === K.ComputedPropertyName) return staticString(name.expression, consts);
  return name.kind === K.Identifier || name.kind === K.StringLiteral || name.kind === K.NumericLiteral
    || name.kind === K.NoSubstitutionTemplateLiteral || name.kind === K.PrivateIdentifier ? name.text : null;
}

/** Leftmost expression of a chain: `a.b['c'](x).d` -> `a`. */
export function rootOf(node) {
  let n = unwrap(node);
  for (;;) {
    if (isAccess(n) || n.kind === K.CallExpression) n = unwrap(n.expression);
    else if (n.kind === K.TaggedTemplateExpression) n = unwrap(n.tag);
    else return n;
  }
}

const tables = new WeakMap();

/**
 * Same-file constants that hold a known string: `const A = 'KR'`, `const M = { kr: 'KR' }` (as `M.kr`),
 * `enum M { KR = 'KR' }` (as `M.KR`). A name declared more than once in the file is dropped: the walk
 * is by name, not by scope, so only an unambiguous name is trusted.
 */
export function constsOf(sf) {
  if (tables.has(sf)) return tables.get(sf);
  const consts = new Map();
  const seen = new Map();
  const pending = [];
  walk(sf, (node, parent) => {
    if (node.kind === K.VariableDeclaration && node.name.kind === K.Identifier) {
      seen.set(node.name.text, (seen.get(node.name.text) ?? 0) + 1);
      if (node.initializer && parent?.kind === K.VariableDeclarationList && (parent.flags & ts.NodeFlags.Const)) pending.push(node);
    } else if (node.kind === K.EnumDeclaration) {
      seen.set(node.name.text, (seen.get(node.name.text) ?? 0) + 1);
      pending.push(node);
    } else if (node.kind === K.Parameter && node.name.kind === K.Identifier) seen.set(node.name.text, 2);
  });
  const put = (key, value) => { if (value !== null && value !== undefined) consts.set(key, value); };
  // Two rounds, so a constant built from another constant (`const B = A + '-x'`) is also resolved.
  for (let round = 0; round < 2; round += 1) {
    for (const node of pending) {
      const owner = node.name.text;
      if (seen.get(owner) !== 1) continue;
      if (node.kind === K.EnumDeclaration) {
        for (const member of node.members) if (member.initializer) put(`${owner}.${keyName(member.name)}`, staticString(member.initializer, consts));
        continue;
      }
      const value = unwrap(node.initializer);
      if (value.kind !== K.ObjectLiteralExpression) { put(owner, staticString(value, consts)); continue; }
      for (const prop of value.properties) {
        if (prop.kind === K.PropertyAssignment) put(`${owner}.${keyName(prop.name, consts)}`, staticString(prop.initializer, consts));
      }
    }
  }
  tables.set(sf, consts);
  return consts;
}
