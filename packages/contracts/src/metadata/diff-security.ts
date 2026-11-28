// D07 / D08 (F2-7): security settings that let someone see or do more than before. Narrowing is always fine.
// D07: a user of an org chart who now heads a subtree with users they could not see before (moving a user, a new head).
// D08: a role that is now allowed an object or field action it was not allowed before (a new role, set, grant, or a
//      removed restriction, or the profiles file removed). Without a profiles file nothing is narrowed, so a base without
//      one allowed everything and any head can only narrow; a head without one after a base with one widens everything.
import { Issue, issue } from './issues';
import type { MetadataBundle } from './schemas';
import type { OrgChartDef, PermissionSetDef } from './security-schemas';

/** Users each user sees through the chart: everyone in the subtrees of the units they head, minus themselves. */
function visibleByUser(chart: OrgChartDef): Map<string, Set<string>> {
  const children = new Map<string, string[]>();
  for (const u of chart.units) if (u.parentId !== undefined) children.set(u.parentId, [...(children.get(u.parentId) ?? []), u.id]);
  const subtree = (root: string) => {
    const seen = new Set<string>(), stack = [root];
    while (stack.length) { const id = stack.pop()!; if (!seen.has(id)) { seen.add(id); stack.push(...(children.get(id) ?? [])); } }
    return seen;
  };
  const out = new Map<string, Set<string>>();
  const users = new Set([...chart.members.map(m => m.userId), ...chart.units.flatMap(u => (u.headUserId ? [u.headUserId] : []))]);
  for (const user of users) {
    const units = new Set<string>();
    for (const u of chart.units) if (u.headUserId === user) for (const id of subtree(u.id)) units.add(id);
    const seen = new Set<string>();
    for (const m of chart.members) if (units.has(m.unitId)) seen.add(m.userId);
    for (const u of chart.units) if (units.has(u.id) && u.headUserId) seen.add(u.headUserId);
    seen.delete(user);
    out.set(user, seen);
  }
  return out;
}

function diffOrg(base: MetadataBundle, head: MetadataBundle, out: Issue[]): void {
  for (const chart of head.orgCharts) {
    const before = base.orgCharts.find(c => c.companyId === chart.companyId);
    // A chart is identified by its company: a company the base had no chart for is compared against an empty chart.
    const was = before ? visibleByUser(before) : new Map<string, Set<string>>();
    for (const [user, now] of [...visibleByUser(chart)].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      const old = was.get(user) ?? new Set<string>();
      const gained = [...now].filter(u => !old.has(u)).sort();
      if (gained.length) out.push(issue('D07_ORG_WIDENED', `orgCharts[${chart.key}]/users[${user}]`, { user, gained: gained.join(', ') },
        { chart: chart.key, companyId: chart.companyId, user, gained }));
    }
  }
}

type Allowance = Set<string>;
/** Every object and field action one role is allowed, as `object:action` and `object.field:action`, like the engine decides. */
function allowedFor(bundle: MetadataBundle, role: string, fieldsOf: (object: string) => string[]): Allowance {
  const byKey = new Map(bundle.permissionSets.map(s => [s.key, s] as const));
  const mine = (bundle.profiles ?? []).filter(p => p.roles.includes(role));
  const pick = (keys: string[]) => keys.flatMap(k => (byKey.has(k) ? [byKey.get(k)!] : []));
  const sets = pick(mine.flatMap(p => p.permissionSets)), denies = pick(mine.flatMap(p => p.restrictions));
  const obj = (list: PermissionSetDef[], o: string, a: 'read' | 'create' | 'edit' | 'delete') => list.some(s => s.objects[o]?.[a] === true);
  const fld = (list: PermissionSetDef[], o: string, f: string, a: 'read' | 'edit') => list.some(s => (s.fields[o]?.[f] ?? s.fields[o]?.['*'])?.[a] === true);
  const can = (o: string, a: 'read' | 'create' | 'edit' | 'delete') => !obj(denies, o, a) && obj(sets, o, a);
  const out: Allowance = new Set();
  const objects = new Set(sets.flatMap(s => [...Object.keys(s.objects), ...Object.keys(s.fields)]));
  for (const o of objects) {
    for (const a of ['read', 'create', 'edit', 'delete'] as const) if (can(o, a)) out.add(`${o}:${a}`);
    for (const f of fieldsOf(o)) {
      const read = can(o, 'read') && !fld(denies, o, f, 'read') && fld(sets, o, f, 'read');
      const edit = read && (can(o, 'edit') || can(o, 'create')) && !fld(denies, o, f, 'edit') && fld(sets, o, f, 'edit');
      if (read) out.add(`${o}.${f}:read`);
      if (edit) out.add(`${o}.${f}:edit`);
    }
  }
  return out;
}

function diffGrants(base: MetadataBundle, head: MetadataBundle, out: Issue[]): void {
  if (base.profiles === undefined) return;
  if (head.profiles === undefined) { out.push(issue('D08_GRANT_WIDENED', 'profiles', { role: '*', gained: 'profiles.json' }, { role: '*', gained: ['profiles.json'] })); return; }
  const fields = new Map(head.objects.map(ob => [ob.object.key, ob.object.fields.map(f => f.key)] as const));
  const fieldsOf = (o: string) => fields.get(o) ?? [];
  const roles = [...new Set(head.profiles.flatMap(p => p.roles))].sort();
  for (const role of roles) {
    const was = allowedFor(base, role, fieldsOf);
    const gained = [...allowedFor(head, role, fieldsOf)].filter(a => !was.has(a)).sort();
    if (gained.length) out.push(issue('D08_GRANT_WIDENED', `profiles/roles[${role}]`, { role, gained: gained.join(', ') }, { role, gained }));
  }
}

export function diffSecurity(base: MetadataBundle, head: MetadataBundle, out: Issue[]): void {
  diffOrg(base, head, out);
  diffGrants(base, head, out);
}
