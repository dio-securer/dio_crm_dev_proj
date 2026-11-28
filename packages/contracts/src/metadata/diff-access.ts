// D05: a row access rule set that lets anyone see more rows than before (ADR 0007). Narrowing is always fine.
import { Issue, issue } from './issues';
import { ObjectBundle, RowAccessRule } from './schemas';

/** The field a rule reads, by its real key (aliases resolved), or undefined for `all` / `none`. */
function fieldOf(rule: RowAccessRule, ob: ObjectBundle): string | undefined {
  const name = rule.kind === 'unit' ? rule.unitField : rule.kind === 'own' || rule.kind === 'members' ? rule.ownerField : undefined;
  if (name === undefined) return undefined;
  return ob.object.fields.find(f => f.key === name || f.aliases.includes(name))?.key ?? name;
}

/**
 * A head rule is covered when some base rule already granted at least the same rows to at least the same actors:
 * - `none` grants nothing, so it is always covered;
 * - a base `all` covers every rule whose actors it already covered (no permission, or the same permission);
 * - otherwise the base rule must be the same kind on the same field, with no permission or the same permission.
 *   "The same field" follows a rename: the base field's key is looked up in the head by key or alias.
 */
function covered(rule: RowAccessRule, head: ObjectBundle, base: ObjectBundle, baseRules: readonly RowAccessRule[]): boolean {
  if (rule.kind === 'none') return true;
  const perm = rule.permission;
  return baseRules.some(b => {
    if (b.kind === 'none') return false;
    if (b.permission !== undefined && b.permission !== perm) return false;
    if (b.kind === 'all') return true;
    // A base field renamed in the head (old key kept as an alias, ADR 0004) is still the same field, the same stored values.
    const baseField = fieldOf(b, base);
    const sameField = baseField !== undefined && fieldOf({ kind: 'own', ownerField: baseField }, head) === fieldOf(rule, head);
    return b.kind === rule.kind && sameField;
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
