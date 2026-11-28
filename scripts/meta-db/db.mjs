// Shared helpers of the real-database scripts: the repository metadata as files, and a transaction helper over mssql.
import fs from 'node:fs';
import path from 'node:path';

export function readMetadata(repo) {
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

/**
 * A MetaTransactional over an mssql pool: one SQL transaction per call, rolled back on any error.
 * `bind` is the backend's bindParams (backend/dist/src/database/sql-params.js): the same typed binding the API uses,
 * so dates travel as DATETIME2(3) / DATE and not as the driver's legacy DATETIME guess.
 */
export function transactional(sql, pool, bind) {
  if (typeof bind !== 'function') throw new Error('transactional needs the backend bindParams');
  return {
    async transaction(work) {
      const tx = new sql.Transaction(pool);
      await tx.begin();
      const query = async (text, params = {}) => {
        const req = new sql.Request(tx);
        bind(req, params, sql);
        return req.query(text);
      };
      try { const out = await work(query); await tx.commit(); return out; } catch (e) {
        // A failed rollback (e.g. the connection dropped) must not hide the error that caused it.
        try { await tx.rollback(); } catch { /* keep the original error */ }
        throw e;
      }
    },
  };
}

/** Writes a result file under .guard/real-db/ and prints the verdict and the steps (never a secret: steps hold none). */
export function writeResult(repo, prefix, result) {
  const dir = path.join(repo, '.guard/real-db');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${prefix}-${result.started.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`[meta-db] ${result.verdict}  ${path.relative(repo, file)}`);
  for (const s of result.steps) console.log(`  ${s.ok ? 'ok  ' : 'FAIL'} ${s.name}${s.error ? `: ${s.error}` : ''}`);
}
