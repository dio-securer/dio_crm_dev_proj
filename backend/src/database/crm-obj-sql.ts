// SQL of the record tables (F2-4). Values only ever travel as parameters with generated names (@p0, @p1, ...);
// identifiers come from metadata keys checked in crm-obj-names.ts. The engine's access predicate becomes a WHERE condition.
import type { AccessPredicate, RecordValue } from '@dio-crm/engine';
import { columnOf, fieldColumns, quote, tableName } from './crm-obj-names';
import type { ObjectShape } from './crm-obj-schema';

export interface Statement { text: string; params: Record<string, unknown> }
export interface RecordScope { companyId: number; actor: string }
export interface Page { limit: number; offset: number }
/** SQL Server takes at most 2100 parameters; an actor whose rules expand past this many values is refused. */
export const MAX_ACCESS_VALUES = 1000;
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
  const count = predicate.terms.reduce((n, t) => n + t.values.length, 0);
  if (count > MAX_ACCESS_VALUES) throw new Error('ACCESS_TOO_WIDE');
  const parts = predicate.terms.filter(t => t.values.length > 0)
    .map(t => `${quote(columnOf(fieldOf(object, t.field)))} COLLATE ${EXACT} IN (${t.values.map(v => params.add(String(v))).join(', ')})`);
  return parts.length ? `(${parts.join(' OR ')})` : '1 = 0';
}

/** [id] and one column per field, each field's column once. */
export function selectList(object: ObjectShape): string {
  const columns = ['id', ...new Set(object.fields.map(columnOf))];
  return columns.map(quote).join(', ');
}

const toParam = (object: ObjectShape, key: string, value: RecordValue) =>
  value !== null && fieldOf(object, key).type === 'datetime' ? new Date(String(value)) : value;

export function listStatement(object: ObjectShape, scope: RecordScope, predicate: AccessPredicate, page: Page): Statement {
  const params = new Params({ company: scope.companyId, offset: page.offset, limit: page.limit });
  const where = accessCondition(predicate, object, params);
  const text = `SELECT ${selectList(object)} FROM dbo.${quote(tableName(object.key))} WHERE [company_id] = @company AND ${where}
ORDER BY [id] OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
  return { text, params: params.values };
}

export function getStatement(object: ObjectShape, scope: RecordScope, predicate: AccessPredicate, id: number, lock: boolean): Statement {
  const params = new Params({ company: scope.companyId, id });
  const where = accessCondition(predicate, object, params);
  const hint = lock ? ' WITH (UPDLOCK, ROWLOCK)' : '';
  const text = `SELECT ${selectList(object)} FROM dbo.${quote(tableName(object.key))}${hint} WHERE [id] = @id AND [company_id] = @company AND ${where}`;
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
  const params = new Params({ company: scope.companyId, at, by: scope.actor });
  const columns = ['[company_id]', '[created_at]', '[created_by]', '[updated_at]', '[updated_by]'];
  const slots = ['@company', '@at', '@by', '@at', '@by'];
  for (const [key, value] of writable(object, values)) {
    columns.push(quote(columnOf(fieldOf(object, key))));
    slots.push(params.add(toParam(object, key, value)));
  }
  const text = `INSERT INTO dbo.${quote(tableName(object.key))} (${columns.join(', ')}) OUTPUT INSERTED.[id] VALUES (${slots.join(', ')})`;
  return { text, params: params.values };
}

export function updateStatement(object: ObjectShape, scope: RecordScope, id: number, values: Record<string, RecordValue>, at: Date): Statement {
  const params = new Params({ company: scope.companyId, id, at, by: scope.actor });
  const sets = writable(object, values).map(([key, value]) => `${quote(columnOf(fieldOf(object, key)))} = ${params.add(toParam(object, key, value))}`);
  sets.push('[updated_at] = @at', '[updated_by] = @by');
  const text = `UPDATE dbo.${quote(tableName(object.key))} SET ${sets.join(', ')} WHERE [id] = @id AND [company_id] = @company`;
  return { text, params: params.values };
}
