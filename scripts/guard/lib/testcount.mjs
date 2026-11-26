// Counts test cases on the TypeScript AST, for the protect check P3 (no test may quietly disappear).
// Two measures per file: `tests` (it / test / specify / bench, including node:test subtests such as `t.test`)
// and `groups` (describe / suite / context). Either one going down is a loss.
import { K, keyName, memberName, unwrap, walk } from './ts.mjs';

const KIND = new Map([['it', 'tests'], ['test', 'tests'], ['specify', 'tests'], ['bench', 'tests'],
  ['describe', 'groups'], ['suite', 'groups'], ['context', 'groups']]);
// Members that may sit between a test function and its call: `it.each(rows)(...)`, `test.concurrent(...)`.
const MODIFIERS = new Set(['each', 'for', 'concurrent', 'sequential', 'serial', 'parallel', 'fails', 'skipIf', 'runIf', 'skip', 'only', 'todo', 'fixme']);
const NODE_TEST = new Set(['node:test', 'test']);

const isAccess = n => n.kind === K.PropertyAccessExpression || n.kind === K.ElementAccessExpression;
const isFunction = node => { const n = unwrap(node); return n.kind === K.ArrowFunction || n.kind === K.FunctionExpression; };

/** Names that stand for a test function in this file: the usual ones, plus `const d = describe` and `import { it as t }`. */
function aliasesOf(sf) {
  const alias = new Map(KIND);
  for (let round = 0; round < 2; round += 1) {
    walk(sf, node => {
      if (node.kind === K.VariableDeclaration && node.name.kind === K.Identifier && node.initializer) {
        const value = unwrap(node.initializer);
        const kind = value.kind === K.Identifier ? alias.get(value.text) : isAccess(value) ? KIND.get(memberName(value) ?? '') : undefined;
        if (kind && !alias.has(node.name.text)) alias.set(node.name.text, kind);
      } else if (node.kind === K.ImportSpecifier && node.propertyName) {
        const kind = KIND.get(keyName(node.propertyName) ?? '');
        if (kind) alias.set(node.name.text, kind);
      } else if (node.kind === K.ImportDeclaration && node.importClause?.name && NODE_TEST.has(node.moduleSpecifier.text)) {
        alias.set(node.importClause.name.text, 'tests'); // `import t from 'node:test'`
      }
    });
  }
  return alias;
}

/** Returns { tests, groups } for one parsed file. */
export function testCountsOf(sf) {
  const alias = aliasesOf(sf);
  const counts = { tests: 0, groups: 0 };
  const inner = new Set();
  walk(sf, node => {
    if (node.kind !== K.CallExpression || inner.has(node)) return;
    // Walk the callee from the call inwards: `describe.each(rows)('name', fn)` -> each(...) -> describe.
    const passed = [];
    let n = unwrap(node.expression);
    let kind = null;
    for (;;) {
      if (n.kind === K.CallExpression) { passed.push(n); n = unwrap(n.expression); } else if (n.kind === K.TaggedTemplateExpression) n = unwrap(n.tag);
      else if (n.kind === K.Identifier) { kind = alias.get(n.text) ?? null; break; } else if (isAccess(n)) {
        const name = memberName(n) ?? '';
        if (KIND.has(name)) {
          // `test.describe(...)` is a group. `t.test('name', fn)` is a subtest, but `/re/.test(text)` is not: it has no function argument.
          let owner = unwrap(n.expression);
          while (isAccess(owner) || owner.kind === K.CallExpression) owner = unwrap(owner.expression);
          if ((owner.kind === K.Identifier && alias.has(owner.text)) || node.arguments.some(isFunction)) kind = KIND.get(name);
          break;
        }
        if (!MODIFIERS.has(name)) break;
        n = unwrap(n.expression);
      } else break;
    }
    if (kind === null) return;
    counts[kind] += 1;
    for (const call of passed) inner.add(call);
  });
  return counts;
}
