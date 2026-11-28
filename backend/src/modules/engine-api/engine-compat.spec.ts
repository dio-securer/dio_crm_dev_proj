// The automatic API across metadata changes (F2-4, ADR 0004) on the SQLite fake: a rename that keeps the old name as an
// alias keeps data and owner visibility; dates of any year survive a round trip; one broken table closes only its object.
import { LEAD, caller, editJson, engineFixture, readMetadata } from '../../../test/support/engine-fixture';

const FIELDS = 'metadata/objects/lead/fields.json';
const u1 = caller('u1'), u2 = caller('u2');
const extra = (key: string, type: string, more: Record<string, unknown> = {}) => ({ aliases: [], key, labelKey: 'lead.field.phone', required: false, system: false, type, ...more });
const renamed = () => editJson(readMetadata(), FIELDS, d => {
  for (const f of d.fields) {
    if (f.key === 'owner_name') { f.key = 'owner'; f.aliases = ['owner_name']; }
    if (f.key === 'phone') { f.key = 'phone_number'; f.aliases = ['phone']; }
  }
});
const note = (fields: unknown[]) => [
  { path: 'metadata/objects/note/object.json', content: JSON.stringify({ aliases: [], key: 'note', labelKey: 'lead.label', pluralLabelKey: 'lead.plural' }) },
  { path: 'metadata/objects/note/fields.json', content: JSON.stringify({ fields }) },
  { path: 'metadata/objects/note/access.json', content: JSON.stringify({ entity: 'note', rules: [{ kind: 'own', ownerField: 'owner' }] }) },
];

describe('engine API: renames with an alias (ADR 0004)', () => {
  it('rows, values and owner visibility survive a published rename, old names still work, and a rollback reads the same data', async () => {
    const { api, publish, versions, db } = await engineFixture();
    await api.create(u1, 'lead', { ...LEAD, phone: '010' });
    await api.create(u2, 'lead', { ...LEAD, hospital_name: 'H2' });
    await publish(renamed());
    const mine = (await api.list(u1, 'lead', {})).items;
    expect(mine.map(r => r.values)).toMatchObject([{ hospital_name: 'H1', owner: 'u1', phone_number: '010' }]);
    expect(mine[0].values).not.toHaveProperty('owner_name');
    expect((await api.list(u2, 'lead', {})).items.map(r => r.values.hospital_name)).toEqual(['H2']);
    await expect(api.get(u2, 'lead', '1')).rejects.toMatchObject({ status: 404 });
    expect((await api.update(u1, 'lead', '1', { phone: '011' })).values.phone_number).toBe('011');
    await expect(api.update(u1, 'lead', '1', { owner_name: 'u2' })).rejects.toMatchObject({ status: 403, code: 'ACCESS_DENIED' });
    expect((await api.create(u1, 'lead', { ...LEAD, hospital_name: 'H3' })).values.owner).toBe('u1');
    const columns = db.raw.prepare('PRAGMA table_info(crm_obj_lead)').all().map((c: any) => c.name);
    expect(columns).toContain('f_owner_name');
    expect(columns).not.toContain('f_owner');
    expect(columns).not.toContain('f_phone_number');
    await versions.rollback('test');
    expect((await api.list(u1, 'lead', {})).items.map(r => [r.values.hospital_name, r.values.owner_name, r.values.phone])).toEqual([['H1', 'u1', '011'], ['H3', 'u1', null]]);
  });
});

describe('engine API: dates', () => {
  it('stores and returns a date-time of the year 1000 with its millisecond, and a date of the year 0001', async () => {
    const files = editJson(readMetadata(), FIELDS, d => { d.fields.push(extra('met_at', 'datetime'), extra('opened_on', 'date')); });
    const { api, db } = await engineFixture(files);
    const made = await api.create(u1, 'lead', { ...LEAD, met_at: '1000-01-01T09:00:00.001+09:00', opened_on: '0001-01-01' });
    expect(made.values).toMatchObject({ met_at: '1000-01-01T00:00:00.001Z', opened_on: '0001-01-01' });
    expect((await api.update(u1, 'lead', made.id, { met_at: '2026-11-28T01:02:03.004Z', opened_on: null })).values).toMatchObject({ met_at: '2026-11-28T01:02:03.004Z', opened_on: null });
    const sent = db.log.filter(l => /^(INSERT|UPDATE)/.test(l.text)).flatMap(l => Object.values(l.params)).filter(v => v instanceof Date);
    expect(sent).toEqual([]);
  });
});

describe('engine API: one object whose table cannot be made', () => {
  it('answers 503 for that object only; the other objects keep working', async () => {
    const { api, publish } = await engineFixture();
    await publish([...readMetadata(), ...note([extra('owner', 'text'), extra('amount', 'integer')])]);
    await api.create(u1, 'note', { amount: 1 });
    // integer -> decimal is an allowed widening in metadata, but the column already holds BIGINT: the table needs a person.
    await publish([...readMetadata(), ...note([extra('owner', 'text'), extra('amount', 'decimal')])]);
    await expect(api.list(u1, 'note', {})).rejects.toMatchObject({ status: 503, code: 'OBJECT_TABLE_UNAVAILABLE' });
    await expect(api.create(u1, 'note', { amount: 1 })).rejects.toMatchObject({ status: 503, code: 'OBJECT_TABLE_UNAVAILABLE' });
    expect((await api.create(u1, 'lead', LEAD)).values.owner_name).toBe('u1');
    expect((await api.list(u1, 'lead', {})).items).toHaveLength(1);
  });

  it('refuses an actor whose access expands to more ids than one statement can carry', async () => {
    const { api } = await engineFixture();
    const wide = caller('u1', 1, { memberIds: Array.from({ length: 1001 }, (_, i) => `m${i}`) });
    for (const work of [() => api.list(wide, 'lead', {}), () => api.get(wide, 'lead', '1'), () => api.create(wide, 'lead', LEAD), () => api.update(wide, 'lead', '1', { phone: '1' })]) {
      await expect(work()).rejects.toMatchObject({ name: 'EngineApiError', status: 403, code: 'ACCESS_TOO_WIDE' });
    }
    expect((await api.list(caller('u1', 1, { memberIds: Array.from({ length: 999 }, (_, i) => `m${i}`) }), 'lead', {})).items).toEqual([]);
  });
});
