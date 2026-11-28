// The real-database scripts (scripts/meta-db) that can be checked without a database: the synthetic company id is
// always negative, and every parameter of a script transaction goes through the backend's typed binding.
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

const dir = path.resolve(__dirname, '../../../scripts/meta-db');
function run(code: string): any {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: dir, encoding: 'utf8' });
  return JSON.parse(out);
}

describe('scripts/meta-db', () => {
  it('accepts only a negative company id for the engine API check, default -4242', () => {
    const tried = ['', '  ', '-4242', '-1', '-2147483647', '0', '1', '4242', '-0', '-2147483648', '-1.5', 'abc', '-1e3', '- 5', '--5', '-99999999999'];
    const result = run(`import { checkCompanyId } from './settings.mjs';
      const out = {}; for (const raw of ${JSON.stringify(tried)}) { try { out[raw] = checkCompanyId({ CRM_ENGINE_CHECK_COMPANY_ID: raw }); } catch (e) { out[raw] = e.message.includes('negative') ? 'refused' : e.message; } }
      out.unset = checkCompanyId({});
      console.log(JSON.stringify(out));`);
    expect(result).toEqual({ '': -4242, '  ': -4242, '-4242': -4242, '-1': -1, '-2147483647': -2147483647, unset: -4242,
      '0': 'refused', '1': 'refused', '4242': 'refused', '-0': 'refused', '-2147483648': 'refused', '-1.5': 'refused', abc: 'refused', '-1e3': 'refused', '- 5': 'refused', '--5': 'refused', '-99999999999': 'refused' });
  });

  it('binds every parameter of a script transaction through the given bindParams, and refuses to run without it', () => {
    const result = run(`import { transactional } from './db.mjs';
      const calls = [], log = [];
      const sql = { Transaction: class { async begin() { log.push('begin'); } async commit() { log.push('commit'); } async rollback() { log.push('rollback'); } },
        Request: class { async query(text) { log.push(text); return { recordset: [] }; } } };
      const bind = (req, params, types) => calls.push({ isRequest: req instanceof sql.Request, params, sameSql: types === sql });
      await transactional(sql, {}, bind).transaction(q => q('SELECT 1', { a: 1 }));
      let refused = ''; try { transactional(sql, {}); } catch (e) { refused = e.message; }
      console.log(JSON.stringify({ calls, log, refused }));`);
    expect(result).toEqual({ calls: [{ isRequest: true, params: { a: 1 }, sameSql: true }], log: ['begin', 'SELECT 1', 'commit'], refused: 'transactional needs the backend bindParams' });
  });

  it('records a failed step with its code, its message and the driver\'s own message, never the password', () => {
    const result = run(`import { errorLine } from './db.mjs';
      import { secretsOf } from './settings.mjs';
      const wrapped = Object.assign(new Error('Validation failed for parameter \\'p0\\'. Out of range.'), { code: 'EPARAM', originalError: new TypeError('Out of range.\\n  at somewhere') });
      const login = Object.assign(new Error('Login failed with hunter2-pw'), { code: 'ELOGIN', originalError: Object.assign(new Error('inner hunter2-pw'), { cause: new Error('root cause') }) });
      console.log(JSON.stringify({
        wrapped: errorLine(wrapped),
        same: errorLine(Object.assign(new Error('boom'), { originalError: new Error('boom') })),
        extra: errorLine(Object.assign(new Error('bad'), { code: 'INVALID_RECORD' }), ' [1]'),
        login: errorLine(login, '', secretsOf({ password: 'hunter2-pw' })),
        ntlm: secretsOf({ authentication: { options: { password: 'pw-ntlm' } } }), none: secretsOf({ connectionString: 'x' }),
        long: errorLine(new Error('x'.repeat(1000))).length, plain: errorLine('text'), empty: errorLine(null),
      }));`);
    expect(result).toEqual({
      wrapped: "EPARAM | Validation failed for parameter 'p0'. Out of range. | Out of range.",
      same: 'boom', extra: 'INVALID_RECORD [1] | bad',
      login: 'ELOGIN | Login failed with *** | inner *** | root cause',
      ntlm: ['pw-ntlm'], none: [], long: 300, plain: 'text', empty: 'null',
    });
  });
});
