#!/usr/bin/env node
// Builds legacy-files.json from the explicit glob rules in lib/legacy.mjs.
//   node scripts/guard/legacy-scan.mjs           create, or shrink an existing list (never grows it)
//   node scripts/guard/legacy-scan.mjs --check   exit 1 when the list on disk is not what a scan would write
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, stableJson } from './lib/files.mjs';
import { LEGACY_FILE, allowedTestCheck, computeLegacy, loadLegacy, toDocument } from './lib/legacy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const target = path.join(root, LEGACY_FILE);
const check = process.argv.includes('--check');
const unknown = process.argv.slice(2).filter(arg => arg !== '--check');
if (unknown.length) { console.error(`[legacy-scan] 알 수 없는 옵션: ${unknown.join(' ')}`); process.exit(2); }

const computed = computeLegacy(createContext(root));
const exists = fs.existsSync(target);

if (exists) {
  // Ratchet: anything that is not already listed is a NEW file in a legacy area and must not be
  // absorbed silently. Only removals (migrated or deleted files) are written.
  const current = loadLegacy(root);
  const known = new Set([...current.files, ...current.frozenOther]);
  const allowedTest = allowedTestCheck(known);
  const added = [...Object.keys(computed.files), ...computed.frozenOther].filter(file => !known.has(file) && !allowedTest(file));
  if (added.length) {
    console.error(`[legacy-scan] 거부: 목록에 없는 새 파일 ${added.length}개가 legacy 영역에 있습니다. 목록은 줄어들 수만 있습니다.`);
    for (const file of added) console.error(` - ${file}`);
    console.error('[legacy-scan] 새 화면·객체별 코드는 legacy 영역에 만들 수 없습니다. 정말 필요하면 사람이 legacy-files.json 을 직접 고칩니다.');
    process.exit(1);
  }
  // Keep the recorded classification of files that still exist; drop the ones that are gone.
  const ctxFiles = new Set([...Object.keys(computed.files), ...computed.frozenOther]);
  computed.files = Object.fromEntries([...current.ruleOf].filter(([file]) => ctxFiles.has(file)));
  computed.frozenOther = [...current.frozenOther].filter(file => ctxFiles.has(file));
}

const text = `${stableJson(toDocument(computed), 2)}\n`;
const before = exists ? fs.readFileSync(target, 'utf8') : null;
const count = `대상 ${Object.keys(computed.files).length}개, 동결 구역의 기타 파일 ${computed.frozenOther.length}개`;
if (check) {
  if (before !== text) { console.error(`[legacy-scan] ${LEGACY_FILE} 이 스캔 결과와 다릅니다. node scripts/guard/legacy-scan.mjs 를 실행하세요.`); process.exit(1); }
  console.log(`[legacy-scan] 일치 (${count})`);
} else if (before === text) console.log(`[legacy-scan] 변경 없음 (${count})`);
else { fs.writeFileSync(target, text); console.log(`[legacy-scan] ${exists ? '줄여서 다시 씀' : '새로 만듦'}: ${LEGACY_FILE} (${count})`); }
