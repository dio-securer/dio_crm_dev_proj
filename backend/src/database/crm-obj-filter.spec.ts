// A list view's filter and sort as SQL (F2-5): fixed statements, values only as parameters, identifiers only from fields.
import type { FieldDef } from '@dio-crm/contracts/metadata';
import { Condition, FilterError, MAX_FILTER_VALUES, conditionSql, orderBySql } from './crm-obj-filter';
import { listStatement } from './crm-obj-sql';

const field = (key: string, type = 'text', more: Partial<FieldDef> = {}): FieldDef =>
  ({ key, type, labelKey: 'x', required: false, system: false, aliases: [], ...more } as FieldDef);
const lead = { key: 'lead', columns: { phone_number: 'f_phone' }, fields: [field('name'), field('status', 'enum'), field('score', 'integer'), field('vip', 'boolean'), field('met_at', 'datetime'),
  field('opened_on', 'date'), field('phone_number', 'text', { aliases: ['phone'] }), field('account', 'reference'), field('updated_at', 'datetime', { system: true })] };
function sql(condition: Condition) {
  const values: unknown[] = [];
  const text = conditionSql(condition, lead, { add: v => { values.push(v); return `@v${values.length - 1}`; } });
  return { text, values };
}
const EVIL = ["' OR 1=1 --", ']; DROP TABLE crm_obj_lead; --', "x') UNION SELECT 1 --"];

