// SQL injection attempts against the automatic API (F2-4), run through the real SQL on the SQLite fake.
// Hostile text in values, actor ids, object names, ids and page values must stay data or be refused.
import { LEAD, caller, engineFixture } from '../../../test/support/engine-fixture';
import { EngineApiError } from './engine-records';

const EVIL = ["x' OR 1=1 --", "'); DROP TABLE crm_obj_lead; --", '] ; DELETE FROM crm_obj_lead; --', '%', "' OR '1'='1"];
const u1 = caller('u1');
async function code(work: Promise<unknown>) {
  const e = await work.then(() => undefined, err => err);
  expect(e).toBeInstanceOf(EngineApiError);
  return `${e.status} ${e.code}`;
}

describe('engine API: injection attempts', () => {
  it('stores hostile text as data and never puts it in the SQL text', async () => {
    const { api, db } = await engineFixture();
    for (const evil of EVIL) await api.create(u1, 'lead', { ...LEAD, hospital_name: evil, phone: evil });
    const items = (await api.list(u1, 'lead', {})).items;
    expect(items.map(r => r.values.hospital_name)).toEqual(EVIL);
    expect(db.tables()).toEqual(['crm_meta_obj_name', 'crm_obj_lead']);
    for (const s of db.log) for (const evil of EVIL) expect(s.text).not.toContain(evil);
  });

  it('a hostile actor id matches nothing but its own rows', async () => {
    const { api } = await engineFixture();
    await api.create(u1, 'lead', LEAD);
    for (const evil of EVIL) {
      const actor = caller(evil, 1, { memberIds: [evil], unitIds: [evil] });
      expect((await api.list(actor, 'lead', {})).items).toEqual([]);
      expect(await code(api.get(actor, 'lead', '1'))).toBe('404 RECORD_NOT_FOUND');
      const own = await api.create(actor, 'lead', LEAD);
      expect((await api.list(actor, 'lead', {})).items.map(r => r.id)).toEqual([own.id]);
    }
    expect((await api.list(u1, 'lead', {})).items.map(r => r.id)).toEqual(['1']);
  });

  it('ids are compared exactly: another case or a wildcard is another user', async () => {
    const { api } = await engineFixture();
    await api.create(u1, 'lead', LEAD);
    for (const other of ['U1', 'u1 ', ' u1', 'u%', 'u_']) expect((await api.list(caller(other), 'lead', {})).items).toEqual([]);
  });

  it('refuses hostile object names, ids and page values before any SQL runs', async () => {
    const { api, db } = await engineFixture();
    await api.create(u1, 'lead', LEAD);
    const before = db.log.length;
    expect(await code(api.list(u1, 'lead; DROP TABLE crm_obj_lead', {}))).toBe('404 OBJECT_NOT_FOUND');
    expect(await code(api.list(u1, '__proto__', {}))).toBe('404 OBJECT_NOT_FOUND');
    for (const id of ['1 OR 1=1', '1;--', '0', '-1', '1e3', '01', '9'.repeat(16), ' 1']) expect(await code(api.get(u1, 'lead', id))).toBe('404 RECORD_NOT_FOUND');
    expect(await code(api.update(u1, 'lead', '1 OR 1=1', { phone: 'x' }))).toBe('404 RECORD_NOT_FOUND');
    for (const limit of ['10; DROP TABLE crm_obj_lead', '1 OR 1=1', '']) expect(await code(api.list(u1, 'lead', { limit }))).toBe('400 BAD_PAGE');
    expect(db.log.length).toBe(before);
  });

  it('a hostile field name is an unknown field, not a column', async () => {
    const { api } = await engineFixture();
    const e = await api.create(u1, 'lead', { ...LEAD, 'f_phone] = 1; --': 'x' }).then(() => undefined, err => err);
    expect(e.errors).toEqual([{ code: 'UNKNOWN_FIELD', field: 'f_phone] = 1; --' }]);
  });
});
