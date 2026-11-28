import { CODE_EXT, hasExt, isTestName } from '../lib/files.mjs';
import { collapse, importsOf, packageName, resolveRelative } from '../lib/imports.mjs';
import { loadLegacy } from '../lib/legacy.mjs';

export const EXT_ALLOWED = ['@dio-crm/contracts', '@dio-crm/engine'];
// Exact specifiers, nothing else. The second list applies only to `*.spec.*` / `*.test.*` files.
export const EXT_EXACT = ['react', 'react/jsx-runtime'];
export const EXT_TEST_EXACT = ['vitest', 'node:test', 'node:assert', 'node:assert/strict'];
export const ENGINE_FORBIDDEN_PACKAGES = ['@dio-crm/api', '@dio-crm/web'];
export const ENGINE_FORBIDDEN_PREFIX = ['frontend/', 'backend/', 'extensions/', '@dio-crm/extension'];
export const CONTRACTS = '@dio-crm/contracts/';
export const SOURCE_SUFFIX = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js'];
export const SOURCE_EXT = /(\.d)?\.[cm]?[jt]sx?$/i;
// A bare specifier is compared as written, so it must not contain `.`, `..` or empty path parts, or a URL scheme.
const isPlain = spec => !spec.split('/').some(part => part === '' || part === '.' || part === '..') && !/^[a-z][\w+.-]*:/i.test(spec.replace(/^node:/, ''));

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
    return `${resolveRelative(file, spec)}/`.startsWith(home) ? null : `자기 확장 폴더(${home}) 밖을 상대경로로 import: "${item.raw}"`;
  }
  if (isPlain(spec) && (EXT_ALLOWED.some(prefix => spec.startsWith(prefix)) || EXT_EXACT.includes(spec))) return null;
  if (isTestName(file) && EXT_TEST_EXACT.includes(spec)) return null;
  return `허용되지 않은 import "${item.raw}" (허용: 자기 폴더 상대경로, @dio-crm/contracts*, @dio-crm/engine*, ${EXT_EXACT.join(', ')}; `
    + `테스트 파일은 ${EXT_TEST_EXACT.join(', ')} 도)`;
}

