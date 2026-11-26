// Trial fixtures made from the pinned lists (tests/guard/pins.json), one finding per member: when a rule loses a member
// of a list (a country code, a driver name, a file extension, a scope folder), the fixture of that member is no longer
// reported and the trial fails. The lists are read from the snapshot, never from the code under test.
// Format: see index.mjs. `each(list, line)` is one file with one line per member, which must give exactly that many findings.
import { pinned } from '../pins.mjs';

const lib = (file, name) => pinned(`scripts/guard/lib/${file}.mjs`, name);
const rule = (file, name) => pinned(`scripts/guard/rules/${file}.mjs`, name);
const each = (list, line) => [`${list.map(line).join('\n')}\n`, list.length];
const at = (dir, map) => Object.fromEntries(Object.entries(map).map(([name, text]) => [`${dir}/${name}`, text]));
const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
const from = spec => `import x from '${spec}';\nexport default x;\n`;
const bare = dir => dir.replace(/\/$/, '');

export const CODE_EXT = lib('files', 'CODE_EXT');
/** The same violation in a file of every code extension. The text must be plain JavaScript. */
const byExt = (stem, text) => Object.fromEntries(CODE_EXT.map(ext => [`${stem}${ext}`, text]));
/** A violating file directly under every scope folder of a rule, in a folder that exists nowhere else. */
const byScope = (scopes, name, text) => Object.fromEntries(scopes.map(scope => [`${scope}scope-trial/${name}`, text]));

// Source text of the operators and of the syntax that `unwrap` looks through. A member without an entry fails the meta test.
export const SYNTAX = {
  EqualsEqualsEqualsToken: '===', ExclamationEqualsEqualsToken: '!==', EqualsEqualsToken: '==', ExclamationEqualsToken: '!=',
  QuestionQuestionToken: '??', BarBarToken: '||', AmpersandAmpersandToken: '&&', PlusToken: '+',
  EqualsToken: '=', BarBarEqualsToken: '||=', QuestionQuestionEqualsToken: '??=', AmpersandAmpersandEqualsToken: '&&=',
};
export const WRAPPED = {
  ParenthesizedExpression: "('KR')", AsExpression: "'KR' as string", TypeAssertionExpression: "<string>'KR'", NonNullExpression: "'KR'!",
  SatisfiesExpression: "'KR' satisfies string", AwaitExpression: "(await 'KR')",
  PartiallyEmittedExpression: null, // made by the compiler only, it cannot be written in a source file
};
export const UNWRAP_KINDS = lib('ts', 'UNWRAP_KINDS');
export const KEY_WORDS = ['company', 'country', 'market', 'tenant', 'nation'];
const capital = word => word[0].toUpperCase() + word.slice(1);
const upper = word => word.toUpperCase();
export const keyPattern = `(?:(?<![A-Za-z])(?:${KEY_WORDS.join('|')})|${KEY_WORDS.map(capital).join('|')}|${KEY_WORDS.map(upper).join('|')})(?!ing)`;
const KEY_NAMES = KEY_WORDS.flatMap(word => [`${word}Code`, `actor${capital(word)}`, `${word.toUpperCase()}_ID`, `x_${word}`, `${capital(word)}`]);

const G06_SCOPE = rule('g06-company-branching', 'SCOPE');
const branch = "export const f = x => x === 'KR';\n";
export const g06 = {
  fail: {
    ...at('backend/src/svc/members', {
      ...Object.fromEntries(chunks(lib('branching', 'ISO'), 90)
        .map((list, n) => [`iso-${n}.ts`, each(list, (code, i) => `export const a${i} = (x: any) => x === '${code}';`)])),
      'key-names.ts': each(KEY_NAMES, (name, i) => `export const a${i} = (row: any) => row.${name} === 'a';`),
      'same-value.ts': each(lib('branching', 'SAME_VALUE'), (name, i) => `export const a${i} = (row: any) => row.country.${name} === 'a';`),
      'tests.ts': each(lib('branching', 'TESTS'), (name, i) => `export const a${i} = (x: any) => x.${name}('KR');`),
      'loops.ts': each(lib('branching', 'LOOPS'), (name, i) => `export const a${i} = (x: any) => ['KR', 'US'].${name}((code: string) => code === x);`),
      'equality.ts': each(lib('branching', 'EQUALITY'), (op, i) => `export const a${i} = (x: any) => x ${SYNTAX[op]} 'KR';`),
      'either.ts': each(lib('branching', 'EITHER'), (op, i) => `export const a${i} = (x: any, row: any) => (row.country ${SYNTAX[op]} x) === 'a';`),
      'unwrap.ts': each(UNWRAP_KINDS.filter(kind => WRAPPED[kind]), (kind, i) => `export const a${i} = async (x: any) => x === ${WRAPPED[kind]};`),
    }),
    ...byExt('backend/src/svc/ext/branch', branch),
    ...byScope(G06_SCOPE, 'branch.ts', branch),
  },
};

