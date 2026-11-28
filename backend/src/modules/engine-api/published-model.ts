// The runtime model of the published metadata version (F2-3), for the automatic API. The pointer is read on every
// request, so a publish or a rollback takes effect at once; a version's model is built (and its record tables made
// complete) once per version id. Versions are immutable, so the cache never goes stale.
import { loadRuntimeModel } from '@dio-crm/engine';
import type { MetaTransactional } from '../../database/crm-meta-version-store';
import { readPublishedFiles, readPublishedId } from '../../database/crm-meta-published';
import { applyObjectSchema, ObjectShape } from '../../database/crm-obj-schema';
import { EngineApiError, Published, PublishedSource } from './engine-records';

export interface PublishedPorts {
  readId(): Promise<number | undefined>;
  readFiles(id: number): Promise<{ id: number; files: { path: string; content: string }[] } | undefined>;
  ensureTables(objects: ObjectShape[]): Promise<void>;
}

export const sqlPublishedPorts = (db: MetaTransactional): PublishedPorts => ({
  readId: () => readPublishedId(db),
  readFiles: id => readPublishedFiles(db, id),
  ensureTables: objects => applyObjectSchema(db, objects),
});

export class PublishedModels implements PublishedSource {
  private readonly loaded = new Map<number, Promise<Published>>();
  constructor(private readonly ports: PublishedPorts) {}

  async current(): Promise<Published | undefined> {
    const id = await this.ports.readId();
    if (id === undefined) return undefined;
    let pending = this.loaded.get(id);
    if (!pending) {
      pending = this.load(id);
      this.loaded.set(id, pending);
      // A failure (database down, invalid version) is not remembered: the next request tries again.
      pending.catch(() => this.loaded.delete(id));
    }
    return pending;
  }

  private async load(id: number): Promise<Published> {
    const version = await this.ports.readFiles(id);
    // The pointer moved between the two reads (publish or rollback in between): ask again on the next request.
    if (!version) throw new EngineApiError(503, 'PUBLISHED_METADATA_CHANGED');
    const { model } = loadRuntimeModel(version.files);
    if (!model) throw new EngineApiError(503, 'PUBLISHED_METADATA_INVALID');
    await this.ports.ensureTables(model.objectKeys().map(key => ({ key, fields: model.object(key)!.object.fields })));
    return { versionId: id, model };
  }
}
