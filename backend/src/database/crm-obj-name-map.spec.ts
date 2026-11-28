// Physical names of record tables and columns (F2-4, ADR 0004): a rename that keeps the old name as an alias keeps the
// table, the column and the data; names are recorded once and only ever added.
import type { FieldDef } from '@dio-crm/contracts/metadata';
import { sqliteDb } from '../../test/support/sqlite-db';
import { NAME_INSERT, NAME_TABLE_DDL, NAMES_QUERY, resolveNames } from './crm-obj-name-map';
import { applyObjectSchema } from './crm-obj-schema';
import { SqlObjectRecords } from './crm-obj-store';

const field = (key: string, aliases: string[] = [], type = 'text'): FieldDef => ({ key, type, labelKey: 'x', required: false, system: false, aliases } as FieldDef);
const v1 = { key: 'lead', aliases: [], fields: [field('hospital_name'), field('owner_name'), field('phone')] };
const v2 = { key: 'lead', aliases: [], fields: [field('hospital_name'), field('owner', ['owner_name']), field('phone_number', ['phone']), field('memo')] };
const at = new Date('2026-11-28T00:00:00Z');
const scope = { companyId: 1, actor: 'u1' };
const all = { kind: 'all' as const };
const columnsOf = (db: ReturnType<typeof sqliteDb>, table: string) => db.raw.prepare(`PRAGMA table_info(${table})`).all().map((c: any) => c.name).filter((n: string) => n.startsWith('f_'));
const namesOf = (db: ReturnType<typeof sqliteDb>) => db.raw.prepare('SELECT scope, name_key, physical FROM crm_meta_obj_name ORDER BY scope, name_key').all().map((r: any) => `${r.scope}/${r.name_key}=${r.physical}`);

