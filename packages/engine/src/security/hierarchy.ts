// Role hierarchy over the organisation tree (F2-7): the head of a unit sees what is owned inside that unit's subtree.
// Pure. The tree comes from the ERP organisation (crm_organization.parent_organization_id); the backend maps the rows.
// The result feeds the existing `members` and `unit` row rules, so no rule kind is added and no settings rule is widened.
import type { Actor } from '../row-access';

export interface OrgUnit {
  id: string;
  /** Parent unit; absent for a root. */
  parentId?: string;
  /** The user who heads this unit (region head, division head, branch head). */
  headUserId?: string;
  /** The ERP organisation code this unit came from, when it came from the ERP. */
  erpOrgCode?: string;
}
export interface OrgMember { userId: string; unitId: string; erpUserCode?: string }
export interface OrgChart { units: readonly OrgUnit[]; members: readonly OrgMember[] }

export type OrgChartIssueCode = 'DUPLICATE_UNIT' | 'UNKNOWN_PARENT' | 'CYCLE' | 'UNKNOWN_UNIT' | 'DUPLICATE_MEMBER';
export interface OrgChartIssue { code: OrgChartIssueCode; id: string }

/** Problems that would make the hierarchy ambiguous. A chart with issues must not be used to open rows. */
export function checkOrgChart(chart: OrgChart): OrgChartIssue[] {
  const issues: OrgChartIssue[] = [];
  const byId = new Map<string, OrgUnit>();
  for (const u of chart.units) { if (byId.has(u.id)) issues.push({ code: 'DUPLICATE_UNIT', id: u.id }); else byId.set(u.id, u); }
  for (const u of byId.values()) {
    if (u.parentId !== undefined && !byId.has(u.parentId)) { issues.push({ code: 'UNKNOWN_PARENT', id: u.id }); continue; }
    const seen = new Set<string>([u.id]);
    for (let p = u.parentId; p !== undefined; p = byId.get(p)?.parentId) {
      if (seen.has(p)) { issues.push({ code: 'CYCLE', id: u.id }); break; }
      seen.add(p);
    }
  }
  const users = new Set<string>();
  for (const m of chart.members) {
    if (!byId.has(m.unitId)) issues.push({ code: 'UNKNOWN_UNIT', id: m.userId });
    if (users.has(m.userId)) issues.push({ code: 'DUPLICATE_MEMBER', id: m.userId });
    users.add(m.userId);
  }
  return issues.sort((a, b) => (a.code + a.id < b.code + b.id ? -1 : a.code + a.id > b.code + b.id ? 1 : 0));
}

/** The units below `rootId`, itself included. Safe on a broken tree: each unit is visited once. */
export function subtreeOf(chart: OrgChart, rootId: string): string[] {
  const children = new Map<string, string[]>();
  for (const u of chart.units) if (u.parentId !== undefined) children.set(u.parentId, [...(children.get(u.parentId) ?? []), u.id]);
  const out: string[] = [], seen = new Set<string>(), stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id); out.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out.sort();
}

export interface HierarchyScope { unitIds: string[]; memberIds: string[] }

/**
 * Units that cannot be trusted, failing closed per branch: a duplicate id, a missing parent (e.g. an inactive unit that
 * was left out), a cycle, and every unit below one of these. The rest of the chart keeps working.
 */
function brokenUnits(chart: OrgChart): Set<string> {
  const issues = checkOrgChart(chart);
  const bad = new Set<string>();
  for (const i of issues) if (i.code === 'DUPLICATE_UNIT' || i.code === 'UNKNOWN_PARENT' || i.code === 'CYCLE') for (const id of subtreeOf(chart, i.id)) bad.add(id);
  return bad;
}

/**
 * What a user sees through the hierarchy: for every healthy unit the user heads, its healthy subtree (units, members
 * and heads). A user who heads nothing gets nothing here (their own rows come from the `own` rule). A broken branch
 * (see brokenUnits) gives its heads nothing and is not reached from above; a user listed twice is never opened.
 */
export function hierarchyScope(chart: OrgChart, userId: string): HierarchyScope {
  const bad = brokenUnits(chart);
  const dupUsers = new Set(checkOrgChart(chart).filter(i => i.code === 'DUPLICATE_MEMBER').map(i => i.id));
  const units = new Set<string>();
  for (const u of chart.units) {
    if (u.headUserId !== userId || bad.has(u.id)) continue;
    for (const id of subtreeOf(chart, u.id)) if (!bad.has(id)) units.add(id);
  }
  const members = new Set<string>();
  for (const m of chart.members) if (units.has(m.unitId) && !dupUsers.has(m.userId)) members.add(m.userId);
  for (const u of chart.units) if (units.has(u.id) && u.headUserId && !dupUsers.has(u.headUserId)) members.add(u.headUserId);
  members.delete(userId);
  return { unitIds: [...units].sort(), memberIds: [...members].sort() };
}

/** The actor with its hierarchy scope added to the members and units it already had. */
export function withHierarchy(actor: Actor, chart: OrgChart): Actor {
  const scope = hierarchyScope(chart, actor.userId);
  const merge = (a: readonly string[] | undefined, b: string[]) => [...new Set([...(a ?? []), ...b])].sort();
  return { ...actor, memberIds: merge(actor.memberIds, scope.memberIds), unitIds: merge(actor.unitIds, scope.unitIds) };
}
