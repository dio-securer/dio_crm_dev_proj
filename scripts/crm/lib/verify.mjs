// `crm verify`: runs every step, keeps going after a failure, and writes the evidence bundle
// `.guard/evidence/<shortsha>/evidence.json` + `summary.md` + one log per step. Bundles of other commits are deleted.
//
// Honesty rules, all enforced here:
// - evidenceKind is the constant SYNTHETIC. This command never touches a real database, so it has no code path that
//   writes the other, reserved kind (real-environment evidence).
// - A step is PASS only when its process ran and exited 0. Could not start, killed, timed out, script changed: ERROR.
// - The verdict is PASS only when every step of the fixed list is PASS and HEAD did not move during the run.
// - A step list passed in by a test (`steps`) is marked INJECTED, can never produce the verdict PASS, and may not write
//   into the repository. The command line has no way to pass one.
import fs from 'node:fs';
import path from 'node:path';
import { renderSummary } from './report.mjs';
import { STATUS, gitLine, runCommand, statusOf } from './run.mjs';
import { DEFAULT_STEPS, resolveBase, scriptProblems } from './steps.mjs';

export const EVIDENCE_KIND = 'SYNTHETIC';
export const EVIDENCE_NOTE = '합성 증거: 개발 기기에서 가짜 데이터로 돌린 검사입니다. 실제 DB·운영 서버·실제 사용자 데이터는 쓰지 않았습니다.';
export const EVIDENCE_DIR = '.guard/evidence';
export const VERDICT = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', ERROR: 'ERROR', INCOMPLETE: 'INCOMPLETE', TEST_ONLY: 'TEST_ONLY' });
const MAX_DIRTY = 20;

function treeState(root) {
  const commit = gitLine(root, ['rev-parse', 'HEAD']);
  const porcelain = gitLine(root, ['status', '--porcelain']);
  const files = porcelain === null ? null : porcelain.split('\n').filter(Boolean).map(row => row.slice(3));
  return { commit, files };
}

function runStep(step, index, context) {
  const blank = { command: null, status: STATUS.ERROR, exitCode: null, signal: null, durationMs: 0, logPath: null, note: null };
  const base = { id: step.id, title: step.title, ...blank };
  let plan;
  try { plan = step.prepare(context); } catch (error) { return { ...base, note: `단계를 준비하지 못했습니다: ${String(error.message ?? error)}` }; }
  if (plan.notRun) return { ...base, status: STATUS.NOT_RUN, note: plan.notRun };
  if (plan.cannotRun || !Array.isArray(plan.argv) || plan.argv.length === 0) return { ...base, note: plan.cannotRun ?? '실행할 명령이 없습니다.' };
  const command = plan.argv.map(part => (part === process.execPath ? 'node' : part)).join(' ');
  const problems = scriptProblems(context.root, step.pinned ?? []);
  if (problems.length) return { ...base, command, note: `돌리지 않았습니다. ${problems.join(' / ')}` };
  const logName = `${String(index + 1).padStart(2, '0')}-${step.id}.log`;
  const ran = runCommand(plan.argv, { cwd: context.root, logFile: path.join(context.outDir, logName) });
  const status = statusOf(ran, step.errorCodes ?? []);
  const why = ran.spawnError ? `명령을 시작하지 못했습니다 (${ran.spawnError}).` : ran.signal ? `신호 ${ran.signal} 로 끝났습니다.`
    : status === STATUS.ERROR ? `종료 코드 ${ran.exitCode}: 검사 자체가 돌지 못했다는 뜻입니다.` : null;
  const logPath = path.posix.join(context.logBase, logName);
  return { ...base, command, status, exitCode: ran.exitCode, signal: ran.signal, durationMs: ran.durationMs, logPath, note: why };
}