describe('list view filter as SQL', () => {
  it('writes every operator as a two-valued condition with parameters', () => {
    expect(sql({ op: 'eq', field: 'status', value: 'NEW' })).toEqual({ text: '([f_status] IS NOT NULL AND [f_status] = @v0)', values: ['NEW'] });
    expect(sql({ op: 'eq', field: 'status', value: null }).text).toBe('([f_status] IS NULL)');
    expect(sql({ op: 'ne', field: 'status', value: 'NEW' })).toEqual({ text: '([f_status] IS NULL OR [f_status] <> @v0)', values: ['NEW'] });
    expect(sql({ op: 'ne', field: 'status' }).text).toBe('([f_status] IS NOT NULL)');
    expect(sql({ op: 'in', field: 'score', value: [1, 2] })).toEqual({ text: '([f_score] IS NOT NULL AND [f_score] IN (@v0, @v1))', values: [1, 2] });
    expect(sql({ op: 'isEmpty', field: 'name' })).toEqual({ text: '([f_name] IS NULL OR [f_name] = @v0)', values: [''] });
    expect(sql({ op: 'isEmpty', field: 'score' })).toEqual({ text: '([f_score] IS NULL)', values: [] });
    expect(['gt', 'gte', 'lt', 'lte'].map(op => sql({ op, field: 'score', value: 5 } as Condition).text))
      .toEqual(['>', '>=', '<', '<='].map(c => `([f_score] IS NOT NULL AND [f_score] ${c} @v0)`));
    expect(sql({ op: 'eq', field: 'vip', value: true }).values).toEqual([true]);
  });

  it('nests all / any / not with brackets, and numbers the parameters in order', () => {
    const c: Condition = { op: 'all', args: [{ op: 'not', arg: { op: 'isEmpty', field: 'name' } }, { op: 'any', args: [{ op: 'eq', field: 'status', value: 'A' }, { op: 'gte', field: 'score', value: 3 }] }] };
    expect(sql(c)).toEqual({ text: '((NOT ([f_name] IS NULL OR [f_name] = @v0)) AND (([f_status] IS NOT NULL AND [f_status] = @v1) OR ([f_score] IS NOT NULL AND [f_score] >= @v2)))', values: ['', 'A', 3] });
  });

  it('sends dates with their SQL type, reads a field by its alias, and uses the recorded column and managed columns', () => {
    expect(sql({ op: 'gte', field: 'met_at', value: '2026-01-01T00:00:00Z' }).values).toEqual([{ sqlParam: 'datetime2', value: new Date('2026-01-01T00:00:00Z') }]);
    expect(sql({ op: 'eq', field: 'opened_on', value: '2026-01-02' }).values).toEqual([{ sqlParam: 'date', value: new Date('2026-01-02T00:00:00Z') }]);
    expect(sql({ op: 'eq', field: 'phone', value: '1' }).text).toBe('([f_phone] IS NOT NULL AND [f_phone] = @v0)');
    expect(sql({ op: 'lt', field: 'updated_at', value: '2026-01-01T00:00:00Z' }).text).toBe('([updated_at] IS NOT NULL AND [updated_at] < @v0)');
  });

  it('keeps hostile values out of the SQL text and refuses hostile or unknown field names', () => {
    for (const evil of EVIL) {
      const s = sql({ op: 'any', args: [{ op: 'eq', field: 'name', value: evil }, { op: 'in', field: 'status', value: [evil] }] });
      expect(s.text).not.toContain(evil);
      expect(s.values).toEqual([evil, evil]);
      expect(() => sql({ op: 'eq', field: evil, value: 'x' })).toThrow(FilterError);
      expect(() => orderBySql([{ field: evil, direction: 'ASC' }], lead)).toThrow(FilterError);
    }
    expect(() => orderBySql([{ field: 'name', direction: 'ASC; DROP TABLE x' as 'ASC' }], lead)).toThrow('CRM_OBJ_BAD_FILTER');
  });

  it('refuses a value that is not of the field\'s type, an empty list, a missing value and too many values', () => {
    const bad: Condition[] = [{ op: 'eq', field: 'score', value: '5' }, { op: 'eq', field: 'vip', value: 1 }, { op: 'eq', field: 'name', value: 5 }, { op: 'gt', field: 'met_at', value: 'yesterday' },
      { op: 'eq', field: 'opened_on', value: 20260101 }, { op: 'in', field: 'score', value: [] }, { op: 'in', field: 'score', value: 5 }, { op: 'gt', field: 'score' }, { op: 'all', args: [] },
      { op: 'like', field: 'name', value: 'x' } as unknown as Condition, { op: 'eq', field: 'name', value: { a: 1 } }];
    for (const c of bad) expect(() => sql(c)).toThrow(FilterError);
    const many = Array.from({ length: MAX_FILTER_VALUES + 1 }, (_, i) => i);
    expect(() => sql({ op: 'in', field: 'score', value: many })).toThrow('too many values');
    expect(sql({ op: 'in', field: 'score', value: many.slice(1) }).values).toHaveLength(MAX_FILTER_VALUES);
  });

  it('orders by the view\'s fields and always ends with the id', () => {
    expect(orderBySql([], lead)).toBe('[id]');
    expect(orderBySql([{ field: 'updated_at', direction: 'DESC' }, { field: 'phone', direction: 'ASC' }], lead)).toBe('[updated_at] DESC, [f_phone] ASC, [id]');
  });

  it('a list statement keeps the company and access conditions and ANDs the filter and the reference match after them', () => {
    const s = listStatement(lead, { companyId: 7, actor: 'u1' }, { kind: 'anyOf', terms: [{ field: 'name', values: ['u1'] }] }, { limit: 10, offset: 0 },
      { filter: { op: 'any', args: [{ op: 'eq', field: 'status', value: 'A' }, { op: 'isEmpty', field: 'score' }] }, sort: [{ field: 'name', direction: 'DESC' }], equals: { field: 'account', value: EVIL[0] } });
    expect(s.text).toBe('SELECT [id], [f_name], [f_status], [f_score], [f_vip], [f_met_at], [f_opened_on], [f_phone], [f_account], [updated_at] FROM dbo.[crm_obj_lead] '
      + 'WHERE [company_id] = @company AND ([f_name] COLLATE Latin1_General_100_BIN2 IN (@p0)) AND [f_account] COLLATE Latin1_General_100_BIN2 = @p1 '
      + 'AND (([f_status] IS NOT NULL AND [f_status] = @p2) OR ([f_score] IS NULL))\nORDER BY [f_name] DESC, [id] OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY');
    expect(s.params).toEqual({ company: 7, offset: 0, limit: 10, p0: 'u1', p1: EVIL[0], p2: 'A' });
    expect(() => listStatement(lead, { companyId: 7, actor: 'u1' }, { kind: 'all' }, { limit: 1, offset: 0 }, { equals: { field: 'nope', value: 'x' } })).toThrow('CRM_OBJ_UNKNOWN_FIELD');
  });
});
