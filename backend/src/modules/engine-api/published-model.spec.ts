// The published model cache of the automatic API (F2-4): one build per version, failures retried, invalid versions refused.
import { readMetadata } from '../../../test/support/engine-fixture';
import { EngineApiError } from './engine-records';
import { PublishedModels, PublishedPorts } from './published-model';

function ports(files = readMetadata()) {
  const state = { id: 1 as number | undefined, ensured: [] as string[][], failEnsure: false, published: true };
  const p: PublishedPorts = {
    readId: async () => state.id,
    readFiles: async id => (state.published ? { id, files } : undefined),
    ensureTables: async objects => { if (state.failEnsure) throw new Error('db down'); state.ensured.push(objects.map(o => o.key)); },
  };
  return { state, p };
}

describe('published models', () => {
  it('builds a version once, makes its tables complete, and follows the pointer', async () => {
    const { state, p } = ports();
    const models = new PublishedModels(p);
    expect((await models.current())?.versionId).toBe(1);
    expect((await models.current())?.model.object('lead')).toBeDefined();
    expect(state.ensured).toEqual([['lead']]);
    state.id = 2;
    expect((await models.current())?.versionId).toBe(2);
    expect(state.ensured).toEqual([['lead'], ['lead']]);
    state.id = undefined;
    expect(await models.current()).toBeUndefined();
  });

  it('does not remember a failure', async () => {
    const { state, p } = ports();
    const models = new PublishedModels(p);
    state.failEnsure = true;
    await expect(models.current()).rejects.toThrow('db down');
    state.failEnsure = false;
    expect((await models.current())?.versionId).toBe(1);
  });

  it('refuses a version whose metadata does not load, and a pointer that moved away', async () => {
    const broken = ports([{ path: 'metadata/objects/lead/fields.json', content: '{' }]);
    await expect(new PublishedModels(broken.p).current()).rejects.toMatchObject({ status: 503, code: 'PUBLISHED_METADATA_INVALID' });
    expect(broken.state.ensured).toEqual([]);
    const moved = ports();
    moved.state.published = false;
    const e = await new PublishedModels(moved.p).current().catch(err => err);
    expect(e).toBeInstanceOf(EngineApiError);
    expect(e.code).toBe('PUBLISHED_METADATA_CHANGED');
  });
});
