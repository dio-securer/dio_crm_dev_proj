import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'docs/admin-platform/customization/evidence');
fs.mkdirSync(out, { recursive: true });
const suite = fs.readdirSync(path.join(root, 'scripts/hq-standard'));
const checks = [
  ['contract-tests', ['--experimental-strip-types', '--test', ...suite.filter(f => f.endsWith('.test.mjs')).map(f => `scripts/hq-standard/${f}`)]],
  ['http-tests', ['--experimental-strip-types', '--test', ...suite.filter(f => /^h0.*-http\.mjs$/.test(f)).map(f => `scripts/hq-standard/${f}`)]],
  ['frontend-typecheck', ['frontend/node_modules/typescript/bin/tsc', '--noEmit', '-p', 'frontend/tsconfig.json']],
  ['backend-typecheck', ['backend/node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false', '-p', 'backend/tsconfig.json']],
  ['i18n-keys', ['scripts/i18n/check.mjs']],
  ['i18n-hardcode', ['scripts/i18n/hardcode-check.mjs']]
];
const results = [];
for (const [id, args] of checks) {
  const start = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 12 * 1024 * 1024, windowsHide: true });
  const text = `${r.stdout ?? ''}\n${r.stderr ?? ''}${r.error ? `\n${r.error.stack}` : ''}`;
  fs.writeFileSync(path.join(out, `${id}.log`), text);
  const row = { id, command: ['node', ...args], exitCode: r.status, signal: r.signal, status: r.error ? 'EXECUTION_ERROR' : r.status === 0 ? 'PASS' : 'FAIL',
    durationMs: Date.now() - start, log: `${id}.log`, tests: text.match(/^(?:#|ℹ) tests (\d+)/m)?.[1] ?? null, passed: text.match(/^(?:#|ℹ) pass (\d+)/m)?.[1] ?? null, failed: text.match(/^(?:#|ℹ) fail (\d+)/m)?.[1] ?? null };
  results.push(row); console.log(JSON.stringify(row));
  fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ stage: 'C00', atUtc: new Date().toISOString(), node: process.version,
    executionScope: 'This runner executes contract/HTTP/typecheck/i18n only. Browser and bundler outcomes are recorded independently; their absence here is not a NOT_RUN verdict.',
    companionEvidence: { browser: 'browser-baseline.json', frontendBundle: 'frontend-build.json' }, results }, null, 2) + '\n');
}
