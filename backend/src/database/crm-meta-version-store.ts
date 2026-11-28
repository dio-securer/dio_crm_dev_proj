import { CRM_META_SCHEMA } from './crm-meta-schema';
import { dateTimeParam } from './sql-params';
// MS SQL adapter of the engine's metadata VersionStore port (packages/engine/src/versions/types.ts).
// The shapes below mirror that port; crm-meta-version-store.spec.ts runs the engine service on this adapter.
type Row = Record<string, unknown>;
export type MetaQuery = (text: string, params?: Record<string, unknown>) => Promise<{ recordset: Row[] }>;
/** The part of DatabaseService this adapter needs: one transaction that hands out a query function. */
export interface MetaTransactional { transaction<T>(work: (query: MetaQuery) => Promise<T>): Promise<T> }

type Status = 'staging' | 'published' | 'superseded' | 'rolled_back' | 'discarded';
interface File { path: string; content: string }
export interface MetaVersionRecord { id: number; status: Status; files: File[]; createdBy: string; createdAt: string; publishedAt?: string; previousId?: number; note?: string }
type Change = Partial<Pick<MetaVersionRecord, 'status' | 'publishedAt' | 'previousId'>>;
interface MetaEvent { versionId: number; action: string; actor: string; at: string; fromVersionId?: number }
export interface MetaVersionTx {
  lockPointer(): Promise<number | undefined>;
  setPointer(id: number | undefined): Promise<void>;
  get(id: number): Promise<MetaVersionRecord | undefined>;
  insert(version: Omit<MetaVersionRecord, 'id'>): Promise<number>;
  update(id: number, change: Change): Promise<void>;
  addEvent(event: MetaEvent): Promise<void>;
}

/** Only these columns can be changed by update(); the SET list is built from this table, never from input names. */
const UPDATABLE: Record<keyof Change, string> = { status: 'status', publishedAt: 'published_at', previousId: 'previous_id' };
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v === null || v === undefined ? undefined : String(v));
const date = (v: string | undefined) => dateTimeParam(v);
const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));

function toRecord(r: Row): MetaVersionRecord {
  const out: MetaVersionRecord = { id: Number(r.id), status: r.status as Status, files: JSON.parse(String(r.files_json)), createdBy: String(r.created_by), createdAt: iso(r.created_at)! };
  const publishedAt = iso(r.published_at), previousId = num(r.previous_id);
  if (publishedAt !== undefined) out.publishedAt = publishedAt;
  if (previousId !== undefined) out.previousId = previousId;
  if (r.note !== null && r.note !== undefined) out.note = String(r.note);
  return out;
}

export function metaVersionTx(query: MetaQuery): MetaVersionTx {
  return {
    async lockPointer() {
      const r = await query('SELECT published_version_id FROM dbo.crm_meta_pointer WITH (UPDLOCK, HOLDLOCK) WHERE id = 1');
      if (!r.recordset.length) throw new Error('CRM_META_SCHEMA_MISSING');
      return num(r.recordset[0].published_version_id);
    },
    async setPointer(id) {
      await query('UPDATE dbo.crm_meta_pointer SET published_version_id = @id WHERE id = 1', { id: id ?? null });
    },
    async get(id) {
      const r = await query('SELECT id, status, files_json, created_by, created_at, published_at, previous_id, note FROM dbo.crm_meta_version WHERE id = @id', { id });
      return r.recordset.length ? toRecord(r.recordset[0]) : undefined;
    },
    async insert(v) {
      const r = await query(
        `INSERT INTO dbo.crm_meta_version (status, files_json, created_by, created_at, published_at, previous_id, note)
OUTPUT INSERTED.id VALUES (@status, @files, @createdBy, @createdAt, @publishedAt, @previousId, @note)`,
        { status: v.status, files: JSON.stringify(v.files), createdBy: v.createdBy, createdAt: date(v.createdAt), publishedAt: date(v.publishedAt), previousId: v.previousId ?? null, note: v.note ?? null });
      return Number(r.recordset[0].id);
    },
    async update(id, change) {
      const keys = (Object.keys(change) as (keyof Change)[]).filter(k => k in UPDATABLE);
      if (!keys.length) return;
      const params: Record<string, unknown> = { id };
      for (const k of keys) params[k] = k === 'publishedAt' ? date(change.publishedAt) : change[k] ?? null;
      await query(`UPDATE dbo.crm_meta_version SET ${keys.map(k => `${UPDATABLE[k]} = @${k}`).join(', ')} WHERE id = @id`, params);
    },
    async addEvent(e) {
      await query('INSERT INTO dbo.crm_meta_event (version_id, action, actor, at, from_version_id) VALUES (@versionId, @action, @actor, @at, @fromVersionId)',
        { versionId: e.versionId, action: e.action, actor: e.actor, at: date(e.at), fromVersionId: e.fromVersionId ?? null });
    },
  };
}

/** The VersionStore: every engine operation runs in one database transaction. */
export class SqlMetaVersionStore {
  constructor(private readonly db: MetaTransactional) {}
  transaction<T>(work: (tx: MetaVersionTx) => Promise<T>): Promise<T> {
    return this.db.transaction(query => work(metaVersionTx(query)));
  }
}

/** Creates the crm_meta_* tables when they are missing. */
export async function applyCrmMetaSchema(db: MetaTransactional): Promise<void> {
  await db.transaction(async query => { for (const s of CRM_META_SCHEMA) await query(s); });
}
