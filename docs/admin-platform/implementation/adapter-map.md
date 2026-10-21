# 기존/신규 연결 상태

| 기존 경로 | 새 연결 및 상태 |
|---|---|
| frontend/src/main.tsx → App.tsx | 기본 LEGACY 유지. 명시 mock 모드만 AdminMockApp 검증 화면 |
| packages/contracts/src/admin | strict domain DTO, scope/override 계약, 회사 fixture, 공통 draft command |
| backend/src/mock-main.ts | 독립 MockAppModule, DB bootstrap 없이 HTTP 실행, 미지원501 |
| backend/src/modules/admin | identity/session fixture + memory repository + mock controller |
| frontend/src/admin/client | BrowserMockAdminClient / HttpAdminClient, 공통 command / HTTP header 계약 |
| backend 기존 auth/controller/guard | 수정 없음. tests/admin/legacy-auth.cjs SQL stub HTTP 회귀 |
| account-sandbox / field profiles / screen-registry | 원본 보존. A05 runtime 연결 미구현 |
| 기존 숫자 companyId ↔ 신규 UUID | LEGACY 응답 숫자 유지. 신규 합성 COMPANY_IDS UUID 별도. 실제 데이터 mapping 미구현 |
| 기존 interface handlers | 원본 유지, A09 MOCK 연결 미구현 |

A01 화면은 어댑터 검증용이며 관리자 전체 UI가 아니다. API actor는 인증 세션에서 도출한다. 브라우저 actor는 합성 시연 값으로 실제 보안 경계가 아니다.
