// Physical names of record tables and columns (F2-4, ADR 0004). A table or column gets its name once, when it is first
// made, and dbo.crm_meta_obj_name remembers it: scope '' maps an object key to its table, scope <table> maps a field key
// to its column. A renamed object or field (the old name kept as an alias) finds the old row and keeps its data; the
// new name is recorded next to it, so a rollback to the old name reads the same table and column too. Rows are never
// deleted: a name once used by an object keeps meaning the same column.
import { FieldDef, resolveByNames } from '@dio-crm/contracts/metadata';
import { ObjectShape, columnOf, fieldColumns, safeColumn, safeTable, tableName } from './crm-obj-names';

export interface NameRow { scope: string; name_key: string; physical: string }
export const NAME_TABLE = 'crm_meta_obj_name';
export const NAME_TABLE_DDL = `IF OBJECT_ID(N'dbo.${NAME_TABLE}', N'U') IS NULL
CREATE TABLE dbo.[${NAME_TABLE}] (
  [scope] NVARCHAR(128) NOT NULL,
  [name_key] NVARCHAR(100) NOT NULL,
  [physical] NVARCHAR(128) NOT NULL,
  CONSTRAINT [pk_${NAME_TABLE}] PRIMARY KEY ([scope], [name_key])
)`;
export const NAMES_QUERY = `SELECT [scope], [name_key], [physical] FROM dbo.[${NAME_TABLE}]`;
export const NAME_INSERT = `INSERT INTO dbo.[${NAME_TABLE}] ([scope], [name_key], [physical]) VALUES (@scope, @key, @physical)`;

const TABLES = '';
const lookup = (rows: readonly NameRow[], scope: string, names: readonly string[]) => {
  for (const name of names) { const row = rows.find(r => r.scope === scope && r.name_key === name); if (row) return row.physical; }
  return undefined;
};

/** The table of an object: the one recorded for its key, else for one of its aliases, else a new crm_obj_<key>. */
export function resolveTable(object: ObjectShape, rows: readonly NameRow[]): string {
  return safeTable(lookup(rows, TABLES, [object.key, ...(object.aliases ?? [])]) ?? tableName(object.key));
}

/**
 * The column of a field, by the shared resolution order (the field's key, then its aliases: resolveByNames, the same
 * function the compatibility diff uses). A field whose names mean two different columns would merge them: refused.
 */
function resolveColumn(field: FieldDef, table: string, rows: readonly NameRow[], existing: ReadonlySet<string>): string {
  const ambiguous = () => new Error(`CRM_OBJ_COLUMN_AMBIGUOUS ${table}.${field.key}`);
  const recorded = resolveByNames(field, name => lookup(rows, table, [name]));
  if (recorded.ambiguous) throw ambiguous();
  if (recorded.value !== undefined) return safeColumn(recorded.value);
  // Nothing recorded yet (a table made before names were recorded): an existing column of the key or of an alias is the field's column.
  const found = resolveByNames(field, name => { const column = columnOf({ key: name, system: false }); return existing.has(column) ? column : undefined; });
  if (found.ambiguous) throw ambiguous();
  return found.value ?? columnOf(field);
}

/**
 * The object with its physical names, and the rows to record. `existingColumns` are the table's columns now (lower case).
 * Two fields on one column would overwrite each other, so that stops the run.
 */
export function resolveNames(object: ObjectShape, rows: readonly NameRow[], existingColumns: readonly string[]): { shape: ObjectShape; add: NameRow[] } {
  const table = resolveTable(object, rows), existing = new Set(existingColumns.map(c => c.toLowerCase()));
  const add: NameRow[] = [];
  if (lookup(rows, TABLES, [object.key]) === undefined) add.push({ scope: TABLES, name_key: object.key, physical: table });
  const columns: Record<string, string> = {}, used = new Map<string, string>();
  for (const field of fieldColumns(object.fields)) {
    const column = resolveColumn(field, table, rows, existing);
    const other = used.get(column);
    if (other !== undefined) throw new Error(`CRM_OBJ_COLUMN_CONFLICT ${table}.${column} (${other}, ${field.key})`);
    used.set(column, field.key);
    columns[field.key] = column;
    if (lookup(rows, table, [field.key]) === undefined) add.push({ scope: table, name_key: field.key, physical: column });
  }
  return { shape: { ...object, table, columns }, add };
}
