// Statically unreachable code in the obvious forms, for the protect check P3: a test that can never run is not a test.
// Two forms are recognised, both by syntax alone (no types, no other files):
//   1. a branch behind a constant condition: `if (false) …`, `if (0) …`, `if (true) {} else …`, `false && …`, `true || …`,
//      `false ? … : …`, `while (false) …`, `for (; false; ) …`;
//   2. the body of a function declared in the file (`function f() {}`, `const f = () => {}`) whose name is never used
//      in live code of the same file. `export` alone is not a use: nothing in this file runs it.
import { K, kindSet, ts, unwrap } from './ts.mjs';

/** true / false when the expression is a constant, null when it is not known. */
function truth(node) {
  const n = unwrap(node);
  if (n.kind === K.TrueKeyword) return true;
  if (n.kind === K.FalseKeyword || n.kind === K.NullKeyword || n.kind === K.VoidExpression) return false;
  if (n.kind === K.NumericLiteral) return Number(n.text) !== 0;
  if (n.kind === K.StringLiteral || n.kind === K.NoSubstitutionTemplateLiteral) return n.text !== '';
  if (n.kind === K.Identifier) return n.text === 'undefined' || n.text === 'NaN' ? false : null;
  if (n.kind === K.PrefixUnaryExpression && n.operator === K.ExclamationToken) {
    const inner = truth(n.operand);
    return inner === null ? null : !inner;
  }
  return null;
}

/** The child of `node` that can never run because of a constant condition, or null. */
function constantDead(node) {
  if (node.kind === K.IfStatement) {
    const cond = truth(node.expression);
    return cond === false ? node.thenStatement : cond === true ? node.elseStatement ?? null : null;
  }
  if (node.kind === K.ConditionalExpression) {
    const cond = truth(node.condition);
    return cond === false ? node.whenTrue : cond === true ? node.whenFalse : null;
  }
  if (node.kind === K.BinaryExpression) {
    const left = truth(node.left);
    if (node.operatorToken.kind === K.AmpersandAmpersandToken && left === false) return node.right;
    if (node.operatorToken.kind === K.BarBarToken && left === true) return node.right;
    return null;
  }
  if (node.kind === K.WhileStatement) return truth(node.expression) === false ? node.statement : null;
  if (node.kind === K.ForStatement) return node.condition && truth(node.condition) === false ? node.statement : null;
  return null;
}

const isFunction = node => node.kind === K.ArrowFunction || node.kind === K.FunctionExpression;
// Parents whose `.name` is a declaration or a member name, not a use of a variable of that name.
export const NAMES_ONLY = ['FunctionDeclaration', 'VariableDeclaration', 'PropertyAccessExpression', 'PropertyAssignment',
  'MethodDeclaration', 'PropertyDeclaration', 'PropertySignature', 'MethodSignature', 'GetAccessor', 'SetAccessor', 'EnumMember',
  'Parameter', 'ClassDeclaration', 'FunctionExpression', 'ImportSpecifier', 'ImportClause', 'NamespaceImport'];
const namesOnly = kindSet(NAMES_ONLY);

/** The name a function is declared under, with the node that holds its code, or null. */
function declared(node) {
  if (node.kind === K.FunctionDeclaration && node.name && node.body) return { name: node.name.text, code: node.body };
  if (node.kind === K.VariableDeclaration && node.name.kind === K.Identifier && node.initializer) {
    const value = unwrap(node.initializer);
    if (isFunction(value)) return { name: node.name.text, code: value };
  }
  return null;
}

/** Returns the Set of nodes whose whole subtree can never run. */
export function deadNodesOf(sf) {
  const dead = new Set();
  const functions = new Map(); // name -> [code node]
  const uses = []; // { name, inside: [function names], unreachable }
  const visit = (node, parent, inside, unreachable) => {
    const cut = constantDead(node);
    if (cut) dead.add(cut);
    const fn = declared(node);
    if (fn) functions.set(fn.name, [...(functions.get(fn.name) ?? []), fn.code]);
    if (node.kind === K.Identifier && parent) {
      const isName = namesOnly.has(parent.kind) && parent.name === node;
      const isExport = parent.kind === K.ExportSpecifier || (parent.kind === K.ExportAssignment && parent.expression === node);
      if (!isName && !isExport) uses.push({ name: node.text, inside, unreachable });
    }
    ts.forEachChild(node, child => {
      const within = fn && (child === fn.code || node.kind === K.VariableDeclaration) ? [...inside, fn.name] : inside;
      visit(child, node, within, unreachable || dead.has(child));
    });
  };
  visit(sf, null, [], false);
  // A function is live when its name is used in reachable code outside itself, and that code is itself live.
  const live = new Set();
  for (let changed = true; changed;) {
    changed = false;
    for (const use of uses) {
      if (live.has(use.name) || !functions.has(use.name) || use.unreachable || use.inside.includes(use.name)) continue;
      if (use.inside.every(name => live.has(name))) { live.add(use.name); changed = true; }
    }
  }
  for (const [name, codes] of functions) if (!live.has(name)) for (const code of codes) dead.add(code);
  return dead;
}
