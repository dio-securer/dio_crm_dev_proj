// Physical names of record tables and columns (F2-4, ADR 0004). A table or column gets its name once, when it is first
// made, and dbo.crm_meta_obj_name remembers it: scope '' maps an object key to its table, scope <table> maps a field key
// to its column. A renamed object or field (the old name kept as an alias) finds the old row and keeps its data; the
// new name is recorded next to it.
//
// A name that leaves the published settings is RETIRED (crm-obj-name-sync.ts, at every publish and rollback), and a
// retired name is never followed again: an object or field that later takes that name gets a fresh table or column
// (crm_obj_<key>_r2, f_<key>_r2 ...). No table or column that already exists is ever given to a name that has no
// live row, so the rows of a removed object or field cannot come back under new access rules. Bringing old data back
// is a migration a person does, not something a publish can do.
import { FieldDef, resolveByNames } from '@dio-crm/contracts/metadata';
import { ObjectShape, columnOf, fieldColumns, safeColumn, safeTable, tableName } from './crm-obj-names';

export interface NameRow { scope: string; name_key: string; physical: string; retired?: number | null }
/** A row to write: a new name (insert) or a retired name taken into use again with a fresh physical name (reuse). */
export interface NameWrite extends NameRow { reuse: boolean }
export const NAME_TABLE = 'crm_meta_obj_name';
export const NAME_TABLE_DDL = `IF OBJECT_ID(N'dbo.${NAME_TABLE}', N'U') IS NULL
CREATE TABLE dbo.[${NAME_TABLE}] (
  [scope] NVARCHAR(128) NOT NULL,
  [name_key] NVARCHAR(100) NOT NULL,
  [physical] NVARCHAR(128) NOT NULL,
  [retired] INT NULL,
  CONSTRAINT [pk_${NAME_TABLE}] PRIMARY KEY ([scope], [name_key])
)`;
/** For a name table made before names could retire. */
export const NAME_RETIRED_DDL = `IF COL_LENGTH(N'dbo.${NAME_TABLE}', N'retired') IS NULL
ALTER TABLE dbo.[${NAME_TABLE}] ADD [retired] INT NULL`;
export const NAMES_QUERY = `SELECT [scope], [name_key], [physical], [retired] FROM dbo.[${NAME_TABLE}]`;
export const NAME_INSERT = `INSERT INTO dbo.[${NAME_TABLE}] ([scope], [name_key], [physical]) VALUES (@scope, @key, @physical)`;
export const NAME_RETIRE = `UPDATE dbo.[${NAME_TABLE}] SET [retired] = 1 WHERE [scope] = @scope AND [name_key] = @key AND [retired] IS NULL`;
export const NAME_REUSE = `UPDATE dbo.[${NAME_TABLE}] SET [physical] = @physical, [retired] = NULL WHERE [scope] = @scope AND [name_key] = @key AND [retired] = 1`;
export const TABLES_QUERY = `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = N'dbo' AND LEFT(TABLE_NAME, 8) = N'crm_obj_'`;

export const TABLES = '';
export const isLive = (row: NameRow) => row.retired === null || row.retired === undefined;
const rowOf = (rows: readonly NameRow[], scope: string, name: string) => rows.find(r => r.scope === scope && r.name_key === name);
const live = (rows: readonly NameRow[], scope: string) => (name: string) => { const row = rowOf(rows, scope, name); return row && isLive(row) ? row.physical : undefined; };

/** A physical name nobody has: `wanted`, or `wanted_r2`, `wanted_r3` ... when it is recorded or exists in the database. */
function fresh(wanted: string, taken: ReadonlySet<string>): string {
  if (!taken.has(wanted)) return wanted;
  for (let n = 2; ; n += 1) if (!taken.has(`${wanted}_r${n}`)) return `${wanted}_r${n}`;
}
const takenIn = (rows: readonly NameRow[], scope: string, existing: readonly string[]) =>
  new Set([...rows.filter(r => r.scope === scope).map(r => r.physical.toLowerCase()), ...existing.map(n => n.toLowerCase())]);

/** The live table of an object (by its key, then its aliases: the shared resolveByNames), or undefined when it has none yet. */
export function liveTable(object: ObjectShape, rows: readonly NameRow[]): string | undefined {
  const hit = resolveByNames({ key: object.key, aliases: object.aliases ?? [] }, live(rows, TABLES));
  // An object whose names mean two tables would merge two objects' rows.
  if (hit.ambiguous) throw new Error(`CRM_OBJ_TABLE_AMBIGUOUS ${object.key}`);
  return hit.value === undefined ? undefined : safeTable(hit.value);
}
/** The live column of a field in its table, or undefined when it has none yet. A field whose names mean two columns is refused. */
export function liveColumn(field: FieldDef, table: string, rows: readonly NameRow[]): string | undefined {
  const hit = resolveByNames(field, live(rows, table));
  if (hit.ambiguous) throw new Error(`CRM_OBJ_COLUMN_AMBIGUOUS ${table}.${field.key}`);
  return hit.value === undefined ? undefined : safeColumn(hit.value);
}

/** The table of an object: its live table, else a fresh one. `existingTables` are the crm_obj_ tables in the database now. */
export function resolveTable(object: ObjectShape, rows: readonly NameRow[], existingTables: readonly string[] = []): string {
  return liveTable(object, rows) ?? safeTable(fresh(tableName(object.key), takenIn(rows, TABLES, existingTables)));
}

const write = (rows: readonly NameRow[], scope: string, name_key: string, physical: string): NameWrite[] => {
  const row = rowOf(rows, scope, name_key);
  return row && isLive(row) ? [] : [{ scope, name_key, physical, reuse: row !== undefined }];
};

/**
 * The object with its physical names, and the rows to write. `existingColumns` are the table's columns now and
 * `existingTables` the crm_obj_ tables now: a name without a live row never gets one of them.
 * Two fields on one column would overwrite each other, so that stops the run.
 */
export function resolveNames(object: ObjectShape, rows: readonly NameRow[], existingColumns: readonly string[], existingTables: readonly string[] = []): { shape: ObjectShape; add: NameWrite[] } {
  const table = resolveTable(object, rows, existingTables), taken = takenIn(rows, table, existingColumns);
  const add: NameWrite[] = write(rows, TABLES, object.key, table);
  const columns: Record<string, string> = {}, used = new Map<string, string>();
  for (const field of fieldColumns(object.fields)) {
    const column = liveColumn(field, table, rows) ?? safeColumn(fresh(columnOf(field), taken));
    const other = used.get(column);
    if (other !== undefined) throw new Error(`CRM_OBJ_COLUMN_CONFLICT ${table}.${column} (${other}, ${field.key})`);
    used.set(column, field.key);
    taken.add(column);
    columns[field.key] = column;
    add.push(...write(rows, table, field.key, column));
  }
  return { shape: { ...object, table, columns }, add };
}
