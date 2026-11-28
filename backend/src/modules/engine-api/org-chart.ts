// The ERP organisation as the engine's org chart (F2-7). Pure mapping of rows already read by the infrastructure layer:
// crm_organization (organization_id, parent_organization_id, erp_org_code) and crm_user (public_id, organization_id, erp_user_code).
// crm_organization has no head column yet, so unit heads are passed in (organization_id -> head user public id).
import type { OrgChart } from '@dio-crm/engine';

export interface OrgRow { organization_id: number | string; parent_organization_id: number | string | null; erp_org_code: string | null; is_active?: boolean | number }
export interface UserRow { public_id: string; organization_id: number | string | null; erp_user_code: string | null; is_active?: boolean | number }

const active = (v: boolean | number | undefined) => v === undefined || v === true || v === 1;

/** Inactive units and users are left out; a unit under an inactive parent keeps its parent link, so that branch fails closed (hierarchyScope opens nothing below the inactive unit; the rest still works). */
export function orgChartFromRows(orgs: readonly OrgRow[], users: readonly UserRow[], heads: Readonly<Record<string, string>> = {}): OrgChart {
  const units = orgs.filter(o => active(o.is_active)).map(o => {
    const id = String(o.organization_id), head = heads[id];
    return {
      id,
      ...(o.parent_organization_id === null ? {} : { parentId: String(o.parent_organization_id) }),
      ...(head ? { headUserId: head } : {}),
      ...(o.erp_org_code ? { erpOrgCode: o.erp_org_code } : {}),
    };
  });
  const members = users.filter(u => active(u.is_active) && u.organization_id !== null && u.public_id)
    .map(u => ({ userId: u.public_id, unitId: String(u.organization_id), ...(u.erp_user_code ? { erpUserCode: u.erp_user_code } : {}) }));
  return { units, members };
}
