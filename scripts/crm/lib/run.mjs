// Runs one command and says honestly what happened. Shared by `crm check` and `crm verify`.
// A status is PASS only when the process really ran and exited with 0. Everything else is FAIL or ERROR, never PASS.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

export const STATUS = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', ERROR: 'ERROR', NOT_RUN: 'NOT_RUN' });
export const STEP_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * The status of a finished process. `errorCodes` are exit codes that mean "the tool itself could not do its job"
 * (the guard uses 2 for that). A spawn failure, a signal, a timeout or a missing exit code is always ERROR.
 */
export function statusOf({ exitCode, signal = null, spawnError = null }, errorCodes = []) {
  if (spawnError || signal || !Number.isInteger(exitCode)) return STATUS.ERROR;
  if (exitCode === 0) return STATUS.PASS;
  return errorCodes.includes(exitCode) ? STATUS.ERROR : STATUS.FAIL;
}

/**
 * Run `argv` in `cwd`. Output goes to `logFile` when given (stdout and stderr together), otherwise to the terminal.
 * No shell is used: the arguments are passed as they are.
 */
export function runCommand(argv, { cwd, logFile = null, timeoutMs = STEP_TIMEOUT_MS, capture = false } = {}) {
  const started = Date.now();
  let fd = null;
  let result;
  try {
    if (logFile) fd = fs.openSync(logFile, 'w');
    const out = fd ?? (capture ? 'pipe' : 'inherit');
    result = spawnSync(argv[0], argv.slice(1), { cwd, stdio: ['ignore', out, fd ?? 'inherit'], timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    result = { status: null, signal: null, error };
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
  const spawnError = result.error ? String(result.error.code ?? result.error.message) : null;
  return {
    exitCode: Number.isInteger(result.status) ? result.status : null,
    signal: result.signal ?? null,
    spawnError,
    durationMs: Date.now() - started,
    stdout: capture && result.stdout ? result.stdout.toString('utf8') : '',
  };
}

/** One line of git output, or null when git fails. */
export function gitLine(root, args) {
  const result = spawnSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 });
  return result.status === 0 ? result.stdout.toString('utf8').trim() : null;
}
