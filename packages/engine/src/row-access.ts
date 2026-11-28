// Row-level access: which rows an actor may see. Pure; rules are ORed; no rule means no access (closed by default).
// accessPredicate gives the same answer as canAccessRow in a form a data layer can turn into a query (F2-4).

import type { RowAccessRule } from '@dio-crm/contracts/metadata';
import type { PermissionGrants } from './security/permissions';
/** The rule shape is the settings schema of access.json (contracts), so settings and evaluator cannot drift apart. */
export type { RowAccessRule };

export interface Actor {
  userId: string;
  /** Users whose rows this actor may see through a `members` rule (e.g. the actor's team). */
  memberIds?: readonly string[];
  /** Organization units whose rows this actor may see through a `unit` rule. */
  unitIds?: readonly string[];
  permissions: readonly string[];
  /** Object and field permissions (F2-7). Absent: the caller narrows nothing beyond row access (no source yet). */
  grants?: PermissionGrants;
}

export type Row = Readonly<Record<string, unknown>>;

export type AccessPredicate =
  | { kind: 'all' }
  | { kind: 'none' }
  | { kind: 'anyOf'; terms: { field: string; values: string[] }[] };

function applies(rule: RowAccessRule, actor: Actor): boolean {
  if (rule.kind === 'none') return false;
  return rule.permission === undefined || actor.permissions.includes(rule.permission);
}

function termOf(rule: RowAccessRule, actor: Actor): { field: string; values: string[] } | 'all' | undefined {
  if (!applies(rule, actor)) return undefined;
  switch (rule.kind) {
    case 'all': return 'all';
    case 'own': return { field: rule.ownerField, values: [actor.userId] };
    case 'members': return { field: rule.ownerField, values: [...(actor.memberIds ?? [])] };
    case 'unit': return { field: rule.unitField, values: [...(actor.unitIds ?? [])] };
    default: return undefined;
  }
}

export function accessPredicate(rules: readonly RowAccessRule[], actor: Actor): AccessPredicate {
  const merged = new Map<string, Set<string>>();
  for (const rule of rules) {
    const t = termOf(rule, actor);
    if (t === 'all') return { kind: 'all' };
    if (!t) continue;
    const set = merged.get(t.field) ?? new Set<string>();
    for (const v of t.values) set.add(v);
    merged.set(t.field, set);
  }
  const terms = [...merged].filter(([, set]) => set.size > 0).map(([field, set]) => ({ field, values: [...set].sort() }));
  return terms.some(() => true) ? { kind: 'anyOf', terms } : { kind: 'none' };
}

export function matchesPredicate(predicate: AccessPredicate, row: Row): boolean {
  if (predicate.kind !== 'anyOf') return predicate.kind === 'all';
  return predicate.terms.some(t => {
    const value = row[t.field];
    return typeof value === 'string' && t.values.includes(value);
  });
}

export function canAccessRow(rules: readonly RowAccessRule[], actor: Actor, row: Row): boolean {
  return matchesPredicate(accessPredicate(rules, actor), row);
}

export function filterRows<R extends Row>(rules: readonly RowAccessRule[], actor: Actor, rows: readonly R[]): R[] {
  const predicate = accessPredicate(rules, actor);
  return rows.filter(row => matchesPredicate(predicate, row));
}
