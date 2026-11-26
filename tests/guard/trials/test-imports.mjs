// Trial fixtures for G11 (code that is not a test loading a test file). See index.mjs for the format.
// Every failing file holds exactly one shape, so losing any one shape is noticed.
const at = (dir, map) => Object.fromEntries(Object.entries(map).map(([name, text]) => [`${dir}/${name}`, text]));
const from = spec => `import x from '${spec}';\nexport default x;\n`;

export const g11 = {
  id: 'G11',
  fail: {
    ...at('backend/src/svc', {
      'spec.ts': from('./gateway.spec'),
      'test-ext.ts': from('./gateway.test.ts'),
      'upper.ts': from('./Gateway.SPEC.ts'),
      'query.ts': from('./gateway.spec?raw'),
      'require.ts': "const helper = require('../helpers/make.spec.js');\nexport default helper;\n",
      'reexport.ts': "export * from './gateway.spec';\n",
      'lazy.ts': "export const load = () => import('./gateway.test');\n",
      'glob.ts': "export const all = import.meta.glob('./**/*.spec.*');\n",
      'glob-list.ts': "export const all = import.meta.glob(['./a.ts', './b.test.{ts,tsx}']);\n",
      'url.ts': "export const worker = new URL('./worker.test.js', import.meta.url);\n",
      'alias.ts': from('@/svc/gateway.spec'),
      'test-root.ts': from('../../test/helper'),
      'test-root-package.ts': from('@dio-crm/api/test/helper'),
      'computed.ts': 'export const load = (name: string) => import(name);\n',
    }),
    'frontend/src/feature/tests-root.ts': from('../../../tests/admin/helper'),
    'packages/engine/src/spec.ts': from('./engine.spec'),
    'extensions/acme/spec.ts': from('./gateway.spec'),
  },
  // A computed import is unverifiable for every rule that reads imports.
  overlap: ['backend/src/svc/computed.ts'],
  pass: {
    ...at('backend/src/svc', {
      'g11-shared.spec.ts': "import a from './gateway.spec';\nimport b from '../../test/helper';\nexport default [a, b];\n",
      'g11-names.ts': "import a from './inspector';\nimport b from './spec';\nimport c from './test-utils';\nimport d from './latest';\n"
        + "import e from './my.testing';\nimport f from './contest/protest';\nexport default [a, b, c, d, e, f];\n",
      'g11-text.ts': "// import x from './gateway.spec';\nexport const s = \"require('./gateway.spec')\";\n",
    }),
    'backend/test/g11-util.ts': from('./gateway.spec'),
    'scripts/x/g11-run.mjs': "import '../../tests/sample.test.mjs';\n",
  },
};
