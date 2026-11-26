// CLAUDE.md holds two generated blocks (the rule table and the protected-path list) between markers, so the rules an
// AI agent reads at the start of a session cannot drift from the rules the guard enforces. `--docs` rewrites the blocks;
// the default guard run fails when they differ, when a marker is missing, or when the file is longer than MAX_LINES.
import fs from 'node:fs';
import path from 'node:path';
import { loadProtected } from './codeowners.mjs';

export const CLAUDE_FILE = 'CLAUDE.md';
export const MAX_LINES = 120;
const WRAP = 120;
const mark = (name, edge) => `<!-- guard:${name}:${edge} (node scripts/guard/run.mjs --docs 가 만든다. 직접 고치지 않는다) -->`;
const cell = text => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
/** The first statement of a rule text: up to the first `. ` or `: `, or the whole text. */
const first = text => { const cut = /(\. |: )/.exec(text); return (cut ? text.slice(0, cut.index) : text).replace(/\.$/, ''); };

function rulesBlock(rules) {
  return ['| 규칙 | 금지하는 것 | 대신 할 일 |', '| --- | --- | --- |',
    ...rules.map(rule => `| ${rule.id} | ${cell(first(rule.forbids))} | ${cell(first(rule.fix))} |`)];
}

/** Paths that do not exist yet are marked, so the reader is never pointed at a file that is not there. */
function protectedBlock(list, root) {
  const rows = [];
  let row = '';
  const label = entry => `\`${entry.path}\`${fs.existsSync(path.join(root, entry.path)) ? '' : ' (아직 없음)'}`;
  for (const item of list.paths.map(label)) {
    if (row && row.length + item.length + 2 > WRAP) { rows.push(`${row},`); row = ''; }
    row = row ? `${row}, ${item}` : item;
  }
  return [...rows, row];
}

/** { name: lines } for every generated block. */
export const blocksOf = (rules, list, root) => ({ rules: rulesBlock(rules), protected: protectedBlock(list, root) });

/** Replace the text between each pair of markers. Returns null when a marker is missing, repeated or out of order. */
export function fill(text, blocks) {
  let out = text;
  for (const [name, lines] of Object.entries(blocks)) {
    const start = mark(name, 'start');
    const end = mark(name, 'end');
    const from = out.indexOf(start);
    const to = out.indexOf(end);
    if (from < 0 || to < from || out.indexOf(start, from + 1) >= 0 || out.indexOf(end, to + 1) >= 0) return null;
    out = `${out.slice(0, from)}${start}\n${lines.join('\n')}\n${out.slice(to)}`;
  }
  return out;
}

/** null when CLAUDE.md is in sync, otherwise one sentence saying what is wrong. */
export function claudeProblem(root, rules) {
  const file = path.join(root, CLAUDE_FILE);
  if (!fs.existsSync(file)) return `${CLAUDE_FILE} 이 없습니다.`;
  const text = fs.readFileSync(file, 'utf8');
  const filled = fill(text, blocksOf(rules, loadProtected(root), root));
  if (filled === null) return `${CLAUDE_FILE} 에 만들어 넣는 구간의 표시(guard:rules, guard:protected)가 없거나 겹칩니다.`;
  if (filled !== text) return `${CLAUDE_FILE} 의 규칙 표나 보호 경로 목록이 가드와 다릅니다. node scripts/guard/run.mjs --docs 를 실행하세요.`;
  const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  return lines > MAX_LINES ? `${CLAUDE_FILE} 이 ${lines}줄입니다. ${MAX_LINES}줄을 넘으면 안 됩니다.` : null;
}

export function writeClaude(root, rules) {
  const file = path.join(root, CLAUDE_FILE);
  if (!fs.existsSync(file)) throw new Error(`${CLAUDE_FILE} 이 없습니다.`);
  const filled = fill(fs.readFileSync(file, 'utf8'), blocksOf(rules, loadProtected(root), root));
  if (filled === null) throw new Error(`${CLAUDE_FILE} 에 만들어 넣는 구간의 표시가 없거나 겹칩니다.`);
  fs.writeFileSync(file, filled);
}
