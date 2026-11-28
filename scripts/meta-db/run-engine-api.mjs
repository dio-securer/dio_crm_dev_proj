#!/usr/bin/env node
// F2-4 real-database check of the automatic API on a real SQL Server (owner's PC). Runs the backend's built engine API
// (published metadata -> crm_obj_ tables -> list/read/create/update with row access) as synthetic actors of a synthetic
// company, then deletes only the rows it created. Creates only crm_meta_* and crm_obj_* tables (idempotent).
// Connection settings come from environment variables only (settings.mjs); the password is never printed or stored.
//
// Windows PowerShell, SQL login (owner's PC: SQL Server on 127.0.0.1:1433, database "DIO CRM", login sa):
//   pnpm install; pnpm build
//   $env:CRM_META_DB_SERVER = "127.0.0.1"; $env:CRM_META_DB_PORT = "1433"; $env:CRM_META_DB_DATABASE = "DIO CRM"
//   $env:CRM_META_DB_USER = "sa"; $env:CRM_META_DB_PASSWORD = Read-Host "SQL password"
//   node scripts/meta-db/run-engine-api.mjs
// Optional: $env:CRM_ENGINE_CHECK_COMPANY_ID = "-4242" (default). It must be negative: no real company has a negative id,
// and zero or a positive id is refused. The next id down is used as "another company".
// If nothing is published yet, the repository metadata is staged and published first.
// The date check writes to its own table dbo.crm_obj_zz_engine_check (made if missing, never dropped; its rows are
// deleted again): the repository's lead has no writable date field, and the check must not change what is published.
// Result: .guard/real-db/engine-api-<time>.json (kind REAL, verdict PASS or FAIL). Exit code 0 only on PASS.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readMetadata, transactional, writeResult } from './db.mjs';
import { MSNODESQLV8_HELP, checkCompanyId, settingsFrom } from './settings.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const backendRequire = createRequire(path.join(repo, 'backend/package.json'));
const dist = rel => backendRequire(path.join(repo, 'backend/dist/src', rel));

const expectCode = async (work, status, code) => {
  try { await work(); } catch (e) { if (e.status === status && e.code === code) return { refused: `${status} ${code}` }; throw e; }
  throw new Error(`expected ${status} ${code}, but it was accepted`);
};
const must = (ok, text) => { if (!ok) throw new Error(text); };

