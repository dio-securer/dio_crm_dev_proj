// The automatic API (F2-4): list / read / create / update of any object in the published metadata.
// Field checks and row access come from the engine; the store runs parameterised SQL inside the company and access condition.
// Closed by default: no rules means no rows and no create; a row outside the actor's access is "not found".
import { accessPredicate, buildUiModel, canObject, fieldAccessOf, isUiLocale, matchesPredicate, readableValues, restrictUiModel, secureActor, validateWrite, viewReadable, withOwnerDefault } from '@dio-crm/engine';
import type { Actor, FieldAccessOf, ObjectAction, RecordError, RecordValue, RuntimeModel, AccessPredicate, UiModel } from '@dio-crm/engine';
import { PublishedCheck, StaleVersionError } from '../../database/crm-meta-published';
import { FilterError } from '../../database/crm-obj-filter';
import type { ObjectShape } from '../../database/crm-obj-schema';
import { MAX_ACCESS_VALUES, accessValueCount } from '../../database/crm-obj-sql';
import type { ListQuery, Page, RecordScope } from '../../database/crm-obj-sql';
import type { StoredRecord } from '../../database/crm-obj-store';

export interface Caller { actor: Actor; companyId: number }
export interface Published {
  versionId: number;
  model: RuntimeModel;
  /** The object with its physical table and column names; makes the table complete on first use (503 when it cannot). */
  shape(objectKey: string): Promise<ObjectShape>;
  /** Given to every write: the version must still be the published one inside the write's transaction. */
  check?: PublishedCheck;
}
export interface PublishedSource { current(): Promise<Published | undefined> }
export interface RecordStore {
  list(object: ObjectShape, scope: RecordScope, predicate: AccessPredicate, page: Page, query?: ListQuery): Promise<StoredRecord[]>;
  get(object: ObjectShape, scope: RecordScope, predicate: AccessPredicate, id: number): Promise<StoredRecord | undefined>;
  insert(object: ObjectShape, scope: RecordScope, values: Record<string, RecordValue>, at: Date, check?: PublishedCheck): Promise<StoredRecord>;
  update(object: ObjectShape, scope: RecordScope, predicate: AccessPredicate, id: number,
    decide: (current: StoredRecord) => Record<string, RecordValue>, at: Date, check?: PublishedCheck): Promise<StoredRecord | undefined>;
}

export class EngineApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly errors: RecordError[] = []) { super(code); this.name = 'EngineApiError'; }
}

/** A write for a version that is no longer the published one wrote nothing: the caller asks again and gets the new version. */
const stale = (error: unknown): never => { throw error instanceof StaleVersionError ? new EngineApiError(503, 'PUBLISHED_METADATA_CHANGED') : error; };

const ID = /^[1-9][0-9]{0,14}$/;
const COUNT = /^[0-9]{1,7}$/;
export const PAGE_MAX = 200;
export const PAGE_DEFAULT = 50;

function idOf(raw: string): number {
  if (!ID.test(raw)) throw new EngineApiError(404, 'RECORD_NOT_FOUND');
  return Number(raw);
}

/** The settings of one object for the screens (F2-5), with what this actor may do. No rows and no access rules. */
export interface UiAnswer extends UiModel { versionId: number; access: { read: boolean; create: boolean } }
export const REF_PREFIX = 'ref.';

export function pageOf(query: { limit?: unknown; offset?: unknown }, defaultLimit = PAGE_DEFAULT): Page {
  const num = (v: unknown, fallback: number) => {
    if (v === undefined) return fallback;
    if (typeof v !== 'string' || !COUNT.test(v)) throw new EngineApiError(400, 'BAD_PAGE');
    return Number(v);
  };
  const limit = num(query.limit, defaultLimit), offset = num(query.offset, 0);
  if (limit < 1 || limit > PAGE_MAX) throw new EngineApiError(400, 'BAD_PAGE');
  return { limit, offset };
}

/** Object permission (F2-7): closed by default once the actor carries grants; an actor without grants is narrowed by row access only. */
function needObject(actor: Actor, objectKey: string, action: ObjectAction): void {
  if (actor.grants && !canObject(actor.grants, objectKey, action)) throw new EngineApiError(403, 'OBJECT_ACCESS_DENIED');
}
/** What leaves the API: only the fields the actor may read. */
const shaped = (record: StoredRecord, access: FieldAccessOf | undefined): StoredRecord => ({ id: record.id, values: readableValues(record.values, access) });
/** The caller with grants and hierarchy from the published settings (F2-7); the request never supplies them. */
const secured = (caller: Caller, model: RuntimeModel): Caller => ({ ...caller, actor: secureActor(caller.actor, model.bundle, caller.companyId) });

export class EngineRecords {
  constructor(private readonly published: PublishedSource, private readonly store: RecordStore, private readonly now: () => Date = () => new Date()) {}

  private async open(given: Caller, objectKey: string, action: ObjectAction = 'read') {
    const current = await this.published.current();
    if (!current) throw new EngineApiError(503, 'NO_PUBLISHED_METADATA');
    const caller = secured(given, current.model);
    const object = current.model.object(objectKey);
    if (!object) throw new EngineApiError(404, 'OBJECT_NOT_FOUND');
    needObject(caller.actor, object.object.key, 'read');
    if (action !== 'read') needObject(caller.actor, object.object.key, action);
    const access = fieldAccessOf(caller.actor.grants, object.object.key);
    const rules = current.model.rowAccess(objectKey);
    const predicate = accessPredicate(rules, caller.actor);
    // More ids than one statement can carry: refused rather than answered with a part of the rows.
    if (accessValueCount(predicate) > MAX_ACCESS_VALUES) throw new EngineApiError(403, 'ACCESS_TOO_WIDE');
    const shape = await current.shape(object.object.key);
    const scope: RecordScope = { companyId: caller.companyId, actor: caller.actor.userId };
    return { current, shape, rules, scope, predicate, access, caller };
  }

