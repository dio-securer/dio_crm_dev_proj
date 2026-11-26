// More trial fixtures for G01, G02, G04, G05, G09 and G10: one file for every shape that docs/framework/guard-rules.md
// says is caught and that the first set of fixtures (zones.mjs, text.mjs) did not hold.
// Format: see index.mjs. index.mjs joins these with the other fixtures of the same rule.
import { pinned } from '../pins.mjs';
import { CODE_EXT } from './members.mjs';

const at = (dir, map) => Object.fromEntries(Object.entries(map).map(([name, text]) => [`${dir}/${name}`, text]));
const from = spec => `import x from '${spec}';\nexport default x;\n`;
const code = 'export const a = 1;\n';

export const g01 = {
  fail: at('metadata', {
    'notes.txt': 'x\n',
    'config.toml': 'a = 1\n',
    'values.yaml.bak': 'a: 1\n',
    'page.html': '<p></p>\n',
    'query.sql': 'select 1;\n',
    // Only the one name `.gitkeep` is let through, not every name that starts with a dot or contains it.
    '.hidden.ts': code,
    '.env': 'A=1\n',
    'sub/.gitignore': '# nothing\n',
    'sub/.npmrc': 'a=1\n',
    '.gitkeep.ts': code,
    'x.gitkeep': '',
    '.gitkeep/tool.ts': code,
    'a/b/c/d/e/f/deep.js': code,
    // A .json file must be JSON, however small.
    'empty.json': '',
    'short.json': '{',
    'trailing.json': '{ "a": 1, }\n',
    'UPPER.JSON': '{ a: 1 }\n',
  }),
  pass: { 'metadata/a/b/c/d/e/f/.gitkeep': '', 'metadata/a/b/c/d/e/f/g01-deep.yml': 'a: 1\n', 'metadata/g01-number.json': '1\n' },
};

export const g02 = {
  fail: {
    ...at('extensions/acme', {
      // Climbing above the top of the repository and coming back in is still outside the extension's own folder.
      'climb-out.ts': from('../../../extensions/acme/x'),
      'url.ts': "export const u = new URL('../other/x.js', import.meta.url);\n",
      'glob.ts': "export const all = import.meta.glob('../other/*.ts');\n",
      'glob-list.ts': "export const all = import.meta.glob(['./a.ts', '../other/b.ts']);\n",
      'hash.ts': from('../other/x#part'),
      'builtin.ts': "export const m = process.getBuiltinModule('node:fs');\n",
      'absolute.ts': from('/abs/x'),
      'url-scheme.ts': from('https://example.invalid/x.js'),
      'contracts-dot.ts': from('@dio-crm/contracts/./x'),
      'contracts-empty-part.ts': from('@dio-crm/contracts//x'),
      'jsx-dev.ts': from('react/jsx-dev-runtime'),
      'react-upper.ts': from('React'),
      'node-builtin.ts': from('node:path'),
      'workspace.ts': from('@dio-crm/web'),
      'lookalike-scope.ts': from('@dio-crmx/contracts'),
      'require-alias.ts': "const r = require;\nexport default r('zod');\n",
      'import-equals.ts': "import z = require('zod');\nexport default z;\n",
      'lazy.ts': "export const load = () => import('zod');\n",
      'side-effect.ts': "import 'zod';\n",
      // A name that only looks like a test name does not get the test-only imports.
      'unit.mock.ts': from('vitest'),
      'unit.testing.ts': from('node:test'),
      'tests/helper.ts': from('node:assert'),
      'deep/er/folder/up.ts': from('../../../../other/x'),
    }),
    'extensions/loose.jsx': code,
    'extensions/other/cross.ts': from('../acme/x'),
    ...at('packages/engine/src', {
      'climb-out.ts': from('../../../../packages/engine/src/x'),
      'url-scheme.ts': from('file:///x'),
      'empty-part.ts': from('zod//x'),
      'parent-part.ts': from('zod/../x'),
      'sibling-engine.ts': from('../../engine-core/src/x'),
      'legacy-dist.ts': from('@dio-crm/contracts/dist/lead-grid.js'),
      'legacy-climb.ts': from('@dio-crm/contracts/src/sub/../lead-grid'),
      'legacy-declaration.ts': from('@dio-crm/contracts/lead-grid.d.ts'),
      // A computed import cannot be checked, in the engine as in an extension. (A test name: G07 and G11 do not look here.)
      'computed.spec.ts': 'export const load = (name: string) => import(name);\n',
      'web-sub.ts': from('@dio-crm/web/src/x'),
      'api-upper.ts': from('@DIO-CRM/API'),
    }),
    'packages/engine-ui/deep/er/up.ts': from('../../../../frontend/src/x'),
  },
  pass: {
    'extensions/acme/deep/er/folder/g02-in.ts': from('../../../lib/x'),
    'packages/engine/src/g02-plain.ts':
      "import a from 'react-dom';\nimport b from 'node:fs';\nimport c from '@dio-crm/contracts';\nimport d from '@dio-crm/engine-core';\n"
      + "import e from '@dio-crm/contracts/order.js';\nimport f from '@dio-crm/contracts/leadership';\nexport default [a, b, c, d, e, f];\n",
  },
};

