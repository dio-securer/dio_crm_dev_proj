// The runtime model of the published metadata version (F2-3), for the automatic API. The pointer is read on every
// request, so a publish or a rollback takes effect at once; a version's model is built once per version id (versions
// are immutable, so the cache never goes stale). An object's record table is made complete the first time the object
// is used in that version. If that fails (type drift, a database error), only that object answers 503, the failure is
// remembered for TABLE_RETRY_MS so every request does not run the DDL again, and the other objects keep working.
import { loadRuntimeModel } from '@dio-crm/engine';
import type { RuntimeModel } from '@dio-crm/engine';
import type { MetaTransactional } from '../../database/crm-meta-version-store';
import { readPublishedFiles, readPublishedId } from '../../database/crm-meta-published';
import { applyObjectSchema, ObjectShape } from '../../database/crm-obj-schema';
import { EngineApiError, Published, PublishedSource } from './engine-records';

export interface PublishedPorts {
  readId(): Promise<number | undefined>;
  readFiles(id: number): Promise<{ id: number; files: { path: string; content: string }[] } | undefined>;
  /** Makes the tables complete and returns each object with its physical table and column names. */
  ensureTables(objects: ObjectShape[]): Promise<ObjectShape[]>;
  /** Told about a table that could not be made complete (the API answer does not carry the cause). */
  report?(objectKey: string, error: unknown): void;
}

export const sqlPublishedPorts = (db: MetaTransactional, report?: PublishedPorts['report']): PublishedPorts => ({
  readId: () => readPublishedId(db),
  readFiles: id => readPublishedFiles(db, id),
  ensureTables: objects => applyObjectSchema(db, objects),
  report,
});

export const TABLE_RETRY_MS = 30_000;

class ObjectTables {
  private readonly ready = new Map<string, Promise<ObjectShape>>();
  private readonly failedAt = new Map<string, number>();
  private readonly tableOwner = new Map<string, string>();
  constructor(private readonly model: RuntimeModel, private readonly ports: PublishedPorts, private readonly now: () => number) {}

  shape(objectKey: string): Promise<ObjectShape> {
    const failed = this.failedAt.get(objectKey);
    if (failed !== undefined && this.now() - failed < TABLE_RETRY_MS) return Promise.reject(new EngineApiError(503, 'OBJECT_TABLE_UNAVAILABLE'));
    let pending = this.ready.get(objectKey);
    if (!pending) {
      pending = this.ensure(objectKey);
      this.ready.set(objectKey, pending);
      pending.catch(() => { this.ready.delete(objectKey); this.failedAt.set(objectKey, this.now()); });
    }
    return pending;
  }

  private async ensure(objectKey: string): Promise<ObjectShape> {
    const object = this.model.object(objectKey);
    if (!object) throw new EngineApiError(404, 'OBJECT_NOT_FOUND');
    try {
      const [shape] = await this.ports.ensureTables([{ key: object.object.key, aliases: object.object.aliases, fields: object.object.fields }]);
      // Two objects of one version on one table would read each other's rows.
      const owner = this.tableOwner.get(String(shape.table)) ?? objectKey;
      if (owner !== objectKey) throw new Error(`CRM_OBJ_TABLE_CONFLICT ${shape.table} (${owner}, ${objectKey})`);
      this.tableOwner.set(String(shape.table), objectKey);
      return shape;
    } catch (error) {
      this.ports.report?.(objectKey, error);
      throw new EngineApiError(503, 'OBJECT_TABLE_UNAVAILABLE');
    }
  }
}

export class PublishedModels implements PublishedSource {
  private readonly loaded = new Map<number, Promise<Published>>();
  constructor(private readonly ports: PublishedPorts, private readonly now: () => number = () => Date.now()) {}

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
    const tables = new ObjectTables(model, this.ports, this.now);
    return { versionId: id, model, shape: objectKey => tables.shape(objectKey) };
  }
}
