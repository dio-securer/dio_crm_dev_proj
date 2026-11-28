// A name that leaves the published settings is retired (F2-4, ADR 0004) - on the SQLite fake. An object or a field
// that is deprecated, removed and later added again under the same name (or with that name as an alias) starts on a
// fresh table or column: the rows written under the old access rules never come back under new ones.
import { syncPublishedNames } from '../../database/crm-obj-name-sync';
import { caller, engineFixture, readMetadata } from '../../../test/support/engine-fixture';

type File = { path: string; content: string };
const u1 = caller('u1'), u2 = caller('u2');
const text = (key: string, more: Record<string, unknown> = {}) => ({ aliases: [], key, labelKey: 'lead.field.phone', required: false, system: false, type: 'text', ...more });
const OWN = [{ kind: 'own', ownerField: 'owner' }], ALL = [{ kind: 'all' }];
function object(key: string, fields: unknown[], rules: unknown[], more: Record<string, unknown> = {}): File[] {
  return [
    { path: `metadata/objects/${key}/object.json`, content: JSON.stringify({ aliases: [], key, labelKey: 'lead.label', pluralLabelKey: 'lead.plural', ...more }) },
    { path: `metadata/objects/${key}/fields.json`, content: JSON.stringify({ fields }) },
    { path: `metadata/objects/${key}/access.json`, content: JSON.stringify({ entity: key, rules }) },
  ];
}
const FIELDS = [text('owner'), text('memo')];
const tablesOf = (db: Awaited<ReturnType<typeof engineFixture>>['db']) => db.tables().filter(t => t.startsWith('crm_obj_visit') || t.startsWith('crm_obj_trip'));
const names = (db: Awaited<ReturnType<typeof engineFixture>>['db'], scope: string) =>
  db.raw.prepare('SELECT name_key, physical, retired FROM crm_meta_obj_name WHERE scope = ? ORDER BY name_key').all(scope).map((r: any) => `${r.name_key}=${r.physical}${r.retired ? ' (retired)' : ''}`);
const memos = async (api: Awaited<ReturnType<typeof engineFixture>>['api'], who: typeof u1, key: string) => (await api.list(who, key, {})).items.map(r => r.values.memo);

/** v1: visit with own(owner), rows of u1. v2: visit deprecated. v3: visit removed. */
async function retiredVisit() {
  const f = await engineFixture([...readMetadata(), ...object('visit', FIELDS, OWN)]);
  await f.api.create(u1, 'visit', { memo: 'private 1' });
  await f.api.create(u1, 'visit', { memo: 'private 2' });
  expect(await memos(f.api, u2, 'visit')).toEqual([]);
  await f.publish([...readMetadata(), ...object('visit', FIELDS, OWN, { deprecated: { since: '2026-11' } })]);
  expect(await memos(f.api, u1, 'visit')).toEqual(['private 1', 'private 2']);
  await f.publish(readMetadata());
  await expect(f.api.list(u1, 'visit', {})).rejects.toMatchObject({ status: 404, code: 'OBJECT_NOT_FOUND' });
  return f;
}

