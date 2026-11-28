// D05: a row access rule set that lets anyone see more rows than before (ADR 0007). Narrowing is always fine.
import { Issue, issue } from './issues';
import { FieldDef, ObjectBundle, RowAccessRule } from './schemas';
import { fieldNames, resolveByNames } from './field-names';

/** The field a rule reads, by its real key (aliases resolved), or undefined for `all` / `none`. */
function fieldOf(rule: RowAccessRule, ob: ObjectBundle): string | undefined {
  const name = rule.kind === 'unit' ? rule.unitField : rule.kind === 'own' || rule.kind === 'members' || rule.kind === 'subtree' ? rule.ownerField : undefined;
  if (name === undefined) return undefined;
  return ob.object.fields.find(f => f.key === name || f.aliases.includes(name))?.key ?? name;
}

/**
 * The base field a head field continues (the same stored column), by the storage's own resolution (field-names.ts):
 * its key and aliases, looked up among the base's keys and aliases. A head field whose names mean more than one base
 * field would merge two columns, so it continues none (`merged`).
 */
export function baseFieldOf(base: ObjectBundle, headField: FieldDef): { field: FieldDef | undefined; merged: boolean } {
  const known = new Map<string, FieldDef>();
  for (const f of base.object.fields) for (const name of fieldNames(f)) if (!known.has(name)) known.set(name, f);
  const hit = resolveByNames(headField, name => known.get(name));
  return { field: hit.ambiguous ? undefined : hit.value, merged: hit.ambiguous };
}

/**
 * The head field that continues a base field: the one head field whose names resolve to that base field and to no
 * other. Two head fields on one base field, or a head field that absorbs two base fields, continue nothing: the
 * storage refuses both, and nothing (a row access rule above all) may follow a name into another field's values.
 */
export function continuedField(base: ObjectBundle, head: ObjectBundle, baseKey: string): FieldDef | undefined {
  const hits = head.object.fields.filter(f => baseFieldOf(base, f).field?.key === baseKey);
  return hits.length === 1 ? hits[0] : undefined;
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
