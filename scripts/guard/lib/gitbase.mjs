// The base side of a comparison, read from git. Every failure here is a guard error (exit 2), never a pass:
// "the base does not have this file" is decided only from a tree listing that succeeded.
import fs from 'node:fs';
import path from 'node:path';
import { git } from './files.mjs';

/** A failure of the guard itself (bad ref, unreadable base, malformed protected file). Always exit code 2. */
export class GuardError extends Error {}

function run(root, args, what) {
  try { return git(root, args); } catch (error) {
    const detail = String(error.stderr ?? '').trim().split('\n')[0] || 'git 이 실패했습니다';
    throw new GuardError(`${what}: ${detail}`);
  }
}

/** Resolve `<ref>` and the merge-base of `<ref>` and HEAD. Throws GuardError when either cannot be determined. */
export function resolveBase(root, ref) {
  if (typeof ref !== 'string' || !/^[\w./@^~{}-]+$/.test(ref) || ref.startsWith('-')) {
    throw new GuardError(`기준 ref 형식이 잘못되었습니다: "${ref}" (예: origin/main)`);
  }
  const tip = run(root, ['rev-parse', '--verify', `${ref}^{commit}`], `기준 ref "${ref}" 를 찾을 수 없습니다`).trim();
  const head = run(root, ['rev-parse', '--verify', 'HEAD^{commit}'], 'HEAD 를 읽을 수 없습니다').trim();
  const none = `"${ref}" 와 HEAD 의 공통 조상을 찾을 수 없습니다`;
  const bases = run(root, ['merge-base', '--all', tip, head], none).split('\n').filter(Boolean);
  if (bases.length === 0 || !bases.every(sha => /^[0-9a-f]{40,64}$/.test(sha))) throw new GuardError(`${none}.`);
  if (bases.length > 1) throw new GuardError(`"${ref}" 와 HEAD 의 공통 조상이 ${bases.length}개라 기준을 정할 수 없습니다. 기준 브랜치를 병합(또는 rebase)한 뒤 다시 실행하세요.`);
  const [mergeBase] = bases;
  // In a shallow clone history is cut off. The merge-base is exact only when no cut-off commit lies between it and the two tips.
  if (run(root, ['rev-parse', '--is-shallow-repository'], '저장소 상태를 읽을 수 없습니다').trim() !== 'false') {
    const file = path.resolve(root, run(root, ['rev-parse', '--git-path', 'shallow'], '저장소 상태를 읽을 수 없습니다').trim());
    const cut = new Set(fs.readFileSync(file, 'utf8').split('\n').filter(Boolean));
    const between = run(root, ['rev-list', tip, head, `^${mergeBase}`], '커밋 기록을 읽을 수 없습니다').split('\n').filter(Boolean);
    if (cut.has(mergeBase) || between.some(sha => cut.has(sha))) {
      throw new GuardError('얕은 복제(shallow clone)라 기준 브랜치와의 공통 조상을 믿을 수 없습니다. 전체 기록을 받으세요(fetch-depth: 0).');
    }
  }
  return { ref, tip, head, mergeBase };
}

/** Files of one commit. `has` is false for anything that is not a regular file there (missing, symlink, submodule). */
export function baseReader(root, commit) {
  const blobs = new Map();
  for (const row of run(root, ['ls-tree', '-r', '-z', commit], '기준 커밋의 파일 목록을 읽을 수 없습니다').split('\0')) {
    const tab = row.indexOf('\t');
    if (tab < 0) continue;
    const [mode, type, sha] = row.slice(0, tab).split(' ');
    if (type === 'blob' && mode !== '120000') blobs.set(row.slice(tab + 1), sha);
  }
  if (blobs.size === 0) throw new GuardError('기준 커밋에 파일이 하나도 없습니다(읽기 실패로 봅니다).');
  const cache = new Map();
  const read = file => {
    if (!blobs.has(file)) throw new GuardError(`기준 커밋에 ${file} 이 없습니다.`);
    if (!cache.has(file)) cache.set(file, run(root, ['cat-file', 'blob', blobs.get(file)], `기준 커밋의 ${file} 을 읽을 수 없습니다`));
    return cache.get(file);
  };
  return { commit, files: [...blobs.keys()], has: file => blobs.has(file), read };
}

/**
 * What differs between the base commit and the working tree (committed or not):
 * [{ status: 'A'|'M'|'D'|'T'|'R'|'C', path, from? }]. `from` is the old path of a rename or copy.
 * Untracked files that are not ignored count as added, the same file universe the rules use.
 */
export function changesSince(root, commit, ctx) {
  const parts = run(root, ['diff', '--name-status', '-z', '-M', '--no-ext-diff', commit, '--'], '기준 커밋과의 차이를 읽을 수 없습니다').split('\0');
  const changes = [];
  for (let i = 0; i < parts.length && parts[i] !== ''; i += 1) {
    const status = parts[i][0];
    if (status === 'R' || status === 'C') { changes.push({ status, from: parts[i + 1], path: parts[i + 2] }); i += 2; } else {
      changes.push({ status, path: parts[i + 1] });
      i += 1;
    }
  }
  const seen = new Set(changes.map(change => change.path));
  const untracked = run(root, ['ls-files', '-z', '--others', '--exclude-standard'], '추적하지 않는 파일 목록을 읽을 수 없습니다').split('\0');
  for (const file of untracked) if (file && !seen.has(file) && ctx.fileSet.has(file)) changes.push({ status: 'A', path: file });
  return changes;
}
