import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CODE_EXT, excerpt, hasExt } from '../lib/files.mjs';
import { K, lineOf, textOf, walk } from '../lib/ts.mjs';

const SCRIPT = 'scripts/i18n/hardcode-check.mjs';
const LINE = /^ - (.+?):(\d+): (.*)$/;
// New zones are checked by the guard itself (the legacy script only looks at frontend/src/**/*.tsx).
const ZONE = /^(extensions|packages\/engine[^/]*)\//;
const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7FF]/;

const LEAVES = () => new Set([K.StringLiteral, K.NoSubstitutionTemplateLiteral, K.TemplateHead, K.TemplateMiddle, K.TemplateTail, K.JsxText,
  K.Identifier, K.PrivateIdentifier, K.RegularExpressionLiteral]);
const decode = text => text.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => {
  const point = Number(code[0].toLowerCase() === 'x' ? `0${code}` : code);
  return point <= 0x10FFFF ? String.fromCodePoint(point) : '';
});

/**
 * Lines of a zone file that hold Hangul in code: string literals, template text, JSX text, regex and names.
 * Read from the AST, so comments are never counted and a comment marker inside a string cannot hide text.
 * Escapes are decoded first, so `'\uD55C'` and `&#xD55C;` count like the letters they stand for.
 */
export function hangulLines(sf) {
  const leaves = LEAVES();
  const lines = new Map();
  walk(sf, node => {
    if (!leaves.has(node.kind)) return;
    const raw = textOf(sf, node);
    const first = lineOf(sf, node);
    let hit = false;
    raw.split('\n').forEach((part, index) => {
      if (!HANGUL.test(part)) return;
      hit = true;
      if (!lines.has(first + index)) lines.set(first + index, part.trim());
    });
    if (!hit && HANGUL.test(decode(node.text ?? '')) && !lines.has(first)) lines.set(first, raw.split('\n')[0].trim());
  });
  return [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([line, text]) => ({ line, text }));
}

export default {
  id: 'G04',
  name: 'hardcoded-ui-text',
  baseline: 'count',
  forbids: '코드에 한글 문구를 직접 적는 것. 문구는 번역 리소스(i18n)나 메타데이터의 라벨 키에 두고 키로 불러야 한다. 기존 화면(.tsx)은 기준선에 묶이고, 새 구역(`extensions/`, `packages/engine*/`)은 한 건도 허용하지 않는다.',
  why: 'AI는 번역 키를 만드는 대신 눈앞의 문자열을 그대로 적는다. 그러면 나라별 문구 교체와 용어 통일이 불가능해진다.',
  fix: '문구를 `frontend/src/i18n/locales/*` 에 넣고 `t("키")` 로 쓴다. 메타데이터 화면이라면 라벨 키를 메타데이터에 둔다.',
  scope: `두 부분이다. (1) 기존 검사 \`${SCRIPT}\` 를 고치지 않고 그대로 실행해 결과를 파일별로 센다. `
    + `그 검사는 \`frontend/src\` 아래 모든 .tsx 에서 한글이 있는 줄을 찾는다(이 부분의 총계는 \`pnpm i18n:hardcode\` 와 같다). `
    + `(2) \`extensions/\` 와 \`packages/engine*/\` 아래 코드 파일(.ts .tsx .js .jsx .mjs .cjs .mts .cts, 테스트 파일 포함)은 가드가 직접 본다: `
    + '문자열·템플릿 문자열·JSX 글자·정규식·이름에 한글이 든 줄은 모두 위반이다(TypeScript 구문 트리로 찾는다).',
  exclusions: ['새 구역에서 주석 안의 한글은 세지 않는다(구문 트리에서 주석은 코드가 아니다). 그 밖의 예외는 없다.'],
  limits: [
    '기존 검사의 한계를 그대로 물려받는다(부분 1): `frontend/src` 의 .ts 파일(예: 라벨 상수 파일)과 `backend/`·`packages/contracts` 는 보지 않는다. 주석 속 한글도 한 줄로 센다.',
    '한글만 본다. 영어 등 다른 언어 문구를 직접 적는 것은 잡지 못한다.',
    '줄 단위로 센다. 한 줄에 문구가 여러 개여도 1건이다.',
    '새 구역(부분 2): 유니코드 이스케이프(`"\\uD55C"`)와 JSX 의 숫자 문자 참조(`&#xD55C;`)는 풀어서 본다. '
      + '그러나 실행 중에 조합한 글자(`String.fromCharCode(…)`, 서버에서 받은 문구)는 잡지 못한다.',
    '기존 검사 스크립트가 없거나 출력 형식이 달라지면 이 규칙은 통과가 아니라 오류로 실패한다.',
  ],
  check(ctx) {
    if (!fs.existsSync(path.join(ctx.root, SCRIPT))) throw new Error(`${SCRIPT} 가 없습니다.`);
    // The script prints hundreds of lines and then calls process.exit(). Through a pipe the tail of that
    // output is sometimes lost (seen: 148 of 744 lines), which would silently LOWER the count. A file
    // descriptor is written synchronously, so the output is captured whole.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-g04-'));
    const out = path.join(dir, 'stderr.txt');
    const fd = fs.openSync(out, 'w');
    let run;
    let stderr;
    try {
      run = spawnSync(process.execPath, [SCRIPT], { cwd: ctx.root, stdio: ['ignore', 'ignore', fd] });
      fs.closeSync(fd);
      stderr = fs.readFileSync(out, 'utf8');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    if (run.error) throw run.error;
    const zone = [];
    for (const file of ctx.files) {
      if (!ZONE.test(file) || !hasExt(file, CODE_EXT)) continue;
      for (const hit of hangulLines(ctx.ast(file))) zone.push({ file, line: hit.line, message: `새 구역의 한글 문구: ${excerpt(hit.text, 50)}` });
    }
    if (run.status === 0) return zone;
    if (run.status !== 1) throw new Error(`${SCRIPT} 가 예상 밖의 코드 ${run.status} 로 끝났습니다: ${excerpt(stderr, 200)}`);
    const rows = stderr.split(/\r?\n/).filter(line => line.startsWith(' - '));
    const findings = rows.map(row => {
      const m = LINE.exec(row);
      if (!m) throw new Error(`${SCRIPT} 출력 줄을 읽을 수 없습니다: ${excerpt(row, 120)}`);
      return { file: m[1].split(path.sep).join('/'), line: Number(m[2]), message: excerpt(m[3], 60) };
    });
    if (findings.length === 0) throw new Error(`${SCRIPT} 가 실패했지만 읽을 수 있는 결과가 없습니다.`);
    return [...findings, ...zone];
  },
};
