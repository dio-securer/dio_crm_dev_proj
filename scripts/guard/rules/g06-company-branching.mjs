import { CODE_EXT, excerpt, hasExt, isTestFile, scan } from '../lib/files.mjs';

const SCOPE = ['frontend/src/', 'backend/src/', 'packages/'];
// Places whose job is to DEFINE markets/countries (data, not branching).
export const DEFINITION_DIRS = [
  'frontend/src/market/profiles/',
  'frontend/src/market/field-profiles/',
  'backend/src/globalization/',
];
export const DEFINITION_FILES = ['packages/contracts/src/globalization.ts'];

// ISO 3166-1 alpha-2 plus the group codes this project uses.
const ISO = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW';
const CODES = `${ISO.split(' ').join('|')}|UK|EU|HQ|GLOBAL|APAC|EMEA|LATAM`;
const Q = '[\'"`]';
const LIT = `${Q}(?:${CODES}|[a-z]{2,3}[-_][A-Z]{2})${Q}`;
const OP = '(?<op>===|!==|==|!=)';
// A key word counts only at the start of a name part: `companyCode`, `actorCompany`, `MARKET_X`; not `accompany`, `marketing`.
const KEY = '(?:(?<![A-Za-z])(?:company|country|market|tenant|nation)|Company|Country|Market|Tenant|Nation|COMPANY|COUNTRY|MARKET|TENANT|NATION)(?!ing)';
const KEYID = `[\\w$]*?${KEY}[\\w$]*`;
const CHAIN = '(?:\\s*\\??\\.\\s*(?:toUpperCase|toLowerCase|trim|toString|code|id|key|name|value)(?:\\(\\))?){0,3}';
const TYPEOF = `(?!${Q}(?:string|number|boolean|undefined|object|function|symbol|bigint)${Q})`;
const CODEID = `(?:[\\w$]*?${KEY}[\\w$]*?(?:[Cc]ode|CODE|_cd|Cd)|(?<![\\w$])(?:country|market))`;

const PATTERNS = [
  ['코드 리터럴 비교', new RegExp(`${OP}\\s*${LIT}`, 'gd')],
  ['코드 리터럴 비교', new RegExp(`${LIT}\\s*${OP}`, 'gd')],
  ['회사/국가/시장 값을 리터럴과 비교', new RegExp(`${KEYID}${CHAIN}\\s*[)\\]]*\\s*${OP}\\s*${TYPEOF}(?:${Q}|-?\\d)`, 'gd')],
  ['회사/국가/시장 값을 리터럴과 비교', new RegExp(`(?:${Q}|\\d)\\s*${OP}\\s*[(\\[]*\\s*(?:[\\w$]+\\s*\\??\\.\\s*)*${KEYID}`, 'gd')],
  ['회사/국가/시장 코드 비교', new RegExp(`${CODEID}\\s*[)\\]]*\\s*${OP}`, 'gd')],
  ['회사/국가/시장 코드 비교', new RegExp(`${OP}\\s*[(\\[]*\\s*(?:[\\w$]+\\s*\\??\\.\\s*)*${CODEID}(?![\\w$]|\\s*\\??\\.)`, 'gd')],
  ['회사/국가/시장 값으로 switch', new RegExp(`(?<op>\\bswitch)\\s*\\([^)\\n]*?${KEY}`, 'gd')],
  ['코드 리터럴 case', new RegExp(`(?<op>\\bcase)\\s+${LIT}\\s*:`, 'gd')],
  ['코드 리터럴 포함 검사', new RegExp(`(?<op>\\.\\s*(?:includes|indexOf|has|startsWith|endsWith|localeCompare))\\s*\\(\\s*${LIT}`, 'gd')],
  ['국가/시장 코드 포함 검사', new RegExp(`(?<op>\\.\\s*(?:includes|indexOf|has))\\s*\\(\\s*(?:[\\w$]+\\s*\\??\\.\\s*)*${CODEID}${CHAIN}\\s*\\)`, 'gd')],
];