describe('physical names of record tables', () => {
  it('a renamed field keeps its column and data; the new name is recorded; a rollback reads the same column', async () => {
    const db = sqliteDb(), store = new SqlObjectRecords(db);
    const [s1] = await applyObjectSchema(db, [v1]);
    expect(s1).toMatchObject({ table: 'crm_obj_lead', columns: { hospital_name: 'f_hospital_name', owner_name: 'f_owner_name', phone: 'f_phone' } });
    await store.insert(s1, scope, { hospital_name: 'H', owner_name: 'u1', phone: '010' }, at);
    const [s2] = await applyObjectSchema(db, [v2]);
    expect(s2.columns).toEqual({ hospital_name: 'f_hospital_name', owner: 'f_owner_name', phone_number: 'f_phone', memo: 'f_memo' });
    expect(columnsOf(db, 'crm_obj_lead')).toEqual(['f_hospital_name', 'f_owner_name', 'f_phone', 'f_memo']);
    expect((await store.list(s2, scope, { kind: 'anyOf', terms: [{ field: 'owner', values: ['u1'] }] }, { limit: 9, offset: 0 })).map(r => r.values))
      .toEqual([{ hospital_name: 'H', owner: 'u1', phone_number: '010', memo: null }]);
    await store.update(s2, scope, all, 1, () => ({ phone_number: '011' }), at);
    const [back] = await applyObjectSchema(db, [v1]);
    expect((await store.get(back, scope, all, 1))?.values).toEqual({ hospital_name: 'H', owner_name: 'u1', phone: '011' });
    expect(namesOf(db)).toEqual(['/lead=crm_obj_lead', 'crm_obj_lead/hospital_name=f_hospital_name', 'crm_obj_lead/memo=f_memo', 'crm_obj_lead/owner=f_owner_name',
      'crm_obj_lead/owner_name=f_owner_name', 'crm_obj_lead/phone=f_phone', 'crm_obj_lead/phone_number=f_phone']);
  });

  it('a renamed object keeps its table and data, and a second rename follows the chain of aliases', async () => {
    const db = sqliteDb(), store = new SqlObjectRecords(db);
    const [s1] = await applyObjectSchema(db, [v1]);
    await store.insert(s1, scope, { hospital_name: 'H', owner_name: 'u1' }, at);
    const [s2] = await applyObjectSchema(db, [{ ...v2, key: 'prospect', aliases: ['lead'] }]);
    expect(s2.table).toBe('crm_obj_lead');
    const [s3] = await applyObjectSchema(db, [{ ...v2, key: 'target', aliases: ['prospect', 'lead'], fields: [field('hospital_name'), field('rep', ['owner', 'owner_name'])] }]);
    expect(s3).toMatchObject({ table: 'crm_obj_lead', columns: { rep: 'f_owner_name' } });
    expect((await store.get(s3, scope, all, 1))?.values).toEqual({ hospital_name: 'H', rep: 'u1' });
    expect(db.tables()).toEqual(['crm_meta_obj_name', 'crm_obj_lead']);
    // The alias dropped later: the recorded name still leads to the same table and column.
    const [s4] = await applyObjectSchema(db, [{ key: 'target', aliases: [], fields: [field('hospital_name'), field('rep')] }]);
    expect((await store.get(s4, scope, all, 1))?.values).toEqual({ hospital_name: 'H', rep: 'u1' });
  });

  it('a table made before names were recorded: the column of the key, else of an alias, is the field\'s column', async () => {
    const db = sqliteDb();
    db.raw.exec('CREATE TABLE crm_obj_lead (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INT, created_at NVARCHAR(40), created_by NVARCHAR(100), updated_at NVARCHAR(40), updated_by NVARCHAR(100), [f_hospital_name] NVARCHAR(4000), [f_owner_name] NVARCHAR(4000), [f_phone] NVARCHAR(4000))');
    db.raw.exec("INSERT INTO crm_obj_lead (company_id, created_at, created_by, updated_at, updated_by, f_hospital_name, f_owner_name) VALUES (1, 'a', 'u', 'a', 'u', 'H', 'u1')");
    const [s] = await applyObjectSchema(db, [v2]);
    expect(s.columns).toEqual({ hospital_name: 'f_hospital_name', owner: 'f_owner_name', phone_number: 'f_phone', memo: 'f_memo' });
    expect((await new SqlObjectRecords(db).get(s, scope, all, 1))?.values.owner).toBe('u1');
  });

  it('records each name once (idempotent), only adds rows, and uses no statement but SELECT / INSERT on the name table', async () => {
    const db = sqliteDb();
    await applyObjectSchema(db, [v1]);
    const before = namesOf(db);
    await applyObjectSchema(db, [v1]);
    expect(namesOf(db)).toEqual(before);
    for (const text of [NAME_TABLE_DDL, NAMES_QUERY, NAME_INSERT]) expect(text).not.toMatch(/\b(DROP|DELETE|UPDATE|ALTER|TRUNCATE|EXEC)\b/i);
    expect(NAME_TABLE_DDL).toMatch(/^IF OBJECT_ID\(N'dbo\.crm_meta_obj_name', N'U'\) IS NULL\nCREATE TABLE dbo\.\[crm_meta_obj_name\]/);
  });

  it('stops when two fields would share a column, or a recorded name is not a safe identifier', () => {
    const rows = [{ scope: '', name_key: 'lead', physical: 'crm_obj_lead' }, { scope: 'crm_obj_lead', name_key: 'a', physical: 'f_a' }, { scope: 'crm_obj_lead', name_key: 'b', physical: 'f_a' }];
    expect(() => resolveNames({ key: 'lead', fields: [field('a'), field('b')] }, rows, [])).toThrow('CRM_OBJ_COLUMN_CONFLICT crm_obj_lead.f_a (a, b)');
    expect(() => resolveNames({ key: 'lead', fields: [] }, [{ scope: '', name_key: 'lead', physical: 'users' }], [])).toThrow('CRM_OBJ_BAD_IDENTIFIER');
    expect(() => resolveNames({ key: 'lead', fields: [field('a')] }, [rows[0], { scope: 'crm_obj_lead', name_key: 'a', physical: 'id' }], [])).toThrow('CRM_OBJ_BAD_IDENTIFIER');
    expect(resolveNames({ key: 'lead', fields: [field('a')] }, rows.slice(0, 2), ['F_A']).add).toEqual([]);
  });

  it('refuses a field whose names mean two different columns (a merge), whichever alias comes first', async () => {
    const rows = [{ scope: '', name_key: 'lead', physical: 'crm_obj_lead' }, { scope: 'crm_obj_lead', name_key: 'company_name', physical: 'f_company_name' }, { scope: 'crm_obj_lead', name_key: 'name', physical: 'f_name' }];
    for (const aliases of [['company_name', 'name'], ['name', 'company_name']]) {
      expect(() => resolveNames({ key: 'lead', fields: [field('cn2', aliases)] }, rows, [])).toThrow('CRM_OBJ_COLUMN_AMBIGUOUS crm_obj_lead.cn2');
      // A table from before names were recorded: the existing columns say the same.
      expect(() => resolveNames({ key: 'lead', fields: [field('cn2', aliases)] }, rows.slice(0, 1), ['f_company_name', 'f_name'])).toThrow('CRM_OBJ_COLUMN_AMBIGUOUS crm_obj_lead.cn2');
    }
    expect(() => resolveNames({ key: 'lead', fields: [field('name', ['company_name'])] }, rows, [])).toThrow('CRM_OBJ_COLUMN_AMBIGUOUS crm_obj_lead.name');
    // One column under several names is not a merge: a rename chain resolves as before.
    const chain = [...rows, { scope: 'crm_obj_lead', name_key: 'title', physical: 'f_name' }];
    expect(resolveNames({ key: 'lead', fields: [field('subject', ['title', 'name'])] }, chain, []).shape.columns).toEqual({ subject: 'f_name' });
    // Through the schema step: the publish that merges two fields makes no column and records no name.
    const db = sqliteDb();
    await applyObjectSchema(db, [{ key: 'lead', aliases: [], fields: [field('company_name'), field('name')] }]);
    await expect(applyObjectSchema(db, [{ key: 'lead', aliases: [], fields: [field('cn2', ['company_name', 'name'])] }])).rejects.toThrow('CRM_OBJ_COLUMN_AMBIGUOUS');
    expect(columnsOf(db, 'crm_obj_lead')).toEqual(['f_company_name', 'f_name']);
    expect(namesOf(db).some((n: string) => n.includes('cn2'))).toBe(false);
  });
});
