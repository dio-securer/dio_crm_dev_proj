// The SQL of the record layer (F2-4): access predicates become parameterised conditions; values never enter the SQL text.
import type { FieldDef } from '@dio-crm/contracts/metadata';
import { columnOf, quote, safeKey, sqlTypeOf, tableName } from './crm-obj-names';
import { MAX_ACCESS_VALUES, getStatement, insertStatement, listStatement, updateStatement } from './crm-obj-sql';

const field = (key: string, type = 'text', more: Partial<FieldDef> = {}): FieldDef =>
  ({ key, type, labelKey: 'x', required: false, system: false, aliases: [], ...more } as FieldDef);
const lead = { key: 'lead', fields: [field('hospital_name'), field('owner_name'), field('sido'), field('met_at', 'datetime'), field('updated_at', 'datetime', { system: true })] };
const scope = { companyId: 7, actor: 'u1' };
const page = { limit: 50, offset: 0 };
const EVIL = ["' OR 1=1 --", ']; DROP TABLE crm_obj_lead; --', "x') UNION SELECT * FROM users --", "u1'; WAITFOR DELAY '0:0:5' --"];

describe('record SQL', () => {
  it('turns anyOf into IN lists of parameters, one OR term per field, with exact comparison', () => {
    const s = listStatement(lead, scope, { kind: 'anyOf', terms: [{ field: 'owner_name', values: ['u1', 'u2'] }, { field: 'sido', values: ['S'] }] }, page);
    expect(s.text).toBe('SELECT [id], [f_hospital_name], [f_owner_name], [f_sido], [f_met_at], [updated_at] FROM dbo.[crm_obj_lead] '
      + 'WHERE [company_id] = @company AND ([f_owner_name] COLLATE Latin1_General_100_BIN2 IN (@p0, @p1) OR [f_sido] COLLATE Latin1_General_100_BIN2 IN (@p2))\n'
      + 'ORDER BY [id] OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY');
    expect(s.params).toEqual({ company: 7, offset: 0, limit: 50, p0: 'u1', p1: 'u2', p2: 'S' });
  });

  it('keeps the company condition for all, and closes none', () => {
    expect(listStatement(lead, scope, { kind: 'all' }, page).text).toContain('WHERE [company_id] = @company AND 1 = 1');
    expect(getStatement(lead, scope, { kind: 'none' }, 1, false).text).toContain('AND 1 = 0');
    expect(getStatement(lead, scope, { kind: 'anyOf', terms: [{ field: 'owner_name', values: [] }] }, 1, false).text).toContain('AND 1 = 0');
  });

  it('carries hostile actor ids and values only as parameters', () => {
    const s = getStatement(lead, scope, { kind: 'anyOf', terms: [{ field: 'owner_name', values: EVIL }] }, 3, true);
    for (const evil of EVIL) expect(s.text).not.toContain(evil);
    expect(Object.values(s.params)).toEqual(expect.arrayContaining(EVIL));
    expect(s.text).toContain('WITH (UPDLOCK, ROWLOCK) WHERE [id] = @id AND [company_id] = @company');
    const ins = insertStatement(lead, scope, { hospital_name: EVIL[1], owner_name: EVIL[0], met_at: '2026-01-01T00:00:00.000Z' }, new Date(0));
    expect(ins.text).toBe('INSERT INTO dbo.[crm_obj_lead] ([company_id], [created_at], [created_by], [updated_at], [updated_by], [f_hospital_name], [f_owner_name], [f_met_at]) '
      + 'OUTPUT INSERTED.[id] VALUES (@company, @at, @by, @at, @by, @p0, @p1, @p2)');
    expect(ins.params.p2).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    const up = updateStatement(lead, scope, 3, { sido: EVIL[2] }, new Date(0));
    expect(up.text).toBe('UPDATE dbo.[crm_obj_lead] SET [f_sido] = @p0, [updated_at] = @at, [updated_by] = @by WHERE [id] = @id AND [company_id] = @company');
    expect(up.params).toMatchObject({ p0: EVIL[2], id: 3, company: 7, by: 'u1' });
  });

  it('refuses identifiers that are not metadata keys, unknown fields and managed columns as write targets', () => {
    for (const bad of ['Lead', 'lead]; DROP', 'a b', '', '1x', 'x'.repeat(101), 'lead--']) expect(() => safeKey(bad)).toThrow('CRM_OBJ_BAD_IDENTIFIER');
    expect(() => tableName('lead];--')).toThrow('CRM_OBJ_BAD_IDENTIFIER');
    expect(quote('a]b; DROP')).toBe('[ab]');
    expect(() => listStatement(lead, scope, { kind: 'anyOf', terms: [{ field: 'nope', values: ['u1'] }] }, page)).toThrow('CRM_OBJ_UNKNOWN_FIELD');
    expect(() => insertStatement(lead, scope, { 'nope]': 'x' }, new Date())).toThrow('CRM_OBJ_UNKNOWN_FIELD');
    expect(() => updateStatement(lead, scope, 1, { updated_at: 'x' }, new Date())).toThrow('CRM_OBJ_NOT_WRITABLE');
  });

  it('refuses an access predicate with more values than SQL Server can take', () => {
    const values = Array.from({ length: MAX_ACCESS_VALUES + 1 }, (_, i) => `u${i}`);
    expect(() => listStatement(lead, scope, { kind: 'anyOf', terms: [{ field: 'owner_name', values }] }, page)).toThrow('ACCESS_TOO_WIDE');
  });

  it('maps every metadata type to a column type, and managed system fields to managed columns', () => {
    const types = ['text', 'enum', 'reference', 'integer', 'decimal', 'boolean', 'date', 'datetime'].map(t => sqlTypeOf(field('a', t)).text);
    expect(types).toEqual(['NVARCHAR(4000)', 'NVARCHAR(100)', 'NVARCHAR(100)', 'BIGINT', 'DECIMAL(18,4)', 'BIT', 'DATE', 'DATETIME2(3)']);
    expect(sqlTypeOf(field('a', 'text', { maxLength: 20 })).text).toBe('NVARCHAR(20)');
    expect(sqlTypeOf(field('a', 'decimal', { precision: 9, scale: 2 })).text).toBe('DECIMAL(9,2)');
    expect(() => sqlTypeOf(field('a', 'blob'))).toThrow('CRM_OBJ_UNKNOWN_TYPE');
    expect(columnOf(field('updated_at', 'datetime', { system: true }))).toBe('updated_at');
    expect(columnOf(field('updated_at', 'datetime'))).toBe('f_updated_at');
    expect(columnOf(field('id'))).toBe('f_id');
  });
});
