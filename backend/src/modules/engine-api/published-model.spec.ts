// The published model cache of the automatic API (F2-4): one build per version, tables per object on first use,
// a failed table closes only its object for a while, invalid versions are refused.
import { readMetadata } from '../../../test/support/engine-fixture';
import { EngineApiError } from './engine-records';
import { PublishedModels, PublishedPorts, TABLE_RETRY_MS } from './published-model';

function ports(files = readMetadata()) {
  const state = { id: 1 as number | undefined, ensured: [] as string[][], failEnsure: false, published: true, reported: [] as string[], at: 0 };
  const p: PublishedPorts = {
    readId: async () => state.id,
    readFiles: async id => (state.published ? { id, files } : undefined),
    ensureTables: async objects => { if (state.failEnsure) throw new Error('CRM_OBJ_SCHEMA_DRIFT x'); state.ensured.push(objects.map(o => o.key)); return objects.map(o => ({ ...o, table: `crm_obj_${o.key}` })); },
    report: (key, error) => { state.reported.push(`${key}: ${(error as Error).message}`); },
  };
  return { state, p, models: new PublishedModels(p, () => state.at) };
}

describe('published models', () => {
  it('builds a version once, follows the pointer, and makes an object\'s table complete once per version on first use', async () => {
    const { state, models } = ports();
    expect((await models.current())?.versionId).toBe(1);
    expect((await models.current())?.model.object('lead')).toBeDefined();
    expect(state.ensured).toEqual([]);
    const v1 = (await models.current())!;
    expect(await v1.shape('lead')).toMatchObject({ key: 'lead', aliases: [], table: 'crm_obj_lead' });
    await (await models.current())!.shape('lead');
    expect(state.ensured).toEqual([['lead']]);
    state.id = 2;
    expect((await models.current())?.versionId).toBe(2);
    await (await models.current())!.shape('lead');
    expect(state.ensured).toEqual([['lead'], ['lead']]);
    await expect(v1.shape('nope')).rejects.toMatchObject({ status: 404, code: 'OBJECT_NOT_FOUND' });
    state.id = undefined;
    expect(await models.current()).toBeUndefined();
  });

  it('a table that cannot be made answers 503 for that object, is reported, and is tried again only after the retry time', async () => {
    const { state, models } = ports();
    state.failEnsure = true;
    const v = (await models.current())!;
    await expect(v.shape('lead')).rejects.toMatchObject({ status: 503, code: 'OBJECT_TABLE_UNAVAILABLE' });
    expect(state.reported).toEqual(['lead: CRM_OBJ_SCHEMA_DRIFT x']);
    state.failEnsure = false;
    state.at = TABLE_RETRY_MS - 1;
    await expect(v.shape('lead')).rejects.toMatchObject({ status: 503, code: 'OBJECT_TABLE_UNAVAILABLE' });
    expect(state.ensured).toEqual([]);
    expect(state.reported).toHaveLength(1);
    state.at = TABLE_RETRY_MS;
    expect((await v.shape('lead')).key).toBe('lead');
    expect(state.ensured).toEqual([['lead']]);
    expect((await models.current())?.versionId).toBe(1);
  });

  it('two objects of one version that resolve to one table: the second one is closed (503), the first keeps working', async () => {
    const second = [
      { path: 'metadata/objects/note/object.json', content: JSON.stringify({ aliases: [], key: 'note', labelKey: 'lead.label', pluralLabelKey: 'lead.plural' }) },
      { path: 'metadata/objects/note/fields.json', content: JSON.stringify({ fields: [] }) },
    ];
    const { state, p } = ports([...readMetadata(), ...second]);
    const models = new PublishedModels({ ...p, ensureTables: async objects => objects.map(o => ({ ...o, table: 'crm_obj_lead' })) }, () => state.at);
    const v = (await models.current())!;
    expect((await v.shape('lead')).table).toBe('crm_obj_lead');
    await expect(v.shape('note')).rejects.toMatchObject({ status: 503, code: 'OBJECT_TABLE_UNAVAILABLE' });
    expect(state.reported).toEqual(['note: CRM_OBJ_TABLE_CONFLICT crm_obj_lead (lead, note)']);
    expect((await v.shape('lead')).key).toBe('lead');
  });

  it('refuses a version whose metadata does not load, and a pointer that moved away', async () => {
    const broken = ports([{ path: 'metadata/objects/lead/fields.json', content: '{' }]);
    await expect(broken.models.current()).rejects.toMatchObject({ status: 503, code: 'PUBLISHED_METADATA_INVALID' });
    expect(broken.state.ensured).toEqual([]);
    const moved = ports();
    moved.state.published = false;
    const e = await moved.models.current().catch(err => err);
    expect(e).toBeInstanceOf(EngineApiError);
    expect(e.code).toBe('PUBLISHED_METADATA_CHANGED');
    moved.state.published = true;
    expect((await moved.models.current())?.versionId).toBe(1);
  });
});
