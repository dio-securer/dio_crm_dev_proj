// A request that still holds an older published version (F2-4) - on the SQLite fake. It may not complete tables, record
// names or write rows once the pointer has moved: otherwise it would bring a retired name back to life and a later
// object of that name would inherit the old rows under new access rules.
import { StaleVersionError, assertStillPublished, pointerQuery, sqlPublishedCheck } from '../../database/crm-meta-published';
import { applyObjectSchema } from '../../database/crm-obj-schema';
import { SqlObjectRecords } from '../../database/crm-obj-store';
import { caller, engineFixture, readMetadata } from '../../../test/support/engine-fixture';
import { EngineRecords } from './engine-records';
import { PublishedModels } from './published-model';

type File = { path: string; content: string };
const u1 = caller('u1'), u2 = caller('u2');
const text = (key: string) => ({ aliases: [], key, labelKey: 'lead.field.phone', required: false, system: false, type: 'text' });
const visit = (rules: unknown[], more: Record<string, unknown> = {}, fields = [text('owner'), text('memo')]): File[] => [
  { path: 'metadata/objects/visit/object.json', content: JSON.stringify({ aliases: [], key: 'visit', labelKey: 'lead.label', pluralLabelKey: 'lead.plural', ...more }) },
  { path: 'metadata/objects/visit/fields.json', content: JSON.stringify({ fields }) },
  { path: 'metadata/objects/visit/access.json', content: JSON.stringify({ entity: 'visit', rules }) },
];
const OWN = [{ kind: 'own', ownerField: 'owner' }], ALL = [{ kind: 'all' }];
const STALE = { status: 503, code: 'PUBLISHED_METADATA_CHANGED' };
type Fixture = Awaited<ReturnType<typeof engineFixture>>;
const liveNames = (f: Fixture) => f.db.raw.prepare("SELECT scope, name_key FROM crm_meta_obj_name WHERE retired IS NULL AND (name_key = 'visit' OR scope LIKE 'crm_obj_visit%')").all().map((r: any) => `${r.scope}/${r.name_key}`);
const rowsIn = (f: Fixture, table: string) => f.db.raw.prepare(`SELECT f_memo FROM ${table} ORDER BY id`).all().map((r: any) => r.f_memo);
const memos = async (f: Fixture, who: typeof u1) => (await f.api.list(who, 'visit', {})).items.map(r => r.values.memo);

describe('engine API: a request that holds an older version', () => {
  it('cannot complete the table of a retired object, so the object added again later does not inherit the old rows', async () => {
    const f = await engineFixture([...readMetadata(), ...visit(OWN)]);
    await f.api.create(u1, 'visit', { memo: 'private' });
    // Another server: it has read version 1 but not opened the object yet.
    const held = (await new PublishedModels(f.ports).current())!;
    await f.publish([...readMetadata(), ...visit(OWN, { deprecated: { since: '2026-11' } })]);
    await f.publish(readMetadata());
    expect(liveNames(f)).toEqual([]);
    // Its request goes on with version 1: it is refused, and nothing is recorded or made.
    await expect(held.shape('visit')).rejects.toMatchObject(STALE);
    expect(liveNames(f)).toEqual([]);
    await f.publish([...readMetadata(), ...visit(ALL)]);
    expect(await memos(f, u2)).toEqual([]);
    expect(f.db.tables().filter(t => t.startsWith('crm_obj_visit'))).toEqual(['crm_obj_visit', 'crm_obj_visit_r2']);
    expect(rowsIn(f, 'crm_obj_visit')).toEqual(['private']);
    // Still stale after the object is back: version 1 is not what is published.
    await expect(held.shape('visit')).rejects.toMatchObject(STALE);
  });

  it('cannot write rows: create and update are refused inside their transaction and change nothing', async () => {
    const f = await engineFixture([...readMetadata(), ...visit(OWN)]);
    await f.api.create(u1, 'visit', { memo: 'first' });
    // A request that read version 1 and has the table ready, frozen at that moment.
    const held = (await new PublishedModels(f.ports).current())!;
    await held.shape('visit');
    const frozen = new EngineRecords({ current: async () => held }, new SqlObjectRecords(f.db));
    expect((await frozen.create(u1, 'visit', { memo: 'in time' })).values.memo).toBe('in time');
    await f.publish([...readMetadata(), ...visit([{ kind: 'none' }])]);
    await expect(frozen.create(u1, 'visit', { memo: 'too late' })).rejects.toMatchObject(STALE);
    await expect(frozen.update(u1, 'visit', '1', { memo: 'too late' })).rejects.toMatchObject(STALE);
    expect(rowsIn(f, 'crm_obj_visit')).toEqual(['first', 'in time']);
    // The current version (closed to everyone) answers as itself.
    await expect(f.api.create(u1, 'visit', { memo: 'x' })).rejects.toMatchObject({ status: 403 });
  });

  it('a rollback moves the stamp too: what was held for the same version id before is stale', async () => {
    const f = await engineFixture([...readMetadata(), ...visit(OWN)]);
    const held = (await new PublishedModels(f.ports).current())!;
    await f.publish([...readMetadata(), ...visit(OWN, {}, [text('owner'), text('memo'), text('extra')])]);
    await f.versions.rollback('test');
    expect((await f.versions.published())!.id).toBe(held.versionId);
    await expect(held.shape('visit')).rejects.toMatchObject(STALE);
    expect((await f.api.create(u1, 'visit', { memo: 'ok' })).values.memo).toBe('ok');
  });
});

