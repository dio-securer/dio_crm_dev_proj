// Trial fixtures for G08 (tests that are switched off). See index.mjs for the format.
// Every failing file holds exactly one shape, so losing any one shape is noticed. The mode words are joined from
// parts so that this file holds no switched-off test of its own.
const at = (dir, map) => Object.fromEntries(Object.entries(map).map(([name, text]) => [`${dir}/${name}`, text]));
const SKIP = 'sk' + 'ip';
const ONLY = 'on' + 'ly';
const TODO = 'to' + 'do';
const body = "'a', () => {}";

export const g08 = {
  id: 'G08',
  fail: {
    ...at('tests/unit', {
      // (1) a mode taken from a test function
      'mode.test.mjs': `it.${SKIP}(${body});\n`,
      'mode-group.test.mjs': `describe.${ONLY}(${body});\n`,
      'mode-todo.test.mjs': `test.${TODO}('a');\n`,
      'mode-bracket.test.mjs': `it['${SKIP}'](${body});\n`,
      'mode-newline.test.mjs': `it\n  .${SKIP}(${body});\n`,
      'mode-optional.test.mjs': `it?.${TODO}('a');\n`,
      'mode-each.test.mjs': `describe.each([1]).${ONLY}(${body});\n`,
      'mode-nested.test.mjs': `test.describe.${SKIP}(${body});\n`,
      'mode-if.test.mjs': `it.${SKIP}If(true)(${body});\n`,
      'mode-run-if.test.mjs': `it.runIf(false)(${body});\n`,
      'mode-fixme.test.mjs': `test.fixme(${body});\n`,
      'mode-value.test.mjs': `const off = it.${SKIP};\noff(${body});\n`,
      'mode-computed.test.mjs': `export const run = mode => it[mode](${body});\n`,
      'mode-destructured.test.mjs': `const { ${SKIP} } = it;\n${SKIP}(${body});\n`,
      'mode-imported.test.mjs': `import { ${SKIP} } from 'node:test';\n${SKIP}(${body});\n`,
      'mode-alias.test.mjs': `const group = describe;\nconst { ${ONLY}: one } = group;\none(${body});\n`,
      // (2) .skip() / .only() / .todo() on anything
      'context.test.mjs': `it('a', t => { t.${SKIP}(); });\n`,
      'this.test.mjs': `it('a', function () { this.${SKIP}(); });\n`,
      // (3) names that are a switched-off or single-run test
      'x-it.test.mjs': `xit(${body});\n`,
      'x-test.test.mjs': `xtest(${body});\n`,
      'x-describe.test.mjs': `xdescribe(${body});\n`,
      'f-it.test.mjs': `fit(${body});\n`,
      'f-describe.test.mjs': `fdescribe(${body});\n`,
      'x-global.test.mjs': `globalThis.xit(${body});\n`,
      'x-imported.test.mjs': `import { xit as later } from 'x';\nlater(${body});\n`,
      // (4) options
      'option.test.mjs': `test('a', { ${SKIP}: true }, () => {});\n`,
      'option-quoted.test.mjs': `test('a', { '${SKIP}': 'later' }, () => {});\n`,
      'option-computed.test.mjs': `test('a', { ['${ONLY}']: true }, () => {});\n`,
      'option-short.test.mjs': `const ${SKIP} = true;\ntest('a', { ${SKIP} }, () => {});\n`,
      'option-variable.test.mjs': `export const run = flag => test('a', { ${TODO}: flag }, () => {});\n`,
      'option-getter.test.mjs': `test('a', { get ${SKIP}() { return true; } }, () => {});\n`,
      'option-assigned.test.mjs': `const options = {};\noptions.${SKIP} = true;\ntest('a', options, () => {});\n`,
      'option-or-assigned.test.mjs': `export const run = (options, flag) => { options['${ONLY}'] ||= flag; };\n`,
      'option-defined.test.mjs': `export const run = options => Object.defineProperty(options, '${SKIP}', { value: true });\n`,
      'option-reflect.test.mjs': `export const run = options => Reflect.set(options, '${ONLY}', true);\n`,
    }),
    // Scope: test names, folders that look like test folders anywhere, and everything under scripts/.
    'backend/src/svc/mode.spec.ts': `it.${SKIP}(${body});\n`,
    'backend/src/svc/__tests__/mode.ts': `it.${SKIP}(${body});\n`,
    'frontend/e2e/mode.ts': `it.${SKIP}(${body});\n`,
    'any/specs/mode.js': `it.${SKIP}(${body});\n`,
    'any/__mocks__/mode.cjs': `it.${SKIP}(${body});\n`,
    'scripts/x/mode.mjs': `it.${SKIP}(${body});\n`,
  },
  pass: {
    ...at('tests/unit', {
      'g08-plain.test.mjs': `describe('g', () => { it(${body}); test(${body}); });\n`,
      'g08-off-values.test.mjs': `test('a', { ${SKIP}: false, ${ONLY}: null, ${TODO}: undefined }, () => {});\n`
        + `test('b', { ${SKIP}: 0, ${ONLY}: '', ${TODO}: void 0 }, () => {});\nconst options = {};\noptions.${SKIP} = false;\n`,
      'g08-text.test.mjs': `// it.${SKIP}(${body});\nit('Test ${ONLY}: it.${SKIP} is text here', () => {});\n`,
      'g08-other-names.test.mjs': `export const run = list => list.skipped || list.onlyOne() || skipper(list);\n`,
    }),
    'tests/unit/g08-types.test.ts': `interface Options { ${SKIP}: boolean; ${ONLY}?: boolean }\nexport const o: Options = { ${SKIP}: false };\n`,
    'backend/src/svc/g08-plain.ts': `it.${SKIP}(${body});\nexport const page = { ${SKIP}: 20 };\n`,
    'frontend/src/feature/g08-plain.ts': `export const page = { ${SKIP}: 20 };\n`,
  },
};
