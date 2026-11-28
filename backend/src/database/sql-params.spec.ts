// What reaches the SQL Server driver for dates (F2-4): an explicit DATETIME2(3) / DATE type, never the driver's guess.
import sql from 'mssql';
import { bindParams, dateParam, dateTimeParam, isTypedParam } from './sql-params';

function sent(params: Record<string, unknown>) {
  const calls: unknown[][] = [];
  bindParams({ input: (...args: unknown[]) => calls.push(args) }, params, sql);
  return calls;
}

describe('typed SQL parameters', () => {
  it('binds a date-time as DATETIME2(3) with the exact instant, for any year and millisecond', () => {
    const [[name, type, value]] = sent({ at: dateTimeParam('1000-01-01T00:00:00.001Z') }) as [[string, any, Date]];
    expect(name).toBe('at');
    expect(type.type).toBe(sql.DateTime2);
    expect(type.scale).toBe(3);
    expect(value.toISOString()).toBe('1000-01-01T00:00:00.001Z');
    expect((sent({ at: dateTimeParam(new Date('2026-11-28T01:02:03.004Z')) })[0][2] as Date).getTime()).toBe(Date.parse('2026-11-28T01:02:03.004Z'));
  });

  it('binds a date as DATE at UTC midnight, and typed nulls keep their type', () => {
    const [[, type, value], [, nullType, nullValue], [, dt, none]] = sent({ d: dateParam('0001-01-01'), n: dateParam(null), t: dateTimeParam(undefined) }) as [string, any, Date | null][];
    expect(type).toBe(sql.Date);
    expect(value!.toISOString()).toBe('0001-01-01T00:00:00.000Z');
    expect([nullType, nullValue]).toEqual([sql.Date, null]);
    expect(dt.type).toBe(sql.DateTime2);
    expect(none).toBeNull();
  });

  it('leaves every other value to the driver as before, and refuses a date that is not one', () => {
    const d = new Date(0);
    expect(sent({ a: 'x', b: 1, c: null, d, e: { sqlParam: 'other', value: 1 } })).toEqual([['a', 'x'], ['b', 1], ['c', null], ['d', d], ['e', { sqlParam: 'other', value: 1 }]]);
    expect(isTypedParam(d)).toBe(false);
    expect(() => dateTimeParam('not a date')).toThrow('SQL_PARAM_BAD_DATE');
    expect(() => dateParam('2026-13-45')).toThrow('SQL_PARAM_BAD_DATE');
  });
});
