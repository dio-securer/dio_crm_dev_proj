// A fake SQL Server for synthetic tests: an in-memory SQLite database (node:sqlite) that runs the record layer's real
// SQL after a few dialect rewrites (dbo., lock hints, OFFSET/FETCH, OUTPUT, IDENTITY, COLLATE). WHERE conditions,
// parameters and data are evaluated by a real SQL engine, so access and injection tests see real query semantics.
// Statements it does not know are refused, so new SQL cannot pass untested. This is not SQL Server (see F2-4 spec).
import { TypedParam, isTypedParam } from '../../src/database/sql-params';

type Row = Record<string, unknown>;
/** A typed parameter as SQLite text: DATETIME2(3) as the UTC ISO text, DATE as YYYY-MM-DD. */
const typed = (p: TypedParam) => (p.value === null ? null : p.sqlParam === 'date' ? p.value.toISOString().slice(0, 10) : p.value.toISOString());
const sqlite = (process as any).getBuiltinModule('node:sqlite');

export interface LoggedStatement { text: string; params: Record<string, unknown> }

export function sqliteDb() {
  const db = new sqlite.DatabaseSync(':memory:');
  const log: LoggedStatement[] = [];
  let inTx = false;
  const bind = (sql: string, params: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (!new RegExp(`@${k}\\b`).test(sql)) continue;
      out[k] = isTypedParam(v) ? typed(v) : v instanceof Date ? v.toISOString() : typeof v === 'boolean' ? (v ? 1 : 0) : v;
    }
    return out;
  };
  const columns = (table: string) => (db.prepare(`PRAGMA table_info([${table}])`).all() as Row[]);
  function typeRow(name: string, declared: string) {
    const m = /^(\w+)(?:\((\d+)(?:,(\d+))?\))?/.exec(declared.toUpperCase())!;
    const kind = m[1] === 'INTEGER' ? 'int' : m[1].toLowerCase();
    const length = kind === 'nvarchar' ? Number(m[2]) : null;
    return { COLUMN_NAME: name, DATA_TYPE: kind, CHARACTER_MAXIMUM_LENGTH: length,
      NUMERIC_PRECISION: kind === 'decimal' ? Number(m[2]) : null, NUMERIC_SCALE: kind === 'decimal' ? Number(m[3]) : null };
  }
  async function query(text: string, params: Record<string, unknown> = {}): Promise<{ recordset: Row[] }> {
    log.push({ text, params });
    if (text.startsWith('DECLARE @lock INT;')) return { recordset: [] };
    let m = /^IF OBJECT_ID\(N'dbo\.(\w+)', N'U'\) IS NULL\nCREATE TABLE dbo\.\[(\w+)\] \(([\s\S]*)\)$/.exec(text);
    if (m) {
      if (m[1] !== m[2]) throw new Error('fake: guard and table differ');
      const body = m[3].replace(/\[id\] BIGINT IDENTITY\(1,1\) NOT NULL CONSTRAINT \[\w+\] PRIMARY KEY/, '[id] INTEGER PRIMARY KEY AUTOINCREMENT');
      db.exec(`CREATE TABLE IF NOT EXISTS [${m[2]}] (${body})`);
      return { recordset: [] };
    }
    m = /^IF NOT EXISTS \(SELECT 1 FROM sys\.indexes WHERE name = N'(\w+)' AND object_id = OBJECT_ID\(N'dbo\.(\w+)'\)\)\nCREATE INDEX \[(\w+)\] ON dbo\.\[(\w+)\] (\(.*\))$/.exec(text);
    if (m) { db.exec(`CREATE INDEX IF NOT EXISTS [${m[3]}] ON [${m[4]}] ${m[5]}`); return { recordset: [] }; }
    m = /^IF COL_LENGTH\(N'dbo\.(\w+)', N'(\w+)'\) IS NULL\nALTER TABLE dbo\.\[(\w+)\] ADD \[(\w+)\] ([A-Z0-9(),]+) NULL$/.exec(text);
    if (m) {
      if (m[1] !== m[3] || m[2] !== m[4]) throw new Error('fake: guard and column differ');
      if (!columns(m[1]).some(c => c.name === m![2])) db.exec(`ALTER TABLE [${m[1]}] ADD COLUMN [${m[2]}] ${m[5]}`);
      return { recordset: [] };
    }
    if (text.startsWith('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES')) {
      return { recordset: (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'crm\\_obj\\_%' ESCAPE '\\'").all() as Row[]).map(r => ({ TABLE_NAME: r.name })) };
    }
    if (text.startsWith('SELECT COLUMN_NAME, DATA_TYPE')) {
      return { recordset: columns(String(params.table)).map(c => typeRow(String(c.name), String(c.type))) };
    }
    let sql = text.replace(/dbo\./g, '').replace(' WITH (UPDLOCK, ROWLOCK)', '').replace(/COLLATE Latin1_General_100_BIN2/g, 'COLLATE BINARY')
      .replace('OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY', 'LIMIT @limit OFFSET @offset');
    const out = /^(INSERT INTO \[\w+\] \([^)]*\)) OUTPUT INSERTED\.\[id\] (VALUES \(.*\))$/.exec(sql);
    if (out) sql = `${out[1]} ${out[2]} RETURNING [id]`;
    if (!/^(SELECT|INSERT|UPDATE) /.test(sql)) throw new Error(`fake: unknown statement ${text.slice(0, 60)}`);
    const st = db.prepare(sql);
    if (/^SELECT|RETURNING/.test(sql)) return { recordset: (st.all(bind(sql, params)) as Row[]).map(r => ({ ...r })) };
    st.run(bind(sql, params));
    return { recordset: [] };
  }
  return {
    log,
    raw: db,
    tables: () => (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Row[]).map(r => String(r.name)),
    async transaction<T>(work: (q: typeof query) => Promise<T>): Promise<T> {
      if (inTx) throw new Error('fake: nested transaction');
      inTx = true;
      db.exec('BEGIN');
      try { const r = await work(query); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } finally { inTx = false; }
    },
  };
}
