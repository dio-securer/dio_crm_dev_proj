// The runtime model of the published metadata version (F2-3), for the automatic API. The pointer is read on every
// request, so a publish or a rollback takes effect at once; a version's model is built once per pointer move (the
// version id with a stamp that changes at every publish and rollback). An object's record table is made complete the first time the object
// is used in that version. If that fails (type drift, a database error), only that object answers 503, the failure is
// remembered for TABLE_RETRY_MS so every request does not run the DDL again, and the other objects keep working.
import { loadRuntimeModel } from '@dio-crm/engine';
import type { RuntimeModel } from '@dio-crm/engine';
import type { MetaTransactional } from '../../database/crm-meta-version-store';
import { PublishedCheck, PublishedPointer, StaleVersionError, readPublishedFiles, readPublishedId, readPublishedPointer, sqlPublishedCheck } from '../../database/crm-meta-published';
import { applyObjectSchema, ObjectShape } from '../../database/crm-obj-schema';
import { EngineApiError, Published, PublishedSource } from './engine-records';

export interface PublishedPorts {
  readId(): Promise<number | undefined>;
  /** The version with a stamp that changes at every publish and rollback. Without it the version id alone is the cache key. */
  readPointer?(): Promise<PublishedPointer | undefined>;
  readFiles(id: number): Promise<{ id: number; files: { path: string; content: string }[] } | undefined>;
  /** Makes the tables complete and returns each object with its physical table and column names. */
  ensureTables(objects: ObjectShape[], check?: PublishedCheck): Promise<ObjectShape[]>;
  /** The check that a version (at its stamp) is still the published one, made inside the transactions that write for it. */
  check?(pointer: PublishedPointer): PublishedCheck;
  /** Told about a table that could not be made complete (the API answer does not carry the cause). */
  report?(objectKey: string, error: unknown): void;
}

export const sqlPublishedPorts = (db: MetaTransactional, report?: PublishedPorts['report']): PublishedPorts => ({
  readId: () => readPublishedId(db),
  readPointer: () => readPublishedPointer(db),
  readFiles: id => readPublishedFiles(db, id),
  ensureTables: (objects, check) => applyObjectSchema(db, objects, check),
  check: sqlPublishedCheck,
  report,
});

export const TABLE_RETRY_MS = 30_000;

class ObjectTables {
  private readonly ready = new Map<string, Promise<ObjectShape>>();
  private readonly failedAt = new Map<string, number>();
  private readonly tableOwner = new Map<string, string>();
  constructor(private readonly model: RuntimeModel, private readonly ports: PublishedPorts, private readonly now: () => number, private readonly check?: PublishedCheck) {}

  shape(objectKey: string): Promise<ObjectShape> {
    const failed = this.failedAt.get(objectKey);
    if (failed !== undefined && this.now() - failed < TABLE_RETRY_MS) return Promise.reject(new EngineApiError(503, 'OBJECT_TABLE_UNAVAILABLE'));
    let pending = this.ready.get(objectKey);
    if (!pending) {
      pending = this.ensure(objectKey);
      this.ready.set(objectKey, pending);
      // A stale version is not a broken table: it is not remembered as one (every later try is refused the same way, cheaply).
      pending.catch(error => { this.ready.delete(objectKey); if ((error as EngineApiError)?.code !== 'PUBLISHED_METADATA_CHANGED') this.failedAt.set(objectKey, this.now()); });
    }
    return pending;
  }

  private async ensure(objectKey: string): Promise<ObjectShape> {
    const object = this.model.object(objectKey);
    if (!object) throw new EngineApiError(404, 'OBJECT_NOT_FOUND');
    try {
      const [shape] = await this.ports.ensureTables([{ key: object.object.key, aliases: object.object.aliases, fields: object.object.fields }], this.check);
      // Two objects of one version on one table would read each other's rows.
      const owner = this.tableOwner.get(String(shape.table)) ?? objectKey;
      if (owner !== objectKey) throw new Error(`CRM_OBJ_TABLE_CONFLICT ${shape.table} (${owner}, ${objectKey})`);
      this.tableOwner.set(String(shape.table), objectKey);
      return shape;
    } catch (error) {
      // The pointer moved while this request held the version: nothing was made or recorded; the next request reads the new version.
      if (error instanceof StaleVersionError) throw new EngineApiError(503, 'PUBLISHED_METADATA_CHANGED');
      this.ports.report?.(objectKey, error);
      throw new EngineApiError(503, 'OBJECT_TABLE_UNAVAILABLE');
    }
  }
}

export class PublishedModels implements PublishedSource {
  private readonly loaded = new Map<string, Promise<Published>>();
  constructor(private readonly ports: PublishedPorts, private readonly now: () => number = () => Date.now()) {}

  private async pointer(): Promise<PublishedPointer | undefined> {
    if (this.ports.readPointer) return this.ports.readPointer();
    const id = await this.ports.readId();
    return id === undefined ? undefined : { id, stamp: '' };
  }

  async current(): Promise<Published | undefined> {
    const pointer = await this.pointer();
    if (pointer === undefined) return undefined;
    const key = `${pointer.id}:${pointer.stamp}`;
    let pending = this.loaded.get(key);
    if (!pending) {
      // The pointer moved: nothing built before it is kept. A version that comes back by rollback is built again,
      // because the names of its tables and columns may have been retired while it was away.
      this.loaded.clear();
      pending = this.load(pointer);
      this.loaded.set(key, pending);
      // A failure (database down, invalid version) is not remembered: the next request tries again.
      pending.catch(() => { if (this.loaded.get(key) === pending) this.loaded.delete(key); });
    }
    return pending;
  }

  private async load(pointer: PublishedPointer): Promise<Published> {
    const id = pointer.id, version = await this.ports.readFiles(id);
    // The pointer moved between the two reads (publish or rollback in between): ask again on the next request.
    if (!version) throw new EngineApiError(503, 'PUBLISHED_METADATA_CHANGED');
    const { model } = loadRuntimeModel(version.files);
    if (!model) throw new EngineApiError(503, 'PUBLISHED_METADATA_INVALID');
    const check = this.ports.check?.(pointer);
    const tables = new ObjectTables(model, this.ports, this.now, check);
    return { versionId: id, model, shape: objectKey => tables.shape(objectKey), check };
  }
}
