// Synthetic end-to-end checks of the automatic API (F2-4) on the SQLite fake: CRUD, row access (no leaks across owners
// or companies), closed by default, and only the published metadata version drives it.
import { ACCESS, LEAD, NOW, caller, editJson, engineFixture, readMetadata } from '../../../test/support/engine-fixture';
import { EngineApiError, EngineRecords } from './engine-records';

const u1 = caller('u1'), u2 = caller('u2'), boss = caller('u2', 1, { memberIds: ['u1'] }), otherCompany = caller('u1', 2);
async function rejects(work: Promise<unknown>, status: number, code: string) {
  const e = await work.then(() => undefined, err => err);
  expect(e).toBeInstanceOf(EngineApiError);
  expect({ status: e.status, code: e.code }).toEqual({ status, code });
  return e as EngineApiError;
}

describe('engine API: records of a published object', () => {
  it('creates a lead, fills the owner and the managed fields, and reads it back', async () => {
    const { api, db } = await engineFixture();
    const made = await api.create(u1, 'lead', { ...LEAD, phone: '010' });
    expect(made.id).toBe('1');
    expect(made.values).toMatchObject({ ...LEAD, phone: '010', owner_name: 'u1', updated_at: NOW.toISOString(), sido: null });
    expect(await api.get(u1, 'lead', '1')).toEqual(made);
    expect(db.tables()).toEqual(['crm_obj_lead']);
  });

  it('never shows another owner\'s row: list, read and update all behave as if it did not exist', async () => {
    const { api, db } = await engineFixture();
    await api.create(u1, 'lead', LEAD);
    expect((await api.list(u2, 'lead', {})).items).toEqual([]);
    await rejects(api.get(u2, 'lead', '1'), 404, 'RECORD_NOT_FOUND');
    await rejects(api.update(u2, 'lead', '1', { phone: 'x' }), 404, 'RECORD_NOT_FOUND');
    expect(db.raw.prepare('SELECT f_phone FROM crm_obj_lead').get().f_phone).toBeNull();
  });

  it('shows a member\'s row through the members rule', async () => {
    const { api } = await engineFixture();
    await api.create(u1, 'lead', LEAD);
    await api.create(u2, 'lead', { ...LEAD, hospital_name: 'H2' });
    expect((await api.list(boss, 'lead', {})).items.map(r => r.values.hospital_name)).toEqual(['H1', 'H2']);
    expect((await api.list(u1, 'lead', {})).items.map(r => r.values.hospital_name)).toEqual(['H1']);
  });

  it('never crosses companies, even for the same user id', async () => {
    const { api } = await engineFixture();
    await api.create(u1, 'lead', LEAD);
    expect((await api.list(otherCompany, 'lead', {})).items).toEqual([]);
    await rejects(api.get(otherCompany, 'lead', '1'), 404, 'RECORD_NOT_FOUND');
    await rejects(api.update(otherCompany, 'lead', '1', { phone: 'x' }), 404, 'RECORD_NOT_FOUND');
  });

  it('refuses to create a row for someone else or to hand a row out of the actor\'s access', async () => {
    const { api, db } = await engineFixture();
    await rejects(api.create(u1, 'lead', { ...LEAD, owner_name: 'u2' }), 403, 'ACCESS_DENIED');
    await api.create(u1, 'lead', LEAD);
    await rejects(api.update(u1, 'lead', '1', { owner_name: 'u2' }), 403, 'ACCESS_DENIED');
    expect(db.raw.prepare('SELECT f_owner_name FROM crm_obj_lead').get().f_owner_name).toBe('u1');
    const lead = caller('u1', 1, { memberIds: ['u2'] });
    expect((await api.update(lead, 'lead', '1', { owner_name: 'u2' })).values.owner_name).toBe('u2');
  });

  it('updates only the sent fields and stamps updated_at', async () => {
    const { api } = await engineFixture();
    await api.create(u1, 'lead', { ...LEAD, phone: '1' });
    const after = await api.update(u1, 'lead', '1', { sido: 'S', phone: null });
    expect(after.values).toMatchObject({ ...LEAD, sido: 'S', phone: null, owner_name: 'u1' });
  });

  it('refuses system and read-only fields and reports every field error', async () => {
    const files = editJson(readMetadata(), 'metadata/objects/lead/screens/detail.json', d => { d.fields.fields.find((f: any) => f.key === 'phone').readOnly = true; });
    const { api, db } = await engineFixture(files);
    const e = await rejects(api.create(u1, 'lead', { ...LEAD, updated_at: '2026-01-01T00:00:00Z', phone: '1', status: 'WON', nope: 1 }), 400, 'INVALID_RECORD');
    expect(e.errors).toEqual([{ code: 'BAD_ENUM', field: 'status' }, { code: 'SYSTEM_FIELD', field: 'updated_at' },
      { code: 'READ_ONLY_FIELD', field: 'phone' }, { code: 'UNKNOWN_FIELD', field: 'nope' }]);
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM crm_obj_lead').get().n).toBe(0);
  });

  it('pages the list and refuses bad page values', async () => {
    const { api } = await engineFixture();
    for (const h of ['A', 'B', 'C']) await api.create(u1, 'lead', { ...LEAD, hospital_name: h });
    const page = await api.list(u1, 'lead', { limit: '2', offset: '1' });
    expect(page).toMatchObject({ object: 'lead', versionId: 1, limit: 2, offset: 1 });
    expect(page.items.map(r => r.values.hospital_name)).toEqual(['B', 'C']);
    for (const q of [{ limit: '0' }, { limit: '201' }, { limit: '1.5' }, { offset: '-1' }, { limit: ['1', '2'] }]) await rejects(api.list(u1, 'lead', q), 400, 'BAD_PAGE');
  });
});

