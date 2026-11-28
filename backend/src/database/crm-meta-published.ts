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

/** The files of a version that is published now; undefined when the version is not (or no longer) published. */
export function readPublishedFiles(db: MetaTransactional, id: number): Promise<PublishedFiles | undefined> {
  return db.transaction(async query => {
    const r = await query("SELECT id, files_json FROM dbo.crm_meta_version WHERE id = @id AND status = N'published'", { id });
    const row = r.recordset[0];
    return row ? { id: Number(row.id), files: JSON.parse(String(row.files_json)) } : undefined;
  });
}
