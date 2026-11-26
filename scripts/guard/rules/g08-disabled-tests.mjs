import { CODE_EXT, excerpt, hasExt, looksLikeTest } from '../lib/files.mjs';
import { K, constsOf, keyName, lineOf, memberName, staticString, textOf, unwrap, walk } from '../lib/ts.mjs';

const RUNNERS = new Set(['it', 'test', 'describe', 'suite', 'context', 'specify', 'bench']);
const MODES = new Set(['skip', 'only', 'todo', 'skipIf', 'runIf', 'fixme']);
const OFF_NAMES = new Set(['xit', 'xtest', 'xdescribe', 'xcontext', 'xspecify', 'fit', 'fdescribe']);
const OPTION_KEYS = new Set(['skip', 'todo', 'only']);
const GLOBALS = new Set(['globalThis', 'global', 'window', 'self']);

export const inScope = file => hasExt(file, CODE_EXT) && (looksLikeTest(file) || file.startsWith('scripts/'));

const isAccess = n => n.kind === K.PropertyAccessExpression || n.kind === K.ElementAccessExpression;

/** A value that certainly leaves the option off: false, null, undefined, 0, '', void 0. Anything else may turn it on. */
function isOff(node, consts) {
  const n = unwrap(node);
  if (n.kind === K.FalseKeyword || n.kind === K.NullKeyword || n.kind === K.VoidExpression) return true;
  if (n.kind === K.Identifier) return n.text === 'undefined' || consts.get(n.text) === '';
  if (n.kind === K.NumericLiteral) return Number(n.text) === 0;
  return (n.kind === K.StringLiteral || n.kind === K.NoSubstitutionTemplateLiteral) && n.text === '';
}

/** Returns [{ line, message }] in source order, at most one per node. */
export function disabledOf(sf) {
  const consts = constsOf(sf);
  const assign = new Set([K.EqualsToken, K.BarBarEqualsToken, K.QuestionQuestionEqualsToken, K.AmpersandAmpersandEqualsToken]);
  const seen = new Set();
  const found = [];
  const add = (node, what) => {
    if (seen.has(node)) return;
    seen.add(node);
    found.push({ pos: node.pos, line: lineOf(sf, node), message: `꺼진 테스트 표시(${what}): ${excerpt(textOf(sf, node), 40)}` });
  };
  // Test functions under another name: `const d = describe`, `import { it as t } from 'vitest'`.
  const runners = new Set(RUNNERS);
  /** True when a chain passes through a test function: `it`, `it.concurrent`, `describe.each(x)`, `base.test`, `globalThis.it`. */
  const isRunner = node => {
    let n = unwrap(node);
    for (;;) {
      if (n.kind === K.Identifier) return runners.has(n.text);
      if (isAccess(n) && RUNNERS.has(memberName(n, consts) ?? '')) return true;
      if (!isAccess(n) && n.kind !== K.CallExpression) return false;
      n = unwrap(n.expression);
    }
  };
  /** `describe`, `globalThis.it`, `base.test`: the test function itself, not something made by calling it. */
  const isRunnerItself = node => {
    const n = unwrap(node);
    return n.kind === K.Identifier ? runners.has(n.text) : isAccess(n) && RUNNERS.has(memberName(n, consts) ?? '');
  };
  for (let round = 0; round < 2; round += 1) {
    walk(sf, node => {
      const named = node.name?.kind === K.Identifier;
      if (node.kind === K.VariableDeclaration && named && node.initializer && isRunnerItself(node.initializer)) runners.add(node.name.text);
      if (node.kind === K.ImportSpecifier && node.propertyName && RUNNERS.has(keyName(node.propertyName) ?? '')) runners.add(node.name.text);
    });
  }

  walk(sf, (node, parent) => {
    if (isAccess(node)) {
      // `it.skip`, `it['skip']`, `it?.todo`, `describe.each(x).only`, `test.describe.skip`: a mode taken from a test function.
      const name = memberName(node, consts);
      if (name !== null && MODES.has(name) && isRunner(node.expression)) add(node, name);
      // `it[mode](...)`: the mode is chosen at run time and cannot be verified.
      const owner = unwrap(node.expression);
      if (name === null && owner.kind === K.Identifier && runners.has(owner.text)) add(node, '계산된 이름');
      // `globalThis.xit(...)`, `g['fdescribe'](...)`.
      if (name !== null && OFF_NAMES.has(name) && owner.kind === K.Identifier && GLOBALS.has(owner.text)) add(node, name);
    } else if (node.kind === K.CallExpression || node.kind === K.TaggedTemplateExpression) {
      // `<anything>.skip(...)`: also covers `t.skip()`, `this.skip()` and a renamed test function.
      const callee = unwrap(node.kind === K.CallExpression ? node.expression : node.tag);
      const name = isAccess(callee) ? memberName(callee, consts) : null;
      if (name !== null && MODES.has(name)) add(callee, name);
      // `Object.defineProperty(options, 'skip', { value: true })`, `Reflect.set(options, 'only', true)`.
      const sets = name === 'defineProperty' || name === 'set';
      if (sets && (node.arguments ?? []).some(arg => OPTION_KEYS.has(staticString(arg, consts) ?? ''))) add(node, '옵션을 이름으로 설정');
    } else if (node.kind === K.Identifier && OFF_NAMES.has(node.text)) {
      // `xit(...)`, `(xit)(...)`, `const t = fit`: any use of the name as a value. A declaration or a member name is not a use.
      if (parent && parent.name !== node && parent.propertyName !== node) add(node, node.text);
    } else if (node.kind === K.ImportSpecifier) {
      // `import { skip } from 'node:test'`, `import { xit as t } from 'x'`.
      const name = keyName(node.propertyName ?? node.name, consts);
      if (name !== null && (MODES.has(name) || OFF_NAMES.has(name))) add(node, name);
    } else if (node.kind === K.VariableDeclaration && node.name.kind === K.ObjectBindingPattern && node.initializer && isRunner(node.initializer)) {
      // `const { skip } = it`, `const { only: o } = describe`, `const { ['todo']: t } = test`.
      for (const item of node.name.elements) {
        const name = keyName(item.propertyName ?? item.name, consts);
        if (name === null || MODES.has(name)) add(item, name ?? '계산된 이름');
      }
    } else if (node.kind === K.PropertyAssignment || node.kind === K.ShorthandPropertyAssignment
      || ((node.kind === K.MethodDeclaration || node.kind === K.GetAccessor) && parent?.kind === K.ObjectLiteralExpression)) {
      // `{ skip: true }`, `{ 'skip': reason }`, `{ ['skip']: true }`, `{ skip }`, `{ get skip() { ... } }`.
      const name = keyName(node.name, consts);
      if (name !== null && OPTION_KEYS.has(name) && !(node.kind === K.PropertyAssignment && isOff(node.initializer, consts))) add(node, name);
    } else if (node.kind === K.BinaryExpression && assign.has(node.operatorToken.kind)) {
      // `options.skip = true`, `opts['only'] ||= flag`.
      const left = unwrap(node.left);
      const name = isAccess(left) ? memberName(left, consts) : null;
      if (name !== null && OPTION_KEYS.has(name) && !isOff(node.right, consts)) add(node, name);
    }
  });
  return found.sort((a, b) => a.pos - b.pos).map(({ line, message }) => ({ line, message }));
}

