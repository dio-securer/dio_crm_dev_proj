// Trial fixtures for the path and size rules G01, G02, G03 and G10. See index.mjs for the format.
const code = 'export const a = 1;\n';
const rows = n => '// x\n'.repeat(n);
const bytes = n => `${'/'.repeat(n - 1)}\n`;
// One Hangul syllable is three bytes: 5001 of them are over the byte limit while far under it in characters.
const SYLLABLE = String.fromCharCode(0xD55C);

export const g01 = {
  id: 'G01',
  fail: {
    'metadata/objects/lead.ts': code,
    'metadata/deep/nested/folder/run.mjs': code,
    'metadata/theme.css': 'a { margin: 0; }\n',
    'metadata/broken.json': '{ "a": \n',
    'metadata/NOEXT': 'value\n',
    'metadata/view.json5': '{}\n',
    'metadata/setup.yaml.sh': 'echo\n',
  },
  pass: {
    'metadata/objects/g01-lead.json': '{ "name": "lead" }\n',
    'metadata/g01-a.yaml': 'a: 1\n',
    'metadata/g01-b.yml': 'b: 1\n',
    'metadata/README.md': '# values\n',
    'metadata/empty/.gitkeep': '',
    'metadata/G01-UPPER.JSON': '[1]\n',
    'metadata-notes/g01-tool.ts': code,
    'config/metadata/g01-tool.ts': code,
  },
};

const from = spec => `import x from '${spec}';\nexport default x;\n`;
export const g02 = {
  id: 'G02',
  fail: {
    'extensions/loose.ts': code,
    'extensions/acme/up.ts': from('../other/x'),
    'extensions/acme/pkg.ts': from('zod'),
    'extensions/acme/req.ts': "const api = require('@dio-crm/api');\nexport default api;\n",
    'extensions/acme/reexport.ts': "export * from '../../backend/src/x';\n",
    'extensions/acme/node.spec.ts': from('node:fs'),
    'extensions/acme/runner.ts': from('vitest'),
    'extensions/acme/climb.ts': from('@dio-crm/contracts/../api'),
    'extensions/acme/dom.ts': from('react-dom'),
    'extensions/acme/ref.ts': '/// <reference path="../../backend/src/x.ts" />\nexport {};\n',
    'extensions/acme/typed.ts': "import type { A } from '@dio-crm/api';\nexport type B = A;\n",
    'extensions/acme/typeof.ts': "export type B = import('lodash').C;\n",
    'extensions/acme/computed.ts': 'export const load = (name: string) => import(name);\n',
    'packages/engine/src/up.ts': from('../../../frontend/src/feature'),
    'packages/engine-core/src/app.ts': from('@dio-crm/web/src/x'),
    'packages/engine/src/prefix.ts': from('frontend/src/x'),
    'packages/engine/src/absolute.ts': from('/abs/x'),
    'packages/engine/src/legacy.ts': from('@dio-crm/contracts/lead-grid'),
    'packages/engine/src/legacy-spelled.ts': from('@dio-crm/contracts/dist/Lead-Grid.JS'),
    'packages/engine/src/extension.ts': from('@dio-crm/extension-acme'),
    'packages/engine/src/dotted.ts': from('pkg/./sub'),
    'packages/engine/src/made.ts': "import { createRequire } from 'node:module';\nexport const m = createRequire(import.meta.url)('@dio-crm/api');\n",
  },
  // A computed import is unverifiable for every rule that reads imports.
  overlap: ['extensions/acme/computed.ts'],
  pass: {
    'extensions/acme/g02-ok.tsx': "import a from './lib/a';\nimport { c } from '@dio-crm/contracts';\nimport e from '@dio-crm/engine/x';\n"
      + "import React from 'react';\nimport { jsx } from 'react/jsx-runtime';\nimport b from '../acme/b';\nexport default [a, c, e, React, jsx, b];\n",
    'extensions/acme/g02-ok.test.ts': "import { it } from 'vitest';\nimport { test } from 'node:test';\nimport a from 'node:assert';\n"
      + "import s from 'node:assert/strict';\nexport default [it, test, a, s];\n",
    'packages/engine/src/g02-ok.ts': "import a from './a';\nimport z from 'zod';\nimport c from '@dio-crm/contracts/order';\nimport up from '../index';\n"
      + 'export default [a, z, c, up];\n',
    'extensions/acme/g02-data.json': '{}\n',
    'packages/tools/src/g02-free.ts': from('../../../frontend/src/feature'),
  },
};

