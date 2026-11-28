// F2-7 through the automatic API on the SQLite fake: role hierarchy over a synthetic org (company -1),
// object permissions and field permissions (hidden fields leave responses and cannot be written).
import { withHierarchy, checkOrgChart } from '@dio-crm/engine';
import type { PermissionGrants } from '@dio-crm/engine';
import { LEAD, caller, engineFixture } from '../../../test/support/engine-fixture';
import { orgChartFromRows } from './org-chart';

const CO = -1;
// Synthetic organisation: 1 domestic > 2 region > 3 division > 4, 5 branches. Never a real row.
const chart = orgChartFromRows(
  [{ organization_id: 1, parent_organization_id: null, erp_org_code: 'V-DOM' }, { organization_id: 2, parent_organization_id: 1, erp_org_code: 'V-REG' },
    { organization_id: 3, parent_organization_id: 2, erp_org_code: 'V-DIV' }, { organization_id: 4, parent_organization_id: 3, erp_org_code: 'V-BR-A' },
    { organization_id: 5, parent_organization_id: 3, erp_org_code: 'V-BR-B' }, { organization_id: 9, parent_organization_id: 1, erp_org_code: 'V-OFF', is_active: 0 }],
  [{ public_id: 'sa1', organization_id: 4, erp_user_code: 'E1' }, { public_id: 'sa2', organization_id: 4, erp_user_code: 'E2' },
    { public_id: 'sb1', organization_id: 5, erp_user_code: 'E3' }, { public_id: 'gone', organization_id: 4, erp_user_code: null, is_active: false }],
  { 2: 'hreg', 3: 'hdiv', 4: 'hbra', 5: 'hbrb' });
const as = (userId: string, grants?: PermissionGrants) => {
  const c = caller(userId, CO, grants ? { grants } : {});
  return { ...c, actor: withHierarchy(c.actor, chart) };
};
const owners = (items: { values: Record<string, unknown> }[]) => items.map(i => i.values.owner_name).sort();

