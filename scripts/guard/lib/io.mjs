// G07 call detection on the TypeScript AST: direct use of the network from code.
import { excerpt } from './files.mjs';
import { K, constsOf, keyName, kindSet, lineOf, memberName, rootOf, staticString, textOf, unwrap, walk } from './ts.mjs';

// Objects through which a global function can be reached: `window.top.fetch`, `self['fetch']`, `document.defaultView.fetch`.
export const GLOBAL_OBJECTS = ['window', 'globalThis', 'self', 'global', 'top', 'parent', 'frames', 'opener', 'document'];
// Global names that open a network connection. Any value use of these names counts.
export const IO_NAMES = new Set(['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'axios']);
// Only names that are never ordinary local variables: `parent[key]` and `top[i]` are common in plain code.
export const COMPUTED_ON = new Set(['window', 'globalThis', 'global']);
const RUNS_TEXT = '(실행 중에 만든 코드)';
export const HTTP_OBJECTS = new Set(['http', 'https', 'http2']);
export const HTTP_CALLS = new Set(['request', 'get']);
// Names that run code built from text: `eval(s)`, `new Function(s)`.
export const TEXT_RUNNERS = { eval: 'eval', make: 'Function' };
// Positions where an identifier only NAMES a member that the code itself defines, or a type. These are NOT counted.
export const DEFINES_MEMBER = ['PropertyAssignment', 'MethodDeclaration', 'PropertySignature', 'MethodSignature', 'PropertyDeclaration',
  'GetAccessor', 'SetAccessor', 'EnumMember', 'JsxAttribute', 'TypeReference', 'QualifiedName'];
const definesMember = kindSet(DEFINES_MEMBER);

const isAccess = n => n.kind === K.PropertyAccessExpression || n.kind === K.ElementAccessExpression;

/** Returns [{ line, message }] in source order, at most one per node. */
export function ioCallsOf(sf) {
  const consts = constsOf(sf);
  const globals = new Set(GLOBAL_OBJECTS);
  const isGlobal = node => { const root = rootOf(node); return root.kind === K.Identifier && globals.has(root.text); };
  // `const w = window; w.fetch(...)`: a local name for a global object is followed (two rounds for an alias of an alias).
  for (let round = 0; round < 2; round += 1) {
    walk(sf, node => {
      if (node.kind === K.VariableDeclaration && node.name.kind === K.Identifier && node.initializer && isGlobal(node.initializer)) {
        globals.add(node.name.text);
      }
    });
  }
  const found = [];
  const add = (node, what) => found.push({ line: lineOf(sf, node), message: `직접 네트워크 호출 ${what}: ${excerpt(textOf(sf, node), 30)}` });

  walk(sf, (node, parent) => {
    if (node.kind === K.Identifier) {
      if (!parent || (definesMember.has(parent.kind) && (parent.name === node || parent.typeName === node || parent.right === node))) return;
      // Code built from text at run time cannot be read by any rule: `eval(s)`, `window.eval(s)`, `(0, eval)(s)`.
      if (node.text === TEXT_RUNNERS.eval) add(node, RUNS_TEXT);
      if (!IO_NAMES.has(node.text)) return;
      if (isAccess(parent) && parent.name === node) return; // judged below, as a member access
      add(parent.kind === K.CallExpression || parent.kind === K.NewExpression ? parent : node, node.text);
    } else if (isAccess(node)) {
      const name = memberName(node, consts);
      if (name === null) {
        // `window[name]`: any global can be reached this way, so it cannot be verified.
        const owner = unwrap(node.expression);
        if (owner.kind === K.Identifier && COMPUTED_ON.has(owner.text)) add(node, '(전역 객체를 계산된 이름으로 접근)');
      } else if (IO_NAMES.has(name) && (node.kind === K.ElementAccessExpression || name !== 'fetch' || isGlobal(node.expression))) add(node, name);
      else if (HTTP_CALLS.has(name) && parent?.kind === K.CallExpression && parent.expression === node) {
        const owner = unwrap(node.expression);
        const ownerName = owner.kind === K.Identifier ? owner.text : memberName(owner, consts);
        if (HTTP_OBJECTS.has(ownerName)) add(parent, `${ownerName}.${name}`);
      }
    } else if (node.kind === K.BindingElement) {
      // `const { fetch: go } = window`, `const { ['fetch']: go } = globalThis`. A plain `{ fetch }` is an identifier and counted above.
      const name = node.propertyName && node.propertyName.kind !== K.Identifier ? keyName(node.propertyName, consts) : null;
      if (name !== null && IO_NAMES.has(name)) add(node, name);
    } else if (node.kind === K.CallExpression || node.kind === K.NewExpression) {
      // `new Function(s)`, `Function(s)`, `globalThis.Function(s)`.
      const callee = unwrap(node.expression);
      if ((callee.kind === K.Identifier ? callee.text : memberName(callee, consts)) === TEXT_RUNNERS.make) add(node, RUNS_TEXT);
      if (node.kind === K.NewExpression) return;
      // `Reflect.get(window, 'fetch')` and similar: a global object and the name passed side by side.
      const names = node.arguments.map(arg => staticString(arg, consts));
      if (names.some(name => name !== null && IO_NAMES.has(name)) && node.arguments.some(arg => isGlobal(arg))) add(node, '(이름으로 꺼냄)');
    }
  });
  return found;
}
