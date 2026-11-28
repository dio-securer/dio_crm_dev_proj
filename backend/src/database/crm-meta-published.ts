// The published metadata version, read without locks (F2-4). The automatic API runs on this version only;
// staging versions and the repository's metadata/ files never reach it. Writes stay in crm-meta-version-store.ts.
import type { MetaQuery, MetaTransactional } from './crm-meta-version-store';

export interface PublishedFiles { id: number; files: { path: string; content: string }[] }

export function readPublishedId(db: MetaTransactional): Promise<number | undefined> {
  return db.transaction(async query => {
    const r = await query('SELECT published_version_id FROM dbo.crm_meta_pointer WHERE id = 1');
    const id = r.recordset[0]?.published_version_id;
    return id === null || id === undefined ? undefined : Number(id);
  });
}

export interface PublishedPointer { id: number; stamp: string }
/**
 * The published version with a stamp that changes at every publish and rollback (each writes events). A rollback
 * brings an old version id back, but the names of its tables may have been retired in between: what was built for
 * that id before must not be used again, and the stamp tells.
 */
export function readPublishedPointer(db: MetaTransactional): Promise<PublishedPointer | undefined> {
  return db.transaction(async query => {
    const r = await query('SELECT published_version_id, (SELECT MAX(id) FROM dbo.crm_meta_event) AS stamp FROM dbo.crm_meta_pointer WHERE id = 1');
    const id = r.recordset[0]?.published_version_id;
    return id === null || id === undefined ? undefined : { id: Number(id), stamp: String(r.recordset[0].stamp ?? '') };
  });
}

/** The files of a version that is published now; undefined when the version is not (or no longer) published. */
export function readPublishedFiles(db: MetaTransactional, id: number): Promise<PublishedFiles | undefined> {
  return db.transaction(async query => {
    const r = await query("SELECT id, files_json FROM dbo.crm_meta_version WHERE id = @id AND status = N'published'", { id });
    const row = r.recordset[0];
    return row ? { id: Number(row.id), files: JSON.parse(String(row.files_json)) } : undefined;
  });
}

/** What was built for one pointer position is used after the pointer moved (a publish or a rollback in between). */
export class StaleVersionError extends Error {
  readonly code = 'CRM_PUBLISHED_VERSION_CHANGED';
  constructor(detail = '') { super(`CRM_PUBLISHED_VERSION_CHANGED${detail ? ` ${detail}` : ''}`); this.name = 'StaleVersionError'; }
}
export type PointerLock = 'shared' | 'update';
/**
 * The check a transaction makes before it writes for a version: is that version, at that stamp, still the published one?
 * `read` must hold the pointer row until the transaction ends, so no publish or rollback can come in between the check
 * and the write: 'shared' for record writes (many at once), 'update' for the schema step (one at a time, the same lock
 * a publish takes first - so the two never interleave and never deadlock).
 */
export interface PublishedCheck {
  expected: PublishedPointer;
  read(query: MetaQuery, lock: PointerLock): Promise<PublishedPointer | undefined>;
  files(query: MetaQuery, id: number): Promise<{ path: string; content: string }[] | undefined>;
}
const HELD: Record<PointerLock, string> = { shared: 'WITH (HOLDLOCK)', update: 'WITH (UPDLOCK, HOLDLOCK)' };
export const pointerQuery = (lock: PointerLock) =>
  `SELECT published_version_id, (SELECT MAX(id) FROM dbo.crm_meta_event) AS stamp FROM dbo.crm_meta_pointer ${HELD[lock]} WHERE id = 1`;

export const sqlPublishedCheck = (expected: PublishedPointer): PublishedCheck => ({
  expected,
  async read(query, lock) {
    const r = await query(pointerQuery(lock));
    const id = r.recordset[0]?.published_version_id;
    return id === null || id === undefined ? undefined : { id: Number(id), stamp: String(r.recordset[0].stamp ?? '') };
  },
  async files(query, id) {
    const r = await query("SELECT id, files_json FROM dbo.crm_meta_version WHERE id = @id AND status = N'published'", { id });
    return r.recordset[0] ? JSON.parse(String(r.recordset[0].files_json)) : undefined;
  },
});

/** Throws StaleVersionError unless the expected version and stamp are the published ones now; the pointer stays locked. */
export async function assertStillPublished(query: MetaQuery, check: PublishedCheck, lock: PointerLock): Promise<void> {
  const now = await check.read(query, lock);
  if (!now || now.id !== check.expected.id || now.stamp !== check.expected.stamp) throw new StaleVersionError();
}
