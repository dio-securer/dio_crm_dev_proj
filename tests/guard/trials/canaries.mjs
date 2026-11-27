// Canaries against self-exemption: the guard must not make an exception for its own code, for its tests, for the crm
// command or for documents. Every rule that looks at a place gets a violating file there, and every zone rule gets one
// in a folder of its zone that merely carries the name of an exempt place (tests/guard, scripts/guard, docs, ...).
// Format: { ruleId: { path: text } }. canaries.test.mjs writes them all at once and compares what the guard reported.
const HEX = '#';
const SKIP = 'skip';
const WORD = String.fromCharCode(0xD55C, 0xAE00);
const big = '/* x */\n'.repeat(301);
const colour = `export const c = '${HEX}0af';\n`;
const off = `it.${SKIP}('a', () => {});\n`;
const code = 'export const a = 1;\n';
const from = spec => `import x from '${spec}';\nexport default x;\n`;
const NAME = 'fetch';
const call = `export const f = (url: string) => ${NAME}(url);\n`;
const branch = "export const f = x => x === 'KR';\n";
const text = `export const label = '${WORD}';\n`;

// The places the guard could be tempted to leave out, with folders below them.
export const OWN = ['tests/guard/', 'tests/guard/trials/', 'scripts/guard/', 'scripts/guard/lib/', 'scripts/guard/rules/', 'scripts/crm/', 'scripts/crm/lib/'];
export const DOCS = ['docs/', 'docs/framework/', 'docs/admin-platform/implementation/'];
// Folder names that are exempt somewhere at the top of the repository and mean nothing inside a zone.
export const INNER = ['tests/guard', 'scripts/guard', 'scripts/crm', 'docs', 'tests', 'backend/test', 'fixtures', 'generated', 'dist', 'vendor'];

const everywhere = (dirs, name, body) => Object.fromEntries(dirs.map(dir => [`${dir}${name}`, body]));
const inner = (zone, name, body) => Object.fromEntries(INNER.map(dir => [`${zone}/${dir}/${name}`, body]));

export const CANARIES = {
  G01: inner('metadata', 'canary.mjs', code),
  G12: inner('metadata', 'canary.json', '{}\n'),
  G02: { ...inner('extensions/acme', 'canary-import.ts', from('zod')), ...inner('packages/engine', 'canary-import.ts', from('@dio-crm/web')) },
  G03: everywhere([...OWN, ...DOCS], 'canary-big.mjs', big),
  G04: { ...inner('extensions/acme', 'canary-text.ts', text), ...inner('packages/engine', 'canary-text.ts', text) },
  G05: everywhere([...OWN, ...DOCS], 'canary-colour.js', colour),
  G06: { ...inner('backend/src', 'canary-branch.js', branch), ...inner('packages/core', 'canary-branch.js', branch) },
  G07: { ...inner('backend/src', 'canary-io.ts', from('mssql')), ...inner('extensions/acme', 'canary-io.ts', call) },
  G08: {
    ...everywhere(OWN, 'canary-off.mjs', off),
    ...everywhere(DOCS, 'canary-off.test.mjs', off),
    ...everywhere(DOCS, 'tests/canary-off.mjs', off),
  },
  G10: inner('frontend/src/hq-mock', 'Canary.tsx', 'export const Canary = () => <i />;\n'),
  G11: inner('backend/src', 'canary-uses-test.ts', from('./anything.spec')),
};