export const inScope = file => hasExt(file, CODE_EXT)
  && SCOPE.some(prefix => file.startsWith(prefix))
  && !isTestFile(file)
  && !DEFINITION_DIRS.some(prefix => file.startsWith(prefix))
  && !DEFINITION_FILES.includes(file);

export default {
  id: 'G06',
  name: 'company-branching',
  baseline: 'count',
  forbids: '코드 안에서 회사·국가·시장 값으로 갈라지는 것: `=== "KR"` 같은 국가/시장 코드 비교(따옴표 종류 무관), `companyCode ===`·`countryCode ===`·`market ===`·`country ===`(상대가 변수여도), 이름에 company/country/market/tenant/nation 이 든 값을 리터럴과 비교, 그런 값으로 `switch`, `case "KR":`, `.includes("KR")`, `[...].includes(countryCode)`.',
  why: 'AI는 "한국만 다르게" 같은 요청을 받으면 그 자리에 if 를 넣는다. 회사가 늘수록 if 가 쌓여 누구도 전체 동작을 알 수 없게 된다.',
  fix: '차이는 `metadata/` 의 설정값이나 시장 프로필로 표현하고 코드는 그 값을 읽기만 한다. 설정으로 안 되는 회사 전용 동작은 `extensions/<회사>` 로 뺀다.',
  scope: '`frontend/src/`, `backend/src/`, `packages/` 의 코드 파일 중 테스트가 아닌 것. (명세는 frontend/src·backend/src 만 말하지만 엔진·계약 패키지도 넣었다.) `extensions/` 는 원래 회사별 코드라 대상이 아니다.',
  exclusions: [
    ...DEFINITION_DIRS.map(dir => `\`${dir}\` (시장·국가를 정의하는 곳)`),
    ...DEFINITION_FILES.map(file => `\`${file}\` (국가/시장 계약 정의)`),
    '테스트 파일(`*.spec.*`, `*.test.*`, `test/`·`tests/`·`__tests__/`·`e2e/` 폴더)',
    '`frontend/src/market/` 의 나머지(해석기·템플릿 화면)와 `frontend/src/i18n/` 은 제외하지 않았다. 기존 건수는 기준선에 묶인다.',
  ],
  limits: [
    '같은 회사인지 확인하는 비교(`row.company_id === actor.companyId`)는 위반이 아니다. 이름에 company/tenant 가 들어도 상대가 변수면 세지 않는다. 다만 이름이 정확히 country/market 이거나 company/country/market…Code 꼴이면 상대가 변수여도 위반으로 센다(명세 그대로).',
    '코드 리터럴은 ISO 두 글자 국가코드(대문자)와 UK/EU/HQ/GLOBAL/APAC/EMEA/LATAM, 그리고 `ko-KR` 꼴 로캘이다. `"IN"`, `"ID"`, `"NO"` 처럼 국가코드와 같은 대문자 두 글자 문자열 비교는 뜻과 상관없이 센다(막는 쪽으로 틀림).',
    '잡지 못하는 것: 객체 조회로 갈라지기(`{KR: a, US: b}[country]`), 미리 만든 불리언(`isKorea`)으로 갈라지기, 소문자 코드(`"kr"`)를 이름에 단서가 없는 변수와 비교, 숫자 회사 ID 를 단서 없는 변수와 비교.',
    '정규식 검사라 주석·문자열 안의 같은 모양도 센다.',
  ],
  check(ctx) {
    const findings = [];
    for (const file of ctx.files) {
      if (!inScope(file)) continue;
      const text = ctx.read(file);
      const seen = new Map();
      for (const [label, regex] of PATTERNS) {
        for (const hit of scan(text, regex, m => m.indices.groups.op[0])) {
          if (!seen.has(hit.offset)) seen.set(hit.offset, { file, line: hit.line, message: `${label}: ${excerpt(hit.text, 50)}` });
        }
      }
      findings.push(...[...seen.entries()].sort((a, b) => a[0] - b[0]).map(entry => entry[1]));
    }
    return findings;
  },
};
