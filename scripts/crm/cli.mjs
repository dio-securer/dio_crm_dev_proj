#!/usr/bin/env node
// Framework command line: `pnpm crm <command>`. Korean text for people, stable JSON for machines (`--json`).
// Exit codes: 0 ok, 1 a check failed, 2 usage error or a check could not run, 3 command not implemented yet.
// Nothing here reads an environment variable, and no option changes which steps `verify` runs.
// Every path is taken from where this file is, never from the current folder, so `node <repo>/scripts/crm/cli.mjs` works anywhere.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyData, renderClassify } from './lib/classify.mjs';
import { notPassedLine, stepLine } from './lib/report.mjs';
import { runCommand } from './lib/run.mjs';
import { NOT_IMPLEMENTED_EXIT, notImplementedMessage, planAddField, planNewObject } from './lib/scaffold.mjs';
import { runVerify } from './lib/verify.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GUARD = 'scripts/guard/run.mjs';
const GUARD_RESULT = '.guard/guard-result.json';
const USAGE_EXIT = 2;

const COMMANDS = [
  ['check', '가드를 돌리고 결과를 보여 준다. 종료 코드는 가드와 같다.'],
  ['verify [--base <ref>]', '가드, 보호 검사, 가드 테스트, 빌드, 테스트, HQ 검사를 차례로 돌리고 증거 꾸러미를 만든다.'],
  ['classify', '요청 분류서(유형 A/B/C/D)를 출력한다. 코드를 쓰기 전에 채운다.'],
  ['new-object <이름>', '(F1에서 구현) 새 개체. 지금은 인자만 검사하고 종료 코드 3.'],
  ['add-field <개체> <필드> <종류>', '(F1에서 구현) 새 필드. 지금은 인자만 검사하고 종료 코드 3.'],
  ['help', '이 도움말.'],
];

function help() {
  const width = Math.max(...COMMANDS.map(([name]) => name.length));
  return ['사용법: pnpm crm <명령> [--json]', '', ...COMMANDS.map(([name, what]) => `  ${name.padEnd(width)}  ${what}`), '',
    '종료 코드: 0 통과, 1 검사 실패, 2 사용법 오류 또는 검사를 돌리지 못함, 3 아직 구현하지 않은 명령.',
    'pnpm 명령은 저장소 맨 위 폴더에서 돌린다. 하위 폴더에서는 node <저장소 경로>/scripts/crm/cli.mjs <명령> 으로 부른다.'].join('\n');
}

const print = value => console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
function usage(message, json) {
  if (json) print({ ok: false, exitCode: USAGE_EXIT, error: message }); else console.error(`[crm] ${message}\n\n${help()}`);
  return USAGE_EXIT;
}

/** Splits flags from positional arguments. `valueFlags` take one value (`--base x` or `--base=x`). Unknown flags are errors. */
function parse(args, valueFlags = []) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < args.length; i += 1) {
    const cut = args[i].startsWith('--') ? args[i].indexOf('=') : -1;
    const [name, inline] = cut > 0 ? [args[i].slice(0, cut), args[i].slice(cut + 1)] : [args[i]];
    if (name === '--json' && inline === undefined) flags.json = true;
    else if (valueFlags.includes(name)) {
      flags[name.slice(2)] = inline ?? args[i + 1] ?? '';
      if (inline === undefined) i += 1;
    } else if (name.startsWith('-')) return { error: `알 수 없는 옵션: ${args[i]}` };
    else rest.push(args[i]);
  }
  return { flags, rest };
}

function check(flags) {
  // With --json the guard's own text is not shown; the result file it wrote is printed instead.
  const resultFile = path.join(root, GUARD_RESULT);
  if (flags.json) fs.rmSync(resultFile, { force: true });
  const ran = runCommand([process.execPath, GUARD], { cwd: root, capture: flags.json });
  const exitCode = ran.exitCode ?? USAGE_EXIT;
  if (flags.json) {
    let result = null;
    try { result = JSON.parse(fs.readFileSync(resultFile, 'utf8')); } catch { /* the guard stopped before writing a result */ }
    print({ ok: exitCode === 0, exitCode, guard: result });
  }
  return exitCode;
}

function verify(flags) {
  if (flags.base === '') return usage('--base 에는 기준 ref 가 필요합니다. 예: --base origin/main', flags.json);
  if (!flags.json) console.log('[crm] verify 를 시작합니다. 몇 분 걸립니다.');
  let ran;
  try { ran = runVerify({ root, base: flags.base ?? null, onStep: step => { if (!flags.json) console.log(stepLine(step)); } }); } catch (error) {
    // Nothing ran and nothing was written (for example the evidence folder is a symbolic link): an error, never a pass.
    const message = String(error.message ?? error);
    if (flags.json) print({ ok: false, exitCode: USAGE_EXIT, verdict: 'ERROR', error: message }); else console.error(`[crm] 판정: ERROR  ${message}`);
    return USAGE_EXIT;
  }
  const { evidence, dir, removed } = ran;
  const where = path.relative(root, dir).split(path.sep).join('/');
  if (flags.json) print(evidence);
  else {
    console.log(`\n[crm] 판정: ${evidence.verdict}  (증거 종류 ${evidence.evidenceKind}${evidence.dirty ? ', 커밋하지 않은 변경 포함' : ''})`);
    console.log(`[crm] ${notPassedLine(evidence)}`);
    console.log(`[crm] 증거 꾸러미: ${where}/evidence.json, ${where}/summary.md`);
    if (removed.length) console.log(`[crm] 다른 커밋의 증거 꾸러미 ${removed.length}개를 지웠습니다: ${removed.join(', ')}`);
  }
  return evidence.exitCode;
}

function placeholder(planOf, rest, json) {
  const planned = planOf(rest);
  if (!planned.ok) return usage(planned.error, json);
  const message = notImplementedMessage(planned.plan);
  if (json) print({ ok: false, exitCode: NOT_IMPLEMENTED_EXIT, implemented: false, plannedIn: 'F1', plan: planned.plan, filesCreated: [] });
  else console.error(`[crm] ${message}`);
  return NOT_IMPLEMENTED_EXIT;
}

function main(argv) {
  const [command, ...args] = argv;
  const parsed = parse(args, command === 'verify' ? ['--base'] : []);
  const json = args.includes('--json');
  if (command === undefined) return usage('명령이 없습니다.', json);
  if (parsed.error) return usage(parsed.error, json);
  const { flags, rest } = parsed;
  const noArgs = () => (rest.length ? usage(`${command} 은 인자를 받지 않습니다: ${rest.join(' ')}`, json) : null);
  if (command === 'help' || command === '--help' || command === '-h') {
    print(json ? { commands: COMMANDS.map(([name, what]) => ({ name, what })) } : help());
    return 0;
  }
  if (command === 'check') return noArgs() ?? check(flags);
  if (command === 'verify') return noArgs() ?? verify(flags);
  if (command === 'classify') return noArgs() ?? (print(json ? classifyData() : renderClassify()), 0);
  if (command === 'new-object') return placeholder(planNewObject, rest, json);
  if (command === 'add-field') return placeholder(planAddField, rest, json);
  return usage(`알 수 없는 명령: ${command}`, json);
}

try { process.exitCode = main(process.argv.slice(2)); } catch (error) {
  console.error(`[crm] 멈췄습니다: ${error.message ?? error}`);
  process.exitCode = USAGE_EXIT;
}
