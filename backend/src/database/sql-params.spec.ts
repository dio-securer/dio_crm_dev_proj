// What reaches the SQL Server driver for dates (F2-4): ISO text of a fixed length, never a Date for the driver to
// guess or to range-check in the machine's time zone. The driver's own validators (tedious) run here on exactly what
// is sent, in three time zones, so a value the driver would refuse (EPARAM) is caught without a database.
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import sql from 'mssql';
import { bindParams, dateParam, dateTimeParam, isTypedParam, paramText } from './sql-params';

// tedious is the driver under mssql; it is resolved from mssql because it is not a dependency of this package.
const tediousPath = require.resolve('tedious', { paths: [require.resolve('mssql')] });
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TYPES } = require(tediousPath) as { TYPES: Record<string, { validate(value: unknown, collation?: unknown): unknown }> };
const typeName = (type: { type: unknown }) => Object.entries(sql.TYPES).find(([, t]) => t === type.type)![0];

function sent(params: Record<string, unknown>) {
  const calls: unknown[][] = [];
  bindParams({ input: (...args: unknown[]) => calls.push(args) }, params, sql);
  return calls;
}
const EDGES = { a: dateTimeParam('1000-01-01T00:00:00.001Z'), b: dateTimeParam('9999-12-31T23:59:59.999Z'), c: dateTimeParam('0001-01-01T00:00:00.000Z'), d: dateTimeParam(null),
  e: dateParam('0001-01-01'), f: dateParam('9999-12-31'), g: dateParam(null), h: dateTimeParam(new Date('2026-11-28T01:02:03.004Z')), i: dateTimeParam('1969-12-31T23:59:59.999Z') };
const EDGE_TEXT = ['1000-01-01T00:00:00.001', '9999-12-31T23:59:59.999', '0001-01-01T00:00:00.000', null, '0001-01-01', '9999-12-31', null, '2026-11-28T01:02:03.004', '1969-12-31T23:59:59.999'];

describe('typed SQL parameters', () => {
  it('binds a date-time as 23 characters of ISO text and a date as 10, exact to the millisecond, nulls typed too', () => {
    const calls = sent(EDGES) as [string, { type: unknown; length: number }, string | null][];
    expect(calls.map(c => c[0])).toEqual(Object.keys(EDGES));
    expect(calls.map(c => c[2])).toEqual(EDGE_TEXT);
    expect(calls.map(c => `${typeName(c[1])}(${c[1].length})`)).toEqual(['a', 'b', 'c', 'd'].map(() => 'NVarChar(23)').concat(['NVarChar(10)', 'NVarChar(10)', 'NVarChar(10)', 'NVarChar(23)', 'NVarChar(23)']));
    for (const [, , value] of calls) expect(value === null || typeof value === 'string').toBe(true);
  });

  it('passes the driver\'s own validators with exactly what is sent, and comes back unchanged', () => {
    for (const [, type, value] of sent(EDGES) as [string, { type: unknown }, string | null][]) {
      expect(TYPES[typeName(type)].validate(value, undefined)).toBe(value);
    }
  });

  it('is the same in every time zone, where the driver\'s Date validators are not', () => {
    // A child process per zone: the zone of a running process cannot be changed reliably. It binds the edge values
    // through the real sql-params and runs the real validators; then shows the old binding (a Date with DATETIME2 / DATE) failing.
    const code = `
      const { bindParams, dateTimeParam, dateParam } = require(${JSON.stringify(path.join(__dirname, 'sql-params.ts'))});
      const { TYPES } = require(${JSON.stringify(tediousPath)});
      const types = { NVarChar: length => ({ name: 'NVarChar', length }) };
      const out = { sent: [], old: [] };
      const edges = { b: dateTimeParam('9999-12-31T23:59:59.999Z'), c: dateTimeParam('0001-01-01T00:00:00.000Z'), e: dateParam('0001-01-01'), f: dateParam('9999-12-31') };
      bindParams({ input: (name, type, value) => out.sent.push(TYPES[type.name].validate(value)) }, edges, types);
      for (const p of Object.values(edges)) { try { TYPES[p.sqlParam === 'date' ? 'Date' : 'DateTime2'].validate(p.value); out.old.push('ok'); } catch (e) { out.old.push(e.message); } }
      console.log(JSON.stringify(out));`;
    const run = (zone: string) => JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '-e', code], { encoding: 'utf8', env: { ...process.env, TZ: zone } }));
    const text = ['9999-12-31T23:59:59.999', '0001-01-01T00:00:00.000', '0001-01-01', '9999-12-31'];
    expect(run('Asia/Seoul')).toEqual({ sent: text, old: ['Out of range.', 'ok', 'ok', 'ok'] });
    expect(run('UTC')).toEqual({ sent: text, old: ['ok', 'ok', 'ok', 'ok'] });
    expect(run('America/Los_Angeles')).toEqual({ sent: text, old: ['ok', 'Out of range.', 'Out of range.', 'ok'] });
  });

  it('leaves every other value to the driver as before, and refuses a date that is not one or is outside 0001-9999', () => {
    const d = new Date(0);
    expect(sent({ a: 'x', b: 1, c: null, d, e: { sqlParam: 'other', value: 1 } })).toEqual([['a', 'x'], ['b', 1], ['c', null], ['d', d], ['e', { sqlParam: 'other', value: 1 }]]);
    expect(isTypedParam(d)).toBe(false);
    expect(() => dateTimeParam('not a date')).toThrow('SQL_PARAM_BAD_DATE');
    expect(() => dateParam('2026-13-45')).toThrow('SQL_PARAM_BAD_DATE');
    for (const iso of ['+010000-01-01T00:00:00.000Z', '0000-12-31T23:59:59.999Z', '-000001-01-01T00:00:00.000Z']) {
      expect(() => paramText(dateTimeParam(iso))).toThrow('SQL_PARAM_BAD_DATE');
      expect(() => sent({ a: { sqlParam: 'date', value: new Date(iso) } })).toThrow('SQL_PARAM_BAD_DATE');
    }
  });
});
