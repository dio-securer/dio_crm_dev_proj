#!/usr/bin/env node
// F2-3 real-database check: stage -> publish -> publish -> rollback of metadata versions on a real SQL Server.
// Meant for the owner's PC. Creates only the crm_meta_* tables (idempotent) and never touches other tables.
// Connection settings come from environment variables only (see settings.mjs); nothing secret is in code or in the result.
//
// Windows PowerShell, SQL login (owner's PC: SQL Server on 127.0.0.1:1433, database "DIO CRM", login sa):
//   pnpm install; pnpm build
//   $env:CRM_META_DB_SERVER = "127.0.0.1"; $env:CRM_META_DB_PORT = "1433"; $env:CRM_META_DB_DATABASE = "DIO CRM"
//   $env:CRM_META_DB_USER = "sa"; $env:CRM_META_DB_PASSWORD = Read-Host "SQL password"
//   node scripts/meta-db/run-publish-rollback.mjs
// Optional, signed-in Windows account instead: $env:CRM_META_DB_AUTH = "windows-integrated" (no user/password; needs msnodesqlv8).
// If the msnodesqlv8 driver is missing the script prints how to add it without changing the repository.
// Result: .guard/real-db/meta-versions-<time>.json (kind REAL, verdict PASS or FAIL). Exit code 0 only on PASS.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readMetadata as readFrom, transactional, writeResult } from './db.mjs';
import { MSNODESQLV8_HELP, settingsFrom } from './settings.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const backendRequire = createRequire(path.join(repo, 'backend/package.json'));
const readMetadata = () => readFrom(repo);

async function main() {
  const started = new Date().toISOString();
  const steps = [];
  const step = async (name, fn) => {
    try { const detail = await fn(); steps.push({ name, ok: true, ...(detail ? { detail } : {}) }); return detail; }
    catch (e) { steps.push({ name, ok: false, error: e.code ? `${e.code}${e.issues?.length ? ` ${e.issues.map(i => i.code).join(',')}` : ''}` : String(e.message) }); throw e; }
  };
  let pool, cfg;
  try {
    let conn;
    cfg = await step('settings', async () => { conn = settingsFrom(process.env); return conn.summary; });
    const sql = await step('load driver', async () => {
      try { return backendRequire(conn.driverModule); } catch (e) {
        if (conn.driverModule !== 'mssql') console.error(MSNODESQLV8_HELP);
        throw new Error(`cannot load ${conn.driverModule}: ${e.message.split('\n')[0]}`);
      }
    });
    delete steps[steps.length - 1].detail;
    const store = backendRequire(path.join(repo, 'backend/dist/src/database/crm-meta-version-store.js'));
    const engine = createRequire(path.join(repo, 'packages/engine/package.json'))(path.join(repo, 'packages/engine/dist/index.js'));
    await step('connect', async () => { pool = await new sql.ConnectionPool(conn.config).connect(); });
    const db = transactional(sql, pool, backendRequire(path.join(repo, 'backend/dist/src/database/sql-params.js')).bindParams);
    await step('apply crm_meta schema', () => store.applyCrmMetaSchema(db));
    const svc = new engine.MetadataVersions(new store.SqlMetaVersionStore(db));
    const actor = 'f2-3-real-db-check';
    const before = await step('read published before', async () => ({ id: (await svc.published())?.id ?? null }));
    const files = readMetadata();
    const v1 = await step('stage v1 (repository metadata)', async () => ({ id: await svc.stage(files, actor, 'F2-3 check v1') }));
    await step('publish v1', async () => ({ status: (await svc.publish(v1.id, actor)).status }));
    const v2files = files.map(f => (f.path === 'metadata/terms/en-US/lead.json' ? { ...f, content: JSON.stringify({ ...JSON.parse(f.content), 'lead.label': 'Lead (F2-3 check)' }) } : f));
    const v2 = await step('stage v2 (one label changed)', async () => ({ id: await svc.stage(v2files, actor, 'F2-3 check v2') }));
    await step('publish v2', async () => { const r = await svc.publish(v2.id, actor); if (r.previousId !== v1.id) throw new Error('previousId is not v1'); return { previousId: r.previousId }; });
    await step('rollback', async () => { const r = await svc.rollback(actor); if (r.id !== v1.id) throw new Error(`rolled back to ${r.id}, not v1 ${v1.id}`); return { restored: r.id }; });
    await step('published is v1 after rollback (fresh read)', async () => { const p = await svc.published(); if (p?.id !== v1.id) throw new Error(`published is ${p?.id}`); return { id: p.id, before: before.id }; });
    await step('refuses a widening publish (D05)', async () => {
      const wide = files.map(f => (f.path === 'metadata/objects/lead/access.json' ? { ...f, content: JSON.stringify({ entity: 'lead', rules: [{ kind: 'all' }] }) } : f));
      const id = await svc.stage(wide, actor, 'F2-3 check widening');
      try { await svc.publish(id, actor); } catch (e) { if (e.code === 'INCOMPATIBLE') { await svc.discard(id, actor); return { refused: true }; } throw e; }
      throw new Error('widening publish was accepted');
    });
  } catch { /* recorded in steps */ } finally {
    if (pool) await pool.close().catch(() => undefined);
  }
  const verdict = steps.length > 0 && steps.every(s => s.ok) && steps.some(s => s.name.startsWith('refuses')) ? 'PASS' : 'FAIL';
  const result = { kind: 'REAL', check: 'F2-3 metadata versions publish/rollback', verdict, started, finished: new Date().toISOString(), target: cfg ?? null, steps };
  writeResult(repo, 'meta-versions', result);
  process.exitCode = verdict === 'PASS' ? 0 : 1;
}
main();
