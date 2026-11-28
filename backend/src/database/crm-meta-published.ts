// The published metadata version, read without locks (F2-4). The automatic API runs on this version only;
// staging versions and the repository's metadata/ files never reach it. Writes stay in crm-meta-version-store.ts.
import { MetaTransactional } from './crm-meta-version-store';

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