describe('engine API: a removed object does not come back with its rows', () => {
  it('the same key added again with access for everyone reads a fresh table', async () => {
    const f = await retiredVisit();
    expect(names(f.db, '')).toContain('visit=crm_obj_visit (retired)');
    await f.publish([...readMetadata(), ...object('visit', FIELDS, ALL)]);
    for (const who of [u1, u2]) expect(await memos(f.api, who, 'visit')).toEqual([]);
    expect(tablesOf(f.db)).toEqual(['crm_obj_visit', 'crm_obj_visit_r2']);
    expect(names(f.db, '')).toContain('visit=crm_obj_visit_r2');
    await expect(f.api.get(u2, 'visit', '1')).rejects.toMatchObject({ status: 404 });
    // New rows live in the new table; the old rows are still where they were, untouched.
    await f.api.create(u2, 'visit', { memo: 'new' });
    expect(await memos(f.api, u1, 'visit')).toEqual(['new']);
    expect(f.db.raw.prepare('SELECT f_memo FROM crm_obj_visit ORDER BY id').all().map((r: any) => r.f_memo)).toEqual(['private 1', 'private 2']);
  });

  it('another key with the old one as an alias reads a fresh table too', async () => {
    const f = await retiredVisit();
    await f.publish([...readMetadata(), ...object('trip', FIELDS, ALL, { aliases: ['visit'] })]);
    for (const who of [u1, u2]) expect(await memos(f.api, who, 'trip')).toEqual([]);
    expect(tablesOf(f.db)).toEqual(['crm_obj_trip', 'crm_obj_visit']);
  });

  it('a rollback to the version that still had the object does not bring the rows back either, although this server had that version built before', async () => {
    const f = await retiredVisit();
    const deprecatedVersion = (await f.versions.published())!.previousId;
    await f.versions.rollback('test');
    expect((await f.versions.published())!.id).toBe(deprecatedVersion);
    expect(await memos(f.api, u1, 'visit')).toEqual([]);
    expect(tablesOf(f.db)).toEqual(['crm_obj_visit', 'crm_obj_visit_r2']);
  });

  it('a server that saw nothing between the removal and the rollback does not go on with what it had built for that version', async () => {
    const f = await engineFixture([...readMetadata(), ...object('visit', FIELDS, OWN)]);
    await f.api.create(u1, 'visit', { memo: 'private' });
    await f.publish([...readMetadata(), ...object('visit', FIELDS, OWN, { deprecated: { since: '2026-11' } })]);
    expect(await memos(f.api, u1, 'visit')).toEqual(['private']);
    // No request reaches this server while the removal is published and rolled back.
    await f.publish(readMetadata());
    await f.versions.rollback('test');
    expect(await memos(f.api, u1, 'visit')).toEqual([]);
    expect(tablesOf(f.db)).toEqual(['crm_obj_visit', 'crm_obj_visit_r2']);
  });

  it('a renamed object rolled back to its old key reads the same table: a name kept as an alias is not retired', async () => {
    const f = await engineFixture([...readMetadata(), ...object('visit', FIELDS, OWN)]);
    await f.api.create(u1, 'visit', { memo: 'kept' });
    await f.publish([...readMetadata(), ...object('trip', FIELDS, OWN, { aliases: ['visit'] })]);
    expect(names(f.db, '')).toEqual(expect.arrayContaining(['trip=crm_obj_visit', 'visit=crm_obj_visit']));
    await f.versions.rollback('test');
    expect(await memos(f.api, u1, 'visit')).toEqual(['kept']);
    expect(tablesOf(f.db)).toEqual(['crm_obj_visit']);
  });

  it('a rename with an alias is not a removal: the table, the rows and the owner rule stay, also when nobody used the object in between', async () => {
    const f = await engineFixture([...readMetadata(), ...object('visit', FIELDS, OWN)]);
    await f.api.create(u1, 'visit', { memo: 'kept' });
    // Renamed, and published again without the alias before anyone opened the object: the new key was recorded at publish.
    await f.publish([...readMetadata(), ...object('trip', FIELDS, OWN, { aliases: ['visit'] })]);
    await f.publish([...readMetadata(), ...object('trip', FIELDS, OWN)]);
    expect(await memos(f.api, u1, 'trip')).toEqual(['kept']);
    expect(await memos(f.api, u2, 'trip')).toEqual([]);
    expect(tablesOf(f.db)).toEqual(['crm_obj_visit']);
    expect(names(f.db, '')).toEqual(expect.arrayContaining(['trip=crm_obj_visit', 'visit=crm_obj_visit (retired)']));
  });
});

describe('engine API: one object cannot take over two tables', () => {
  it('an object whose key and aliases mean two live tables is refused by the compatibility check; the published version stays', async () => {
    const f = await engineFixture([...readMetadata(), ...object('visit', FIELDS, OWN), ...object('trip', FIELDS, ALL)]);
    await f.api.create(u1, 'visit', { memo: 'private' });
    await f.api.create(u2, 'trip', { memo: 'open' });
    const before = (await f.versions.published())!.id;
    await expect(f.publish([...readMetadata(), ...object('tour', FIELDS, ALL, { aliases: ['trip', 'visit'] })])).rejects.toMatchObject({ code: 'INCOMPATIBLE' });
    expect((await f.versions.published())!.id).toBe(before);
    expect(await memos(f.api, u2, 'visit')).toEqual([]);
    expect(names(f.db, '')).toEqual(expect.arrayContaining(['trip=crm_obj_trip', 'visit=crm_obj_visit']));
  });
});