describe('the checks inside the transactions', () => {
  const field = (key: string) => text(key) as any;
  it('the schema step records nothing for an object or a field that the published version does not have', async () => {
    const f = await engineFixture([...readMetadata(), ...visit(OWN)]);
    const check = f.ports.check((await f.ports.readPointer())!);
    const before = f.db.tables();
    await expect(applyObjectSchema(f.db, [{ key: 'ghost', aliases: [], fields: [field('a')] }], check)).rejects.toThrow('CRM_PUBLISHED_VERSION_CHANGED not published: ghost');
    await expect(applyObjectSchema(f.db, [{ key: 'visit', aliases: [], fields: [field('owner'), field('sneaked')] }], check)).rejects.toThrow('CRM_PUBLISHED_VERSION_CHANGED not published: visit.sneaked');
    expect(f.db.tables()).toEqual(before);
    expect(liveNames(f)).toEqual([]);
    expect((await applyObjectSchema(f.db, [{ key: 'visit', aliases: [], fields: [field('owner'), field('memo')] }], check))[0].table).toBe('crm_obj_visit');
    // Another stamp or another id: refused before anything else is sent.
    for (const expected of [{ id: check.expected.id, stamp: 'x' }, { id: check.expected.id + 1, stamp: check.expected.stamp }]) {
      const sent = f.db.log.length;
      await expect(applyObjectSchema(f.db, [{ key: 'visit', aliases: [], fields: [] }], { ...check, expected })).rejects.toBeInstanceOf(StaleVersionError);
      expect(f.db.log.length).toBe(sent);
    }
  });

  it('SQL: the pointer is read with a lock held to the end of the transaction, before the application lock; shared for writes, update for the schema step', async () => {
    expect(pointerQuery('shared')).toBe('SELECT published_version_id, (SELECT MAX(id) FROM dbo.crm_meta_event) AS stamp FROM dbo.crm_meta_pointer WITH (HOLDLOCK) WHERE id = 1');
    expect(pointerQuery('update')).toBe('SELECT published_version_id, (SELECT MAX(id) FROM dbo.crm_meta_event) AS stamp FROM dbo.crm_meta_pointer WITH (UPDLOCK, HOLDLOCK) WHERE id = 1');
    const log: string[] = [];
    const answer = (row: Record<string, unknown> | undefined) => async (sql: string) => { log.push(sql); return { recordset: row ? [row] : [] }; };
    const check = sqlPublishedCheck({ id: 3, stamp: '41' });
    await assertStillPublished(answer({ published_version_id: 3, stamp: 41 }), check, 'shared');
    for (const row of [{ published_version_id: 3, stamp: 42 }, { published_version_id: 4, stamp: 41 }, { published_version_id: null, stamp: 41 }, undefined]) {
      await expect(assertStillPublished(answer(row), check, 'update')).rejects.toBeInstanceOf(StaleVersionError);
    }
    expect(log[0]).toBe(pointerQuery('shared'));
    expect(log[1]).toBe(pointerQuery('update'));
    expect(await check.files(answer({ id: 3, files_json: '[{"path":"a","content":"b"}]' }), 3)).toEqual([{ path: 'a', content: 'b' }]);
    expect(await check.files(answer(undefined), 3)).toBeUndefined();
    expect(log[log.length - 1]).toBe("SELECT id, files_json FROM dbo.crm_meta_version WHERE id = @id AND status = N'published'");
    // Order in the schema step and in a write: the pointer first.
    const order: string[] = [];
    const db = { transaction: async (work: any) => work(async (sql: string) => { order.push(sql.split('\n')[0].slice(0, 30)); if (sql.includes('crm_meta_pointer')) return { recordset: [{ published_version_id: 9, stamp: 1 }] }; throw new Error('stop'); }) };
    await expect(applyObjectSchema(db, [], sqlPublishedCheck({ id: 9, stamp: '1' }))).rejects.toThrow('stop');
    expect(order).toEqual(['SELECT published_version_id, (', 'DECLARE @lock INT;']);
    order.length = 0;
    await expect(new SqlObjectRecords(db).insert({ key: 'visit', fields: [] }, { companyId: 1, actor: 'u' }, {}, new Date(0), sqlPublishedCheck({ id: 8, stamp: '1' }))).rejects.toBeInstanceOf(StaleVersionError);
    await expect(new SqlObjectRecords(db).update({ key: 'visit', fields: [] }, { companyId: 1, actor: 'u' }, { kind: 'all' }, 1, () => ({}), new Date(0), sqlPublishedCheck({ id: 8, stamp: '1' }))).rejects.toBeInstanceOf(StaleVersionError);
    expect(order).toEqual(['SELECT published_version_id, (', 'SELECT published_version_id, (']);
  });
});