const G07_ALLOWED = rule('g07-direct-io', 'ALLOWED').map(([prefix]) => prefix);
const NET = rule('g07-direct-io', 'NET');
const HTTP = lib('io', 'HTTP_OBJECTS').flatMap(owner => lib('io', 'HTTP_CALLS').map(call => [owner, call]));
const NAME = 'fetch';
const call = `export const f = url => ${NAME}(url);\n`;
export const g07 = {
  fail: {
    ...at('backend/src/svc/members', {
      'db.ts': each(rule('g07-direct-io', 'DB'), (name, i) => `import a${i} from '${name}';`),
      'db-scopes.ts': each(rule('g07-direct-io', 'DB_SCOPES'), (scope, i) => `import a${i} from '${scope}anything';`),
      'net.ts': each(NET, (name, i) => `import a${i} from '${name}';`),
      'net-node.ts': each(NET, (name, i) => `import a${i} from 'node:${name}/sub';`),
      'io-names.ts': each(lib('io', 'IO_NAMES'), (name, i) => `export const a${i} = ${name};`),
      'io-bracket.ts': each(lib('io', 'IO_NAMES'), (name, i) => `export const a${i} = (repo: any) => repo['${name}'];`),
      'io-key.ts': each(lib('io', 'IO_NAMES'), (name, i) => `export const a${i} = (w: any) => { const { '${name}': go } = w; return go; };`),
      'globals.ts': each(lib('io', 'GLOBAL_OBJECTS'), (name, i) => `export const a${i} = (url: string) => ${name}.${NAME}(url);`),
      'computed.ts': each(lib('io', 'COMPUTED_ON'), (name, i) => `export const a${i} = (key: string) => ${name}[key];`),
      'http.ts': each(HTTP, ([owner, method], i) => `export const a${i} = (${owner}: any) => ${owner}.${method}({});`),
      'text-runners.ts': each(Object.values(lib('io', 'TEXT_RUNNERS')), (name, i) => `export const a${i} = (s: string) => ${name}(s);`),
    }),
    ...byExt('backend/src/svc/ext/io', from('mssql')),
    ...byScope(rule('g07-direct-io', 'SCOPE'), 'io.js', call),
    // An allowed folder is that exact path from the top of the repository: not a folder of the same name deeper down,
    // and not a neighbour whose name merely starts the same way.
    ...Object.fromEntries(G07_ALLOWED.map(prefix => [`packages/nest/${prefix}${prefix.endsWith('/') ? 'io.js' : ''}`, call])),
    ...Object.fromEntries(G07_ALLOWED.map(prefix => [`${bare(prefix)}x/io.js`, call])),
  },
  pass: Object.fromEntries(G07_ALLOWED.filter(prefix => prefix.endsWith('/')).map(prefix => [`${prefix}deep/er/g07-members.js`, call])),
};

const SKIP = 'skip';
const body = "'a', () => {}";
const MODES = rule('g08-disabled-tests', 'MODES');
const OFF_NAMES = rule('g08-disabled-tests', 'OFF_NAMES');
const MODE_VALUES = rule('g08-disabled-tests', 'RUNNERS').flatMap(runner => MODES.map(mode => `${runner}.${mode}`));
// Folders that look like a test folder (G08 and P3 look into them wherever they are). Tied to the pinned pattern by the meta test.
export const TESTISH = ['__tests__', 'test', 'tests', 'e2e', 'spec', 'specs', '__mocks__'];
export const NOT_TESTISH = ['testing', 'latest', 'e2e2', 'specification', 'mocks', 'my-tests', 'tests2'];
// Option values that leave a test ON are only: false, null, undefined, 0, '', void 0. Everything else counts.
const ON_VALUES = ['1', '2', "' '", "'no'", "'false'", '-0', 'NaN', '[]', '{}', '!0', 'true', '0n', '`x`', '0.5'];
const mode = `it.${SKIP}(${body});\n`;
export const g08 = {
  fail: {
    ...at('tests/unit/members', {
      'modes.test.mjs': each(MODE_VALUES, (value, i) => `export const a${i} = ${value};`),
      'mode-calls.test.mjs': each(MODES, (name, i) => `anything${i}.${name}(${body});`),
      'off-names.test.mjs': each(OFF_NAMES, name => `${name}(${body});`),
      'off-global-names.test.mjs': each(OFF_NAMES, name => `globalThis.${name}(${body});`),
      'off-globals.test.mjs': each(rule('g08-disabled-tests', 'GLOBALS'), name => `${name}.${OFF_NAMES[0]}(${body});`),
      'option-keys.test.mjs': each(rule('g08-disabled-tests', 'OPTION_KEYS'), key => `test('a', { ${key}: true }, () => {});`),
      'option-methods.test.mjs': each(rule('g08-disabled-tests', 'OPTION_KEYS'), key => `test('a', { ${key}() { return true; } }, () => {});`),
      'assign.test.mjs': each(rule('g08-disabled-tests', 'ASSIGN'), (op, i) => `export const a${i} = (o, flag) => { o.${SKIP} ${SYNTAX[op]} flag; };`),
      'setters.test.mjs': each(rule('g08-disabled-tests', 'SETTERS'), (name, i) => `export const a${i} = o => Anything.${name}(o, '${SKIP}', true);`),
      'on-values.test.mjs': each(ON_VALUES, value => `test('a', { ${SKIP}: ${value} }, () => {});`),
    }),
    ...byExt('tests/unit/ext/mode.test', mode),
    ...Object.fromEntries(TESTISH.flatMap(dir => [[`${dir}/top/mode.js`, mode], [`any/where/${dir}/mode.js`, mode]])),
    'Any/E2E/upper.js': mode,
  },
  pass: Object.fromEntries(NOT_TESTISH.map(dir => [`any/${dir}/g08-mode.js`, mode])),
};

