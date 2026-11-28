// Trial fixtures for G07 (database or network touched outside the infrastructure folders). See index.mjs for the format.
// Every failing file holds exactly one shape, so losing any one shape is noticed.
const at = (dir, map) => Object.fromEntries(Object.entries(map).map(([name, text]) => [`${dir}/${name}`, text]));
const from = spec => `import x from '${spec}';\nexport default x;\n`;
const f = body => `export const f = (url: string, repo: any) => ${body};\n`;
const NET = 'fetch';
const GLOBALS = ['window', 'globalThis', 'self', 'global', 'top', 'parent', 'frames', 'opener', 'document'];

export const g07 = {
  id: 'G07',
  fail: {
    ...at('backend/src/svc', {
      // (1) drivers, ORMs and network modules, however they are imported
      'driver.ts': from('mssql'),
      'driver-sub.ts': from('mysql2/promise'),
      'driver-require.ts': "const { Pool } = require('pg');\nexport default Pool;\n",
      'driver-equals.ts': "import knex = require('knex');\nexport default knex;\n",
      'driver-type.ts': "import type { DataSource } from 'typeorm';\nexport type D = DataSource;\n",
      'driver-lazy.ts': "export const load = () => import('mongoose');\n",
      'driver-scope.ts': from('@prisma/extension-x'),
      'driver-scope2.ts': from('@mikro-orm/postgresql'),
      'net-node.ts': from('node:https'),
      'net-plain.ts': from('net'),
      'net-library.ts': from('undici'),
      // (3) http(s).request / get without an import
      'http-call.ts': 'export const f = (http: any) => http.request({});\n',
      'https-call.ts': "export const f = (https: any) => https['get']('x');\n",
      // (4) what cannot be verified
      'computed-require.ts': 'export const f = (name: string) => require(name);\n',
      'computed-global.ts': 'export const f = (name: string) => globalThis[name];\n',
      'eval.ts': 'export const f = (s: string) => eval(s);\n',
      'function.ts': 'export const f = (s: string) => new Function(s);\n',
      // A folder that merely looks like a test folder, or sits next to an allowed one, is not exempt.
      'e2e/call.ts': f(`${NET}(url)`),
    }),
    'backend/src/database-tools/pool.ts': from('mssql'),
    'backend/src/integrations/erp.ts': from('axios'),
    ...at('frontend/src/feature', {
      // (2) the global network names
      'call.tsx': f(`${NET}(url)`),
      'window-chain.ts': f(`window.top.${NET}(url)`),
      'bracket.ts': f(`globalThis['${NET}'](url)`),
      'bracket-own.ts': f(`repo['${NET}'](url)`),
      'destructured.ts': `export const f = () => { const { ${NET}: go } = window; return go; };\n`,
      'value.ts': `export const go = ${NET};\n`,
      'alias.ts': `const w = window;\n${f(`w.${NET}(url)`)}`,
      'reflect.ts': f(`Reflect.get(window, '${NET}')`),
      'xhr.ts': 'export const f = () => new XMLHttpRequest();\n',
      'beacon.ts': f('navigator.sendBeacon(url)'),
      'socket.ts': f('new WebSocket(url)'),
      'events.ts': f('new EventSource(url)'),
      'library-name.ts': f('axios.get(url)'),
    }),
    // `.fetch` taken from any object through which a global can be reached
    ...Object.fromEntries(GLOBALS.map(name => [`frontend/src/feature/globals/${name}.ts`, f(`${name}.${NET}(url)`)])),
    'frontend/src/feature/globals/view.ts': f(`document.defaultView.${NET}(url)`),
    'frontend/src/admin/clients/call.ts': f(`${NET}(url)`),
    'frontend/public/worker.js': `self.${NET}('/x');\n`,
    'packages/engine/src/call.ts': f(`${NET}(url)`),
    'extensions/acme/call.mjs': `export const f = url => ${NET}(url);\n`,
  },
  // A computed require is unverifiable for every rule that reads imports.
  overlap: ['backend/src/svc/computed-require.ts'],
  pass: {
    'backend/src/database/g07-pool.ts': from('mssql'),
    'backend/src/integration/g07-erp.ts': `import axios from 'axios';\nexport const f = (url: string) => axios.get(url) ?? ${NET}(url);\n`,
    'frontend/src/admin/client/g07-http.ts': f(`${NET}(url)`),
    ...at('backend/src/svc', {
      'g07-own-method.ts': f(`repo.${NET}(url)`),
      'g07-member-name.ts': `export const o = { ${NET}: 1 };\nexport interface I { ${NET}(): void }\n`,
      'g07-text.ts': `// ${NET}(url)\nexport const s = "${NET}(url) and require('pg')";\n`,
      'g07-harmless.ts': "import fs from 'node:fs';\nimport local from './http';\nimport lodash from 'lodash';\nexport default [fs, local, lodash];\n",
      'g07-call.spec.ts': `import pg from 'pg';\nexport const f = (url: string) => ${NET}(url) ?? pg;\n`,
    }),
    'backend/test/g07-call.ts': f(`${NET}(url)`),
    'scripts/x/g07-call.mjs': `export const f = url => ${NET}(url);\n`,
    'tests/g07-call.mjs': `export const f = url => ${NET}(url);\n`,
  },
};
