// Keeps dbo.crm_meta_obj_name in step with what is published (F2-4, ADR 0004). It runs inside the transaction that
// moves the published pointer (every publish and every rollback), so it cannot be skipped and cannot be half done.
//  1. Carry forward: an object or field of the new version that continues a live name (by key or alias) gets its own
//     key recorded on the same table or column, even if nobody has used the object since the rename.
//  2. Retire: every recorded name that the new version no longer has (as a key or an alias) is retired. A retired name
//     is never followed again (crm-obj-name-map.ts): whoever takes it later starts with a fresh table or column.
// An object or field whose names mean two tables or two columns stops the publish (CRM_OBJ_*_AMBIGUOUS).
import { bundleFromFiles, fieldNames } from '@dio-crm/contracts/metadata';
import type { MetaQuery } from './crm-meta-version-store';
import { fieldColumns } from './crm-obj-names';
import { NAMES_QUERY, NAME_INSERT, NAME_RETIRE, NAME_RETIRED_DDL, NAME_REUSE, NAME_TABLE_DDL, NameRow, NameWrite, TABLES, isLive, liveColumn, liveTable } from './crm-obj-name-map';

type File = { path: string; content: string };
export const APPLOCK = `DECLARE @lock INT;
EXEC @lock = sp_getapplock @Resource = N'crm_obj_schema', @LockMode = N'Exclusive', @LockOwner = N'Transaction', @LockTimeout = 30000;
IF @lock < 0 THROW 51000, N'CRM_OBJ_SCHEMA_LOCK', 1;`;

export async function writeNames(query: MetaQuery, writes: readonly NameWrite[]): Promise<void> {
  for (const w of writes) await query(w.reuse ? NAME_REUSE : NAME_INSERT, { scope: w.scope, key: w.name_key, physical: w.physical });
}

/** `files` are the files of the version that is published from now on; undefined when nothing is published. */
export async function syncPublishedNames(query: MetaQuery, files: readonly File[] | undefined): Promise<void> {
  // A version without files has no objects. Files that do not make a bundle cannot be published names: stop.
  const bundle = files?.length ? bundleFromFiles([...files]).bundle : undefined;
  if (files?.length && !bundle) throw new Error('CRM_META_NAMES_UNREADABLE');
  await query(APPLOCK);
  await query(NAME_TABLE_DDL);
  await query(NAME_RETIRED_DDL);
  const rows = (await query(NAMES_QUERY)).recordset as unknown as NameRow[];
  if (!rows.length) return;
  const keep = new Set<string>(), id = (scope: string, name: string) => `${scope}\u0000${name}`;
  const writes: NameWrite[] = [];
  const carry = (scope: string, key: string, physical: string) => {
    const row = rows.find(r => r.scope === scope && r.name_key === key);
    if (!row || !isLive(row)) writes.push({ scope, name_key: key, physical, reuse: row !== undefined });
  };
  for (const { object } of bundle?.objects ?? []) {
    const table = liveTable(object, rows);
    if (table === undefined) continue;
    for (const name of fieldNames(object)) keep.add(id(TABLES, name));
    carry(TABLES, object.key, table);
    for (const field of fieldColumns(object.fields)) {
      const column = liveColumn(field, table, rows);
      if (column === undefined) continue;
      for (const name of fieldNames(field)) keep.add(id(table, name));
      carry(table, field.key, column);
    }
  }
  await writeNames(query, writes);
  for (const row of rows) if (isLive(row) && !keep.has(id(row.scope, row.name_key))) await query(NAME_RETIRE, { scope: row.scope, key: row.name_key });
}
