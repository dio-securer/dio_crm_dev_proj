// More trial fixtures for G06, G07, G08 and G11: one file for every shape that docs/framework/guard-rules.md says is
// caught and that the first set of fixtures (branching.mjs, io.mjs, disabled.mjs, test-imports.mjs) did not hold.
// Format: see index.mjs. index.mjs joins these with the other fixtures of the same rule.
const at = (dir, map) => Object.fromEntries(Object.entries(map).map(([name, text]) => [`${dir}/${name}`, text]));
const from = spec => `import x from '${spec}';\nexport default x;\n`;
const f = body => `export const f = (x: any, row: any) => ${body};\n`;
const branch = f("x === 'KR'");
// A file is a test only by the two suffixes and the two folders. None of these names or folders is one.
export const NOT_TEST_NAMES = ['unit.mock.ts', 'unit.tests.ts', 'unit.testing.ts', 'unit-spec.ts', 'spec.ts', 'test.ts', 'unit.test.txt.ts',
  'unit.spec-data.ts', 'unit.fixture.ts', 'unit.stories.tsx', 'unit.e2e.ts'];
export const NOT_TEST_DIRS = ['backend/src/test', 'backend/src/tests', 'backend/tests', 'backend/testing', 'frontend/test', 'frontend/tests',
  'frontend/src/tests', 'packages/nest/backend/test', 'packages/nest/tests', 'extensions/acme/tests',
  'backend/test-utils', 'backend/src/__tests__', 'backend/src/__mocks__'];
const EVERYWHERE = ['frontend/', 'backend/', 'packages/', 'extensions/'];
const notTests = (stem, text, scopes = EVERYWHERE) => ({
  ...Object.fromEntries(NOT_TEST_NAMES.map(name => [`backend/src/svc/not-test/${stem}-${name}`, text])),
  ...Object.fromEntries(NOT_TEST_DIRS.filter(dir => scopes.some(scope => dir.startsWith(scope))).map(dir => [`${dir}/${stem}-not-test.ts`, text])),
});

export const g06 = {
  fail: {
    ...at('backend/src/svc', {
      'case-const.ts': 'export function f(x: any) { switch (x) { case Market.KR: return 1; default: return 0; } }\n',
      'case-bare.ts': 'export function f(x: any) { switch (x) { case KR: return 1; default: return 0; } }\n',
      'switch-code.ts': "export function f(x: any) { switch ('KR') { case x: return 1; default: return 0; } }\n",
      'conditional.ts': f("(x ? row.country : row.other) === 'a'"),
      'conditional-else.ts': f("(x ? row.other : row.country) === 'a'"),
      'awaited.ts': "export const f = async (row: any) => (await row.country) === 'a';\n",
      'comma.ts': f("x === (0, 'KR')"),
      'lower-case.ts': f("row.country.toLowerCase() === 'a'"),
      'chained-call.ts': f("row.market.trim().slice(0, 2) === 'a'"),
      'locale-underscore.ts': f("x === 'ko_KR'"),
      'locale-three.ts': f("x === 'fil-PH'"),
      'template-key.ts': f("`${row.country}` === 'a'"),
      'template-code.ts': f('x === `K${"R"}`'),
      'call-argument.ts': f("normalize(row.market) === 'a'"),
      'call-name.ts': f("row.getTenant() === 'a'"),
      'reflect.ts': f("Reflect.get(row, 'countryCode') === 'a'"),
      'computed-key.ts': f("row[x.countryKey] === 'a'"),
      'bigint.ts': f('row.companyId === 3n'),
      'zero.ts': f('row.marketCount === 0'),
      'raw.ts': f('x === String.raw`KR`'),
      'char-codes.ts': f('x === String.fromCharCode(75, 82)'),
      'upper-cased.ts': f("x === 'kr'.toUpperCase()"),
      'array-join.ts': f("x === ['K', 'R'].join('')"),
      'concat.ts': f("x === 'K'.concat('R')"),
      'string-call.ts': f("x === String('KR')"),
      'const-chain.ts': `const part = 'K';\nconst whole = part + 'R';\n${f('x === whole')}`,
      'frozen-list.ts': f("Object.freeze(['KR', 'US']).includes(x)"),
      'spread-list.ts': f("[...['KR'], 'US'].includes(x)"),
      'regex-match.ts': f('x.match(/^(KR|US)$/)'),
      'map-get.ts': f("new Map([['a', 1]]).get(row.companyCode)"),
      'number-list.ts': f('[1, 2].includes(row.companyId)'),
      'lookup-const.ts': f("({ a: 1 })[row['marketCode']]"),
      'UPPER-EXT.TS': branch,
    }),
    'packages/tools/src/branch.ts': branch,
    'packages/any-new-package/branch.js': "export const f = x => x === 'KR';\n",
    ...notTests('branch', branch, ['frontend/src/', 'backend/src/', 'packages/']),
  },
  pass: {
    ...at('backend/src/svc', {
      'g06-not-locale.ts': f("x === 'KO-KR' || x === 'ko-kr' || x === 'k-KR' || x === 'kore-KR' || x === 'ko-KRX' || x === 'Kr' || x === 'ko.KR'"),
      'g06-not-code.ts': f("x === 'XX' || x === 'KRW' || x === 'K' || x === 'global' || x === Market.Korea || x === 'kr'"),
      'g06-not-key.ts': f("row.xcompany === 'a' && row.nationing === 'b' && row.subtenant === 'c' && row.country === x.country"),
      'g06-no-equality.ts': f("row.companyRank > 3 && row.marketName.length < 2 && typeof row.country && x.includes(row.other)"),
    }),
    'frontend/public/g06-outside.js': "export const f = x => x === 'KR';\n",
    'backend/scripts/g06-outside.js': "export const f = x => x === 'KR';\n",
    'tests/any/g06-in-test-root.ts': branch,
  },
};

