import { CODE_EXT, TEST_ROOTS, hasExt, isTestFile } from '../lib/files.mjs';
import { collapse, importsOf, resolveRelative } from '../lib/imports.mjs';

export const SCOPE = ['frontend/', 'backend/', 'packages/', 'extensions/'];
// Workspace package name -> folder, so `@dio-crm/api/test/x` is seen as `backend/test/x`.
export const PACKAGE_DIRS = [['@dio-crm/api', 'backend'], ['@dio-crm/web', 'frontend'], ['@dio-crm/contracts', 'packages/contracts']];
// `x.spec`, `x.spec.ts`, `x.test.js`, and glob forms such as `*.spec.*` or `*.test.{ts,tsx}`.
export const TEST_TARGET = /\.(spec|test)(\.[^/]*)?$/i;

export const inScope = file => hasExt(file, CODE_EXT) && SCOPE.some(prefix => file.startsWith(prefix)) && !isTestFile(file);

/** Repo-relative path an import points at (best effort for bare specifiers). */
function targetOf(file, specifier) {
  if (specifier.startsWith('.')) return resolveRelative(file, specifier);
  const bare = collapse(specifier) ?? specifier;
  for (const [name, dir] of PACKAGE_DIRS) {
    if (bare.toLowerCase() === name || bare.toLowerCase().startsWith(`${name}/`)) return dir + bare.slice(name.length);
  }
  return bare;
}

const isTestTarget = target => TEST_TARGET.test(target) || TEST_ROOTS.some(root => `${target}/`.startsWith(root));
const roots = TEST_ROOTS.map(root => `\`${root}\``).join(', ');

export default {
  id: 'G11',
  name: 'no-test-imports',
  baseline: 'none',
  forbids: '테스트가 아닌 코드가 테스트 파일을 가져다 쓰는 것: 이름이 `*.spec.*`·`*.test.*` 인 파일(확장자를 생략한 `./x.spec`, 질의·해시를 붙인 `./x.spec?raw` 포함)이나 '
    + '테스트 폴더 안의 파일을 import·require·re-export·`import()`·`import.meta.glob`·`new URL(…, import.meta.url)` 로 가리키는 것. 경로를 실행 중에 만드는 import()/require() 도 위반이다.',
  why: 'G06·G07 은 테스트 파일을 검사하지 않는다. AI가 운영 코드를 `gateway.spec.ts` 같은 이름으로 만들어 두고 일반 코드에서 불러 쓰면 그 검사를 통째로 피한다. '
    + '이 규칙이 그 길을 막는다.',
  fix: '운영에 필요한 코드는 테스트 이름이 아닌 일반 파일로 옮긴다(그러면 G06·G07 이 본다). 테스트끼리 나눠 쓰는 도우미는 테스트 파일에서만 import 한다.',
  scope: '`frontend/`, `backend/`, `packages/`, `extensions/` 의 코드 파일 중 테스트가 아닌 것(G07 과 같은 범위). '
    + `테스트 폴더는 ${roots} 로 정해져 있다. import 는 TypeScript 구문 트리(AST)에서 찾는다.`,
  exclusions: ['없음. 기존 위반이 없어 기준선도 없다.'],
  limits: [
    '경로를 실행 중에 만드는 import()/require() 는 대상을 알 수 없으므로 위반으로 센다(명세보다 엄격한 점). 지금 이 범위에 그런 import 는 없다.',
    '`import.meta.glob("./**/*")` 처럼 테스트 이름을 적지 않고 폴더 전체를 싣는 패턴, 프레임워크의 자동 탐색, 빌드 설정(entry)으로 테스트 이름 파일을 싣는 것은 잡지 못한다.',
    'tsconfig paths 별칭은 풀지 않는다. 다만 별칭이어도 경로 끝이 `.spec`/`.test` 이면 잡는다.',
    '`scripts/` 와 `tests/` 의 실행 도구는 대상이 아니다(테스트를 돌리는 것이 일이다).',
  ],
  check(ctx) {
    const findings = [];
    for (const file of ctx.files) {
      if (!inScope(file)) continue;
      for (const item of importsOf(ctx, file)) {
        if (item.dynamic) findings.push({ file, line: item.line, message: '경로를 실행 중에 만드는 import()/require() (대상을 확인할 수 없음)' });
        else if (isTestTarget(targetOf(file, item.specifier))) findings.push({ file, line: item.line, message: `테스트 파일 import "${item.raw}"` });
      }
    }
    return findings;
  },
};