const WORD = String.fromCharCode(0xC800, 0xC7A5);
// The Hangul blocks the rule knows, as [first, last] code points. Tied to the pinned pattern by the meta test.
export const HANGUL_BLOCKS = [[0x1100, 0x11FF], [0x3130, 0x318F], [0xA960, 0xA97F], [0xAC00, 0xD7FF]];
const hex = point => point.toString(16).toUpperCase().padStart(4, '0');
export const hangulPattern = `[${HANGUL_BLOCKS.map(([first, last]) => `\\u${hex(first)}-\\u${hex(last)}`).join('')}]`;
// Where text can sit in code, by syntax kind. Tied to the pinned LEAVES list by the meta test.
export const LEAF_SOURCE = {
  StringLiteral: `export const a = '${WORD}';\n`,
  NoSubstitutionTemplateLiteral: `export const a = \`${WORD}\`;\n`,
  TemplateHead: `export const a = (n: number) => \`${WORD} \${n}\`;\n`,
  TemplateMiddle: `export const a = (n: number) => \`a \${n} ${WORD} \${n} b\`;\n`,
  TemplateTail: `export const a = (n: number) => \`a \${n} ${WORD}\`;\n`,
  JsxText: `export const A = () => <b>${WORD}</b>;\n`,
  Identifier: `export const a = (o: any) => o.${WORD};\n`,
  PrivateIdentifier: `export class A { #${WORD} = 1; }\n`,
  RegularExpressionLiteral: `export const a = /${WORD}+/u;\n`,
};
export const LEAVES = pinned('scripts/guard/rules/g04-hardcoded-ui-text.mjs', 'LEAVES');
const label = `export const label = '${WORD}';\n`;
const NEXT_TO = HANGUL_BLOCKS.flatMap(([first, last]) => [first - 1, last + 1]).filter(point => point < 0xD800);
export const g04 = {
  fail: {
    ...Object.fromEntries(LEAVES.map(kind => [`extensions/acme/leaves/${kind}.tsx`, LEAF_SOURCE[kind]])),
    ...Object.fromEntries(HANGUL_BLOCKS.flat()
      .map(point => [`extensions/acme/blocks/u${hex(point)}.ts`, `export const s = '${String.fromCharCode(point)}';\n`])),
    ...Object.fromEntries(CODE_EXT.map(ext => [`extensions/acme/ext/label${ext}`, label])),
    'extensions/acme/attribute.tsx': `export const A = () => <b title="${WORD}" />;\n`,
    'extensions/acme/key.ts': `export const o = { '${WORD}': 1 };\n`,
    'extensions/acme/hex-escape.ts': "export const s = '\\u{D55C}';\n",
    'extensions/other/deep/er/label.ts': label,
    'packages/engine-x/deep/er/label.js': label,
    'packages/engine/label.spec.ts': label,
  },
  pass: {
    // The code points next to each block are not Hangul.
    'extensions/acme/g04-next-to.ts': `export const s = '${NEXT_TO.map(point => String.fromCharCode(point)).join(' ')}';\n`,
    'packages/my-engine/g04-label.ts': label,
    'packages/contracts/src/g04-label.ts': label,
    'extensions/acme/g04-jsx-comment.tsx': `export const A = () => <b>{/* ${WORD} */}</b>;\n`,
  },
};

