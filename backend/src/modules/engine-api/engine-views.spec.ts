// The automatic API for the generic screens (F2-5) on the SQLite fake: list views (filter and sort), the reference
// match of related lists, and the screen model. Row access and the company stay in force under every filter.
import { ACCESS, LEAD, caller, editJson, engineFixture, readMetadata } from '../../../test/support/engine-fixture';

const VIEWS = 'metadata/objects/lead/list-views.json';
const u1 = caller('u1'), u2 = caller('u2');
const visit = [
  { path: 'metadata/objects/visit/object.json', content: JSON.stringify({ aliases: [], key: 'visit', labelKey: 'lead.tab.basic', pluralLabelKey: 'lead.tab.keyman' }) },
  { path: 'metadata/objects/visit/fields.json', content: JSON.stringify({ fields: [
    { aliases: [], key: 'lead_ref', labelKey: 'lead.label', required: true, system: false, type: 'reference', referenceObject: 'lead' },
    { aliases: [], key: 'second_ref', labelKey: 'lead.label', required: false, system: false, type: 'reference', referenceObject: 'lead' },
    { aliases: [], key: 'owner', labelKey: 'lead.field.owner_name', required: false, system: false, type: 'text' },
    { aliases: [], key: 'memo', labelKey: 'lead.field.phone', required: false, system: false, type: 'text' }] }) },
  { path: 'metadata/objects/visit/access.json', content: JSON.stringify({ entity: 'visit', rules: [{ kind: 'own', ownerField: 'owner' }] }) },
];
const names = (page: { items: { values: Record<string, unknown> }[] }) => page.items.map(r => r.values.hospital_name);

describe('engine API: list views', () => {
  it('applies the view\'s filter, sort and page size, inside the actor\'s rows only', async () => {
    const files = editJson(readMetadata(), VIEWS, d => { d.views[1].sort = [{ field: 'hospital_name', direction: 'DESC' }]; d.views[1].pageSize = 2; });
    const { api } = await engineFixture(files);
    for (const [who, name, status] of [[u1, 'A', 'NEW'], [u1, 'B', 'CONTACT_EXCLUDED'], [u2, 'C', 'CONTACT_EXCLUDED'], [u1, 'D', 'CONTACT_EXCLUDED'], [u1, 'E', 'CONTACT_EXCLUDED']] as const) {
      await api.create(who, 'lead', { hospital_name: name, status });
    }
    const page = await api.list(u1, 'lead', { view: 'excluded' });
    expect(names(page)).toEqual(['E', 'D']);
    expect(page.limit).toBe(2);
    expect(names(await api.list(u1, 'lead', { view: 'excluded', offset: '2' }))).toEqual(['B']);
    expect(names(await api.list(u1, 'lead', { view: 'excluded', limit: '50' }))).toEqual(['E', 'D', 'B']);
    expect(names(await api.list(u2, 'lead', { view: 'excluded' }))).toEqual(['C']);
    expect(names(await api.list(caller('u1', 2), 'lead', { view: 'excluded' }))).toEqual([]);
    expect(names(await api.list(u1, 'lead', { view: 'hq_default' }))).toEqual(['A', 'B', 'D', 'E']);
    expect(names(await api.list(u1, 'lead', {}))).toEqual(['A', 'B', 'D', 'E']);
  });

  it('refuses a view that does not exist or whose filter cannot become a query', async () => {
    const files = editJson(readMetadata(), VIEWS, d => { d.views[1].filter = { op: 'eq', field: 'status', value: 5 }; });
    const { api } = await engineFixture(files);
    for (const view of ['nope', '', ['excluded'], "excluded' OR 1=1 --"]) await expect(api.list(u1, 'lead', { view })).rejects.toMatchObject({ status: 400, code: 'BAD_VIEW' });
    await api.create(u1, 'lead', LEAD);
    await expect(api.list(u1, 'lead', { view: 'excluded' })).rejects.toMatchObject({ status: 400, code: 'BAD_VIEW' });
    expect(names(await api.list(u1, 'lead', { view: 'hq_default' }))).toEqual(['H1']);
  });
});

