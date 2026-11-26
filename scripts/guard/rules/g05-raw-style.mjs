import { excerpt, hasExt, scan } from '../lib/files.mjs';

export const TOKEN_SOURCES = ['frontend/src/styles/tokens.css'];
const EXT = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss'];
// #rgb #rgba #rrggbb #rrggbbaa in any letter case, or a colour function call.
const RAW = /(?<![\w&$.])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\b(?:rgba?|hsla?|hwb|oklab|oklch)\s*\(/gi;

export default {
  id: 'G05',
  name: 'raw-style',
  baseline: 'count',
  forbids: '색을 날값으로 적는 것: 16진 색(#fff, #FFFFFF, #ffffff80)과 rgb()/rgba()/hsl()/hsla()/hwb()/oklab()/oklch(). 색은 디자인 토큰(CSS 변수)으로만 쓴다.',
  why: 'AI는 화면마다 비슷하지만 조금씩 다른 색을 새로 적는다. 그러면 화면마다 모양이 달라지고 테마 변경이 불가능해진다.',
  fix: '`var(--토큰이름)` 을 쓴다. 맞는 토큰이 없으면 토큰 파일에 토큰을 추가하고 그것을 쓴다.',
  scope: '저장소 전체의 .ts .tsx .js .jsx .css .scss 파일(테스트 파일 포함). 건수는 줄이 아니라 나타난 횟수로 센다.',
  exclusions: TOKEN_SOURCES.map(file => `\`${file}\` (디자인 토큰을 정의하는 유일한 파일)`),
  limits: [
    '색 이름(red, white 등)과 문자열을 이어 붙여 만든 색("#" + "fff")은 잡지 못한다.',
    '16진수처럼 보이는 3·4·6·8자 글자(예: CSS id 선택자 `#add`, 문자열 "#1234")도 색으로 센다(막는 쪽으로 틀림). 주석 속 색도 센다.',
    '다른 CSS 파일 안에서 정의한 지역 변수(`--x:#fff`)는 토큰으로 인정하지 않는다. 토큰 파일은 위 목록 하나뿐이다.',
    '크기·간격(px) 날값은 이 규칙이 보지 않는다.',
  ],
  check(ctx) {
    const findings = [];
    for (const file of ctx.files) {
      if (!hasExt(file, EXT) || TOKEN_SOURCES.includes(file)) continue;
      for (const hit of scan(ctx.read(file), RAW)) findings.push({ file, line: hit.line, message: `날값 색 ${excerpt(hit.text, 20)}` });
    }
    return findings;
  },
};