const HEX = '#';
const css = value => `a { color: ${value}; }\n`;
export const g05 = {
  fail: at('ui/shapes', {
    'colon.css': `a{color:${HEX}fff}\n`,
    'comma.css': `a{background:linear-gradient(red,${HEX}fff)}\n`,
    'upper.css': css(`${HEX}ABC`),
    'mixed.css': css(`${HEX}aBcDeF`),
    'paren.ts': `export const c = f('${HEX}000');\n`,
    'equals.tsx': `export const C = () => <i color="${HEX}fff" />;\n`,
    'comment.ts': `// ${HEX}fff\nexport const a = 1;\n`,
    'hyphen-function.css': css('x-rgb(0 0 0)'),
    'function-newline.css': css('rgb\n(0 0 0)'),
    'function-upper.scss': css('HSLA(0 0% 0% / 1)'),
    'important.css': `a { color: ${HEX}fff!important; }\n`,
    'last.css': `a { color: ${HEX}fff }`,
  }),
  pass: at('ui/shapes', {
    'g05-prefixed.ts': `export const a = 'x${HEX}fff'; export const b = '&${HEX}fff'; export const c = '$${HEX}fff'; export const d = '.${HEX}fff';\n`,
    'g05-not-hex.css': `a { b: ${HEX}ggg; c: ${HEX}ff; d: ${HEX}fffffffff; e: ${HEX}fff_; f: xrgb(1); g: rgbs(1); }\n`,
    'g05-other-ext.mjs': `export const c = '${HEX}fff';\n`,
  }),
};

export const g09 = {
  fail: ['[REQ12] no dash', '[REQ-12 no closing bracket', '[F1-2 no closing bracket', '[WIP] not an id', '[REQ-12a] letters after the number',
    '[F1-2-3] three numbers', 'REQ-12] no opening bracket', '[ REQ-12 ] spaces inside', '[BUG-12] another word', '[F-2] no first number',
    '[REQ--12] two dashes', '[FIX] [F1] [REQ] halves', '[F1_2] underscore', '[REQ-x] no digits', '{REQ-12} braces', '[F1.2] dot', '[Req-12] mixed case',
    '[REQ-12\\] escaped bracket'],
  pass: ['[F0-5] this unit', 'fix [REQ-1]', '[F1-2][REQ-3] two ids', '[REQ-000123] leading zeros',
    'x[F12-345]y no spaces around', '[WIP] [REQ-9] other tag first'],
};

export const g10 = {
  fail: {
    'frontend/src/hq-mock/notes.md': '# notes\n',
    'frontend/src/hq-mock/data.json': '{}\n',
    'frontend/src/.hidden': 'x\n',
    'frontend/src/a.b.c.ts': code,
    'frontend/src/demo/deep/er/New.tsx': code,
    'backend/src/modules/order/order.service.extra.spec.ts': code,
    'backend/src/modules/order/other.spec.ts': code,
    'frontend/src/hq-mock/Old.stories.tsx': code,
    'frontend/src/styles/tokens2.css': 'a { margin: 0; }\n',
    'backend/src/customization/lead-.ts': code,
  },
  pass: {
    'backend/src/modules/order/order.service.test.ts': code,
    'frontend/src/sub/g10-deeper.ts': code,
    'frontend/srcx/g10.ts': code,
    'packages/contracts/src/sub/lead-g10.ts': code,
    'frontend/src/customization/sub/g10-Lead.tsx': code,
    'docs/frontend/src/hq-mock/g10.md': '# x\n',
  },
};
