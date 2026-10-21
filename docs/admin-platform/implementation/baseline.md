# A00 기준선 및 재개 기록

2026-10-21 · 기준 main d4fa184 (PR #27 병합), PR #28 head 7b87257.
이전 로컬 체크포인트 9ef9ca9에서 미커밋 변경을 복원했다. 원 작업 폴더의 동시 변경이 발견되어 `feat/admin-platform-resume-20261021` worktree로 격리했다. 원격 후속 커밋 8d41669를 검토하고 통합했다.

## A00 결과
- LEGACY HQ(KR)/US/MX 거래처 목록을 실제 Chromium으로 재실행했다. `evidence/baseline-{KR,US,MX}.png`.
- 캡처의 `/api/me/context`는 합성 fixture이며 실제 로그인·DB 검증이 아니다. 업무 API를 offline fixture로 응답하여 기존 sandbox fallback을 확인한다.
- 최초 캡처의 한글 글꼴 누락은 Noto Sans CJK KR을 테스트 환경에 공급하여 해소했다. 제품에 글꼴 경로나 다운로드 의존성을 추가하지 않았다.
- 기존 seed 원본을 `fixtures/legacy-account-sandbox.ts.txt`에 보존했다. 원본 source/storage key는 수정하지 않았다. 주소로 법인을 추론하지 않는다.
- 기존 GLOBAL 승인자 미확정 사항은 유지한다. 합성 승인자 확정은 후속 A07 대상이다.
- 기존 라우팅/화면은 LEGACY 분기에서 유지한다. 신규 bootstrap은 명시 모드에서만 실행한다.

## A01 구현 범위
- domain payload, scope/override/version, identity/session/MFA 포트 계약.
- Browser Web Locks 저장소 및 copy-on-write Memory 저장소. 조회와 receipt 재응답은 dataset revision을 변경하지 않는다.
- 공통 초안 command를 HTTP/브라우저 adapter에서 함께 사용. strict DTO, 회사 scope, If-Match, SHA-256 receipt, event 원자 저장.
- DB 모듈을 import하지 않는 Nest MockAppModule과 인증 fixture, refresh/logout/revocation, production 차단.
- React bootstrap의 LEGACY/API_MOCK/BROWSER_MOCK 분리, API context 모드 검증, 미지원 API 501.
- `MockEntry`는 A01 검증용 실행 화면이다. 31개 관리자 화면 구현 완료를 의미하지 않는다.
- 실제 MFA는 범위 밖이다. 조직/사용자 CRUD는 A02-report.md에 기록하며, DEMO MFA·승인/설정 게시·ERP 모의 엔진은 후속 단계다.

## 재현 명령
```sh
pnpm build
pnpm test
pnpm test:admin:contracts
pnpm test:admin:api
CHROMIUM_PATH=/path/to/chromium pnpm test:admin:browser
CHROMIUM_PATH=/path/to/chromium pnpm test:admin:entry
CHROMIUM_PATH=/path/to/chromium pnpm test:admin:baseline
```
Chromium이 Playwright 기본 경로에 설치되어 있으면 CHROMIUM_PATH는 생략한다. 한글 글꼴이 없는 환경은 fontconfig로 Noto CJK 글꼴을 공급한다.

시연: `pnpm dev:admin:api`와 `pnpm dev:admin:web`를 각각 실행하거나 `pnpm dev:admin:browser`만 실행한다. API mock 전용 key는 실행 때 임시 생성하며 운영 JWT와 공유하지 않는다. Node 프로세스를 다시 시작하면 API seed/session이 초기화된다. 브라우저는 ADMIN_DEMO_V1 localStorage에 저장된다.
계정: US_A / admin1 / DemoOnly!2026. 모든 표시 데이터와 인증은 DEMO이며 운영 보안 기능이 아니다.

## 판정 원칙
단위/HTTP/기반 UI 테스트 개수와 83개 전체 인수 TC를 구분한다. A03~A11 전체 완료나 운영 배포를 주장하지 않는다. 단계별 결과와 작업자 B 재검증은 A01-report.md에 기록한다.
