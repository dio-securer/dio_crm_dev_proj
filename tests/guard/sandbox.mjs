// A throwaway copy of the guard for the trial tests: a small synthetic repository in the OS temp folder that holds a
// copy of scripts/guard and scripts/crm (the code under test), so the real runner and its exit codes are exercised
// without touching this working tree.
// Everything a test process makes lives under ONE folder (HOME below), and the temp-folder variables of the process
// point at it, so child processes (the guard, git, crm) put their temp files there too. HOME is removed when the
// process ends, also on SIGINT / SIGTERM / SIGHUP, and by a small watcher process when the test process is killed outright.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeClaude } from '../../scripts/guard/lib/claude-md.mjs';
import { writeCodeowners } from '../../scripts/guard/lib/codeowners.mjs';
import { writeDocs } from '../../scripts/guard/lib/docs.mjs';
import { createContext, stableJson } from '../../scripts/guard/lib/files.mjs';
import { LEGACY_FILE, computeLegacy, toDocument } from '../../scripts/guard/lib/legacy.mjs';
import { TS_HOSTS } from '../../scripts/guard/lib/ts.mjs';
import { RULES } from '../../scripts/guard/rules/index.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const NODE = process.execPath;
const GUARD = 'scripts/guard/run.mjs';
const START = 'scripts/guard/commit-id-start.json';
export const TEMP_PREFIX = 'guard-trial-';
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
for (const name of ['TMPDIR', 'TMP', 'TEMP']) process.env[name] = HOME;
const cleanUp = () => { try { fs.rmSync(HOME, { recursive: true, force: true, maxRetries: 2 }); } catch { /* the watcher tries again */ } };
process.on('exit', cleanUp);
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) process.on(signal, () => { cleanUp(); process.exit(code); });
// The watcher: waits until this process is gone, then removes HOME (again after a moment: a guard run that was still
// going may have written once more). It covers the ends no handler can see, such as SIGKILL.
const WATCHER = `const fs = require('node:fs'); const [pid, dir] = process.argv.slice(1);
const gone = () => { try { process.kill(Number(pid), 0); return false; } catch (error) { return error.code !== 'EPERM'; } };
const sweep = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} };
const timer = setInterval(() => { if (!gone()) return; clearInterval(timer); sweep(); setTimeout(sweep, 1000); setTimeout(sweep, 4000); }, 250);`;
spawn(process.execPath, ['-e', WATCHER, String(process.pid), HOME], { cwd: os.homedir(), detached: true, stdio: 'ignore' }).unref();

/** A new empty folder under this process's temp folder. It is deleted when this process ends, however it ends. */
export function tempDir(prefix = TEMP_PREFIX) {
  return fs.mkdtempSync(path.join(HOME, prefix));
}

export function writeFiles(dir, files) {
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
}

const HEX = '#';
// The smallest tree in which every rule has something real to look at. Clean under an empty baseline.
export const BASE_FILES = {
  '.gitignore': 'node_modules/\n.guard/\n',
  'frontend/src/App.tsx': 'export const App = () => <main />;\n',
  'frontend/src/HomePage.tsx': 'export const HomePage = () => <section />;\n',
  'frontend/src/api.ts': "export const call = (url: string) => fetch(url);\n",
  'frontend/src/styles/tokens.css': `:root { --brand: ${HEX}0af; }\n`,
  'frontend/src/hq-mock/Old.tsx': 'export const Old = () => <div />;\n',
  'packages/contracts/src/lead-grid.ts': 'export const columns = [];\n',
  // More legacy contract files, one per source suffix that an import may leave out (trials/members.mjs).
  ...Object.fromEntries(['lead-view.tsx', 'lead-tool.js', 'lead-part.jsx', 'lead-mod.mjs', 'lead-old.cjs']
    .map(name => [`packages/contracts/src/${name}`, 'export const a = 1;\n'])),
  'backend/src/modules/order/order.service.ts': 'export const total = (a: number, b: number) => a + b;\n',
  'tests/guard/base.test.mjs': "import { it } from 'node:test';\nit('guard', () => {});\n",
  'tests/sample.test.mjs': "describe('g', () => { it('a', () => {}); it('b', () => {}); });\n",
  'scripts/x/order-check.mjs': 'async function check(n, run) { await run(); }\nawait check(1, async () => {});\nawait check(2, async () => {});\n',
};