  /** The view named by `view` (its filter, sort and page size) and at most one `ref.<field>=<value>` condition. */
  private listQuery(model: RuntimeModel, objectKey: string, query: Record<string, unknown>, access?: FieldAccessOf): { more: ListQuery; pageSize?: number } {
    const more: ListQuery = {};
    let pageSize: number | undefined;
    if (query.view !== undefined) {
      const view = typeof query.view === 'string' ? model.object(objectKey)?.listViews?.views.find(v => v.key === query.view) : undefined;
      // A view that filters or sorts on a field the actor cannot read would reveal that field through its rows.
      if (!view || !viewReadable(model, objectKey, view.key, access)) throw new EngineApiError(400, 'BAD_VIEW');
      Object.assign(more, { filter: view.filter, sort: view.sort });
      pageSize = view.pageSize;
    }
    const refs = Object.keys(query).filter(k => k.startsWith(REF_PREFIX));
    if (refs.length > 1) throw new EngineApiError(400, 'BAD_FILTER');
    for (const name of refs) {
      const field = model.field(objectKey, name.slice(REF_PREFIX.length)), value = query[name];
      // Only a reference field can be matched this way: it is how a related list asks for "the rows that point at this record".
      if (!field || (access && !access(field.key).read) || field.type !== 'reference' || typeof value !== 'string' || value === '' || value.length > 100) throw new EngineApiError(400, 'BAD_FILTER');
      more.equals = { field: field.key, value };
    }
    return { more, pageSize };
  }

  async list(caller: Caller, objectKey: string, query: Record<string, unknown>) {
    const { current, shape, scope, predicate, access } = await this.open(caller, objectKey);
    const { more, pageSize } = this.listQuery(current.model, objectKey, query, access);
    const page = pageOf(query, pageSize);
    try {
      // The SQL condition narrows; the engine confirms each row (exact comparison, whatever the database collation or padding).
      const items = (await this.store.list(shape, scope, predicate, page, more)).filter(r => matchesPredicate(predicate, r.values)).map(r => shaped(r, access));
      return { object: shape.key, versionId: current.versionId, items, ...page };
    } catch (error) {
      // A view whose filter cannot be turned into a query (a value of the wrong type) is a settings problem of that view.
      if (error instanceof FilterError) throw new EngineApiError(400, 'BAD_VIEW');
      throw error;
    }
  }

  /** The object's settings in one language, for the generic screens. Only the published version; no table is touched. */
  async ui(given: Caller, objectKey: string, locale: unknown): Promise<UiAnswer> {
    const current = await this.published.current();
    if (!current) throw new EngineApiError(503, 'NO_PUBLISHED_METADATA');
    const caller = secured(given, current.model);
    if (!isUiLocale(locale)) throw new EngineApiError(400, 'BAD_LOCALE');
    const built = buildUiModel(current.model, objectKey, locale);
    if (!built) throw new EngineApiError(404, 'OBJECT_NOT_FOUND');
    const key = built.object.key, grants = caller.actor.grants;
    const ui = restrictUiModel(built, grants, current.model);
    const open = accessPredicate(current.model.rowAccess(objectKey), caller.actor).kind !== 'none';
    const may = (a: ObjectAction) => open && (!grants || canObject(grants, key, a));
    return { ...ui, versionId: current.versionId, access: { read: may('read'), create: may('read') && may('create') } };
  }

  async get(caller: Caller, objectKey: string, rawId: string): Promise<StoredRecord> {
    const id = idOf(rawId);
    const { shape, scope, predicate, access } = await this.open(caller, objectKey);
    const found = await this.store.get(shape, scope, predicate, id);
    if (!found || !matchesPredicate(predicate, found.values)) throw new EngineApiError(404, 'RECORD_NOT_FOUND');
    return shaped(found, access);
  }

  async create(caller: Caller, objectKey: string, body: unknown): Promise<StoredRecord> {
    const { current, shape, rules, scope, predicate, access, caller: secure } = await this.open(caller, objectKey, 'create');
    const checked = validateWrite(current.model, objectKey, body, 'create', access);
    if (!checked.ok) throw new EngineApiError(400, 'INVALID_RECORD', checked.errors);
    const values = withOwnerDefault(rules, secure.actor, checked.values);
    // The new row must be one the actor can see: nobody creates rows for others or outside their access.
    if (!matchesPredicate(predicate, values)) throw new EngineApiError(403, 'ACCESS_DENIED');
    return shaped(await this.store.insert(shape, scope, values, this.now(), current.check).catch(stale), access);
  }

  async update(caller: Caller, objectKey: string, rawId: string, body: unknown): Promise<StoredRecord> {
    const id = idOf(rawId);
    const { current, shape, scope, predicate, access } = await this.open(caller, objectKey, 'edit');
    const checked = validateWrite(current.model, objectKey, body, 'update', access);
    if (!checked.ok) throw new EngineApiError(400, 'INVALID_RECORD', checked.errors);
    const updated = await this.store.update(shape, scope, predicate, id, row => {
      if (!matchesPredicate(predicate, row.values)) throw new EngineApiError(404, 'RECORD_NOT_FOUND');
      // The changed row must stay inside the actor's access: a row cannot be handed out of it.
      if (!matchesPredicate(predicate, { ...row.values, ...checked.values })) throw new EngineApiError(403, 'ACCESS_DENIED');
      return checked.values;
    }, this.now(), current.check).catch(stale);
    if (!updated) throw new EngineApiError(404, 'RECORD_NOT_FOUND');
    return shaped(updated, access);
  }
}
