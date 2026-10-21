# A00 기준선 및 A01 재개 결과

기준 main: d4fa1842f35eca254cff72c3e2a7d866ae20bdac (설계 PR #27 병합).
설계는 작업자 B 검토를 거쳐 31 ADM / T01~T83 대응이 확정됐다.

## 2026-10-21 실행 결과

| 검증 | 결과 | 증거 |
|---|---|---|
| 전체 build | PASS (번들 크기 경고 있음) | evidence/resume-build.log |
| 전체 unit/regression | frontend 57 + backend 69 = 126 PASS | evidence/resume-tests.log |
| 실제 HTTP | 9 PASS, 독립 Nest listener, 실제 DB 불필요 | evidence/resume-api.log |
| 실제 브라우저 | 새로고침, false 보존, 두 탭 CAS, 공통 DTO/멱등키, UI 저장/복구 PASS | evidence/resume-browser.log, a01-browser.png |
| 기존 HQ/US/MX 화면 | 캡처 및 화면 확인 | baseline-KR.png, baseline-US.png, baseline-MX.png |

브라우저 다운로드 차단은 해결됐다. 테스트 호스트의 Brotli Chromium 실행 파일을 CHROMIUM_PATH로 지정해 실행했다. 한글 폰트가 없는 테스트 호스트는 ADMIN_SCREENSHOT_FONT_DIR에 Noto Sans KR CSS 디렉터리를 지정해 캡처했다. 화면 DOM 상호작용은 폰트 주입 전 실행한다.

기준선의 me/context는 합성 응답이며 운영 로그인 검증이 아니다. HQ는 기존 로컬 거래처 fixture, US/MX는 기존 GLOBAL 화면의 빈 목록을 확인했다. 실제 DB/ERP 업무 성공을 의미하지 않는다. 원본 account seed는 변경하지 않았다.

## 구현된 기반

- 명시적 LEGACY/API_MOCK/BROWSER_MOCK 선택. production mock 거부.
- 독립 MockAppModule, fixture identity/session, mock 전용 issuer/audience/key, 로그인/refresh/logout.
- domain별 strict Zod, scope/override/ScopeVersion 계약, 공통 draft command 및 두 AdminClient.
- 회사 격리, rollback, revision CAS, 멱등 receipt와 events 원자 저장. 무변경 조회/replay는 dataset revision 유지.
- 브라우저 Web Locks와 localStorage envelope. A01 검증 화면에서 저장/조회 가능.
- 기존 LEGACY auth는 수정하지 않았으며 SQL stub 기반 실제 HTTP login/refresh/logout T60 PASS.

작업자 B가 발견한 5개 결함(무변경 revision, companies 격리, 오류 계약, 혼합 payload/overrides, COMPANY_PROFILE scope)은 수정 후 정적 재검토에서 해소 확인. 이 확인은 A01 전체 또는 A02~A11 승인과 다르다.

## 다음 구현 경계

A01 기반은 동작하지만 전체 단계 승인 전 확정 DTO와 publicId/fixture mapping, 모드 간 HTTP UI parity 및 잔여 계약 검토를 마무리해야 한다. A02~A11은 아직 완료되지 않았다. RESET/lock/registry 의미 검증과 게시·rebase 엔진은 A04에서 연결한다. 관리자 31개 화면, 조직/사용자 CRUD, MFA, 런타임 거래처 반영, 승인/ERP 엔진 및 전체 인수검증은 미완료다. 코드 PR #28은 draft로 유지하며 main에 병합하지 않았다.

## 재현

1. pnpm install 및 pnpm build
2. pnpm test / pnpm test:admin:api
3. CHROMIUM_PATH=/path/to/chromium pnpm test:admin:browser
4. CHROMIUM_PATH=/path/to/chromium pnpm test:admin:baseline
5. API: CRM_MOCK_JWT_SECRET=<32자 이상 별도 키> pnpm dev:admin:api
6. 프런트: pnpm dev:admin:web 또는 pnpm dev:admin:browser

API 목업 계정: homeCompanyCode HQ_DEMO/US_A/US_B/MX_A, loginId admin1/sales1/sales2/manager1, 비밀번호 DemoOnly!2026 (합성 시연 전용). localhost:3001 API와 localhost:5173 프런트를 사용한다. 세션은 메모리이며 API 재시작 시 초기화된다.