export default {
  id: 'G08',
  name: 'disabled-tests',
  baseline: 'count',
  forbids: '테스트를 꺼 두는 것. (1) 테스트 함수의 skip / only / todo / skipIf / runIf / fixme: `it.skip(...)`, `it . skip`, 줄바꿈 뒤 `.skip`, `it["skip"](...)`, '
    + '`describe["only"](...)`, `it?.todo("a")`, `describe.each(x).only`, `const { skip } = it`, `import { skip } from "node:test"`. '
    + '(2) 받는 쪽이 무엇이든 `.skip(...)`·`.only(...)`·`.todo(...)` 호출(`t.skip()`, `this.skip()`). '
    + '(3) x 로 시작하는 꺼진 테스트 이름(xit, xtest, xdescribe …)과 f 로 시작하는 단독 실행(fit, fdescribe). '
    + '(4) 옵션 객체의 skip·todo·only 값이 꺼짐(false, null, undefined, 0, 빈 문자열)이 아닌 것: `{ skip: true }`, `{ ["skip"]: true }`, `{ skip }`, `opts.skip = true`.',
  why: 'AI는 테스트가 실패하면 원인을 고치는 대신 테스트를 끄거나 하나만 돌려 "통과"를 만든다. 꺼진 테스트는 아무도 다시 켜지 않는다.',
  fix: '테스트를 켜고 실패 원인을 고친다. 정말 지울 테스트라면 이유를 커밋에 적고 삭제한다(끄는 것은 안 된다).',
  scope: '테스트 파일(이름이 `*.spec.*`·`*.test.*` 이거나, 경로 어디든 `test/`·`tests/`·`__tests__/`·`e2e/`·`spec/`·`specs/`·`__mocks__/` 폴더 안에 있는 파일)과 '
    + '`scripts/` 아래 모든 코드 파일(검사 스크립트). 이 규칙은 검사를 하는 쪽이라 폴더 이름을 넓게 잡는다(다른 규칙의 테스트 예외는 정해진 폴더만 인정한다). '
    + 'TypeScript 구문 트리(AST)로 검사하므로 주석과 문자열 안의 글자("Test only: …")는 세지 않는다.',
  exclusions: ['없음. 가드 자신의 코드(`scripts/guard/`)도 검사 대상이다.'],
  limits: [
    '주석 처리해서 끈 테스트, 본문 첫 줄의 `return`, 조건문으로 감싼 테스트, 설정 파일의 제외 패턴(testPathIgnorePatterns 등), 명령줄 옵션(`--test-only`, '
      + '`--test-skip-pattern`, `-t`)은 잡지 못한다.',
    '`scripts/`·테스트 파일 안에서는 테스트와 무관한 객체의 skip·todo·only 속성(예: 페이지 건너뛰기 값 `{ skip: 20 }`)과 `.skip()` 메서드 호출도 센다(막는 쪽으로 틀림). '
      + '`fit`·`xit` 같은 이름의 변수를 값으로 쓰는 것도 센다. 타입 선언(`skip: boolean`)은 값이 아니므로 세지 않는다.',
    '옵션 값이 변수면 켜진 것으로 본다(`{ skip: flag }`). 값을 따지지 않는다.',
    '옵션 객체를 다른 파일에서 만들어 가져오면 잡지 못한다. 실행 중에 만든 이름으로 고르는 것(`it[name]`)은 확인할 수 없으므로 위반으로 센다.',
    '테스트 파일 이름 규칙과 `scripts/` 밖에 둔 테스트(예: 임의 이름의 .mjs)는 대상이 아니다.',
  ],
  check(ctx) {
    const findings = [];
    for (const file of ctx.files) {
      if (!inScope(file)) continue;
      for (const hit of disabledOf(ctx.ast(file))) findings.push({ file, ...hit });
    }
    return findings;
  },
};
