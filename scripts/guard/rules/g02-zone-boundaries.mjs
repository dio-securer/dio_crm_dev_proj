import { CODE_EXT, hasExt } from '../lib/files.mjs';
import { extractImports, packageName, resolveRelative } from '../lib/imports.mjs';
import { loadLegacy } from '../lib/legacy.mjs';

const EXT_ALLOWED = ['@dio-crm/contracts', '@dio-crm/engine'];
const ENGINE_FORBIDDEN_PACKAGES = ['@dio-crm/api', '@dio-crm/web'];
const ENGINE_FORBIDDEN_PREFIX = ['frontend/', 'backend/', 'extensions/', '@dio-crm/extension'];
const SOURCE_SUFFIX = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js'];

const zoneOf = file => {
  const ext = /^extensions\/([^/]+)\//.exec(file);
  if (ext) return { kind: 'extension', home: `extensions/${ext[1]}/` };
  if (file.startsWith('extensions/')) return { kind: 'extension-root', home: 'extensions/' };
  const engine = /^packages\/(engine[^/]*)\//.exec(file);
  return engine ? { kind: 'engine', home: `packages/${engine[1]}/` } : null;
};

function checkExtension(home, file, item) {
  const spec = item.specifier;
  if (spec.startsWith('.')) {
    return `${resolveRelative(file, spec)}/`.startsWith(home) ? null : `자기 확장 폴더(${home}) 밖을 상대경로로 import: "${spec}"`;
  }
  if (EXT_ALLOWED.some(prefix => spec.startsWith(prefix))) return null;
  return `허용되지 않은 import "${spec}" (허용: 자기 폴더 상대경로, @dio-crm/contracts*, @dio-crm/engine*)`;
}

function checkEngine(home, file, item, legacy) {
  const spec = item.specifier;
  if (spec.startsWith('.')) {
    return `${resolveRelative(file, spec)}/`.startsWith(home) ? null : `엔진 패키지(${home}) 밖을 상대경로로 import: "${spec}"`;
  }
  if (spec.startsWith('/')) return `절대경로 import: "${spec}"`;
  if (ENGINE_FORBIDDEN_PACKAGES.includes(packageName(spec)) || ENGINE_FORBIDDEN_PREFIX.some(prefix => spec.startsWith(prefix))) {
    return `엔진이 앱/확장 구역을 import: "${spec}"`;
  }
  if (spec.startsWith('@dio-crm/contracts/')) {
    const target = `packages/contracts/src/${spec.slice('@dio-crm/contracts/'.length)}`;
    if (SOURCE_SUFFIX.some(suffix => legacy.files.has(target + suffix))) return `엔진이 legacy 계약 파일을 import: "${spec}"`;
  }
  return null;
}

export default {
  id: 'G02',
  name: 'zone-boundaries',
  baseline: 'none',
  forbids: '구역 경계를 넘는 import. `extensions/<이름>/` 의 코드는 자기 폴더 안 상대경로, `@dio-crm/contracts*`, `@dio-crm/engine*` 만 import 할 수 있다. `packages/engine*/` 의 코드는 `frontend/`, `backend/`, `extensions/`, legacy 파일을 import 할 수 없다.',
  why: 'AI는 가까이 있는 코드를 그대로 끌어다 쓴다. 엔진이 화면 코드를, 확장이 다른 회사 확장이나 DB를 직접 잡으면 한 곳을 고칠 때 전부 깨진다.',
  fix: '필요한 기능을 `@dio-crm/contracts` 의 계약이나 `@dio-crm/engine` 의 공개 API로 올리고 그것을 import 한다.',
  scope: '`extensions/` 와 `packages/engine*/` 아래 코드 파일(.ts .tsx .js .jsx .mjs .cjs .mts .cts). 테스트 파일도 예외 없이 본다.',
  exclusions: [],
  limits: [
    '명세보다 엄격한 점: 확장은 react·zod·node 내장 모듈도 직접 import 할 수 없다(명세의 "only" 그대로). 엔진은 자기 패키지 밖으로 나가는 상대경로 전부가 위반이다.',
    '명세보다 엄격한 점: 경로를 실행 중에 만드는 import()/require() 는 확인할 수 없으므로 위반으로 본다. `extensions/` 바로 아래(확장 폴더 밖)의 코드 파일도 위반이다.',
    'import 문을 정규식으로 찾는다. 문자열 안의 `from "x"` 도 import 로 셀 수 있다(막는 쪽으로 틀림).',
    '`@dio-crm/contracts` 의 index 를 거쳐 legacy 파일을 다시 내보내는 경우는 잡지 못한다. tsconfig paths 별칭도 풀지 않는다(별칭은 허용 목록에 없으므로 확장에서는 위반이 된다).',
  ],
  check(ctx) {
    const findings = [];
    let legacy = null;
    for (const file of ctx.files) {
      const zone = zoneOf(file);
      if (!zone || !hasExt(file, CODE_EXT)) continue;
      if (zone.kind === 'extension-root') {
        findings.push({ file, line: 0, message: '코드 파일은 extensions/<확장이름>/ 폴더 안에 있어야 합니다.' });
        continue;
      }
      if (zone.kind === 'engine') legacy ??= loadLegacy(ctx.root);
      for (const item of extractImports(ctx.read(file))) {
        const message = item.dynamic
          ? '경로를 실행 중에 만드는 import()/require() 는 구역 안에서 쓸 수 없습니다.'
          : zone.kind === 'extension' ? checkExtension(zone.home, file, item) : checkEngine(zone.home, file, item, legacy);
        if (message) findings.push({ file, line: item.line, message });
      }
    }
    return findings;
  },
};
