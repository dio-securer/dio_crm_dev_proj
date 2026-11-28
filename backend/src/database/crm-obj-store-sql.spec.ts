// The record store alone on the SQLite fake (F2-4): the SQL condition by itself keeps other owners' and other
// companies' rows out, without the engine's second check in the API layer.
import type { FieldDef } from '@dio-crm/contracts/metadata';
import { sqliteDb } from '../../test/support/sqlite-db';
import { applyObjectSchema } from './crm-obj-schema';
import { SqlObjectRecords } from './crm-obj-store';

const field = (key: string): FieldDef => ({ key, type: 'text', labelKey: 'x', required: false, system: false, aliases: [] } as FieldDef);
const lead = { key: 'lead', fields: [field('hospital_name'), field('owner_name'), field('sido')] };
const page = { limit: 50, offset: 0 };
const at = new Date('2026-11-28T00:00:00Z');

async function seeded() {
  const db = sqliteDb();
  await applyObjectSchema(db, [lead]);
  const store = new SqlObjectRecords(db);
  const add = (companyId: number, owner: string, sido: string) => store.insert(lead, { companyId, actor: owner }, { hospital_name: `${owner}-${companyId}`, owner_name: owner, sido }, at);
  await add(1, 'u1', 'A'); await add(1, 'u2', 'B'); await add(1, 'u3', 'A'); await add(2, 'u1', 'A');
  return { store, db };
}
const names = (rows: { values: Record<string, unknown> }[]) => rows.map(r => r.values.hospital_name);

describe('record store SQL on its own', () => {
  it('lists only rows inside the company and the access condition', async () => {
    const { store } = await seeded();
    const s1 = { companyId: 1, actor: 'u1' };
    expect(names(await store.list(lead, s1, { kind: 'anyOf', terms: [{ field: 'owner_name', values: ['u1'] }] }, page))).toEqual(['u1-1']);
    expect(names(await store.list(lead, s1, { kind: 'anyOf', terms: [{ field: 'owner_name', values: ['u2'] }, { field: 'sido', values: ['A'] }] }, page)))
      .toEqual(['u1-1', 'u2-1', 'u3-1']);
    expect(names(await store.list(lead, s1, { kind: 'all' }, page))).toEqual(['u1-1', 'u2-1', 'u3-1']);
    expect(names(await store.list(lead, { companyId: 2, actor: 'u1' }, { kind: 'all' }, page))).toEqual(['u1-2']);
    expect(await store.list(lead, s1, { kind: 'none' }, page)).toEqual([]);
    expect(await store.list(lead, s1, { kind: 'anyOf', terms: [{ field: 'owner_name', values: ["u1' OR '1'='1"] }] }, page)).toEqual([]);
  });

  it('reads and updates nothing outside the condition, and writes nothing then', async () => {
    const { store, db } = await seeded();
    const s1 = { companyId: 1, actor: 'u1' }, own = { kind: 'anyOf' as const, terms: [{ field: 'owner_name', values: ['u1'] }] };
    expect(await store.get(lead, s1, own, 2)).toBeUndefined();
    expect((await store.get(lead, s1, own, 1))?.values.hospital_name).toBe('u1-1');
    const before = db.log.length;
    expect(await store.get(lead, s1, { kind: 'none' }, 1)).toBeUndefined();
    expect(await store.update(lead, s1, { kind: 'none' }, 1, () => ({ sido: 'Z' }), at)).toBeUndefined();
    expect(db.log.length).toBe(before);
    expect(await store.get(lead, s1, { kind: 'all' }, 4)).toBeUndefined();
    let asked = 0;
    expect(await store.update(lead, s1, own, 2, () => { asked++; return { sido: 'Z' }; }, at)).toBeUndefined();
    expect(await store.update(lead, s1, { kind: 'all' }, 4, () => { asked++; return { sido: 'Z' }; }, at)).toBeUndefined();
    expect(asked).toBe(0);
    expect(db.raw.prepare("SELECT COUNT(*) AS n FROM crm_obj_lead WHERE f_sido = 'Z'").get().n).toBe(0);
    expect((await store.update(lead, s1, own, 1, () => ({ sido: 'Z' }), at))?.values.sido).toBe('Z');
  });

  it('reads the row to update with an update lock inside the access condition; plain reads take no lock', async () => {
    const { store, db } = await seeded();
    const s1 = { companyId: 1, actor: 'u1' }, own = { kind: 'anyOf' as const, terms: [{ field: 'owner_name', values: ['u1'] }] };
    const start = db.log.length;
    await store.update(lead, s1, own, 1, () => ({ sido: 'Z' }), at);
    const [read, write, after] = db.log.slice(start).map(l => l.text);
    expect(read).toBe('SELECT [id], [f_hospital_name], [f_owner_name], [f_sido] FROM dbo.[crm_obj_lead] WITH (UPDLOCK, ROWLOCK) '
      + 'WHERE [id] = @id AND [company_id] = @company AND ([f_owner_name] COLLATE Latin1_General_100_BIN2 IN (@p0))');
    expect(write).toMatch(/^UPDATE dbo\.\[crm_obj_lead\] SET /);
    expect(after).not.toMatch(/UPDLOCK|ROWLOCK/);
    await store.get(lead, s1, own, 1);
    await store.list(lead, s1, own, page);
    for (const l of db.log.slice(start + 3)) expect(l.text).not.toMatch(/UPDLOCK|ROWLOCK/);
  });

  it('round-trips the dates the real-database script writes (year 1000 with .001 ms, 0001-01-01, typed nulls, exact updated_at)', async () => {
    const db = sqliteDb(), store = new SqlObjectRecords(db), s = { companyId: -4242, actor: 'a' }, all = { kind: 'all' as const };
    const f = (key: string, type: string, system = false): FieldDef => ({ key, type, labelKey: 'x', required: false, system, aliases: [] } as FieldDef);
    const [shape] = await applyObjectSchema(db, [{ key: 'zz_engine_check', aliases: [], fields: [f('met_at', 'datetime'), f('opened_on', 'date'), f('updated_at', 'datetime', true)] }]);
    const made = await store.insert(shape, s, { met_at: '1000-01-01T00:00:00.001Z', opened_on: '0001-01-01' }, new Date('2026-01-01T00:00:00.001Z'));
    expect((await store.get(shape, s, all, Number(made.id)))?.values).toEqual({ met_at: '1000-01-01T00:00:00.001Z', opened_on: '0001-01-01', updated_at: '2026-01-01T00:00:00.001Z' });
    const later = await store.update(shape, s, all, Number(made.id), () => ({ met_at: '9999-12-31T23:59:59.999Z', opened_on: null }), new Date(5));
    expect(later?.values).toEqual({ met_at: '9999-12-31T23:59:59.999Z', opened_on: null, updated_at: '1970-01-01T00:00:00.005Z' });
  });

  it('rolls the update back when the decision throws', async () => {
    const { store, db } = await seeded();
    await expect(store.update(lead, { companyId: 1, actor: 'u1' }, { kind: 'all' }, 1, () => { throw new Error('no'); }, at)).rejects.toThrow('no');
    expect(db.raw.prepare('SELECT f_sido FROM crm_obj_lead WHERE id = 1').get().f_sido).toBe('A');
  });
});
