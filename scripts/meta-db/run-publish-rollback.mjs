#!/usr/bin/env node
// F2-3 real-database check: stage -> publish -> publish -> rollback of metadata versions on a real SQL Server.
// Meant for the owner's PC. Creates only the crm_meta_* tables (idempotent) and never touches other tables.
// Connection settings come from environment variables only; nothing secret is written in code or in the result.
//   CRM_META_DB_SERVER (e.g. 127.0.0.1)   CRM_META_DB_PORT (default 1433)   CRM_META_DB_DATABASE (e.g. "DIO CRM")
//   CRM_META_DB_USER   CRM_META_DB_PASSWORD   CRM_META_DB_DOMAIN (only for Windows/NTLM sign-in)
//   CRM_META_DB_ENCRYPT=true|false (default false)   CRM_META_DB_TRUST_CERT=true|false (default true)
// Before running: pnpm install && pnpm build. Run from the repository root: node scripts/meta-db/run-publish-rollback.mjs
// Result: .guard/real-db/meta-versions-<time>.json (kind REAL, verdict PASS or FAIL). Exit code 0 only on PASS.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const backendRequire = createRequire(path.join(repo, 'backend/package.json'));
const env = name => (process.env[name] ?? '').trim();

function settings() {
  const missing = ['CRM_META_DB_SERVER', 'CRM_META_DB_DATABASE', 'CRM_META_DB_USER', 'CRM_META_DB_PASSWORD'].filter(n => !env(n));
  if (missing.length) throw new Error(`missing environment variables: ${missing.join(', ')}`);
  const domain = env('CRM_META_DB_DOMAIN');
  return {
    server: env('CRM_META_DB_SERVER'), port: Number(env('CRM_META_DB_PORT') || 1433), database: env('CRM_META_DB_DATABASE'),
    ...(domain
      ? { authentication: { type: 'ntlm', options: { domain, userName: env('CRM_META_DB_USER'), password: env('CRM_META_DB_PASSWORD') } } }
      : { user: env('CRM_META_DB_USER'), password: env('CRM_META_DB_PASSWORD') }),
    options: { encrypt: env('CRM_META_DB_ENCRYPT') === 'true', trustServerCertificate: env('CRM_META_DB_TRUST_CERT') !== 'false' },
    pool: { min: 0, max: 2 }, connectionTimeout: 15000, requestTimeout: 30000,
  };
}

function readMetadata() {
  const out = [];
  const walk = dir => {
    for (const e of fs.readdirSync(path.join(repo, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel); else out.push({ path: rel, content: fs.readFileSync(path.join(repo, rel), 'utf8') });
    }
  };
  walk('metadata');
  return out;
}

/** A MetaTransactional over an mssql pool: one SQL transaction per call, rolled back on any error. */
function transactional(sql, pool) {
  return {
    async transaction(work) {
      const tx = new sql.Transaction(pool);
      await tx.begin();
      const query = async (text, params = {}) => {
        const req = new sql.Request(tx);
        for (const [k, v] of Object.entries(params)) req.input(k, v);
        return req.query(text);
      };
      try { const out = await work(query); await tx.commit(); return out; } catch (e) { await tx.rollback(); throw e; }
    },
  };
}

async function main() {
  const started = new Date().toISOString();
  const steps = [];
  const step = async (name, fn) => {
    try { const detail = await fn(); steps.push({ name, ok: true, ...(detail ? { detail } : {}) }); return detail; }
    catch (e) { steps.push({ name, ok: false, error: e.code ? `${e.code}${e.issues?.length ? ` ${e.issues.map(i => i.code).join(',')}` : ''}` : String(e.message) }); throw e; }
  };
  let pool, cfg;
  try {
    cfg = await step('settings', async () => { const c = settings(); return { server: c.server, port: c.port, database: c.database }; });
    const sql = backendRequire('mssql');
    const store = backendRequire(path.join(repo, 'backend/dist/src/database/crm-meta-version-store.js'));
    const engine = createRequire(path.join(repo, 'packages/engine/package.json'))(path.join(repo, 'packages/engine/dist/index.js'));
    await step('connect', async () => { pool = await new sql.ConnectionPool(settings()).connect(); });
    const db = transactional(sql, pool);
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
  const dir = path.join(repo, '.guard/real-db');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `meta-versions-${started.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`[meta-db] ${verdict}  ${path.relative(repo, file)}`);
  for (const s of steps) console.log(`  ${s.ok ? 'ok  ' : 'FAIL'} ${s.name}${s.error ? `: ${s.error}` : ''}`);
  process.exitCode = verdict === 'PASS' ? 0 : 1;
}
main();