describe('engine API: closed by default, published version only', () => {
  it('answers 503 before anything is published, and 404 for an object that is not in the metadata', async () => {
    const empty = await engineFixture(null);
    await rejects(empty.api.list(u1, 'lead', {}), 503, 'NO_PUBLISHED_METADATA');
    const { api } = await engineFixture();
    await rejects(api.list(u1, 'account', {}), 404, 'OBJECT_NOT_FOUND');
  });

  it('an object without access rules shows nothing and accepts no create', async () => {
    const { api, publish } = await engineFixture();
    await api.create(u1, 'lead', LEAD);
    await publish(readMetadata().filter(f => f.path !== ACCESS));
    expect((await api.list(u1, 'lead', {})).items).toEqual([]);
    await rejects(api.get(u1, 'lead', '1'), 404, 'RECORD_NOT_FOUND');
    await rejects(api.create(u1, 'lead', LEAD), 403, 'ACCESS_DENIED');
  });

  it('a staged version does nothing until it is published; a rollback takes effect at once', async () => {
    const { api, versions, publish } = await engineFixture();
    await api.create(u1, 'lead', LEAD);
    await versions.stage(editJson(readMetadata(), ACCESS, d => { d.rules = [{ kind: 'all' }]; }), 'test');
    expect((await api.list(u2, 'lead', {})).items).toEqual([]);
    await publish(readMetadata().filter(f => f.path !== ACCESS));
    expect((await api.list(u1, 'lead', {})).items).toEqual([]);
    await versions.rollback('test');
    expect((await api.list(u1, 'lead', {})).items.map(r => r.id)).toEqual(['1']);
  });

  it('a permission-gated rule opens all rows only for actors with that permission', async () => {
    const files = editJson(readMetadata(), ACCESS, d => { d.rules = [{ kind: 'own', ownerField: 'owner_name' }, { kind: 'all', permission: 'company.manage' }]; });
    const { api } = await engineFixture(files);
    await api.create(u1, 'lead', LEAD);
    expect((await api.list(u2, 'lead', {})).items).toEqual([]);
    expect((await api.list(caller('u2', 1, { permissions: ['company.manage'] }), 'lead', {})).items.length).toBe(1);
    expect((await api.list(caller('u2', 2, { permissions: ['company.manage'] }), 'lead', {})).items).toEqual([]);
  });
});

describe('engine API: second check of rows the database returns', () => {
  it('hides rows outside the predicate even if the database returned them (e.g. collation or padding differences)', async () => {
    const { api } = await engineFixture();
    await api.create(u1, 'lead', LEAD);
    const foreign = { id: '99', values: { ...LEAD, owner_name: 'u1 ' } };
    const inner = (api as any).store;
    const leaky = { ...inner, list: async (...a: any[]) => [...await inner.list(...a), foreign], get: async () => foreign,
      update: (o: any, s: any, p: any, id: number, decide: any, at: Date) => inner.update(o, s, { kind: 'all' }, id, decide, at) };
    const guarded = new EngineRecords((api as any).published, leaky, () => NOW);
    expect((await guarded.list(u1, 'lead', {})).items.map(r => r.id)).toEqual(['1']);
    await rejects(guarded.get(u1, 'lead', '99'), 404, 'RECORD_NOT_FOUND');
    await api.create(u2, 'lead', LEAD);
    await rejects(guarded.update(u1, 'lead', '2', { phone: 'x' }), 404, 'RECORD_NOT_FOUND');
  });
});
