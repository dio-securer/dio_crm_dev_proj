// Connection settings of run-publish-rollback.mjs, from environment variables only. No secret has a default.
//   CRM_META_DB_AUTH = sql (default) | windows-integrated
//   sql:                 CRM_META_DB_SERVER, CRM_META_DB_DATABASE, CRM_META_DB_USER, CRM_META_DB_PASSWORD (all required),
//                        CRM_META_DB_PORT (1433), CRM_META_DB_DOMAIN (NTLM with user/password), CRM_META_DB_ENCRYPT, CRM_META_DB_TRUST_CERT
//   windows-integrated:  the signed-in Windows account, no user or password. CRM_META_DB_SERVER, CRM_META_DB_DATABASE (required),
//                        CRM_META_DB_PORT (1433), CRM_META_DB_ODBC_DRIVER ("ODBC Driver 18 for SQL Server"), CRM_META_DB_TRUST_CERT
const read = env => name => (env[name] ?? '').trim();
/** An ODBC connection string value, braced so spaces, ';' and '}' are kept (DIO CRM -> {DIO CRM}). */
export const odbcValue = v => `{${v.replace(/}/g, '}}')}}`;

export function settingsFrom(env) {
  const e = read(env), auth = e('CRM_META_DB_AUTH') || 'sql';
  if (auth !== 'sql' && auth !== 'windows-integrated') throw new Error(`CRM_META_DB_AUTH must be sql or windows-integrated, not ${auth}`);
  const need = auth === 'sql' ? ['CRM_META_DB_SERVER', 'CRM_META_DB_DATABASE', 'CRM_META_DB_USER', 'CRM_META_DB_PASSWORD'] : ['CRM_META_DB_SERVER', 'CRM_META_DB_DATABASE'];
  const missing = need.filter(n => !e(n));
  if (missing.length) throw new Error(`missing environment variables: ${missing.join(', ')}`);
  const server = e('CRM_META_DB_SERVER'), port = Number(e('CRM_META_DB_PORT') || 1433), database = e('CRM_META_DB_DATABASE');
  const trust = e('CRM_META_DB_TRUST_CERT') !== 'false';
  const summary = { auth, server, port, database };
  const common = { pool: { min: 0, max: 2 }, connectionTimeout: 15000, requestTimeout: 30000 };
  if (auth === 'windows-integrated') {
    const driver = e('CRM_META_DB_ODBC_DRIVER') || 'ODBC Driver 18 for SQL Server';
    const connectionString = [`Driver=${odbcValue(driver)}`, `Server=${server},${port}`, `Database=${odbcValue(database)}`,
      'Trusted_Connection=yes', `TrustServerCertificate=${trust ? 'yes' : 'no'}`].join(';') + ';';
    return { driverModule: 'mssql/msnodesqlv8', summary: { ...summary, driver }, config: { ...common, connectionString, options: { trustedConnection: true } } };
  }
  const domain = e('CRM_META_DB_DOMAIN');
  const login = domain
    ? { authentication: { type: 'ntlm', options: { domain, userName: e('CRM_META_DB_USER'), password: e('CRM_META_DB_PASSWORD') } } }
    : { user: e('CRM_META_DB_USER'), password: e('CRM_META_DB_PASSWORD') };
  return { driverModule: 'mssql', summary, config: { ...common, server, port, database, ...login, options: { encrypt: e('CRM_META_DB_ENCRYPT') === 'true', trustServerCertificate: trust } } };
}

/** The secret texts of a connection config (the password), so an error line can blank them if a message repeats them. */
export const secretsOf = config => [config?.password, config?.authentication?.options?.password].filter(v => typeof v === 'string' && v !== '');

/**
 * The synthetic company of run-engine-api.mjs. It must be negative, so it can never be a real company's id, and
 * the id below it ("another company") must still fit an INT column.
 */
export function checkCompanyId(env) {
  const raw = read(env)('CRM_ENGINE_CHECK_COMPANY_ID');
  const company = raw === '' ? -4242 : /^-?[0-9]{1,10}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(company) || company >= 0 || company - 1 < -2147483648) {
    throw new Error('CRM_ENGINE_CHECK_COMPANY_ID must be a negative integer (from -1 to -2147483647): real company ids are refused');
  }
  return company;
}

export const MSNODESQLV8_HELP = [
  'windows-integrated needs the msnodesqlv8 driver, which is not installed in this repository (adding it changes protected package files).',
  'Without changing the repository (PowerShell):',
  '  npm install --prefix "$env:TEMP\\dio-odbc" msnodesqlv8',
  '  $env:NODE_PATH = "$env:TEMP\\dio-odbc\\node_modules"',
  'then run this script again in the same window. It also needs "ODBC Driver 18 for SQL Server" (or 17: set CRM_META_DB_ODBC_DRIVER).',
  'Adding it to the repository instead (pnpm add -w -D msnodesqlv8) changes package.json and pnpm-lock.yaml and needs the owner\'s approval.',
].join('\n');
