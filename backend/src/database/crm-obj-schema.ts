// Record tables of metadata objects (F2-4): one dbo.crm_obj_<object> table per object. Idempotent: a missing table is
// created and a missing field column added; nothing is dropped, no column is changed, no table outside crm_obj_ is touched.
// The physical names come from crm-obj-name-map.ts (recorded in dbo.crm_meta_obj_name; a retired name is never followed again).
// A column whose type no longer matches the metadata (e.g. an allowed integer -> decimal widening) stops the run
// (CRM_OBJ_SCHEMA_DRIFT): changing a column with data in it is left to a person.
import { bundleFromFiles } from '@dio-crm/contracts/metadata';
import { MetaTransactional } from './crm-meta-version-store';
import { PublishedCheck, StaleVersionError, assertStillPublished } from './crm-meta-published';
import { ObjectShape, columnFor, fieldColumns, quote, sqlTypeOf, tableOf } from './crm-obj-names';
import { NAMES_QUERY, NAME_RETIRED_DDL, NAME_TABLE_DDL, NameRow, TABLES_QUERY, resolveNames, resolveTable } from './crm-obj-name-map';
import { APPLOCK, writeNames } from './crm-obj-name-sync';

export type { ObjectShape };
export { APPLOCK };

export function objectSchemaStatements(object: ObjectShape): string[] {
  const table = tableOf(object);
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
    const column = columnFor(object, f);
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
    const want = sqlTypeOf(f), have = byName.get(columnFor(object, f));
    const ok = have && have.DATA_TYPE.toLowerCase() === want.dataType
      && (want.length === undefined || have.CHARACTER_MAXIMUM_LENGTH === -1 || Number(have.CHARACTER_MAXIMUM_LENGTH) >= want.length)
      && (want.precision === undefined || (Number(have.NUMERIC_PRECISION) === want.precision && Number(have.NUMERIC_SCALE) === want.scale));
    if (!ok) drift.push(`${tableOf(object)}.${columnFor(object, f)} ${have ? have.DATA_TYPE : 'missing'} -> ${want.text}`);
  }
  return drift;
}

/** The requested objects and fields must be in the published files: a name is never recorded for something that is not published. */
function assertPublished(objects: readonly ObjectShape[], files: readonly { path: string; content: string }[] | undefined): void {
  const bundle = files?.length ? bundleFromFiles([...files]).bundle : undefined;
  for (const object of objects) {
    const published = bundle?.objects.find(o => o.object.key === object.key)?.object;
    const fields = new Set(published?.fields.map(f => f.key));
    const missing = !published ? object.key : object.fields.find(f => !fields.has(f.key))?.key;
    if (missing !== undefined) throw new StaleVersionError(`not published: ${object.key}${published ? `.${missing}` : ''}`);
  }
}

/**
 * Creates or completes the record tables of the given objects in one transaction, serialised by an application lock.
 * Returns each object with its physical table and column names; the record SQL must be built from these.
 *
 * `check` is given by everything that serves requests: the pointer is locked first (the lock a publish takes first),
 * and the run goes on only if the version these objects come from is still the published one, at the same stamp, and
 * really has these objects and fields. A request that still holds an older version therefore cannot record a name
 * that a publish has retired in the meantime. Without `check` (the real-database check script, unit tests) nothing is compared.
 */
export async function applyObjectSchema(db: MetaTransactional, objects: readonly ObjectShape[], check?: PublishedCheck): Promise<ObjectShape[]> {
  return db.transaction(async query => {
    if (check) await assertStillPublished(query, check, 'update');
    await query(APPLOCK);
    if (check) assertPublished(objects, await check.files(query, check.expected.id));
    await query(NAME_TABLE_DDL);
    await query(NAME_RETIRED_DDL);
    const drift: string[] = [], out: ObjectShape[] = [];
    const columnsOf = async (table: string) => (await query(COLUMNS_QUERY, { table })).recordset as ColumnRow[];
    for (const object of objects) {
      const names = (await query(NAMES_QUERY)).recordset as unknown as NameRow[];
      const tables = (await query(TABLES_QUERY)).recordset.map(r => String(r.TABLE_NAME));
      const before = await columnsOf(resolveTable(object, names, tables));
      const { shape, add } = resolveNames(object, names, before.map(c => c.COLUMN_NAME), tables);
      await writeNames(query, add);
      for (const statement of objectSchemaStatements(shape)) await query(statement);
      drift.push(...schemaDrift(shape, await columnsOf(tableOf(shape))));
      out.push(shape);
    }
    if (drift.length) throw new Error(`CRM_OBJ_SCHEMA_DRIFT ${drift.join('; ')}`);
    return out;
  });
}