async function main() {
  const started = new Date().toISOString();
  const steps = [];
  const step = async (name, fn) => {
    try { const detail = await fn(); steps.push({ name, ok: true, ...(detail ? { detail } : {}) }); return detail; }
    catch (e) { steps.push({ name, ok: false, error: e.code ? `${e.code}${e.errors?.length ? ` ${JSON.stringify(e.errors)}` : ''}` : String(e.message).split('\n')[0] }); throw e; }
  };
  let company;
  const tag = started.replace(/\D/g, '').slice(0, 14);
  const created = [], createdDates = [];
  let pool, cfg, db;
  try {
    let conn;
    cfg = await step('settings', async () => {
      company = checkCompanyId(process.env);
      conn = settingsFrom(process.env);
      return { ...conn.summary, company };
    });
    const sql = await step('load driver', async () => {
      try { return backendRequire(conn.driverModule); } catch (e) {
        if (conn.driverModule !== 'mssql') console.error(MSNODESQLV8_HELP);
        throw new Error(`cannot load ${conn.driverModule}: ${e.message.split('\n')[0]}`);
      }
    });
    delete steps[steps.length - 1].detail;
    const meta = dist('database/crm-meta-version-store.js');
    const { SqlObjectRecords } = dist('database/crm-obj-store.js');
    const { EngineRecords } = dist('modules/engine-api/engine-records.js');
    const { PublishedModels, sqlPublishedPorts } = dist('modules/engine-api/published-model.js');
    const engine = backendRequire('@dio-crm/engine');
    await step('connect', async () => { pool = await new sql.ConnectionPool(conn.config).connect(); });
    db = transactional(sql, pool, dist('database/sql-params.js').bindParams);
    await step('apply crm_meta schema', () => meta.applyCrmMetaSchema(db));
    await step('published metadata version', async () => {
      const versions = new engine.MetadataVersions(new meta.SqlMetaVersionStore(db));
      const now = await versions.published();
      if (now) return { id: now.id, publishedHere: false };
      const id = await versions.stage(readMetadata(repo), 'f2-4-real-db-check', 'F2-4 check: first publish');
      return { id: (await versions.publish(id, 'f2-4-real-db-check')).id, publishedHere: true };
    });
    const api = new EngineRecords(new PublishedModels(sqlPublishedPorts(db)), new SqlObjectRecords(db));
    const actor = (userId, more = {}) => ({ companyId: company, actor: { userId, permissions: [], memberIds: [], unitIds: [], ...more } });
    const a = actor(`f2-4-a-${tag}`), b = actor(`f2-4-b-${tag}`), boss = actor(`f2-4-b-${tag}`, { memberIds: [a.actor.userId] });
    const elsewhere = { ...a, companyId: company - 1 };
    await step('first call makes crm_obj tables; new actor sees nothing', async () => {
      const page = await api.list(a, 'lead', {});
      must(page.items.length === 0, `new actor sees ${page.items.length} rows`);
      return { versionId: page.versionId };
    });
    const row = await step('create as A (owner filled with A)', async () => {
      const r = await api.create(a, 'lead', { hospital_name: 'F2-4 check', status: 'NEW' });
      created.push(r.id);
      must(r.values.owner_name === a.actor.userId, 'owner is not A');
      return { id: r.id };
    });
    await step('A reads it', async () => { must((await api.get(a, 'lead', row.id)).values.hospital_name === 'F2-4 check', 'wrong row'); });
    await step('B cannot read or list it', async () => {
      must(!(await api.list(b, 'lead', {})).items.some(r => r.id === row.id), 'B lists it');
      return expectCode(() => api.get(b, 'lead', row.id), 404, 'RECORD_NOT_FOUND');
    });
    await step('B with A as member sees it', async () => { must((await api.list(boss, 'lead', {})).items.some(r => r.id === row.id), 'members rule did not open it'); });
    await step('same user id in another company cannot read it', () => expectCode(() => api.get(elsewhere, 'lead', row.id), 404, 'RECORD_NOT_FOUND'));
    await step('A updates a field', async () => { must((await api.update(a, 'lead', row.id, { phone: '000' })).values.phone === '000', 'not updated'); });
    await step('B cannot update it', () => expectCode(() => api.update(b, 'lead', row.id, { phone: '111' }), 404, 'RECORD_NOT_FOUND'));
    await step('A cannot hand it to B', () => expectCode(() => api.update(a, 'lead', row.id, { owner_name: b.actor.userId }), 403, 'ACCESS_DENIED'));
    await step('system field write refused', () => expectCode(() => api.create(a, 'lead', { hospital_name: 'x', status: 'NEW', updated_at: started }), 400, 'INVALID_RECORD'));
    await step('injection text stored as data', async () => {
      const evil = "'); DROP TABLE dbo.crm_obj_lead; --";
      const r = await api.create(a, 'lead', { hospital_name: evil, status: 'NEW' });
      created.push(r.id);
      must((await api.get(a, 'lead', r.id)).values.hospital_name === evil, 'stored text differs');
      const t = await db.transaction(q => q("SELECT OBJECT_ID(N'dbo.crm_obj_lead', N'U') AS id"));
      must(t.recordset[0].id !== null, 'crm_obj_lead is gone');
    });
    await step('dates: year 1000 with .001 ms, date 0001-01-01, typed nulls (own table crm_obj_zz_engine_check)', async () => {
      const { applyObjectSchema } = dist('database/crm-obj-schema.js');
      const f = (key, type, more = {}) => ({ key, type, labelKey: 'x', required: false, system: false, aliases: [], ...more });
      const [shape] = await applyObjectSchema(db, [{ key: 'zz_engine_check', aliases: [], fields: [f('met_at', 'datetime'), f('opened_on', 'date'), f('updated_at', 'datetime', { system: true })] }]);
      const store = new SqlObjectRecords(db), scope = { companyId: company, actor: a.actor.userId }, all = { kind: 'all' };
      const sent = { met_at: '1000-01-01T00:00:00.001Z', opened_on: '0001-01-01' }, at = new Date('2026-01-01T00:00:00.001Z');
      const made = await store.insert(shape, scope, sent, at);
      createdDates.push(made.id);
      const read = (await store.get(shape, scope, all, Number(made.id))).values;
      must(read.met_at === sent.met_at, `met_at came back as ${read.met_at}`);
      must(read.opened_on === sent.opened_on, `opened_on came back as ${read.opened_on}`);
      must(read.updated_at === at.toISOString(), `updated_at came back as ${read.updated_at}`);
      const later = (await store.update(shape, scope, all, Number(made.id), () => ({ met_at: '9999-12-31T23:59:59.999Z', opened_on: null }), at)).values;
      must(later.met_at === '9999-12-31T23:59:59.999Z' && later.opened_on === null, `update came back as ${JSON.stringify(later)}`);
      return { id: made.id, read, later };
    });
    await step('B still sees none of A\'s rows', async () => { must((await api.list(b, 'lead', {})).items.length === 0, 'B sees rows'); });
  } catch { /* recorded in steps */ } finally {
    if (db && createdDates.length) {
      await step('delete only the date rows this run created', async () => {
        const ids = createdDates.map(Number);
        const r = await db.transaction(q => q(`DELETE FROM dbo.crm_obj_zz_engine_check WHERE company_id = @company AND id IN (${ids.map((_, i) => `@id${i}`).join(', ')})`,
          { company, ...Object.fromEntries(ids.map((id, i) => [`id${i}`, id])) }));
        return { deleted: r.rowsAffected?.[0] ?? null, ids };
      }).catch(() => undefined);
    }
    if (db && created.length) {
      await step('delete only the rows this run created', async () => {
        const ids = created.map(Number);
        const r = await db.transaction(q => q(`DELETE FROM dbo.crm_obj_lead WHERE company_id = @company AND id IN (${ids.map((_, i) => `@id${i}`).join(', ')})`,
          { company, ...Object.fromEntries(ids.map((id, i) => [`id${i}`, id])) }));
        return { deleted: r.rowsAffected?.[0] ?? null, ids };
      }).catch(() => undefined);
    }
    if (pool) await pool.close().catch(() => undefined);
  }
  const reached = ['dates:', 'B still'].every(start => steps.some(s => s.name.startsWith(start)));
  const verdict = steps.length > 0 && steps.every(s => s.ok) && reached ? 'PASS' : 'FAIL';
  const result = { kind: 'REAL', check: 'F2-4 engine API on a real database', verdict, started, finished: new Date().toISOString(), target: cfg ?? null, steps };
  writeResult(repo, 'engine-api', result);
  process.exitCode = verdict === 'PASS' ? 0 : 1;
}
main();
