// Record tables (F2-4): only crm_obj_ tables, nothing dropped or changed, idempotent, a lock first, type drift stops the run.
import type { FieldDef } from '@dio-crm/contracts/metadata';
import { sqliteDb } from '../../test/support/sqlite-db';
import { APPLOCK, applyObjectSchema, objectSchemaStatements, schemaDrift } from './crm-obj-schema';

const field = (key: string, type = 'text', more: Partial<FieldDef> = {}): FieldDef =>
  ({ key, type, labelKey: 'x', required: false, system: false, aliases: [], ...more } as FieldDef);
const lead = { key: 'lead', fields: [field('hospital_name'), field('visits', 'integer'), field('amount', 'decimal', { precision: 9, scale: 2 }), field('updated_at', 'datetime', { system: true })] };

describe('record table schema', () => {
  it('creates only dbo.crm_obj_<object>, adds field columns, and never drops or alters a column', () => {
    const all = objectSchemaStatements(lead).join('\n');
    expect(all).not.toMatch(/\bDROP\b|ALTER COLUMN|TRUNCATE|DELETE|EXEC|sp_rename/i);
    for (const table of all.match(/dbo\.\[?(\w+)/g) ?? []) expect(table.replace(/dbo\.\[?/, '')).toMatch(/^crm_obj_lead$/);
    expect(all.match(/ALTER TABLE dbo\.\[crm_obj_lead\] ADD \[\w+\]/g)).toEqual([
      'ALTER TABLE dbo.[crm_obj_lead] ADD [f_hospital_name]', 'ALTER TABLE dbo.[crm_obj_lead] ADD [f_visits]', 'ALTER TABLE dbo.[crm_obj_lead] ADD [f_amount]']);
    for (const s of objectSchemaStatements(lead)) expect(s).toMatch(/^IF (OBJECT_ID\(|NOT EXISTS \(|COL_LENGTH\()/);
  });

  it('takes the application lock first and raises when the lock is not granted', async () => {
    const db = sqliteDb();
    await applyObjectSchema(db, [lead]);
    expect(db.log[0].text).toBe(APPLOCK);
    expect(APPLOCK).toMatch(/IF @lock < 0 THROW/);
  });

  it('is idempotent and adds a new field column to an existing table without touching its rows', async () => {
    const db = sqliteDb();
    db.raw.exec('CREATE TABLE legacy_lead (id INTEGER, name TEXT)');
    db.raw.exec("INSERT INTO legacy_lead VALUES (1, 'kept')");
    await applyObjectSchema(db, [lead]);
    db.raw.exec("INSERT INTO crm_obj_lead (company_id, created_at, created_by, updated_at, updated_by, f_hospital_name) VALUES (1, 'a', 'u', 'a', 'u', 'H')");
    await applyObjectSchema(db, [lead]);
    await applyObjectSchema(db, [{ ...lead, fields: [...lead.fields, field('sido')] }]);
    expect(db.raw.prepare('SELECT f_hospital_name, f_sido FROM crm_obj_lead').all().map((r: any) => ({ ...r }))).toEqual([{ f_hospital_name: 'H', f_sido: null }]);
    expect(db.raw.prepare('SELECT * FROM legacy_lead').all().map((r: any) => ({ ...r }))).toEqual([{ id: 1, name: 'kept' }]);
    expect(db.tables()).toEqual(['crm_meta_obj_name', 'crm_obj_lead', 'legacy_lead']);
  });

  it('stops on a column whose type no longer matches (e.g. integer widened to decimal) and rolls the run back', async () => {
    const db = sqliteDb();
    await applyObjectSchema(db, [lead]);
    const widened = { ...lead, fields: [field('hospital_name'), field('visits', 'decimal'), field('amount', 'decimal', { precision: 9, scale: 2 }), field('sido')] };
    await expect(applyObjectSchema(db, [widened])).rejects.toThrow('CRM_OBJ_SCHEMA_DRIFT crm_obj_lead.f_visits bigint -> DECIMAL(18,4)');
    expect(db.raw.prepare('PRAGMA table_info(crm_obj_lead)').all().map((c: any) => c.name)).not.toContain('f_sido');
  });

  it('accepts a longer text column but not a shorter one or another decimal scale', () => {
    const row = (name: string, type: string, length: number | null = null, p: number | null = null, s: number | null = null) =>
      ({ COLUMN_NAME: name, DATA_TYPE: type, CHARACTER_MAXIMUM_LENGTH: length, NUMERIC_PRECISION: p, NUMERIC_SCALE: s });
    const obj = { key: 'lead', fields: [field('a', 'text', { maxLength: 50 }), field('b', 'decimal', { precision: 9, scale: 2 })] };
    expect(schemaDrift(obj, [row('f_a', 'nvarchar', 100), row('f_b', 'decimal', null, 9, 2)])).toEqual([]);
    expect(schemaDrift(obj, [row('f_a', 'nvarchar', -1), row('f_b', 'decimal', null, 9, 2)])).toEqual([]);
    expect(schemaDrift(obj, [row('f_a', 'nvarchar', 10), row('f_b', 'decimal', null, 9, 3)])).toHaveLength(2);
    expect(schemaDrift(obj, [])).toEqual(['crm_obj_lead.f_a missing -> NVARCHAR(50)', 'crm_obj_lead.f_b missing -> DECIMAL(9,2)']);
  });
});
