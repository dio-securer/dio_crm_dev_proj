import { CODE_EXT, TEST_ROOTS, hasExt, isTestFile } from '../lib/files.mjs';
import { extractImports, resolveRelative } from '../lib/imports.mjs';

const SCOPE = ['frontend/', 'backend/', 'packages/', 'extensions/'];
// Workspace package name -> folder, so `@dio-crm/api/test/x` is seen as `backend/test/x`.
const PACKAGE_DIRS = [['@dio-crm/api', 'backend'], ['@dio-crm/web', 'frontend'], ['@dio-crm/contracts', 'packages/contracts']];
const TEST_TARGET = /\.(spec|test)(\.[cm]?[jt]sx?)?$/i;

export const inScope = file => hasExt(file, CODE_EXT) && SCOPE.some(prefix => file.startsWith(prefix)) && !isTestFile(file);

/** Repo-relative path an import points at (best effort for bare specifiers). */
function targetOf(file, specifier) {
  if (specifier.startsWith('.')) return resolveRelative(file, specifier);
  for (const [name, dir] of PACKAGE_DIRS) if (specifier === name || specifier.startsWith(`${name}/`)) return dir + specifier.slice(name.length);
  return specifier.replace(/^\/+/, '');
}

const isTestTarget = target => TEST_TARGET.test(target) || TEST_ROOTS.some(root => `${target}/`.startsWith(root));

export default {
  id: 'G11',
  name: 'no-test-imports',
  baseline: 'none',
  forbids: '테스트가 아닌 코드가 테스트 파일을 import 하는 것: 이름이 `*.spec.*`·`*.test.*` 인 파일(확장자를 생략한 `./x.spec` 포함)이나 테스트 폴더 안의 파일을 import·require·re-export 하는 것.',
  why: 'G06·G07 은 테스트 파일을 검사하지 않는다. AI가 운영 코드를 `gateway.spec.ts` 같은 이름으로 만들어 두고 일반 코드에서 불러 쓰면 그 검사를 통째로 피한다. 이 규칙이 그 길을 막는다.',
  fix: '운영에 필요한 코드는 테스트 이름이 아닌 일반 파일로 옮긴다(그러면 G06·G07 이 본다). 테스트끼리 나눠 쓰는 도우미는 테스트 파일에서만 import 한다.',
  scope: `\`frontend/\`, \`backend/\`, \`packages/\`, \`extensions/\` 의 코드 파일 중 테스트가 아닌 것(G07 과 같은 범위). 테스트 폴더는 ${TEST_ROOTS.map(root => `\`${root}\``).join(', ')} 로 정해져 있다.`,
  exclusions: ['없음. 기존 위반이 없어 기준선도 없다.'],
  limits: [
    '경로를 실행 중에 만드는 import()/require() 는 대상을 알 수 없어 보지 않는다. `import.meta.glob`, 프레임워크의 자동 탐색, 빌드 설정(entry)으로 테스트 이름 파일을 싣는 것도 잡지 못한다.',
    'tsconfig paths 별칭은 풀지 않는다. 다만 별칭이어도 경로 끝이 `.spec`/`.test` 이면 잡는다.',
    '`scripts/` 와 `tests/` 의 실행 도구는 대상이 아니다(테스트를 돌리는 것이 일이다).',
  ],
  check(ctx) {
    const findings = [];
    for (const file of ctx.files) {
      if (!inScope(file)) continue;
      for (const item of extractImports(ctx.read(file))) {
        if (item.dynamic || !item.specifier) continue;
        const target = targetOf(file, item.specifier);
        if (isTestTarget(target)) findings.push({ file, line: item.line, message: `테스트 파일 import "${item.specifier}"` });
      }
    }
    return findings;
  },
};
