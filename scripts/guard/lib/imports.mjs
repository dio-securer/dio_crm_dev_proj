// Import extraction on the TypeScript AST. Every way a file can name another module ends up here.
import { K, constsOf, lineOf, memberName, staticString, unwrap, walk } from './ts.mjs';

const isMeta = node => node.kind === K.MetaProperty && node.name.text === 'meta';
const calleeName = node => (node.kind === K.Identifier ? node.text : memberName(node));

/** Names bound to a require function: `const r = require`, `const r = module.require`, `const r = createRequire(...)`. */
function requireAliases(sf) {
  const names = new Set(['require']);
  const isRequire = node => {
    const n = unwrap(node);
    if (n.kind === K.CallExpression) return calleeName(unwrap(n.expression)) === 'createRequire';
    return (n.kind === K.Identifier && names.has(n.text)) || memberName(n) === 'require';
  };
  // Two rounds, so an alias of an alias is also known.
  for (let round = 0; round < 2; round += 1) {
    walk(sf, node => {
      if (node.kind === K.VariableDeclaration && node.name.kind === K.Identifier && node.initializer && isRequire(node.initializer)) names.add(node.name.text);
      if (node.kind === K.BinaryExpression && node.operatorToken.kind === K.EqualsToken && node.left.kind === K.Identifier
        && isRequire(node.right)) names.add(node.left.text);
    });
  }
  return { names, isRequire };
}

/** The argument nodes that name a module, for a call or `new` expression; [] when it is not an import. */
function moduleArgs(node, req) {
  const callee = unwrap(node.expression);
  const first = node.arguments?.slice(0, 1) ?? [];
  if (node.kind === K.NewExpression) {
    // `new URL('./x', import.meta.url)` is how workers and assets are loaded by path.
    const second = node.arguments?.[1];
    const viaMeta = second && memberName(unwrap(second)) === 'url' && isMeta(unwrap(unwrap(second).expression));
    return calleeName(callee) === 'URL' && viaMeta ? first : [];
  }
  if (callee.kind === K.ImportKeyword || req.isRequire(callee)) return first;
  const name = memberName(callee);
  if (name === null) return [];
  const owner = unwrap(callee.expression);
  if (name === 'getBuiltinModule' || (name === 'resolve' && (req.isRequire(owner) || isMeta(owner)))) return first;
  if (!isMeta(owner) || !/^glob/.test(name)) return [];
  const arg = first.length ? unwrap(first[0]) : null;
  return arg?.kind === K.ArrayLiteralExpression ? [...arg.elements] : first;
}

function extract(sf) {
  const consts = constsOf(sf);
  const req = requireAliases(sf);
  const found = [];
  const add = (node, at) => {
    const raw = staticString(node, consts);
    const line = lineOf(sf, at);
    if (raw === null) found.push({ line, pos: at.pos, specifier: '', raw: '', dynamic: true });
    // A query or hash (`./x.spec?raw`, `./x#y`) does not change which file is loaded.
    else found.push({ line, pos: at.pos, specifier: raw.replace(/[?#].*$/s, '').trim(), raw, dynamic: false });
  };
  walk(sf, node => {
    if ((node.kind === K.ImportDeclaration || node.kind === K.ExportDeclaration) && node.moduleSpecifier) add(node.moduleSpecifier, node);
    else if (node.kind === K.ImportEqualsDeclaration && node.moduleReference.kind === K.ExternalModuleReference) {
      add(node.moduleReference.expression, node);
    } else if (node.kind === K.ImportType) {
      if (node.argument.kind === K.LiteralType) add(node.argument.literal, node);
      else found.push({ line: lineOf(sf, node), pos: node.pos, specifier: '', raw: '', dynamic: true });
    } else if (node.kind === K.CallExpression || node.kind === K.NewExpression) {
      for (const arg of moduleArgs(node, req)) add(arg, node);
    }
  });
  // `/// <reference path="..." />` is always a path relative to the file.
  for (const ref of sf.referencedFiles ?? []) {
    const spec = /^\.{0,2}\//.test(ref.fileName) ? ref.fileName : `./${ref.fileName}`;
    found.push({ line: sf.getLineAndCharacterOfPosition(ref.pos).line + 1, pos: ref.pos, specifier: spec, raw: spec, dynamic: false });
  }
  return found.sort((a, b) => a.pos - b.pos);
}

/**
 * Returns [{ line, specifier, raw, dynamic }] for a file, parsed once and shared between rules.
 * Covers import/export declarations, `import x = require()`, `import()`, `require()` and its aliases,
 * `require.resolve()`, `process.getBuiltinModule()`, `createRequire(...)()`, `import('x')` in types, `import.meta.glob/resolve`,
 * `new URL(x, import.meta.url)` and `/// <reference path>`. `specifier` has any `?query`/`#hash` removed.
 * `dynamic: true` means the target is computed at run time and cannot be verified statically.
 */
export const importsOf = (ctx, file) => ctx.memo('imports', file, () => extract(ctx.ast(file)));

/** 'node:https' -> 'https', '@scope/pkg/sub' -> '@scope/pkg', 'pkg/sub' -> 'pkg'. Lower-cased. */
export function packageName(specifier) {
  const bare = specifier.replace(/^node:/i, '').toLowerCase();
  const parts = bare.split('/');
  return bare.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Resolve a relative specifier against the importing file. Returns a repo-relative path (may start with '..'). */
export function resolveRelative(fromFile, specifier) {
  const stack = fromFile.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') { if (stack.length && stack[stack.length - 1] !== '..') stack.pop(); else stack.push('..'); } else stack.push(part);
  }
  return stack.join('/');
}

/** Collapse `.`, `..` and empty parts inside a bare specifier: 'a/b/../c' -> 'a/c'. Returns null when it climbs out. */
export function collapse(specifier) {
  const out = [];
  for (const part of specifier.split('/')) {
    if (part === '' || part === '.') continue;
    if (part !== '..') out.push(part);
    else if (!out.length) return null;
    else out.pop();
  }
  return out.join('/');
}
