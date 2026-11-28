// A list view's filter and sort as SQL (F2-5). The condition language is the admin one (all, any, not, eq, ne, in,
// isEmpty, gt, gte, lt, lte). Every value is a parameter; every identifier is a field of the object, looked up by key
// or alias and written through columnFor. NULL counts as "empty", so each leaf is plainly true or false and `not` is safe.
import type { FieldDef } from '@dio-crm/contracts/metadata';
import { ObjectShape, columnFor, quote } from './crm-obj-names';
import { dateParam, dateTimeParam } from './sql-params';

export type Condition =
  | { op: 'all' | 'any'; args: Condition[] }
  | { op: 'not'; arg: Condition }
  | { op: 'eq' | 'ne' | 'in' | 'isEmpty' | 'gt' | 'gte' | 'lt' | 'lte'; field: string; value?: unknown };
export interface SortKey { field: string; direction: 'ASC' | 'DESC' }
export interface ParamBag { add(value: unknown): string }
export class FilterError extends Error {
  readonly code = 'CRM_OBJ_BAD_FILTER';
  constructor(detail: string) { super(`CRM_OBJ_BAD_FILTER ${detail.slice(0, 120)}`); this.name = 'FilterError'; }
}

export const MAX_FILTER_VALUES = 500;
const COMPARE = { gt: '>', gte: '>=', lt: '<', lte: '<=' } as const;
const TEXT_LIKE: readonly string[] = ['text', 'enum', 'reference'];

export function fieldByName(object: ObjectShape, name: string): FieldDef {
  const field = object.fields.find(f => f.key === name) ?? object.fields.find(f => f.aliases.includes(name));
  if (!field) throw new FilterError(`unknown field ${String(name)}`);
  return field;
}

/** One filter value as a parameter of the field's type. A value of another type is a settings error, not a query. */
function valueParam(field: FieldDef, value: unknown): unknown {
  const bad = () => new FilterError(`value of ${field.key} is not ${field.type}`);
  switch (field.type) {
    case 'integer': case 'decimal': if (typeof value !== 'number' || !Number.isFinite(value)) throw bad(); return value;
    case 'boolean': if (typeof value !== 'boolean') throw bad(); return value;
    case 'date': case 'datetime':
      if (typeof value !== 'string') throw bad();
      try { return field.type === 'date' ? dateParam(value) : dateTimeParam(value); } catch { throw bad(); }
    default: if (typeof value !== 'string') throw bad(); return value;
  }
}

export function conditionSql(condition: Condition, object: ObjectShape, params: ParamBag): string {
  let count = 0;
  const param = (field: FieldDef, value: unknown) => {
    if (++count > MAX_FILTER_VALUES) throw new FilterError('too many values');
    return params.add(valueParam(field, value));
  };
  const walk = (c: Condition): string => {
    if ('args' in c) {
      if ((c.op !== 'all' && c.op !== 'any') || !Array.isArray(c.args) || c.args.length === 0) throw new FilterError('all / any without arguments');
      return `(${c.args.map(walk).join(c.op === 'all' ? ' AND ' : ' OR ')})`;
    }
    if ('arg' in c) {
      if (c.op !== 'not') throw new FilterError('unknown operator');
      return `(NOT ${walk(c.arg)})`;
    }
    const field = fieldByName(object, c.field), column = quote(columnFor(object, field));
    const empty = c.value === null || c.value === undefined;
    switch (c.op) {
      case 'isEmpty': return TEXT_LIKE.includes(field.type) ? `(${column} IS NULL OR ${column} = ${params.add('')})` : `(${column} IS NULL)`;
      case 'eq': return empty ? `(${column} IS NULL)` : `(${column} IS NOT NULL AND ${column} = ${param(field, c.value)})`;
      case 'ne': return empty ? `(${column} IS NOT NULL)` : `(${column} IS NULL OR ${column} <> ${param(field, c.value)})`;
      case 'in': {
        if (!Array.isArray(c.value) || c.value.length === 0) throw new FilterError(`in without values on ${field.key}`);
        return `(${column} IS NOT NULL AND ${column} IN (${c.value.map(v => param(field, v)).join(', ')}))`;
      }
      case 'gt': case 'gte': case 'lt': case 'lte':
        if (empty) throw new FilterError(`${c.op} without a value on ${field.key}`);
        return `(${column} IS NOT NULL AND ${column} ${COMPARE[c.op]} ${param(field, c.value)})`;
      default: throw new FilterError(`unknown operator ${String((c as { op: unknown }).op)}`);
    }
  };
  return walk(condition);
}

/** `ORDER BY` columns of a view's sort, always ending with [id] so pages are stable. */
export function orderBySql(sort: readonly SortKey[], object: ObjectShape): string {
  const keys = sort.map(s => {
    if (s.direction !== 'ASC' && s.direction !== 'DESC') throw new FilterError('unknown sort direction');
    return `${quote(columnFor(object, fieldByName(object, s.field)))} ${s.direction}`;
  });
  return [...keys, '[id]'].join(', ');
}