const NAME = 'fetch';
const call = f(`${NAME}(String(x))`);
export const g07 = {
  fail: {
    ...at('backend/src/svc', {
      'builtin.ts': "export const m = process.getBuiltinModule('node:https');\n",
      'require-alias.ts': "const r = require;\nexport default r('pg');\n",
      'require-alias-twice.ts': "const r = require;\nconst s = r;\nexport default s('pg');\n",
      'require-assigned.ts': "let r;\nr = require;\nexport default r('pg');\n",
      'module-require.ts': "export default module.require('pg');\n",
      'require-resolve.ts': "export default require.resolve('pg');\n",
      'meta-resolve.ts': "export default import.meta.resolve('pg');\n",
      'create-require.ts': "import { createRequire } from 'node:module';\nexport default createRequire(import.meta.url)('pg');\n",
      'create-require-alias.ts': "import { createRequire } from 'node:module';\nconst load = createRequire(import.meta.url);\nexport default load('pg');\n",
      'upper-case.ts': from('MSSQL'),
      'node-upper.ts': from('NODE:HTTPS'),
      'export-from.ts': "export { Pool } from 'pg';\n",
      'export-all.ts': "export * as pg from 'pg';\n",
      'side-effect.ts': "import 'pg';\n",
      'template.ts': 'export default require(`pg`);\n',
      'joined.ts': "export default require('p' + 'g');\n",
      'type-query.ts': "export type P = import('pg').Pool;\n",
      'type-computed.ts': 'export type P<T extends string> = import(T);\n',
      'computed-import.ts': 'export const load = (name: string) => import(name);\n',
      'function-call.ts': 'export const f = (s: string) => Function(s);\n',
      'function-global.ts': 'export const f = (s: string) => new globalThis.Function(s);\n',
      'eval-indirect.ts': 'export const f = (s: string) => (0, eval)(s);\n',
      'eval-window.ts': 'export const f = (s: string) => window.eval(s);\n',
      'short-key.ts': `export const f = (w: any) => { const { ${NAME} } = w; return ${NAME}; };\n`,
      'reflect-self.ts': `export const f = () => Reflect.get(self, '${NAME}');\n`,
      'alias-twice.ts': `const w = window;\nconst v = w;\nexport const f = (url: string) => v.${NAME}(url);\n`,
      'optional.ts': `export const f = (url: string) => globalThis?.${NAME}?.(url);\n`,
      'type-of.ts': `export const has = typeof ${NAME} === 'function';\n`,
    }),
    ...notTests('io', call),
  },
  overlap: ['backend/src/svc/computed-import.ts', 'backend/src/svc/type-computed.ts'],
  pass: at('backend/src/svc', {
    'g07-own-http.ts': "export const f = (client: any) => client.request({}) ?? client.get('x');\n",
    'g07-own-key.ts': 'export const f = (parent: any, top: any, key: string) => parent[key] ?? top[key];\n',
    'g07-names.ts': `export const o = { ${NAME}: 1, eval: 2 };\nexport class C { ${NAME}() { return 1; } get axios() { return 2; } }\n`
      + `export type T = { ${NAME}: string; WebSocket(): void };\nexport enum E { ${NAME} = 1 }\n`,
    'g07-similar.ts': "import a from 'pgx';\nimport b from './pg';\nimport c from 'http-errors';\nimport d from '@scope/pg';\nexport default [a, b, c, d];\n",
  }),
};