/** `@dio-crm/contracts/<x>` -> the source file it stands for, whatever the spelling: `x`, `x.js`, `x.ts`, `src/x`, `dist/x.js`. */
export function contractsSource(spec) {
  const flat = collapse(spec);
  if (flat === null || !flat.toLowerCase().startsWith(CONTRACTS)) return null;
  const sub = flat.slice(CONTRACTS.length).replace(/^(src|dist)\//i, '').replace(SOURCE_EXT, '');
  return `packages/contracts/src/${sub}`.toLowerCase();
}

function checkEngine(home, file, item, legacy) {
  const spec = item.specifier;
  if (spec.startsWith('.')) {
    return `${resolveRelative(file, spec)}/`.startsWith(home) ? null : `엔진 패키지(${home}) 밖을 상대경로로 import: "${item.raw}"`;
  }
  if (spec.startsWith('/')) return `절대경로 import: "${item.raw}"`;
  if (!isPlain(spec)) return `경로에 \`.\`·\`..\`·빈 마디나 URL 이 든 import: "${item.raw}"`;
  const lower = spec.toLowerCase();
  if (ENGINE_FORBIDDEN_PACKAGES.includes(packageName(spec)) || ENGINE_FORBIDDEN_PREFIX.some(prefix => lower.startsWith(prefix))) {
    return `엔진이 앱/확장 구역을 import: "${item.raw}"`;
  }
  const target = contractsSource(spec);
  if (target !== null && SOURCE_SUFFIX.some(suffix => legacy.lower.has(target + suffix))) return `엔진이 legacy 계약 파일을 import: "${item.raw}"`;
  return null;
}

export default {
  id: 'G02',
  name: 'zone-boundaries',
  baseline: 'none',
  forbids: '구역 경계를 넘는 import. `extensions/<이름>/` 의 코드는 자기 폴더 안 상대경로, `@dio-crm/contracts*`, `@dio-crm/engine*`, `react`, `react/jsx-runtime` 만 '
    + 'import 할 수 있다. 확장 안의 테스트 파일(`*.spec.*`, `*.test.*`)은 여기에 `vitest`, `node:test`, `node:assert`, `node:assert/strict` 를 더 쓸 수 있다. '
    + '`packages/engine*/` 의 코드는 `frontend/`, `backend/`, `extensions/`, legacy 파일을 import 할 수 없다.',
  why: 'AI는 가까이 있는 코드를 그대로 끌어다 쓴다. 엔진이 화면 코드를, 확장이 다른 회사 확장이나 DB를 직접 잡으면 한 곳을 고칠 때 전부 깨진다.',
  fix: '필요한 기능을 `@dio-crm/contracts` 의 계약이나 `@dio-crm/engine` 의 공개 API로 올리고 그것을 import 한다.',
  scope: '`extensions/` 와 `packages/engine*/` 아래 코드 파일(.ts .tsx .js .jsx .mjs .cjs .mts .cts). 테스트 파일도 예외 없이 본다. '
    + 'import 는 TypeScript 구문 트리(AST)에서 찾는다: import/export 문, `import x = require()`, `import()`, `require()` 와 그 별칭, `require.resolve()`, '
    + '`createRequire()()`, 타입 안의 `import("x")`, `import.meta.glob`, `new URL(x, import.meta.url)`, `/// <reference path>`.',
  exclusions: [],
  limits: [
    '허용 목록은 글자 그대로 비교한다. 확장은 `react-dom`, `react/jsx-dev-runtime`, zod, node 내장 모듈(테스트용 넷 제외)을 직접 import 할 수 없다. '
      + '엔진은 자기 패키지 밖으로 나가는 상대경로 전부가 위반이다. 경로 뒤의 `?질의`·`#해시` 는 떼고 비교한다.',
    '`@dio-crm/contracts*`·`@dio-crm/engine*` 는 앞부분만 본다. `@dio-crm/contracts-x` 같은 이름의 패키지를 새로 만들면 통과한다(패키지 추가는 lockfile 변경으로 드러난다). '
      + '경로 안에 `.`·`..`·빈 마디가 든 것(`@dio-crm/contracts/../api`)은 위반이다.',
    '테스트용 허용은 파일 이름으로 정한다. 확장 안에서 일반 코드가 테스트 파일을 import 하는 것은 G11 이 막는다.',
    '명세보다 엄격한 점: 경로를 실행 중에 만드는 import()/require() 는 확인할 수 없으므로 위반으로 본다. `extensions/` 바로 아래(확장 폴더 밖)의 코드 파일도 위반이다.',
    'legacy 계약 파일은 `@dio-crm/contracts/lead-grid-columns` 를 확장자(.js/.ts) 유무, `/src/`·`/dist/` 경유, 대소문자와 상관없이 같은 파일로 본다. '
      + '그러나 `@dio-crm/contracts` 의 index 를 거쳐 legacy 파일을 다시 내보내는 경우는 잡지 못한다. tsconfig paths 별칭도 풀지 않는다'
      + '(별칭은 허용 목록에 없으므로 확장에서는 위반이 된다).',
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
      if (zone.kind === 'engine' && !legacy) {
        legacy = loadLegacy(ctx.root);
        legacy.lower = new Set([...legacy.files].map(name => name.toLowerCase()));
      }
      for (const item of importsOf(ctx, file)) {
        const message = item.dynamic
          ? '경로를 실행 중에 만드는 import()/require() 는 구역 안에서 쓸 수 없습니다.'
          : zone.kind === 'extension' ? checkExtension(zone.home, file, item) : checkEngine(zone.home, file, item, legacy);
        if (message) findings.push({ file, line: item.line, message });
      }
    }
    return findings;
  },
};