/** lstat that answers null for a path that does not exist. A symbolic link is reported as a link, never followed. */
function kindOf(file) {
  try { return fs.lstatSync(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

/**
 * The evidence folder is emptied before every run, so it must be a real folder inside the repository. When `.guard`,
 * `.guard/evidence` or an entry of it is a symbolic link, the clean-up would delete (and the run would write) somewhere else.
 * Returns one sentence saying what is wrong, or null. The caller deletes nothing unless this is null.
 */
export function evidenceProblem(root, evidenceRoot) {
  const parts = path.relative(root, evidenceRoot).split(path.sep);
  if (parts[0] === '' || parts[0] === '..' || path.isAbsolute(parts[0])) return `증거 폴더(${evidenceRoot})가 저장소 밖입니다.`;
  let at = root;
  for (const part of parts) {
    at = path.join(at, part);
    const stat = kindOf(at);
    if (stat === null) return null;
    if (stat.isSymbolicLink()) return `${path.relative(root, at)} 이 심볼릭 링크입니다. 링크를 따라가서 지우지 않습니다.`;
    if (!stat.isDirectory()) return `${path.relative(root, at)} 이 폴더가 아닙니다.`;
  }
  if (path.relative(fs.realpathSync(root), fs.realpathSync(evidenceRoot)).split(path.sep)[0] === '..') return `증거 폴더(${evidenceRoot})가 저장소 밖을 가리킵니다.`;
  const links = fs.readdirSync(evidenceRoot).filter(name => kindOf(path.join(evidenceRoot, name))?.isSymbolicLink()).sort();
  return links.length ? `증거 폴더 안에 심볼릭 링크가 있습니다: ${links.join(', ')}. 링크를 따라가서 지우지 않습니다.` : null;
}

/**
 * Delete the evidence bundles of other commits, so the folder holds only the bundle of the commit being verified and an
 * old PASS cannot be read as this commit's result. Returns the names that were removed.
 * Refuses (throws, nothing deleted) when the folder or an entry of it is a symbolic link.
 */
export function pruneEvidence(evidenceRoot, keep) {
  const stat = kindOf(evidenceRoot);
  if (stat === null) return [];
  const problem = evidenceProblem(path.dirname(evidenceRoot), evidenceRoot);
  if (problem) throw new Error(`증거 꾸러미를 지우지 않았습니다. ${problem}`);
  const others = fs.readdirSync(evidenceRoot).filter(name => name !== keep).sort();
  for (const name of others) fs.rmSync(path.join(evidenceRoot, name), { recursive: true, force: true });
  return others;
}

export function verdictOf(steps, { injected, headMoved }) {
  if (injected) return VERDICT.TEST_ONLY;
  if (steps.some(step => step.status === STATUS.FAIL)) return VERDICT.FAIL;
  if (headMoved || steps.some(step => step.status === STATUS.ERROR)) return VERDICT.ERROR;
  if (steps.length === 0 || steps.some(step => step.status !== STATUS.PASS)) return VERDICT.INCOMPLETE;
  return VERDICT.PASS;
}

/** 0 only for PASS. 1 when a step failed. 2 when the result could not be established (error, incomplete, test-only). */
export const exitCodeOf = verdict => (verdict === VERDICT.PASS ? 0 : verdict === VERDICT.FAIL ? 1 : 2);

/**
 * Run the verification. `steps` and `outDir` exist for the tests only: see the header.
 * Returns { evidence, dir, removed }: the evidence object, its folder, and the bundles of other commits that were deleted.
 * `onStep(step)` is called after each step so the caller can print progress.
 */
export function runVerify({ root, base = null, steps = DEFAULT_STEPS, outDir = null, onStep = () => {} }) {
  const injected = steps !== DEFAULT_STEPS;
  const start = treeState(root);
  if (!start.commit || start.files === null) throw new Error('git 저장소 상태를 읽을 수 없습니다. 증거를 만들 수 없습니다.');
  const shortCommit = start.commit.slice(0, 12);
  const inRepo = path.join(root, EVIDENCE_DIR, shortCommit);
  if (injected && (!outDir || !path.relative(root, path.resolve(outDir)).startsWith('..'))) {
    throw new Error('시험용 단계 목록은 저장소 밖의 outDir 에만 쓸 수 있습니다.');
  }
  const dir = injected ? path.resolve(outDir) : inRepo;
  // Checked before anything is deleted or written: see evidenceProblem.
  const problem = injected ? null : evidenceProblem(root, path.join(root, EVIDENCE_DIR));
  if (problem) throw new Error(`증거 꾸러미를 만들지 않았습니다. ${problem}`);
  // Start from an empty folder: an old PASS must not survive a run that stops half way. Bundles of other commits go too
  // (only for the real run: a test's outDir is outside the repository and its neighbours are not ours to delete).
  const removed = injected ? [] : pruneEvidence(path.join(root, EVIDENCE_DIR), shortCommit);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const logBase = injected ? '.' : `${EVIDENCE_DIR}/${shortCommit}`;
  const startedAt = new Date();
  const context = { root, outDir: dir, logBase, base: resolveBase(root, base) };
  const results = [];
  steps.forEach((step, index) => { const row = runStep(step, index, context); results.push(row); onStep(row); });
  const end = treeState(root);
  const headMoved = end.commit !== start.commit;
  const dirtyFiles = [...new Set([...start.files, ...(end.files ?? [])])].sort();
  const verdict = verdictOf(results, { injected, headMoved });
  const evidence = {
    schemaVersion: 1,
    tool: 'crm verify',
    evidenceKind: EVIDENCE_KIND,
    evidenceNote: EVIDENCE_NOTE,
    stepSet: injected ? 'INJECTED' : 'DEFAULT',
    verdict,
    exitCode: exitCodeOf(verdict),
    commit: start.commit,
    branch: gitLine(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    dirty: dirtyFiles.length > 0 || end.files === null,
    dirtyAtStart: start.files.length > 0,
    dirtyAtEnd: end.files === null ? null : end.files.length > 0,
    dirtyFiles: dirtyFiles.slice(0, MAX_DIRTY),
    dirtyFileCount: dirtyFiles.length,
    headMovedDuringRun: headMoved,
    base: context.base,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    environment: { node: process.version, platform: `${process.platform}-${process.arch}` },
    notPassed: results.filter(step => step.status !== STATUS.PASS).map(step => ({ id: step.id, status: step.status, exitCode: step.exitCode })),
    steps: results,
  };
  fs.writeFileSync(path.join(dir, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'summary.md'), renderSummary(evidence));
  return { evidence, dir, removed };
}