describe('engine API: rows that refer to a record (related lists)', () => {
  it('matches one reference field exactly, still inside row access, and refuses any other field', async () => {
    const { api, publish, db } = await engineFixture();
    await publish([...readMetadata(), ...visit]);
    await api.create(u1, 'visit', { lead_ref: '1', memo: 'a' });
    await api.create(u1, 'visit', { lead_ref: '2', memo: 'b' });
    await api.create(u2, 'visit', { lead_ref: '1', memo: 'c' });
    await api.create(u1, 'visit', { lead_ref: '1', memo: 'd' });
    const memos = async (who: typeof u1, query: Record<string, unknown>) => (await api.list(who, 'visit', query)).items.map(r => r.values.memo);
    expect(await memos(u1, { 'ref.lead_ref': '1' })).toEqual(['a', 'd']);
    expect(await memos(u2, { 'ref.lead_ref': '1' })).toEqual(['c']);
    expect(await memos(u1, { 'ref.lead_ref': '3' })).toEqual([]);
    const evil = "1' OR '1'='1";
    expect(await memos(u1, { 'ref.lead_ref': evil })).toEqual([]);
    for (const s of db.log) expect(s.text).not.toContain(evil);
    for (const query of [{ 'ref.memo': 'a' }, { 'ref.owner': 'u2' }, { 'ref.nope': '1' }, { 'ref.lead_ref': '' }, { 'ref.lead_ref': ['1', '2'] }, { 'ref.lead_ref': 'x'.repeat(101) },
      { 'ref.lead_ref': '1', 'ref.memo': 'a' }, { 'ref.lead_ref': '1', 'ref.second_ref': '1' }, { 'ref.': '1' }, { 'ref.lead_ref]; DROP TABLE crm_obj_visit; --': '1' }]) {
      await expect(api.list(u1, 'visit', query)).rejects.toMatchObject({ status: 400, code: 'BAD_FILTER' });
    }
    expect(db.tables()).toContain('crm_obj_visit');
  });
});

describe('engine API: the screen model', () => {
  it('gives the published settings in the asked language with what the actor may do, and nothing about rows or rules', async () => {
    const { api, publish } = await engineFixture();
    await api.create(u1, 'lead', LEAD);
    const ui = await api.ui(u1, 'lead', 'en-US');
    expect(ui).toMatchObject({ versionId: 1, locale: 'en-US', object: { key: 'lead', label: 'Lead' }, access: { read: true, create: true } });
    expect(ui.texts['engine.action.save']).toBe('Save');
    expect((await api.ui(u1, 'lead', 'ko-KR')).object.label).not.toBe('Lead');
    expect(JSON.stringify(ui)).not.toMatch(/ownerField|H1|"rules"/);
    await publish(readMetadata().filter(f => f.path !== ACCESS));
    expect(await api.ui(u1, 'lead', 'en-US')).toMatchObject({ versionId: 2, access: { read: false, create: false } });
  });

  it('opens create only for an actor some rule applies to; unknown objects and languages are refused', async () => {
    const files = editJson(readMetadata(), ACCESS, d => { d.rules = [{ kind: 'all', permission: 'company.manage' }]; });
    const { api } = await engineFixture(files);
    expect((await api.ui(u1, 'lead', 'en-US')).access).toEqual({ read: false, create: false });
    expect((await api.ui(caller('u1', 1, { permissions: ['company.manage'] }), 'lead', 'en-US')).access).toEqual({ read: true, create: true });
    await expect(api.ui(u1, 'nope', 'en-US')).rejects.toMatchObject({ status: 404, code: 'OBJECT_NOT_FOUND' });
    for (const locale of [undefined, 'fr-FR', ['en-US'], '']) await expect(api.ui(u1, 'lead', locale)).rejects.toMatchObject({ status: 400, code: 'BAD_LOCALE' });
    await expect((await engineFixture(null)).api.ui(u1, 'lead', 'en-US')).rejects.toMatchObject({ status: 503, code: 'NO_PUBLISHED_METADATA' });
  });
});
