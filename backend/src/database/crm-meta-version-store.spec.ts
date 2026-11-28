// Synthetic checks of the MS SQL metadata version adapter: the SQL it sends, the rows it reads, and a full
// stage -> publish -> rollback run of the real engine service against a fake that understands only these statements.
// A real SQL Server run is scripts/meta-db/run-publish-rollback.mjs (not run here).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CRM_META_SCHEMA, CRM_META_TABLES } from './crm-meta-schema';
import { MetaQuery, MetaTransactional, SqlMetaVersionStore, applyCrmMetaSchema, metaVersionTx } from './crm-meta-version-store';
import { DatabaseService } from './database.service';
// The engine is a backend dependency since F2-4 (@dio-crm/engine, built before the backend by pnpm -r build).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const engine = require('@dio-crm/engine');

type Row = Record<string, any>;
/** A fake database that keeps crm_meta_* rows in memory and answers exactly the adapter's statements. */
function fakeDb() {
  let state = { versions: new Map<number, Row>(), pointer: null as number | null, events: [] as Row[], next: 1, tables: new Set<string>(['crm_meta_version', 'crm_meta_pointer', 'crm_meta_event']), pointerRow: true };
  const log: { text: string; params: Record<string, unknown> }[] = [];
  const clone = () => ({ versions: new Map([...state.versions].map(([k, v]) => [k, { ...v }])), pointer: state.pointer, events: [...state.events], next: state.next, tables: new Set(state.tables), pointerRow: state.pointerRow });
  const created: string[] = [], names: string[] = [];
  const run = (s: typeof state): MetaQuery => async (text, params = {}) => {
    log.push({ text, params });
    const p = params as Row;
    // The name table of record tables is synchronised with every pointer move (crm-obj-name-sync.ts); here it is empty.
    if (text.startsWith('DECLARE @lock INT;') || text.includes('crm_meta_obj_name')) { names.push(text.split('\n')[0].slice(0, 40)); return { recordset: [] }; }
    const guard = /^IF OBJECT_ID\(N'dbo\.(\w+)', N'U'\) IS NULL\nCREATE TABLE dbo\.(\w+) /.exec(text);
    if (guard) {
      if (guard[1] !== guard[2]) throw new Error('guard and table differ');
      if (!s.tables.has(guard[2])) { s.tables.add(guard[2]); created.push(guard[2]); }
      return { recordset: [] };
    }
    if (text.startsWith('IF NOT EXISTS (SELECT 1 FROM dbo.crm_meta_pointer WHERE id = 1)\nINSERT')) {
      if (!s.pointerRow) { s.pointerRow = true; created.push('pointer row'); }
      return { recordset: [] };
    }
    if (text.startsWith('SELECT published_version_id')) return { recordset: s.pointerRow ? [{ published_version_id: s.pointer }] : [] };
    if (text.startsWith('UPDATE dbo.crm_meta_pointer')) { s.pointer = p.id; return { recordset: [] }; }
    if (text.startsWith('SELECT id, status')) { const r = s.versions.get(p.id); return { recordset: r ? [{ ...r }] : [] }; }
    if (text.startsWith('INSERT INTO dbo.crm_meta_version')) {
      const id = s.next++;
      s.versions.set(id, { id, status: p.status, files_json: p.files, created_by: p.createdBy, created_at: p.createdAt, published_at: p.publishedAt, previous_id: p.previousId, note: p.note });
      return { recordset: [{ id }] };
    }
    if (text.startsWith('UPDATE dbo.crm_meta_version SET')) {
      const r = s.versions.get(p.id)!;
      for (const [, col, name] of text.matchAll(/(\w+) = @(\w+)/g)) if (name !== 'id') r[col] = p[name];
      return { recordset: [] };
    }
    if (text.startsWith('INSERT INTO dbo.crm_meta_event')) { s.events.push({ ...p }); return { recordset: [] }; }
    throw new Error(`unexpected SQL: ${text}`);
  };
  const db: MetaTransactional = { async transaction(work) { const draft = clone(); const out = await work(run(draft)); state = draft; return out; } };
  const empty = () => { state.tables.clear(); state.pointerRow = false; };
  return { db, log, created, names, empty, get state() { return state; } };
}

function readMetadata() {
  const repo = path.resolve(__dirname, '../../..'), out: { path: string; content: string }[] = [];
  const walk = (dir: string) => { for (const e of fs.readdirSync(path.join(repo, dir), { withFileTypes: true })) { const rel = `${dir}/${e.name}`; if (e.isDirectory()) walk(rel); else out.push({ path: rel, content: fs.readFileSync(path.join(repo, rel), 'utf8') }); } };
  walk('metadata');
  return out;
}

