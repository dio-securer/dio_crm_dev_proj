// Legacy (migration-target) file rules. Single source for legacy-scan.mjs, G02 and G10.
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit, countLines, isTestName, matcher } from './files.mjs';

export { isTestName };

export const LEGACY_FILE = 'legacy-files.json';

/**
 * include: files that are migration targets (test/spec files are never targets).
 * freeze : scope in which NO new file may appear (G10). Existing non-target files inside a
 *          frozen scope are recorded as `frozenOther` so they stay allowed.
 */
export const LEGACY_RULES = [
  { id: 'L1', name: 'frontend-top-level-pages', description: '화면별 페이지 컴포넌트(frontend/src 바로 아래 *Page.tsx). frontend/src 바로 아래에는 새 파일을 만들 수 없다.',
    include: ['frontend/src/*Page.tsx'], freeze: ['frontend/src/*'] },
  { id: 'L2', name: 'frontend-hq-mock', description: 'HQ 목업 화면 전체(화면·객체별 코드와 전용 CSS).',
    include: ['frontend/src/hq-mock/**'], freeze: ['frontend/src/hq-mock/**'] },
  { id: 'L3', name: 'frontend-screen-templates', description: '데모 화면과 시장 템플릿 화면 컴포넌트.',
    include: ['frontend/src/demo/**', 'frontend/src/market/templates/**'], freeze: ['frontend/src/demo/**', 'frontend/src/market/templates/**'] },
  { id: 'L4', name: 'lead-specific-customization', description: '리드 전용 커스터마이징 계약·게이트웨이·화면 파일(객체 하나만을 위한 코드).',
    include: ['packages/contracts/src/lead-*', 'backend/src/customization/*lead-*', 'frontend/src/customization/*Lead*', 'frontend/src/customization/lead-*'],
    freeze: ['packages/contracts/src/lead-*', 'backend/src/customization/*lead-*', 'frontend/src/customization/*Lead*', 'frontend/src/customization/lead-*'] },
  { id: 'L5', name: 'big-css', description: '100줄 이상인 CSS(토큰 파일 제외). frontend/src/styles 에는 새 파일을 만들 수 없다.',
    include: ['frontend/src/**/*.css'], exclude: ['frontend/src/styles/tokens.css'], minLines: 100, freeze: ['frontend/src/styles/*'] },
  { id: 'L6', name: 'backend-hq-mock', description: 'HQ 목업 백엔드(객체별 라우트·모델). 명세에 직접 적히지 않았으나 프런트 hq-mock 과 한 쌍이라 포함했다.',
    include: ['backend/src/hq-mock/**'], freeze: ['backend/src/hq-mock/**'] },
  { id: 'L7', name: 'backend-object-modules', description: '객체별 백엔드 모듈(activity·analytics·contract·customer·opportunity·order). 명세에 직접 적히지 않았으나 객체별 코드라 포함했다.',
    include: ['backend/src/modules/{activity,analytics,contract,customer,opportunity,order}/**'],
    freeze: ['backend/src/modules/{activity,analytics,contract,customer,opportunity,order}/**'] },
  { id: 'L8', name: 'configured-screens', description: '객체별 "Configured" 화면 컴포넌트(ConfiguredRecords·ConfiguredLedger 등). 화면 하나를 위한 코드라 이관 대상이다.',
    include: ['frontend/src/customization/Configured*.tsx'], freeze: ['frontend/src/customization/Configured*.tsx'] },
];

/** Legacy paths are matched without regard to letter case, so `Hq-Mock/` or `Lead-x.ts` cannot dodge a rule. */
export const legacyMatcher = globs => matcher(globs, 'i');
export const frozenScope = () => legacyMatcher(LEGACY_RULES.flatMap(rule => rule.freeze));

const stem = file => file.replace(/\.(spec|test)(\.[cm]?[jt]sx?)$/i, '$2').replace(/\.[^./]+$/, '');

/** A new test is allowed in a frozen scope only next to an already listed file of the same name. */
export function allowedTestCheck(known) {
  const stems = new Set([...known].filter(file => !isTestName(file)).map(stem));
  return file => isTestName(file) && stems.has(stem(file));
}

/** Compute the legacy list from the file universe. Deterministic. */
export function computeLegacy(ctx) {
  const files = {};
  for (const rule of LEGACY_RULES) {
    const include = legacyMatcher(rule.include);
    const exclude = legacyMatcher(rule.exclude ?? []);
    for (const file of ctx.files) {
      if (files[file] || isTestName(file) || !include(file) || exclude(file)) continue;
      if (rule.minLines && countLines(ctx.read(file)) < rule.minLines) continue;
      files[file] = rule.id;
    }
  }
  const frozen = frozenScope();
  const frozenOther = ctx.files.filter(file => frozen(file) && !files[file]);
  return { files, frozenOther };
}

const groupNames = paths => {
  const dirs = new Map();
  for (const file of [...paths].sort(byCodeUnit)) {
    const cut = file.lastIndexOf('/');
    const dir = file.slice(0, cut);
    if (!dirs.has(dir)) dirs.set(dir, []);
    dirs.get(dir).push(file.slice(cut + 1));
  }
  return [...dirs].map(([dir, names]) => ({ dir, names }));
};

export function toDocument({ files, frozenOther }) {
  const entries = [];
  for (const rule of LEGACY_RULES) {
    const mine = Object.keys(files).filter(file => files[file] === rule.id);
    for (const group of groupNames(mine)) entries.push({ rule: rule.id, ...group });
  }
  return {
    schemaVersion: 1,
    generatedBy: 'node scripts/guard/legacy-scan.mjs',
    note: '이관 대상(legacy) 파일 목록. 줄어들 수만 있다. 파일을 추가하려면 사람이 직접 고쳐야 한다(보호 파일).',
    totals: { files: Object.keys(files).length, frozenOther: frozenOther.length },
    rules: LEGACY_RULES,
    files: entries,
    frozenOther: groupNames(frozenOther),
  };
}

const expand = groups => (groups ?? []).flatMap(group => group.names.map(name => `${group.dir}/${name}`));

/** Load legacy-files.json. Throws when missing or malformed: the guard must fail closed. */
export function loadLegacy(root) {
  const file = path.join(root, LEGACY_FILE);
  if (!fs.existsSync(file)) throw new Error(`${LEGACY_FILE} 이 없습니다. node scripts/guard/legacy-scan.mjs 로 만드세요.`);
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(doc.files) || !Array.isArray(doc.frozenOther)) throw new Error(`${LEGACY_FILE} 형식이 잘못되었습니다.`);
  const ruleOf = new Map(doc.files.flatMap(group => group.names.map(name => [`${group.dir}/${name}`, group.rule])));
  const frozenOther = expand(doc.frozenOther);
  return { doc, ruleOf, files: new Set(ruleOf.keys()), frozenOther: new Set(frozenOther), rulesInSync: JSON.stringify(doc.rules) === JSON.stringify(LEGACY_RULES) };
}
