// The trial tests leave nothing behind in the temp folder of the machine, however their process ends: normally, with a
// failing test, with an uncaught error, on a signal (Ctrl-C, a stopped CI job), or killed outright (SIGKILL).
// A small process that uses sandbox.mjs is started for each ending, with a temp folder of its own, and that folder
// must be empty again shortly after the process is gone.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { NODE, TEMP_PREFIX, tempDir } from './sandbox.mjs';

const SANDBOX = new URL('./sandbox.mjs', import.meta.url).href;
const WAIT_MS = 15000;
const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });
// The process makes two folders with files, tells where they are, and then ends in the way it is told to.
const ENDINGS = {
  'a normal end': 'process.exitCode = 0;',
  'process.exit(3)': 'process.exit(3);',
  'an uncaught error': "throw new Error('trial: uncaught');",
  'a rejected promise': "await Promise.reject(new Error('trial: rejected'));",
  'a failing test': "const { test } = await import('node:test'); test('fails', () => { throw new Error('trial: failing test'); });",
  SIGINT: 'setInterval(() => {}, 1000);',
  SIGTERM: 'setInterval(() => {}, 1000);',
  SIGHUP: 'setInterval(() => {}, 1000);',
  SIGKILL: 'setInterval(() => {}, 1000);',
};
const script = ending => `import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { tempDir } from ${JSON.stringify(SANDBOX)};
const dirs = [tempDir(), tempDir('other-')];
for (const dir of dirs) { fs.mkdirSync(path.join(dir, 'deep/er'), { recursive: true }); fs.writeFileSync(path.join(dir, 'deep/er/file.txt'), 'x'); }
fs.writeFileSync(path.join(os.tmpdir(), 'from-a-child-tool.txt'), 'x');
console.log(JSON.stringify(dirs));
${ending}
`;

/** Start the process, wait until it has made its folders, end it with `signal` (if any) and return what is left in its temp folder. */
async function leftAfter(ending, signal) {
  const temp = tempDir('ending-');
  const env = { ...process.env, TMPDIR: temp, TMP: temp, TEMP: temp };
  const child = spawn(NODE, ['--input-type=module', '-e', script(ending)], { env, stdio: ['ignore', 'pipe', 'ignore'] });
  const closed = new Promise(resolve => { child.on('close', (code, by) => resolve({ code, by })); });
  let out = '';
  child.stdout.on('data', chunk => { out += chunk; });
  for (let waited = 0; !out.includes('\n') && waited < WAIT_MS; waited += 50) await sleep(50);
  const dirs = JSON.parse(out.split('\n')[0]);
  const home = path.dirname(dirs[0]);
  // While the process lives its folders are there, inside one folder of its own directly in the temp folder.
  const during = { home: path.dirname(home) === temp && path.basename(home).startsWith(TEMP_PREFIX), same: path.dirname(dirs[1]) === home };
  if (signal) { assert.ok(fs.existsSync(path.join(dirs[0], 'deep/er/file.txt'))); child.kill(signal); }
  const end = await closed;
  let left = fs.readdirSync(temp);
  for (let waited = 0; left.length > 0 && waited < WAIT_MS; waited += 100) { await sleep(100); left = fs.readdirSync(temp); }
  return { during, end, left };
}

for (const [name, ending] of Object.entries(ENDINGS)) {
  const signal = name.startsWith('SIG') ? name : null;
  test(`nothing is left in the temp folder after ${signal ? `the process is ended by ${signal}` : name}`, async () => {
    const run = await leftAfter(ending, signal);
    assert.deepEqual(run.during, { home: true, same: true });
    assert.deepEqual(run.left, [], 'the temp folder is empty again');
    if (signal === 'SIGKILL') assert.equal(run.end.by, 'SIGKILL');
    else if (signal) assert.deepEqual(run.end, { code: { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 }[signal], by: null });
    else assert.equal(run.end.code, { 'a normal end': 0, 'process.exit(3)': 3 }[name] ?? 1);
  });
}

test('this test process keeps everything it makes under one folder, and its tools are pointed there too', () => {
  const [one, two] = [tempDir(), tempDir('named-')];
  assert.equal(path.dirname(one), path.dirname(two));
  assert.ok(path.basename(path.dirname(one)).startsWith(TEMP_PREFIX) && path.basename(two).startsWith('named-'));
  for (const name of ['TMPDIR', 'TMP', 'TEMP']) assert.equal(process.env[name], path.dirname(one), name);
});