const SKIP = 'skip';
const ONLY = 'only';
const TODO = 'todo';
const body = "'a', () => {}";
export const g08 = {
  fail: at('tests/unit', {
    'alias-value.test.mjs': `const group = describe;\nexport const off = group.${ONLY};\n`,
    'alias-twice.test.mjs': `const group = describe;\nconst again = group;\nexport const off = again.${ONLY};\n`,
    'alias-import.test.mjs': `import { it as later } from 'vitest';\nexport const off = later.${TODO};\n`,
    'chained.test.mjs': `export const off = it.concurrent.${SKIP};\n`,
    'tagged.test.mjs': `it.${SKIP}\`a\`;\n`,
    'global-runner.test.mjs': `export const off = globalThis.it.${SKIP};\n`,
    'base-runner.test.mjs': `export const off = base.test.${ONLY};\n`,
    'parens.test.mjs': `(it).${SKIP}(${body});\n`,
    'joined-name.test.mjs': `it['sk' + 'ip'](${body});\n`,
    'const-name.test.mjs': `const mode = '${SKIP}';\nit[mode](${body});\n`,
    'x-value.test.mjs': 'export const later = xit;\n',
    'x-parens.test.mjs': `(xtest)(${body});\n`,
    'x-global-bracket.test.mjs': `window['fdescribe'](${body});\n`,
    'mode-imported-alias.test.mjs': `import { ${SKIP} as later } from 'node:test';\nlater(${body});\n`,
    'destructured-computed.test.mjs': `export const run = key => { const { [key]: off } = it; return off; };\n`,
    'destructured-quoted.test.mjs': `const { '${TODO}': later } = test;\nlater('a');\n`,
    'option-template-key.test.mjs': `test('a', { [\`${SKIP}\`]: true }, () => {});\n`,
    'option-nullish.test.mjs': `export const run = (o, flag) => { o.${SKIP} ??= flag; };\n`,
    'option-and.test.mjs': `export const run = (o, flag) => { o['${TODO}'] &&= flag; };\n`,
    'option-spread-source.test.mjs': `const off = { ${ONLY}: 1 };\ntest('a', { ...off }, () => {});\n`,
    'option-const-empty-not.test.mjs': `const reason = 'later';\ntest('a', { ${SKIP}: reason }, () => {});\n`,
  }),
  pass: at('tests/unit', {
    'g08-off-more.test.mjs': `const none = '';\ntest('a', { ${SKIP}: 0.0, ${ONLY}: 0x0, ${TODO}: \`\` }, () => {});\ntest('b', { ${SKIP}: none }, () => {});\n`
      + `const o = {};\no.${ONLY} = null;\no.${TODO} ??= undefined;\n`,
    'g08-names.test.mjs': 'export const run = o => o.skipped ?? o.todos ?? o.onlyIf ?? xitem ?? fitness ?? o.xit;\n',
    'g08-type.test.ts': `export type O = { ${SKIP}?: boolean };\nexport interface P { ${ONLY}(): void }\nexport class Q { ${TODO} = false; }\n`,
  }),
};

export const g11 = {
  fail: {
    ...at('backend/src/svc', {
      'hash.ts': from('./gateway.spec#part'),
      'query-hash.ts': from('./gateway.test.ts?raw#part'),
      'ext-mts.ts': from('./gateway.spec.mts'),
      'ext-cjs.ts': from('./gateway.test.cjs'),
      'ext-jsx.ts': from('./gateway.test.jsx'),
      'ext-json.ts': from('./gateway.spec.json'),
      'package-upper.ts': from('@DIO-CRM/API/test/helper'),
      'package-collapsed.ts': from('@dio-crm/api/src/../test/helper'),
      'bare-tests-root.ts': from('tests/admin/helper'),
      'bare-backend-root.ts': from('backend/test/helper'),
      'root-itself.ts': from('../../test'),
      'type-import.ts': "export type T = import('./gateway.spec').T;\n",
      'require-resolve.ts': "export default require.resolve('./gateway.spec');\n",
      'side-effect.ts': "import './gateway.test';\n",
      'export-named.ts': "export { a } from './gateway.spec';\n",
      'glob-eager.ts': "export const all = import.meta.globEager('./*.test.ts');\n",
      'reference.ts': '/// <reference path="./gateway.spec.ts" />\nexport {};\n',
      'spaces.ts': from(' ./gateway.spec '),
    }),
    ...notTests('importer', from('./gateway.spec')),
  },
  pass: at('backend/src/svc', {
    // Above the top of the repository there is no test folder of this repository.
    'g11-outside.ts': from('../../../../backend/test/helper'),
    'g11-not-roots.ts': "import a from '../test/helper';\nimport b from '../../testsx/helper';\nimport c from './x.specs';\nimport d from './x.test-data';\n"
      + "import e from 'testsuite/helper';\nimport f from '@dio-crm/web/tests/helper';\nexport default [a, b, c, d, e, f];\n",
  }),
};
