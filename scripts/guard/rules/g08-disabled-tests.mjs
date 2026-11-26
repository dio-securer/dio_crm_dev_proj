import { CODE_EXT, excerpt, hasExt, isTestFile, scan } from '../lib/files.mjs';

const RUNNER = '(?:it|test|describe|suite|context|specify|bench)';
const MODE = '(?:skip|only|todo|skipIf|runIf)';
const DISABLED = new RegExp([
  `\\b${RUNNER}(?:\\s*\\.\\s*\\w+)*?\\s*\\.\\s*${MODE}\\b`,
  `\\.\\s*(?:skip|only)\\s*\\(`,
  `(?<![\\w$.])(?:xit|xtest|xdescribe|xcontext|xspecify|fit|fdescribe)\\s*\\(`,
  `(?<![\\w$.])['"]?(?:skip|todo|only)['"]?\\s*:\\s*(?!false\\b|undefined\\b|null\\b|0\\b)[^\\s,}]`,
].join('|'), 'g');

export const inScope = file => hasExt(file, CODE_EXT) && (isTestFile(file) || file.startsWith('scripts/'));

export default {
  id: 'G08',
  name: 'disabled-tests',
  baseline: 'count',
  forbids: '테스트를 꺼 두는 것: 테스트 함수의 skip / only / todo / skipIf / runIf 표시(점 주변 공백이나 `.each` 가 끼어도 잡는다), x 로 시작하는 꺼진 테스트 이름(xit, xtest, xdescribe)과 f 로 시작하는 단독 실행(fit, fdescribe), node:test 옵션의 skip·todo·only 값이 false 가 아닌 것.',
  why: 'AI는 테스트가 실패하면 원인을 고치는 대신 테스트를 끄거나 하나만 돌려 "통과"를 만든다. 꺼진 테스트는 아무도 다시 켜지 않는다.',
  fix: '테스트를 켜고 실패 원인을 고친다. 정말 지울 테스트라면 이유를 커밋에 적고 삭제한다(끄는 것은 안 된다).',
  scope: '테스트 파일(`*.spec.*`, `*.test.*`, `test/`·`tests/`·`__tests__/`·`e2e/` 폴더)과 `scripts/` 아래 모든 코드 파일(검사 스크립트).',
  exclusions: ['없음. 가드 자신의 코드(`scripts/guard/`)도 검사 대상이다.'],
  limits: [
    '주석 처리해서 끈 테스트, 본문 첫 줄의 `return`, 조건문으로 감싼 테스트, 설정 파일의 제외 패턴(testPathIgnorePatterns 등)은 잡지 못한다.',
    '`scripts/`·테스트 파일 안에서는 테스트와 무관한 skip 속성(예: 페이지 건너뛰기 값)과 타입 선언의 skip 속성도 센다(막는 쪽으로 틀림).',
    '테스트 파일 이름 규칙과 `scripts/` 밖에 둔 테스트(예: 임의 이름의 .mjs)는 대상이 아니다.',
  ],
  check(ctx) {
    const findings = [];
    for (const file of ctx.files) {
      if (!inScope(file)) continue;
      for (const hit of scan(ctx.read(file), DISABLED)) findings.push({ file, line: hit.line, message: `꺼진 테스트 표시: ${excerpt(hit.text, 40)}` });
    }
    return findings;
  },
};
