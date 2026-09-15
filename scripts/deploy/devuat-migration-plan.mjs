#!/usr/bin/env node

import { readdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const raw = process.argv.slice(2);
const getArg = name => {
  const i = raw.indexOf(`--${name}`);
  return i >= 0 ? raw[i + 1] : undefined;
};
const has = name => raw.includes(`--${name}`);

const target = String(getArg('target') || process.env.CRM_TARGET_ENV || 'DEV').toUpperCase();
const execute = has('execute');
const allowed = new Set(['DEV', 'UAT']);

if (!allowed.has(target)) {
  console.error(`REFUSED Target '${target}' is not allowed. This script only permits DEV or UAT.`);
  process.exit(2);
}

const migrationDir = path.resolve('database/migrations');
const seedDir = path.resolve('database/seeds');
const migrations = (await readdir(migrationDir)).filter(x => /^\d{3}_.*\.sql$/i.test(x)).sort();
const seeds = (await readdir(seedDir)).filter(x => /^\d{3}_.*\.sql$/i.test(x)).sort();

const expected = ['001','002','003','004','005','006','007','008','009','010','011'];
const migrationPrefixes = migrations.map(x => x.slice(0,3));
const missing = expected.filter(x => !migrationPrefixes.includes(x));
if (missing.length) {
  console.error(`FAIL Missing migration(s): ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`DIO CRM ${target} Migration Plan`);
console.log('Migrations:');
migrations.forEach((file, i) => console.log(`${String(i + 1).padStart(2,'0')}. ${file}`));
console.log('Seeds:');
seeds.forEach((file, i) => console.log(`${String(i + 1).padStart(2,'0')}. ${file}`));

if (!execute) {
  console.log('PLAN ONLY No SQL was executed. Add --execute only after backup/snapshot and environment approval.');
  process.exit(0);
}

const required = ['CRM_DB_SERVER','CRM_DB_DATABASE','CRM_DB_USER','CRM_DB_PASSWORD'];
const absent = required.filter(k => !process.env[k]);
if (absent.length) {
  console.error(`REFUSED Missing environment variables: ${absent.join(', ')}`);
  process.exit(2);
}
if (process.env.CRM_ALLOW_DB_MUTATION !== 'YES') {
  console.error('REFUSED CRM_ALLOW_DB_MUTATION=YES is required for execution.');
  process.exit(2);
}

try {
  await access(migrationDir, constants.R_OK);
} catch {
  console.error('FAIL Migration directory is not readable.');
  process.exit(1);
}

const sqlcmd = process.env.SQLCMD_PATH || 'sqlcmd';
const common = ['-S', `${process.env.CRM_DB_SERVER}${process.env.CRM_DB_PORT ? ',' + process.env.CRM_DB_PORT : ''}`, '-d', process.env.CRM_DB_DATABASE, '-U', process.env.CRM_DB_USER, '-P', process.env.CRM_DB_PASSWORD, '-b', '-r', '1'];

function runFile(file) {
  console.log(`EXEC ${file}`);
  const r = spawnSync(sqlcmd, [...common, '-i', file], { stdio: 'inherit', shell: false });
  if (r.error) {
    console.error(`FAIL Could not execute sqlcmd: ${r.error.message}`);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

for (const file of migrations) runFile(path.join('database/migrations', file));
for (const file of seeds) runFile(path.join('database/seeds', file));
console.log(`PASS ${target} migration/seed execution completed. Run post-migration smoke and DB verification before marking the gate complete.`);
