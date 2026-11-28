// The record store of metadata objects (F2-4): runs the statements of crm-obj-sql.ts and turns rows back into values.
// The engine API decides what may be written; this layer only reads and writes inside the company and access condition.
import type { AccessPredicate, RecordValue } from '@dio-crm/engine';
import type { FieldDef } from '@dio-crm/contracts/metadata';
import { MetaQuery, MetaTransactional } from './crm-meta-version-store';
import { PublishedCheck, assertStillPublished } from './crm-meta-published';
import { ObjectShape, columnFor } from './crm-obj-names';
import { ListQuery, Page, RecordScope, Statement, getStatement, insertStatement, listStatement, updateStatement } from './crm-obj-sql';

export interface StoredRecord { id: string; values: Record<string, RecordValue> }
const run = (query: MetaQuery, s: Statement) => query(s.text, s.params);

function valueOf(field: FieldDef, raw: unknown): RecordValue {
  if (raw === null || raw === undefined) return null;
  switch (field.type) {
    case 'datetime': return (raw instanceof Date ? raw : new Date(String(raw))).toISOString();
    case 'date': return raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw).slice(0, 10);
    case 'boolean': return typeof raw === 'number' ? raw !== 0 : Boolean(raw);
    // BIGINT arrives as a string from the mssql driver.
    case 'integer': case 'decimal': return Number(raw);
    default: return String(raw);
  }
}

export function recordOf(object: ObjectShape, row: Record<string, unknown>): StoredRecord {
  const values: Record<string, RecordValue> = {};
  for (const f of object.fields) values[f.key] = valueOf(f, row[columnFor(object, f)]);
  return { id: String(row.id), values };
}

export class SqlObjectRecords {
  constructor(private readonly db: MetaTransactional) {}

  list(object: ObjectShape, scope: RecordScope, predicate: AccessPredicate, page: Page, more: ListQuery = {}): Promise<StoredRecord[]> {
    if (predicate.kind === 'none') return Promise.resolve([]);
    return this.db.transaction(async query => (await run(query, listStatement(object, scope, predicate, page, more))).recordset.map(r => recordOf(object, r)));
  }

  get(object: ObjectShape, scope: RecordScope, predicate: AccessPredicate, id: number): Promise<StoredRecord | undefined> {
    if (predicate.kind === 'none') return Promise.resolve(undefined);
    return this.db.transaction(async query => {
      const [row] = (await run(query, getStatement(object, scope, predicate, id, false))).recordset;
      return row ? recordOf(object, row) : undefined;
    });
  }

  /**
   * `check` (here and in update): the version the values were validated for must still be the published one, checked
   * inside this transaction with the pointer held, so a row is never written under the rules of a version that is gone.
   */
  insert(object: ObjectShape, scope: RecordScope, values: Record<string, RecordValue>, at: Date, check?: PublishedCheck): Promise<StoredRecord> {
    return this.db.transaction(async query => {
      if (check) await assertStillPublished(query, check, 'shared');
      const id = Number((await run(query, insertStatement(object, scope, values, at))).recordset[0].id);
      const [row] = (await run(query, getStatement(object, scope, { kind: 'all' }, id, false))).recordset;
      return recordOf(object, row);
    });
  }

  /**
   * Reads the row with an update lock inside the access condition, lets `decide` return the change (or throw), writes it.
   * Undefined when the row does not exist for this actor; nothing is written then.
   */
  update(object: ObjectShape, scope: RecordScope, predicate: AccessPredicate, id: number,
    decide: (current: StoredRecord) => Record<string, RecordValue>, at: Date, check?: PublishedCheck): Promise<StoredRecord | undefined> {
    if (predicate.kind === 'none') return Promise.resolve(undefined);
    return this.db.transaction(async query => {
      if (check) await assertStillPublished(query, check, 'shared');
      const [row] = (await run(query, getStatement(object, scope, predicate, id, true))).recordset;
      if (!row) return undefined;
      await run(query, updateStatement(object, scope, id, decide(recordOf(object, row)), at));
      const [after] = (await run(query, getStatement(object, scope, { kind: 'all' }, id, false))).recordset;
      return recordOf(object, after);
    });
  }
}