const G02 = name => rule('g02-zone-boundaries', name);
// Legacy contract files of the sandbox (sandbox.mjs), one per source suffix that an import may leave out.
export const LEGACY_CONTRACTS = ['lead-grid.ts', 'lead-view.tsx', 'lead-tool.js', 'lead-part.jsx', 'lead-mod.mjs', 'lead-old.cjs'];
export const g02 = {
  fail: {
    ...byExt('extensions/acme/ext/pkg', from('zod')),
    'extensions/acme/members/test-only.ts': each(G02('EXT_TEST_EXACT'), (spec, i) => `import a${i} from '${spec}';`),
    ...at('packages/engine/src/members', {
      'packages.ts': each(G02('ENGINE_FORBIDDEN_PACKAGES'), (name, i) => `import a${i} from '${name}/src/x';`),
      'packages-bare.ts': each(G02('ENGINE_FORBIDDEN_PACKAGES'), (name, i) => `import a${i} from '${name}';`),
      'prefixes.ts': each(G02('ENGINE_FORBIDDEN_PREFIX'), (prefix, i) => `import a${i} from '${prefix}x';`),
      'prefixes-upper.ts': each(G02('ENGINE_FORBIDDEN_PREFIX'), (prefix, i) => `import a${i} from '${prefix.toUpperCase()}x';`),
      'legacy.ts': each(LEGACY_CONTRACTS, (name, i) => `import a${i} from '${G02('CONTRACTS')}${name.replace(/\.\w+$/, '')}';`),
      'legacy-src.ts': each(LEGACY_CONTRACTS, (name, i) => `import a${i} from '${G02('CONTRACTS')}src/${name}';`),
    }),
  },
  pass: {
    'extensions/acme/g02-members.test.ts': each(G02('EXT_TEST_EXACT'), (spec, i) => `import a${i} from '${spec}';`)[0],
    'extensions/acme/g02-members.ts':
      each([...G02('EXT_EXACT'), ...G02('EXT_ALLOWED'), `${G02('EXT_ALLOWED')[0]}/sub`], (spec, i) => `import a${i} from '${spec}';`)[0],
  },
};

export const g11 = {
  fail: {
    ...byExt('backend/src/svc/ext/spec', from('./gateway.spec')),
    ...byScope(rule('g11-no-test-imports', 'SCOPE'), 'spec.js', from('./gateway.spec')),
    ...Object.fromEntries(lib('files', 'TEST_ROOTS').map((dir, i) => [`backend/src/svc/members/root-${i}.ts`, from(`../../../../${dir}helper`)])),
  },
};

export const g03 = {
  fail: {
    ...Object.fromEntries([...CODE_EXT, ...lib('files', 'STYLE_EXT')].map(ext => [`sizes/lines${ext}`, '/* x */\n'.repeat(301)])),
    ...Object.fromEntries(rule('g03-file-size', 'METADATA_EXT').map(ext => [`metadata/sizes/bytes${ext}`, `"a${'b'.repeat(15000)}"\n`])),
  },
  // The excluded folders are these exact paths: the same path below another folder is checked like everything else.
  lookalikes: Object.fromEntries(rule('g03-file-size', 'EXCLUDED_DIRS').map(([dir]) => [`any/${dir}big.js`, '// x\n'.repeat(301)])),
};

export const g05 = {
  fail: Object.fromEntries(rule('g05-raw-style', 'EXT').map(ext => [`ui/ext/colour${ext}`, `/* ${'#'}0af */\n`])),
  // Only that one file defines colours: not a file at the same path below another folder.
  lookalikes: Object.fromEntries(rule('g05-raw-style', 'TOKEN_SOURCES').map(file => [`any/${file}`, `a { color: ${'#'}0af; }\n`])),
};