describe('names follow the published pointer (syncPublishedNames)', () => {
  it('stops when the new version has an object on two live tables or a field on two live columns, and changes nothing', async () => {
    const f = await engineFixture([...readMetadata(), ...object('visit', FIELDS, OWN), ...object('trip', FIELDS, ALL)]);
    await f.api.create(u1, 'visit', { memo: 'private' });
    await f.api.create(u2, 'trip', { memo: 'open' });
    const before = names(f.db, '').concat(names(f.db, 'crm_obj_visit'));
    const sync = (files: File[]) => f.db.transaction(q => syncPublishedNames(q, files));
    await expect(sync(object('tour', FIELDS, ALL, { aliases: ['trip', 'visit'] }))).rejects.toThrow('CRM_OBJ_TABLE_AMBIGUOUS tour');
    await expect(sync(object('visit', [text('who', { aliases: ['owner', 'memo'] })], ALL))).rejects.toThrow('CRM_OBJ_COLUMN_AMBIGUOUS crm_obj_visit.who');
    await expect(sync([{ path: 'metadata/objects/visit/object.json', content: '{' }])).rejects.toThrow('CRM_META_NAMES_UNREADABLE');
    expect(names(f.db, '').concat(names(f.db, 'crm_obj_visit'))).toEqual(before);
    // Nothing published at all: every name retires.
    await f.db.transaction(q => syncPublishedNames(q, undefined));
    expect(names(f.db, '').every((n: string) => n.endsWith('(retired)'))).toBe(true);
    expect(names(f.db, 'crm_obj_visit')).toEqual(['memo=f_memo (retired)', 'owner=f_owner (retired)']);
  });
});

describe('engine API: a removed field does not come back with its values', () => {
  /** v1: memo with values. v2: memo deprecated. v3: memo removed. */
  async function retiredMemo() {
    const f = await engineFixture([...readMetadata(), ...object('visit', FIELDS, ALL)]);
    await f.api.create(u1, 'visit', { owner: 'u1', memo: 'old secret' });
    await f.publish([...readMetadata(), ...object('visit', [text('owner'), text('memo', { deprecated: { since: '2026-11' } })], ALL)]);
    await f.publish([...readMetadata(), ...object('visit', [text('owner')], ALL)]);
    expect((await f.api.get(u1, 'visit', '1')).values).toEqual({ owner: 'u1' });
    expect(names(f.db, 'crm_obj_visit')).toEqual(['memo=f_memo (retired)', 'owner=f_owner']);
    return f;
  }
  const columns = (db: Awaited<ReturnType<typeof engineFixture>>['db']) => db.raw.prepare('PRAGMA table_info(crm_obj_visit)').all().map((c: any) => c.name).filter((n: string) => n.startsWith('f_'));

  it('the same key added again reads a fresh column', async () => {
    const f = await retiredMemo();
    await f.publish([...readMetadata(), ...object('visit', FIELDS, ALL)]);
    expect((await f.api.get(u2, 'visit', '1')).values).toEqual({ owner: 'u1', memo: null });
    expect(columns(f.db)).toEqual(['f_owner', 'f_memo', 'f_memo_r2']);
    expect(names(f.db, 'crm_obj_visit')).toEqual(['memo=f_memo_r2', 'owner=f_owner']);
    expect((await f.api.update(u2, 'visit', '1', { memo: 'new' })).values.memo).toBe('new');
    expect(f.db.raw.prepare('SELECT f_memo FROM crm_obj_visit').all().map((r: any) => r.f_memo)).toEqual(['old secret']);
  });

  it('another key with the old one as an alias reads a fresh column', async () => {
    const f = await retiredMemo();
    await f.publish([...readMetadata(), ...object('visit', [text('owner'), text('remark', { aliases: ['memo'] })], ALL)]);
    expect((await f.api.get(u2, 'visit', '1')).values).toEqual({ owner: 'u1', remark: null });
    expect(columns(f.db)).toEqual(['f_owner', 'f_memo', 'f_remark']);
  });

  it('a rollback to the version that still had the field reads a fresh column as well', async () => {
    const f = await retiredMemo();
    await f.versions.rollback('test');
    expect((await f.api.get(u1, 'visit', '1')).values).toEqual({ owner: 'u1', memo: null });
  });
});
