// D05: a row access rule set that lets anyone see more rows than before (ADR 0007). Narrowing is always fine.
import { Issue, issue } from './issues';
import { FieldDef, ObjectBundle, RowAccessRule } from './schemas';

/** The field a rule reads, by its real key (aliases resolved), or undefined for `all` / `none`. */
function fieldOf(rule: RowAccessRule, ob: ObjectBundle): string | undefined {
  const name = rule.kind === 'unit' ? rule.unitField : rule.kind === 'own' || rule.kind === 'members' ? rule.ownerField : undefined;
  if (name === undefined) return undefined;
  return ob.object.fields.find(f => f.key === name || f.aliases.includes(name))?.key ?? name;
}

/**
 * The head field that continues a base field (the same stored column): the field with the same key, or - when that key
 * is gone from the head - the one head field that lists it as an alias AND is new in the head (its key was neither a
 * key nor an alias of any base field). A field that already existed and merely takes over the old name as an alias is
 * NOT the same field: it has its own column and its own values (ADR 0004), so nothing may follow the old name to it.
 */
export function continuedField(base: ObjectBundle, head: ObjectBundle, baseKey: string): FieldDef | undefined {
  const same = head.object.fields.find(f => f.key === baseKey);
  if (same) return same;
  const known = new Set(base.object.fields.flatMap(f => [f.key, ...f.aliases]));
  const renamed = head.object.fields.filter(f => f.aliases.includes(baseKey) && !known.has(f.key));
  return renamed.length === 1 ? renamed[0] : undefined;
}

/**
 * A head rule is covered when some base rule already granted at least the same rows to at least the same actors:
 * - `none` grants nothing, so it is always covered;
 * - a base `all` covers every rule whose actors it already covered (no permission, or the same permission);
 * - otherwise the base rule must be the same kind on the same field, with no permission or the same permission.
 *   "The same field" follows a rename only as continuedField does: the same stored column, never another field's.
 */
function covered(rule: RowAccessRule, head: ObjectBundle, base: ObjectBundle, baseRules: readonly RowAccessRule[]): boolean {
  if (rule.kind === 'none') return true;
  const perm = rule.permission;
  return baseRules.some(b => {
    if (b.kind === 'none') return false;
    if (b.permission !== undefined && b.permission !== perm) return false;
    if (b.kind === 'all') return true;
    const baseField = fieldOf(b, base);
    const now = baseField === undefined ? undefined : continuedField(base, head, baseField);
    return b.kind === rule.kind && now !== undefined && now.key === fieldOf(rule, head);
  });
}

/**
 * Only a new object (absent from the base) is not compared. An existing object without access.json was closed
 * (no rows), so its base counts as `none` and any head rule other than `none` is a widening.
 * A head without access.json closes the object (no rows), which is a narrowing.
 */
const CLOSED: readonly RowAccessRule[] = [{ kind: 'none' }];
export function diffAccess(base: ObjectBundle, head: ObjectBundle, path: string, out: Issue[]): void {
  if (!head.access) return;
  const baseRules = base.access?.rules ?? CLOSED;
  head.access.rules.forEach((rule, i) => {
    if (!covered(rule, head, base, baseRules)) out.push(issue('D05_ACCESS_WIDENED', `${path}/access/rules[#${i}]`, { entity: head.object.key, rule: rule.kind }));
  });
}