describe('role hierarchy through the API', () => {
  it('maps the ERP rows and leaves inactive units and users out', () => {
    expect(checkOrgChart(chart)).toEqual([]);
    expect(chart.units.map(u => u.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(chart.members.map(m => m.userId)).toEqual(['sa1', 'sa2', 'sb1']);
  });

  it('salesperson sees own rows only; branch head sees the branch; region head sees the subtree', async () => {
    const { api } = await engineFixture();
    for (const u of ['sa1', 'sa2', 'sb1', 'hbra', 'hdiv']) await api.create(as(u), 'lead', LEAD);
    const list = async (u: string) => owners((await api.list(as(u), 'lead', {})).items);
    expect(await list('sa1')).toEqual(['sa1']);
    expect(await list('sb1')).toEqual(['sb1']);
    expect(await list('hbra')).toEqual(['hbra', 'sa1', 'sa2']);
    expect(await list('hbrb')).toEqual(['sb1']);
    expect(await list('hreg')).toEqual(['hbra', 'hdiv', 'sa1', 'sa2', 'sb1']);
    // A sibling-branch record is "not found", not forbidden.
    const sb = (await api.list(as('sb1'), 'lead', {})).items[0];
    await expect(api.get(as('sa1'), 'lead', sb.id)).rejects.toMatchObject({ status: 404 });
    await expect(api.get(as('hbra'), 'lead', sb.id)).rejects.toMatchObject({ status: 404 });
    // Other company: the hierarchy opens nothing across companies.
    expect((await api.list({ ...as('hreg'), companyId: 1 }, 'lead', {})).items).toEqual([]);
  });

  it('a head cannot hand a record outside the subtree', async () => {
    const { api } = await engineFixture();
    const r = await api.create(as('sa1'), 'lead', LEAD);
    await expect(api.update(as('hbra'), 'lead', r.id, { owner_name: 'sb1' })).rejects.toMatchObject({ status: 403 });
  });
});

const sales: PermissionGrants = { sets: [{ key: 'sales', objects: { lead: { read: true, create: true, edit: true } }, fields: { lead: { '*': { read: true, edit: true }, phone: { read: true } } } }],
  restrictions: [{ key: 'pii', fields: { lead: { business_no: { read: true } } } }] };

describe('object and field permissions through the API', () => {
  it('an unreadable field is absent from every response and cannot be written; a read-only field cannot be written', async () => {
    const { api } = await engineFixture();
    const full = await api.create(as('sa1'), 'lead', { ...LEAD, business_no: '123', phone: '010' });
    expect(full.values.business_no).toBe('123');
    const g = as('sa1', sales);
    expect('business_no' in (await api.get(g, 'lead', full.id)).values).toBe(false);
    expect((await api.list(g, 'lead', {})).items.every(i => !('business_no' in i.values))).toBe(true);
    await expect(api.update(g, 'lead', full.id, { business_no: '999' })).rejects.toMatchObject({ status: 400, errors: [{ code: 'UNKNOWN_FIELD', field: 'business_no' }] });
    await expect(api.update(g, 'lead', full.id, { phone: '011' })).rejects.toMatchObject({ status: 400, errors: [{ code: 'READ_ONLY_FIELD', field: 'phone' }] });
    await expect(api.create(g, 'lead', { ...LEAD, business_no: '1' })).rejects.toMatchObject({ errors: [{ code: 'UNKNOWN_FIELD', field: 'business_no' }] });
    const updated = await api.update(g, 'lead', full.id, { hospital_name: 'H2' });
    expect(updated.values.hospital_name).toBe('H2');
    expect('business_no' in updated.values).toBe(false);
    // The hidden value was not touched by the allowed write.
    expect((await api.get(as('sa1'), 'lead', full.id)).values.business_no).toBe('123');
    const ui = await api.ui(g, 'lead', 'en-US');
    expect(ui.fields.some(f => f.key === 'business_no')).toBe(false);
    expect(ui.fields.find(f => f.key === 'phone')?.readOnly).toBe(true);
  });

  it('grants without the object are closed: no list, no read, no create, no edit', async () => {
    const { api } = await engineFixture();
    const r = await api.create(as('sa1'), 'lead', LEAD);
    const none = as('sa1', { sets: [] });
    await expect(api.list(none, 'lead', {})).rejects.toMatchObject({ status: 403, code: 'OBJECT_ACCESS_DENIED' });
    await expect(api.get(none, 'lead', r.id)).rejects.toMatchObject({ status: 403 });
    await expect(api.create(none, 'lead', LEAD)).rejects.toMatchObject({ status: 403 });
    const readOnly = as('sa1', { sets: [{ key: 'r', objects: { lead: { read: true } }, fields: { lead: { '*': { read: true } } } }] });
    expect((await api.get(readOnly, 'lead', r.id)).values.hospital_name).toBe('H1');
    await expect(api.update(readOnly, 'lead', r.id, { hospital_name: 'X' })).rejects.toMatchObject({ status: 403 });
    await expect(api.create(readOnly, 'lead', LEAD)).rejects.toMatchObject({ status: 403 });
    expect((await api.ui(readOnly, 'lead', 'en-US')).access).toEqual({ read: true, create: false });
  });

  it('a hidden status: a view filtering on it is refused and left out of the UI, and create does not name it', async () => {
    const { api } = await engineFixture();
    await api.create(as('sa1'), 'lead', LEAD);
    const g = as('sa1', { sets: [sales.sets[0]], restrictions: [{ key: 'st', fields: { lead: { status: { read: true } } } }] });
    await expect(api.list(g, 'lead', { view: 'excluded' })).rejects.toMatchObject({ status: 400, code: 'BAD_VIEW' });
    expect((await api.list(g, 'lead', { view: 'hq_default' })).items.every(i => !('status' in i.values))).toBe(true);
    const ui = await api.ui(g, 'lead', 'en-US');
    expect(ui.listViews.map(v => v.key)).toEqual(['hq_default']);
    const failure = await api.create(g, 'lead', { hospital_name: 'H' }).catch(e => e);
    expect(failure).toMatchObject({ status: 400, code: 'INVALID_RECORD' });
    expect(JSON.stringify(failure.errors)).not.toContain('status');
    expect(failure.errors).toEqual([{ code: 'NOT_PERMITTED' }]);
    await expect(api.create(g, 'lead', { ...LEAD })).rejects.toMatchObject({ errors: [{ code: 'UNKNOWN_FIELD', field: 'status' }] });
  });
});
