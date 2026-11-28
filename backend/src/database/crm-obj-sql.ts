// SQL of the record tables (F2-4). Values only ever travel as parameters with generated names (@p0, @p1, ...);
// identifiers come from metadata keys checked in crm-obj-names.ts. The engine's access predicate becomes a WHERE condition.
import type { AccessPredicate, RecordValue } from '@dio-crm/engine';
import { ObjectShape, columnFor, fieldColumns, quote, tableOf } from './crm-obj-names';
import { Condition, SortKey, conditionSql, orderBySql } from './crm-obj-filter';
import { dateParam, dateTimeParam } from './sql-params';

export interface Statement { text: string; params: Record<string, unknown> }
export interface RecordScope { companyId: number; actor: string }
export interface Page { limit: number; offset: number }
/** What a list adds to the company and access conditions: a view's filter and sort, and one reference field equal to a value. */
export interface ListQuery { filter?: Condition; sort?: readonly SortKey[]; equals?: { field: string; value: string } }
/** SQL Server takes at most 2100 parameters; an actor whose rules expand past this many values is refused. */
export const MAX_ACCESS_VALUES = 1000;
export class AccessTooWideError extends Error {
  readonly code = 'ACCESS_TOO_WIDE';
  constructor() { super('ACCESS_TOO_WIDE'); this.name = 'AccessTooWideError'; }
}
export const accessValueCount = (predicate: AccessPredicate) => (predicate.kind === 'anyOf' ? predicate.terms.reduce((n, t) => n + t.values.length, 0) : 0);
export function assertAccessWidth(predicate: AccessPredicate): void {
  if (accessValueCount(predicate) > MAX_ACCESS_VALUES) throw new AccessTooWideError();
}
/** Owner and unit ids are compared exactly (case-sensitive), as the engine compares them, whatever the database collation. */
export const EXACT = 'Latin1_General_100_BIN2';

class Params {
  private next = 0;
  readonly values: Record<string, unknown> = {};
  constructor(fixed: Record<string, unknown>) { Object.assign(this.values, fixed); }
  add(value: unknown): string { const name = `p${this.next++}`; this.values[name] = value; return `@${name}`; }
}

function fieldOf(object: ObjectShape, key: string) {
  const field = object.fields.find(f => f.key === key);
  if (!field) throw new Error(`CRM_OBJ_UNKNOWN_FIELD ${key.slice(0, 100)}`);
  return field;
}

/** The access predicate as a condition. 'none' is `1 = 0`; callers skip the query for it anyway. */
function accessCondition(predicate: AccessPredicate, object: ObjectShape, params: Params): string {
  if (predicate.kind === 'all') return '1 = 1';
  if (predicate.kind === 'none') return '1 = 0';
  assertAccessWidth(predicate);
  const parts = predicate.terms.filter(t => t.values.length > 0)
    .map(t => `${quote(columnFor(object, fieldOf(object, t.field)))} COLLATE ${EXACT} IN (${t.values.map(v => params.add(String(v))).join(', ')})`);
  return parts.length ? `(${parts.join(' OR ')})` : '1 = 0';
}

/** [id] and one column per field, each field's column once. */
export function selectList(object: ObjectShape): string {
  const columns = ['id', ...new Set(object.fields.map(f => columnFor(object, f)))];
  return columns.map(quote).join(', ');
}

/** Dates and date-times travel with an explicit SQL type (DATE, DATETIME2(3)); see sql-params.ts. */
function toParam(object: ObjectShape, key: string, value: RecordValue): unknown {
  const type = fieldOf(object, key).type;
  if (type === 'datetime') return dateTimeParam(value === null ? null : String(value));
  if (type === 'date') return dateParam(value === null ? null : String(value));
  return value;
}

export function listStatement(object: ObjectShape, scope: RecordScope, predicate: AccessPredicate, page: Page, query: ListQuery = {}): Statement {
  const params = new Params({ company: scope.companyId, offset: page.offset, limit: page.limit });
  // The company and access conditions always come first and are ANDed with everything else: a filter can only narrow.
  const where = [accessCondition(predicate, object, params)];
  if (query.equals) where.push(`${quote(columnFor(object, fieldOf(object, query.equals.field)))} COLLATE ${EXACT} = ${params.add(String(query.equals.value))}`);
  if (query.filter) where.push(conditionSql(query.filter, object, params));
  const text = `SELECT ${selectList(object)} FROM dbo.${quote(tableOf(object))} WHERE [company_id] = @company AND ${where.join(' AND ')}
ORDER BY ${orderBySql(query.sort ?? [], object)} OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
  return { text, params: params.values };
}

export function getStatement(object: ObjectShape, scope: RecordScope, predicate: AccessPredicate, id: number, lock: boolean): Statement {
  const params = new Params({ company: scope.companyId, id });
  const where = accessCondition(predicate, object, params);
  const hint = lock ? ' WITH (UPDLOCK, ROWLOCK)' : '';
  const text = `SELECT ${selectList(object)} FROM dbo.${quote(tableOf(object))}${hint} WHERE [id] = @id AND [company_id] = @company AND ${where}`;
  return { text, params: params.values };
}

function writable(object: ObjectShape, values: Record<string, RecordValue>): [string, RecordValue][] {
  const own = new Set(fieldColumns(object.fields).map(f => f.key));
  return Object.entries(values).map(([key, value]) => {
    if (!own.has(fieldOf(object, key).key)) throw new Error(`CRM_OBJ_NOT_WRITABLE ${key}`);
    return [key, value];
  });
}

export function insertStatement(object: ObjectShape, scope: RecordScope, values: Record<string, RecordValue>, at: Date): Statement {
  const params = new Params({ company: scope.companyId, at: dateTimeParam(at), by: scope.actor });
  const columns = ['[company_id]', '[created_at]', '[created_by]', '[updated_at]', '[updated_by]'];
  const slots = ['@company', '@at', '@by', '@at', '@by'];
  for (const [key, value] of writable(object, values)) {
    columns.push(quote(columnFor(object, fieldOf(object, key))));
    slots.push(params.add(toParam(object, key, value)));
  }
  const text = `INSERT INTO dbo.${quote(tableOf(object))} (${columns.join(', ')}) OUTPUT INSERTED.[id] VALUES (${slots.join(', ')})`;
  return { text, params: params.values };
}

export function updateStatement(object: ObjectShape, scope: RecordScope, id: number, values: Record<string, RecordValue>, at: Date): Statement {
  const params = new Params({ company: scope.companyId, id, at: dateTimeParam(at), by: scope.actor });
  const sets = writable(object, values).map(([key, value]) => `${quote(columnFor(object, fieldOf(object, key)))} = ${params.add(toParam(object, key, value))}`);
  sets.push('[updated_at] = @at', '[updated_by] = @by');
  const text = `UPDATE dbo.${quote(tableOf(object))} SET ${sets.join(', ')} WHERE [id] = @id AND [company_id] = @company`;
  return { text, params: params.values };
}
