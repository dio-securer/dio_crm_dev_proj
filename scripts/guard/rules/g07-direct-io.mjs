import { CODE_EXT, TEST_ROOTS, excerpt, hasExt, isTestFile, scan } from '../lib/files.mjs';
import { extractImports, packageName } from '../lib/imports.mjs';

const SCOPE = ['frontend/', 'backend/', 'packages/', 'extensions/'];
// The only places allowed to talk to a database or the network directly.
export const ALLOWED = [
  ['backend/src/database/', 'DB 연결과 트랜잭션(mssql)을 가진 유일한 곳'],
  ['backend/src/integration/', '외부 시스템 연동 어댑터'],
  ['frontend/src/api.ts', '프런트 공용 API 클라이언트'],
  ['frontend/src/admin/client/', '관리자 화면 API 클라이언트'],
];
const DB = ['mssql', 'tedious', 'typeorm', '@nestjs/typeorm', 'knex', 'prisma', '@prisma/client', 'pg', 'pg-promise', 'postgres', 'mysql', 'mysql2', 'mariadb', 'sqlite3', 'better-sqlite3', 'oracledb', 'sequelize', '@nestjs/sequelize', 'mongoose', '@nestjs/mongoose', 'mongodb', 'redis', 'ioredis', 'drizzle-orm', 'kysely', '@mikro-orm/core', 'odbc'];
const NET = ['axios', '@nestjs/axios', 'node-fetch', 'cross-fetch', 'isomorphic-fetch', 'undici', 'got', 'ky', 'superagent', 'request', 'needle', 'http', 'https', 'http2', 'net', 'tls', 'dgram', 'ws', 'socket.io-client', 'graphql-request', 'soap'];
const CALLS = /(?<![\w$.])fetch\b(?!\s*:)|\b(?:window|globalThis|self|global)\s*(?:\?\.|\.)\s*fetch\b|\[\s*['"`]fetch['"`]\s*\]|\bXMLHttpRequest\b|\bsendBeacon\b|\bnew\s+(?:WebSocket|EventSource)\b|\baxios\b(?!['"`/-])|\bhttps?\s*\.\s*(?:request|get)\s*\(/g;

export const inScope = file => hasExt(file, CODE_EXT)
  && SCOPE.some(prefix => file.startsWith(prefix))
  && !isTestFile(file)
  && !ALLOWED.some(([prefix]) => file === prefix || (prefix.endsWith('/') && file.startsWith(prefix)));

export default {
  id: 'G07',
  name: 'direct-io',
  baseline: 'count',
  forbids: '정해진 인프라 폴더 밖에서 DB나 네트워크를 직접 건드리는 것: DB 드라이버·ORM import(mssql, tedious, typeorm, knex, prisma, pg, mysql2, mongoose, redis …), HTTP 라이브러리·node 네트워크 모듈 import(axios, undici, http, https, net …), 그리고 `fetch(...)`, `XMLHttpRequest`, `sendBeacon`, `new WebSocket/EventSource`, `http(s).request/get(` 호출.',
  why: 'AI는 화면이나 서비스 코드 한가운데서 바로 DB·API를 부른다. 그러면 권한 검사·감사 기록·오류 처리·회사 격리를 건너뛰는 길이 생기고, 호출 지점이 수백 곳으로 흩어진다.',
  fix: '허용된 인프라 계층(아래 목록)의 함수를 통해 호출한다. 프런트는 API 클라이언트를, 백엔드는 database/integration 계층이 내주는 인터페이스를 쓴다.',
  scope: '`frontend/`, `backend/`, `packages/`, `extensions/` 의 코드 파일 중 테스트가 아닌 것. import 한 건, 호출 한 건을 각각 1건으로 센다.',
  exclusions: [
    ...ALLOWED.map(([prefix, reason]) => `\`${prefix}\` (${reason})`),
    `테스트 파일: 이름이 \`*.spec.*\`·\`*.test.*\` 인 파일과, 정해진 테스트 폴더 ${TEST_ROOTS.map(root => `\`${root}\``).join(', ')} 뿐이다(테스트는 띄운 서버를 직접 호출해야 한다). 다른 곳의 \`test/\`·\`__tests__/\`·\`e2e/\` 폴더는 제외되지 않는다`,
    '`scripts/`, `tests/` 는 검사·실행 도구라 대상 밖이다',
    '허용 목록은 지금 실제로 IO 를 가진 곳만 넣었다. 엔진의 데이터 접근 계층이 생기면 사람이 이 목록에 추가해야 한다.',
  ],
  limits: [
    '`fetch` 라는 이름이면 직접 만든 함수여도 센다(막는 쪽으로 틀림). 반대로 `const f = globalThis["fe"+"tch"]` 같은 우회는 잡지 못한다.',
    '날 SQL 은 보지 않는다. `DatabaseService.query("INSERT …")` 처럼 허용 계층이 내준 객체로 SQL 문자열을 직접 실행하는 것은 import 도 네트워크 호출도 아니라서 잡지 못한다. 기존 서비스 코드 대부분이 이렇게 되어 있고, 새 코드가 그렇게 해도 통과한다.',
    '파일 읽기/쓰기(fs), 자식 프로세스 실행은 대상이 아니다.',
    '테스트 이름(`*.spec.ts`)을 붙인 파일은 검사하지 않는다. 그런 파일을 일반 코드가 import 하면 G11 이 막지만, import 없이 실행되는 경로(자동 탐색·빌드 설정)는 막지 못한다.',
    '정규식 검사라 주석·문자열 안의 같은 모양도 센다.',
  ],
  check(ctx) {
    const findings = [];
    for (const file of ctx.files) {
      if (!inScope(file)) continue;
      const text = ctx.read(file);
      const found = [];
      for (const item of extractImports(text)) {
        if (item.dynamic) continue;
        const name = packageName(item.specifier);
        if (DB.includes(name) || name.startsWith('@prisma/') || name.startsWith('@mikro-orm/')) found.push({ file, line: item.line, message: `DB 드라이버/ORM import "${item.specifier}"` });
        else if (NET.includes(name)) found.push({ file, line: item.line, message: `네트워크 모듈 import "${item.specifier}"` });
      }
      for (const hit of scan(text, CALLS)) found.push({ file, line: hit.line, message: `직접 네트워크 호출 ${excerpt(hit.text, 30)}` });
      findings.push(...found.sort((a, b) => a.line - b.line));
    }
    return findings;
  },
};