// A tree with two old violations frozen in the baseline, for the tests of the ratchet and of the protect check P1.
const OLD_BIG = '// x\n'.repeat(310);
export const BOUND = {
  files: { 'ui/old.css': `a { color: ${HEX}fff; background: ${HEX}000; }\n`, 'src/old-big.ts': OLD_BIG },
  baseline: {
    G03: { total: { lines: 310, bytes: OLD_BIG.length }, files: { src: { 'old-big.ts': { lines: 310, bytes: OLD_BIG.length } } } },
    G05: { total: 2, files: { ui: { 'old.css': 2 } } },
  },
};

function typescriptDir() {
  for (const host of TS_HOSTS) {
    try { return path.dirname(createRequire(path.join(root, host, 'package.json')).resolve('typescript/package.json')); } catch { /* next host */ }
  }
  throw new Error('typescript is not installed in this repository (run pnpm install).');
}

/**
 * Build the sandbox. `files` are added to the base tree, `baseline` is the `rules` object of guard-baseline.json.
 * Returns helpers bound to the folder: guard(...args) runs the copied runner, result(name) reads what it wrote.
 */
export function makeSandbox({ files = {}, baseline = {} } = {}) {
  const dir = tempDir();
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = subject => { git('commit', '-q', '--allow-empty', '--no-verify', '-m', subject); return git('rev-parse', 'HEAD'); };
  for (const name of ['scripts/guard', 'scripts/crm']) fs.cpSync(path.join(root, name), path.join(dir, name), { recursive: true });
  for (const name of ['scripts/i18n/hardcode-check.mjs', 'CLAUDE.md', 'guard-raises.json']) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.copyFileSync(path.join(root, name), path.join(dir, name));
  }
  writeFiles(dir, { ...BASE_FILES, ...files, 'guard-baseline.json': `${JSON.stringify({ schemaVersion: 2, rules: baseline }, null, 2)}\n` });
  const link = path.join(dir, TS_HOSTS[0], 'node_modules');
  fs.mkdirSync(link, { recursive: true });
  fs.symlinkSync(typescriptDir(), path.join(link, 'typescript'), 'junction');
  git('init', '-q');
  fs.writeFileSync(path.join(dir, LEGACY_FILE), `${stableJson(toDocument(computeLegacy(createContext(dir))), 2)}\n`);
  // CODEOWNERS and the rule document first: CLAUDE.md marks the protected paths that do not exist yet.
  writeCodeowners(dir);
  writeDocs(dir, RULES);
  writeClaude(dir, RULES);
  git('add', '-A');
  const first = commit('sandbox tree');
  // The start point of the change-id rule must be a commit of this repository: `exempt` has no ID and is never checked.
  const exempt = commit('sandbox commit from before the change-id rule');
  fs.writeFileSync(path.join(dir, START), `${JSON.stringify({ lastExemptCommit: exempt })}\n`);
  git('add', '-A');
  const base = commit('[F0-5] sandbox start point');
  const guardWith = (env, ...args) => spawnSync(NODE, [GUARD, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
  const guard = (...args) => guardWith({}, ...args);
  const result = (name = 'guard-result.json') => JSON.parse(fs.readFileSync(path.join(dir, '.guard', name), 'utf8'));
  const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
  const write = map => writeFiles(dir, map);
  const remove = name => fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  /** Back to the committed tree: undo edits, delete new files. Ignored files (.guard, node_modules) stay. */
  const reset = (to = base) => { git('reset', '-q', '--hard', to); git('clean', '-fdq'); };
  return { dir, first, exempt, base, git, commit, guard, guardWith, result, read, write, remove, reset, typescriptLink: path.join(link, 'typescript') };
}

/** { ruleId: { file: current } } of everything a default guard run reported as new. */
export function violationsOf(result) {
  const out = {};
  for (const rule of result.rules) if (rule.newViolations.length) out[rule.id] = Object.fromEntries(rule.newViolations.map(item => [item.file, item.current]));
  return out;
}
