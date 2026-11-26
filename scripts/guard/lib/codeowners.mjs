// The protected-path list (protected-paths.json) and the CODEOWNERS file generated from it.
// One list, two users: GitHub (who must approve) and the protect check P4 (what the summary shows).
import fs from 'node:fs';
import path from 'node:path';
import { GuardError } from './gitbase.mjs';

export const PROTECTED_FILE = 'scripts/guard/protected-paths.json';
export const CODEOWNERS_FILE = '.github/CODEOWNERS';

/** Parse the list. Every path is rooted (`/x`), a folder ends with `/`, and nothing is a pattern. */
export function parseProtected(text) {
  let doc;
  try { doc = JSON.parse(text); } catch (error) { throw new GuardError(`${PROTECTED_FILE} 을 읽을 수 없습니다(JSON 오류: ${error.message})`); }
  if (!doc || !/^@[\w-]+(\/[\w-]+)?$/.test(doc.owner ?? '') || !Array.isArray(doc.paths) || doc.paths.length === 0) {
    throw new GuardError(`${PROTECTED_FILE} 형식이 잘못되었습니다(owner, paths 필요).`);
  }
  for (const item of doc.paths) {
    if (!item || typeof item.what !== 'string' || !/^\/[\w.@/-]+$/.test(item.path ?? '') || item.path.includes('//')) {
      throw new GuardError(`${PROTECTED_FILE}: 경로가 잘못되었습니다: ${JSON.stringify(item)} ("/" 로 시작, 와일드카드 없음)`);
    }
  }
  return { owner: doc.owner, paths: doc.paths.map(item => ({ path: item.path, what: item.what })) };
}

export function loadProtected(root) {
  const file = path.join(root, PROTECTED_FILE);
  if (!fs.existsSync(file)) throw new GuardError(`${PROTECTED_FILE} 이 없습니다.`);
  return parseProtected(fs.readFileSync(file, 'utf8'));
}

/** The protected entry a repo-relative file falls under, or null. Exact, case-sensitive (as GitHub matches). */
export function protectedEntry(list, file) {
  const rooted = `/${file}`;
  return list.paths.find(item => (item.path.endsWith('/') ? rooted.startsWith(item.path) : rooted === item.path)) ?? null;
}

export function renderCodeowners(list) {
  const width = Math.max(...list.paths.map(item => item.path.length));
  return [
    `# 이 파일은 ${PROTECTED_FILE} 에서 만든다: node scripts/guard/run.mjs --codeowners`,
    '# 직접 고치지 않는다. 목록과 다르면 pnpm guard 가 실패한다.',
    '# 아래 경로를 바꾸는 PR 은 적힌 사람의 승인이 있어야 한다(저장소 설정의 "Require review from Code Owners" 가 켜져 있을 때만).',
    '',
    ...list.paths.map(item => `${item.path.padEnd(width)} ${list.owner}`),
    '',
  ].join('\n');
}

export function writeCodeowners(root) {
  const file = path.join(root, CODEOWNERS_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, renderCodeowners(loadProtected(root)));
}

export function codeownersInSync(root) {
  const file = path.join(root, CODEOWNERS_FILE);
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8') === renderCodeowners(loadProtected(root));
}
