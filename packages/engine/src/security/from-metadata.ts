// The actor's security from the published settings (F2-7): permission sets by profile role, and the hierarchy from the
// org chart of the actor's company. Pure; the settings are metadata/security/ (contracts security-schemas).
import type { MetadataBundle } from '@dio-crm/contracts/metadata';
import type { Actor } from '../row-access';
import { withHierarchy, type OrgChart } from './hierarchy';
import type { PermissionGrants, PermissionSet } from './permissions';

/**
 * Grants of the profiles whose roles the actor holds. Undefined only when the settings have no profiles file at all
 * (nothing to narrow, as before F2-7). A profiles file, even an empty one, is a declaration: an actor matching no
 * profile gets no sets, closed by default.
 */
export function grantsFromMetadata(bundle: MetadataBundle, roles: readonly string[]): PermissionGrants | undefined {
  if (bundle.profiles === undefined) return undefined;
  const byKey = new Map<string, PermissionSet>(bundle.permissionSets.map(s => [s.key, { key: s.key, objects: s.objects, fields: s.fields }]));
  const mine = bundle.profiles.filter(p => p.roles.some(r => roles.includes(r)));
  const pick = (keys: string[]) => [...new Set(keys)].sort().flatMap(k => (byKey.has(k) ? [byKey.get(k)!] : []));
  return { sets: pick(mine.flatMap(p => p.permissionSets)), restrictions: pick(mine.flatMap(p => p.restrictions)) };
}

/** The org chart of one company, or undefined when the settings have none for it. */
export function orgChartFromMetadata(bundle: MetadataBundle, companyId: number): OrgChart | undefined {
  const chart = bundle.orgCharts.find(c => c.companyId === companyId);
  if (!chart) return undefined;
  return {
    units: chart.units.map(u => ({ id: u.id, ...(u.parentId ? { parentId: u.parentId } : {}), ...(u.headUserId ? { headUserId: u.headUserId } : {}), ...(u.erpOrgCode ? { erpOrgCode: u.erpOrgCode } : {}) })),
    members: chart.members.map(m => ({ userId: m.userId, unitId: m.unitId, ...(m.erpUserCode ? { erpUserCode: m.erpUserCode } : {}) })),
  };
}

/**
 * The actor with grants and hierarchy from the settings. Settings that define profiles replace any grants on the actor;
 * a company with an org chart replaces its subtree. Without such settings the actor keeps what the caller gave it
 * (the API caller gives no grants and no subtree, see backend engine-api/actor.ts).
 */
export function secureActor(actor: Actor, bundle: MetadataBundle, companyId: number): Actor {
  const grants = grantsFromMetadata(bundle, actor.roles ?? []);
  const chart = orgChartFromMetadata(bundle, companyId);
  const withGrants: Actor = grants ? { ...actor, grants } : { ...actor };
  return chart ? withHierarchy(withGrants, chart) : withGrants;
}
