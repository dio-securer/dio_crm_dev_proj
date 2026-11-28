// Trial fixtures for G06 (branching on a company / country / market value). See index.mjs for the format.
// Every failing file holds exactly one shape, so losing any one shape is noticed.
const f = body => `export const f = (x: any, row: any) => ${body};\n`;
const at = (dir, map) => Object.fromEntries(Object.entries(map).map(([name, text]) => [`${dir}/${name}`, text]));

export const g06 = {
  id: 'G06',
  fail: {
    ...at('backend/src/svc', {
      // (1) a country / market code literal or constant
      'strict.ts': f("x === 'KR'"),
      'reversed.ts': f("'US' !== x"),
      'loose.ts': f('x == "JP"'),
      'loose-not.ts': f('x != `DE`'),
      // spellings that do not change the value: parentheses, casts, `!`, satisfies, joined text
      'parens.ts': f("((x)) === (('KR'))"),
      'cast-as.ts': f("x === ('KR' as string)"),
      'cast-angle.ts': f("x === <string>'KR'"),
      'bang.ts': f("x === 'KR'!"),
      'satisfies.ts': f("x === ('KR' satisfies string)"),
      'joined.ts': f("x === 'K' + 'R'"),
      'named-cast.ts': f("(row.companyCode as string)! === 'acme'"),
      'locale.ts': f("x === 'ko-KR'"),
      'group.ts': f("x === 'APAC'"),
      'const.ts': `const target = 'KR';\n${f('x === target')}`,
      'const-member.ts': `const Home = { code: 'KR' };\n${f('x === Home.code')}`,
      'enum-member.ts': `enum Area { home = 'KR' }\n${f('x === Area.home')}`,
      'code-name.ts': f('x === Market.KR'),
      'code-name-bracket.ts': f("x === Market['KR']"),
      'code-bare.ts': f('x === KR'),
      'case.ts': "export function f(x: string) { switch (x) { case 'KR': return 1; default: return 0; } }\n",
      // (2) a value named company / country / market / tenant / nation against a literal
      'named.ts': f("row.companyCode === 'acme'"),
      'named-bracket.ts': f("row['countryCode'] == 3"),
      'named-negative.ts': f('-1 === row.marketIndex'),
      'named-tenant.ts': f("row.tenantId !== 'a'"),
      'named-nation.ts': f("row.nation === 'x'"),
      'named-chain.ts': f("row.country.trim().toUpperCase() === 'x'"),
      'named-call.ts': f("getCountry() === 'x'"),
      'named-wrapped.ts': f("String(row.market) === '1'"),
      'alias.ts': "export const f = (row: any) => { const c = row.countryCode; return c === 'x'; };\n",
      'alias-destructured.ts': "export const f = (row: any) => { const { marketCode: m } = row; return m === 'x'; };\n",
      // (3) switch and inline lookup tables
      'switch.ts': "export function f(market: string) { switch (market) { case 'a': return 1; default: return 0; } }\n",
      'lookup.ts': 'export const f = (country: string) => ({ a: 1, b: 2 })[country];\n',
      'lookup-in.ts': 'export const f = (country: string) => country in { a: 1 };\n',
      // (4) membership tests
      'includes.ts': f("x.includes('KR')"),
      'list-includes.ts': f("['KR', 'US'].includes(x)"),
      'set-has.ts': f("new Set(['a']).has(row.companyCode)"),
      'regex.ts': f('/KR/.test(x)'),
      'object-is.ts': f("Object.is(x, 'KR')"),
      'some.ts': f("['KR', 'US'].some(code => code === x)"),
      'starts-with.ts': f("x.startsWith('ko-KR')"),
      'index-of.ts': f("x.indexOf('KR')"),
      // A folder that merely looks like a test folder is not exempt.
      '__tests__/helper.ts': f("x === 'KR'"),
    }),
    'frontend/src/feature/branch.tsx': f("x === 'KR'"),
    'packages/engine/src/branch.mjs': "export const f = x => x === 'KR';\n",
    'packages/contracts/src/branch.cjs': "module.exports = x => x === 'KR';\n",
  },
  pass: {
    ...at('backend/src/svc', {
      'g06-variables.ts': f('x.market === row.market && row.companyCode === x.companyCode && x.allowed.includes(row.countryCode)'),
      'g06-other-literal.ts': f("x.direction === 'inbound' && x.status === 'OPEN' && x.code === 'kr' && x.count > 3"),
      'g06-other-names.ts': f("x.marketing === 'a' && x.accompany === 'b'"),
      'g06-text.ts': `// x === 'KR'\n${f('"x === \'KR\'"')}`,
      'g06-branch.spec.ts': f("x === 'KR'"),
    }),
    'backend/test/g06-branch.ts': f("x === 'KR'"),
    'extensions/acme/g06-branch.ts': f("x === 'KR'"),
    'scripts/x/g06-branch.mjs': "export const f = x => x === 'KR';\n",
  },
};
