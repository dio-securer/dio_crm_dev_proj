// Record tables of metadata objects (F2-4): one dbo.crm_obj_<object> table per object. Idempotent: a missing table is
// created and a missing field column added; nothing is dropped, no column is changed, no table outside crm_obj_ is touched.
// A column whose type no longer matches the metadata (e.g. an allowed integer -> decimal widening) stops the run
// (CRM_OBJ_SCHEMA_DRIFT): changing a column with data in it is left to a person.
import type { FieldDef } from '@dio-crm/contracts/metadata';
import { MetaTransactional } from './crm-meta-version-store';
import { fieldColumns, quote, sqlTypeOf, tableName, columnOf } from './crm-obj-names';

export interface ObjectShape { key: string; fields: readonly FieldDef[] }
/** A negative sp_getapplock result (timeout, deadlock) is raised, so the run never goes on without the lock. */
export const APPLOCK = `DECLARE @lock INT;
EXEC @lock = sp_getapplock @Resource = N'crm_obj_schema', @LockMode = N'Exclusive', @LockOwner = N'Transaction', @LockTimeout = 30000;
IF @lock < 0 THROW 51000, N'CRM_OBJ_SCHEMA_LOCK', 1;`;

export function objectSchemaStatements(object: ObjectShape): string[] {
  const table = tableName(object.key);
  const create = `IF OBJECT_ID(N'dbo.${table}', N'U') IS NULL
CREATE TABLE dbo.${quote(table)} (
  [id] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT ${quote(`pk_${table}`)} PRIMARY KEY,
  [company_id] INT NOT NULL,
  [created_at] DATETIME2(3) NOT NULL,
  [created_by] NVARCHAR(100) NOT NULL,
  [updated_at] DATETIME2(3) NOT NULL,
  [updated_by] NVARCHAR(100) NOT NULL
)`;
  const index = `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_${table}_company' AND object_id = OBJECT_ID(N'dbo.${table}'))
CREATE INDEX ${quote(`ix_${table}_company`)} ON dbo.${quote(table)} ([company_id], [id])`;
  const columns = fieldColumns(object.fields).map(f => {
    const column = columnOf(f);
    return `IF COL_LENGTH(N'dbo.${table}', N'${column}') IS NULL
ALTER TABLE dbo.${quote(table)} ADD ${quote(column)} ${sqlTypeOf(f).text} NULL`;
  });
  return [create, index, ...columns];
}

type ColumnRow = { COLUMN_NAME: string; DATA_TYPE: string; CHARACTER_MAXIMUM_LENGTH: number | null; NUMERIC_PRECISION: number | null; NUMERIC_SCALE: number | null };
export const COLUMNS_QUERY = `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = @table`;

/** Field columns whose database type differs from what the metadata needs. A longer text column is fine. */
export function schemaDrift(object: ObjectShape, rows: readonly ColumnRow[]): string[] {
  const byName = new Map(rows.map(r => [r.COLUMN_NAME.toLowerCase(), r] as const));
  const drift: string[] = [];
  for (const f of fieldColumns(object.fields)) {
    const want = sqlTypeOf(f), have = byName.get(columnOf(f));
    const ok = have && have.DATA_TYPE.toLowerCase() === want.dataType
      && (want.length === undefined || have.CHARACTER_MAXIMUM_LENGTH === -1 || Number(have.CHARACTER_MAXIMUM_LENGTH) >= want.length)
      && (want.precision === undefined || (Number(have.NUMERIC_PRECISION) === want.precision && Number(have.NUMERIC_SCALE) === want.scale));
    if (!ok) drift.push(`${tableName(object.key)}.${columnOf(f)} ${have ? have.DATA_TYPE : 'missing'} -> ${want.text}`);
  }
  return drift;
}

/** Creates or completes the record tables of the given objects in one transaction, serialised by an application lock. */
export async function applyObjectSchema(db: MetaTransactional, objects: readonly ObjectShape[]): Promise<void> {
  await db.transaction(async query => {
    await query(APPLOCK);
    const drift: string[] = [];
    for (const object of objects) {
      for (const statement of objectSchemaStatements(object)) await query(statement);
      drift.push(...schemaDrift(object, (await query(COLUMNS_QUERY, { table: tableName(object.key) })).recordset as ColumnRow[]));
    }
    if (drift.length) throw new Error(`CRM_OBJ_SCHEMA_DRIFT ${drift.join('; ')}`);
  });
}