export const g03 = {
  id: 'G03',
  fail: {
    'src/lines.ts': rows(301),
    'src/unterminated.ts': `${rows(300)}// x`,
    'any/where/bytes.js': bytes(15001),
    'tools/wide-letters.js': `// ${SYLLABLE.repeat(5001)}\n`,
    'metadata/big.json': `[\n${'0,\n'.repeat(298)}0\n]\n`,
    'metadata/big.yaml': `a: ${'b'.repeat(15000)}\n`,
    'web/sheet.css': '/* x */\n'.repeat(301),
    'web/sheet.scss': '/* x */\n'.repeat(301),
    'tests/long.test.mjs': rows(301),
    'lib/module.mts': rows(301),
    'lib/common.cts': rows(301),
    'fixtures/generated/dist/big.cjs': rows(301),
    'docs/admin-platform/implementation/evidence-copy/big.tsx': rows(301),
  },
  pass: {
    'src/g03-edge-lines.ts': rows(300),
    'src/g03-edge-bytes.ts': bytes(15000),
    'docs/g03-long.md': '- x\n'.repeat(400),
    'data/g03-long.json': `[\n${'0,\n'.repeat(400)}0\n]\n`,
    'database/g03-long.sql': '-- x\n'.repeat(400),
    'docs/admin-platform/implementation/evidence/g03.js': rows(400),
    'docs/admin-platform/implementation/ui-improvement/evidence/g03.js': rows(400),
    'docs/hq-standard/implementation/evidence/g03.js': rows(400),
    'docs/admin-platform/implementation/fixtures/g03.js': rows(400),
  },
};

const MODULES = ['activity', 'analytics', 'contract', 'customer', 'opportunity', 'order'];
export const g10 = {
  id: 'G10',
  fail: {
    'frontend/src/NewPage.tsx': code,
    'frontend/src/notes.md': '# notes\n',
    'frontend/src/hq-mock/deep/New.tsx': code,
    'frontend/src/hq-mock/Brand.test.tsx': code,
    'frontend/src/demo/demo.ts': code,
    // Letter case does not dodge a frozen folder. (No lower-case twin: some file systems would merge the two.)
    'frontend/src/Market/Templates/T.tsx': code,
    'packages/contracts/src/lead-new.ts': code,
    'packages/contracts/src/Lead-Upper.ts': code,
    'backend/src/customization/x-lead-y.ts': code,
    'frontend/src/customization/MyLeadPanel.tsx': code,
    'frontend/src/customization/lead-x.ts': code,
    'frontend/src/customization/misleading.ts': code,
    'frontend/src/customization/ConfiguredOrders.tsx': code,
    'frontend/src/styles/new.css': 'a { margin: 0; }\n',
    'backend/src/hq-mock/route.ts': code,
    ...Object.fromEntries(MODULES.map(name => [`backend/src/modules/${name}/deep/new-${name}.ts`, code])),
  },
  pass: {
    'frontend/src/hq-mock/Old.tsx': 'export const Old = () => <div id="edited" />;\n',
    'frontend/src/hq-mock/Old.test.tsx': code,
    'frontend/src/hq-mock/Old.spec.tsx': code,
    'backend/src/modules/order/order.service.spec.ts': code,
    'frontend/src/feature/g10-New.tsx': code,
    'frontend/src/hq-mock2/g10.ts': code,
    'frontend/src/customization/g10-OrderScreen.tsx': code,
    'frontend/src/styles/sub/g10.css': 'a { margin: 0; }\n',
    'backend/src/modules/billing/g10.ts': code,
    'packages/contracts/src/g10-order.ts': code,
    'backend/src/customization/g10-order.ts': code,
  },
};
