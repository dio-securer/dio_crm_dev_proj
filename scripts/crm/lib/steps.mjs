// The fixed list of steps that `crm verify` runs, in order. The list is frozen and is not read from a file, an option
// or an environment variable: the command line cannot add, remove or replace a step.
import fs from 'node:fs';
import path from 'node:path';
import { gitLine } from './run.mjs';

export const DEFAULT_BASE = 'origin/main';
const GUARD = 'scripts/guard/run.mjs';
const GUARD_TESTS_DIR = 'tests/guard';
// Exit code 2 of the guard means "the guard could not run", which is an error, not an ordinary failure.
const GUARD_ERROR_CODES = [2];

/**
 * The package.json scripts that the pnpm steps really run. `pnpm test` is only as good as the script behind it, so
 * each step first compares these with the files on disk. A script that differs or is missing makes the step an ERROR
 * (the step did not run what this file says it runs). Changing a script therefore means changing this list too.
 */
export const PINNED_SCRIPTS = Object.freeze({
  'package.json': Object.freeze({
    build: 'pnpm -r build',
    test: 'pnpm -r test --if-present',
    'hq:check': 'node --experimental-strip-types --test scripts/hq-standard/*.test.mjs',
  }),
  'backend/package.json': Object.freeze({ build: 'nest build', test: 'jest --runInBand' }),
  'frontend/package.json': Object.freeze({ build: 'tsc --noEmit && vite build', test: 'vitest run' }),
  'packages/contracts/package.json': Object.freeze({ build: 'tsc -p tsconfig.json' }),
});
const pins = (...names) => Object.entries(PINNED_SCRIPTS).flatMap(([file, scripts]) => names.filter(name => name in scripts).map(name => [file, name]));

/** Sentences describing every pinned script that is not what this file expects. Empty when all match. */
export function scriptProblems(root, wanted) {
  const problems = [];
  for (const [file, name] of wanted) {
    let actual;
    try { actual = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')).scripts?.[name]; } catch { actual = undefined; }
    const expected = PINNED_SCRIPTS[file][name];
    if (actual !== expected) problems.push(`${file} 의 "${name}" 스크립트가 기대와 다릅니다 (기대: ${expected} / 실제: ${actual ?? '없음'})`);
  }
  return problems;
}

/** The guard's own test files, sorted. A step with no file to run is an error, not a pass. */
function guardTestFiles(root) {
  const dir = path.join(root, GUARD_TESTS_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.test.mjs')).sort().map(name => `${GUARD_TESTS_DIR}/${name}`);
}

/** Which base the protect step compares with: the one given, else origin/main when it exists, else none. */
export function resolveBase(root, given) {
  if (given) return { ref: given, source: '--base' };
  const found = gitLine(root, ['rev-parse', '--verify', '--quiet', `${DEFAULT_BASE}^{commit}`]);
  return found ? { ref: DEFAULT_BASE, source: 'default' } : { ref: null, source: null };
}

/**
 * Each step: id, title (Korean, for the summary), prepare(context) -> { argv } or { cannotRun: reason } or { notRun: reason }.
 * `notRun` exists only for the protect step without a base; a step that was not run makes the whole verdict INCOMPLETE.
 */
export const DEFAULT_STEPS = Object.freeze([
  { id: 'guard', title: '가드 규칙 (--strict)', errorCodes: GUARD_ERROR_CODES, prepare: () => ({ argv: [process.execPath, GUARD, '--strict'] }) },
  {
    id: 'protect', title: '보호 검사 (기준 브랜치와 비교)', errorCodes: GUARD_ERROR_CODES,
    prepare: ({ base }) => (base.ref
      ? { argv: [process.execPath, GUARD, '--protect', base.ref] }
      : { notRun: `기준 브랜치(${DEFAULT_BASE})를 찾지 못했고 --base 도 없어서 돌리지 않았습니다.` }),
  },
  {
    id: 'guard-tests', title: '가드 자신의 테스트',
    prepare: ({ root }) => {
      const files = guardTestFiles(root);
      return files.length ? { argv: [process.execPath, '--test', ...files] } : { cannotRun: `${GUARD_TESTS_DIR}/*.test.mjs 파일이 하나도 없습니다.` };
    },
  },
  { id: 'build', title: '빌드 (pnpm build)', pinned: pins('build'), prepare: () => ({ argv: ['pnpm', 'build'] }) },
  { id: 'test', title: '단위 테스트 (pnpm test)', pinned: pins('test'), prepare: () => ({ argv: ['pnpm', 'test'] }) },
  { id: 'hq-check', title: 'HQ 표준 계약 테스트 (pnpm hq:check)', pinned: pins('hq:check'), prepare: () => ({ argv: ['pnpm', 'hq:check'] }) },
].map(step => Object.freeze(step)));