describe('crm_meta schema', () => {
  it('creates only crm_meta_* tables, idempotently, and never drops, alters or truncates', () => {
    const all = CRM_META_SCHEMA.join('\n');
    expect(all).not.toMatch(/\b(DROP|ALTER|TRUNCATE|DELETE)\b/i);
    const created = [...all.matchAll(/CREATE TABLE dbo\.(\w+)/g)].map(m => m[1]);
    expect(created.sort()).toEqual([...CRM_META_TABLES].sort());
    for (const t of [...all.matchAll(/(?:INTO|FROM|REFERENCES|TABLE) dbo\.(\w+)/g)].map(m => m[1])) expect(t.startsWith('crm_meta_')).toBe(true);
    for (const s of CRM_META_SCHEMA.filter(x => x.includes('CREATE TABLE'))) expect(s.startsWith('IF OBJECT_ID(')).toBe(true);
  });
  it('applyCrmMetaSchema sends every statement in one transaction', async () => {
    const f = fakeDb();
    await applyCrmMetaSchema(f.db);
    expect(f.log.map(l => l.text)).toEqual([...CRM_META_SCHEMA]);
  });
  it('running the schema twice creates each table once and keeps the published pointer', async () => {
    const f = fakeDb();
    f.empty();
    await applyCrmMetaSchema(f.db);
    expect(f.created).toEqual(['crm_meta_version', 'crm_meta_pointer', 'pointer row', 'crm_meta_event']);
    await f.db.transaction(async q => { const tx = metaVersionTx(q); await tx.setPointer(await tx.insert({ status: 'published', files: [], createdBy: 'o', createdAt: '2026-11-28T00:00:00.000Z' })); });
    await applyCrmMetaSchema(f.db);
    expect(f.created).toHaveLength(4);
    expect(f.state.pointer).toBe(1);
  });
});

describe('SqlMetaVersionStore', () => {
  it('accepts DatabaseService as its transaction provider (compile-time)', () => {
    const fromService = (db: DatabaseService) => new SqlMetaVersionStore(db);
    expect(typeof fromService).toBe('function');
  });
  it('locks the pointer row and only updates whitelisted columns with parameters', async () => {
    const f = fakeDb();
    await f.db.transaction(async q => {
      const tx = metaVersionTx(q);
      await tx.lockPointer();
      const id = await tx.insert({ status: 'staging', files: [], createdBy: 'o', createdAt: '2026-11-28T00:00:00.000Z' });
      await tx.update(id, { status: 'published', previousId: undefined, ['note' as any]: 'x' } as any);
    });
    expect(f.log[0].text).toContain('WITH (UPDLOCK, HOLDLOCK)');
    const upd = f.log.find(l => l.text.startsWith('UPDATE dbo.crm_meta_version'))!;
    expect(upd.text).toBe('UPDATE dbo.crm_meta_version SET status = @status, previous_id = @previousId WHERE id = @id');
    expect(upd.params).toEqual({ id: 1, status: 'published', previousId: null });
  });
  it('reads rows back as engine records (dates as ISO strings, NULL as absent)', async () => {
    const tx = metaVersionTx(async () => ({ recordset: [{ id: 3, status: 'published', files_json: '[{"path":"a","content":"b"}]', created_by: 'o', created_at: new Date('2026-11-28T01:02:03.004Z'), published_at: null, previous_id: null, note: null }] }));
    expect(await tx.get(3)).toEqual({ id: 3, status: 'published', files: [{ path: 'a', content: 'b' }], createdBy: 'o', createdAt: '2026-11-28T01:02:03.004Z' });
  });
  it('refuses to run without the schema', async () => {
    await expect(metaVersionTx(async () => ({ recordset: [] })).lockPointer()).rejects.toThrow('CRM_META_SCHEMA_MISSING');
  });
  it('runs stage -> publish -> publish -> rollback with the engine service (the port matches at run time)', async () => {
    const f = fakeDb();
    let n = 0;
    const svc = new engine.MetadataVersions(new SqlMetaVersionStore(f.db), () => new Date(Date.UTC(2026, 10, 28, 0, 0, n++)).toISOString());
    const files = readMetadata();
    const v1 = await svc.stage(files, 'owner');
    await svc.publish(v1, 'owner');
    const v2files = files.map(x => x.path === 'metadata/terms/en-US/lead.json' ? { ...x, content: JSON.stringify({ ...JSON.parse(x.content), 'lead.label': 'Prospect' }) } : x);
    const v2 = await svc.publish(await svc.stage(v2files, 'owner'), 'owner');
    expect(v2.previousId).toBe(v1);
    expect((await svc.rollback('owner')).id).toBe(v1);
    expect(f.state.pointer).toBe(v1);
    expect([...f.state.versions.values()].map(v => v.status)).toEqual(['published', 'rolled_back']);
    expect(f.state.events.map(e => e.action)).toEqual(['stage', 'publish', 'stage', 'supersede', 'publish', 'rollback', 'restore']);
    // Every pointer move (two publishes, one rollback) synchronised the names of record tables in the same transaction.
    expect(f.names.filter(t => t.startsWith('SELECT [scope]'))).toHaveLength(3);
    expect(f.names.filter(t => t.startsWith('DECLARE @lock'))).toHaveLength(3);
  });
});
