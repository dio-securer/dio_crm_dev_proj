# 기존/신규 adapter 연결표

| 기존 경로 | 신규 연결 및 경계 |
|---|---|
| frontend/src/main.tsx → App.tsx | LEGACY 그대로. 명시 mock 모드일 때만 admin/MockEntry.tsx |
| market/globalization-context.tsx | LEGACY provider 그대로. mock은 분리 context 사용; API 실행모드 일치 확인 |
| account-sandbox.ts / account-model.ts | 원본 seed·storage 보존. MockAccountRuntimePort는 별도 관리자 목업 저장소를 사용 |
| app/screen-registry.ts, screen-profile.ts | HQ/GLOBAL registry 재사용. 공통 프로필 기반 AccountRuntimePage에 게시된 설정 연결 |
| 기존 숫자 JWT companyId/userId | 기존 AuthService 유지, SQL stub login/refresh/logout 회귀. 신규 UUID로 덮어쓰지 않음 |
| backend/src/main.ts / app.module.ts | 기존 DB bootstrap 유지. mock-main.ts는 MockAppModule만 로드 |
| auth/auth.service.ts | LEGACY 유지. admin/mock-auth.ts는 주입된 합성 identity/session 저장소와 별도 issuer/audience/key |
| frontend/admin/client/admin-client.ts | HTTP/Browser AdminClient. 양쪽 공통 drafts command 사용 |
| contracts/admin/core.ts | versioned envelope, transaction, seed, errors, 모드 거부 |
| contracts/admin/schemas.ts,versions.ts,identity.ts | 도메인별 payload, scope override, identity/session/MFA 확장 계약 |
| integration enqueuePending/result handlers | 기존 동작 불변. 새 ERP mock binding은 A09 미구현 |

A01~A05의 단계별 구현·검증은 각 보고서를 기준으로 한다. A06~A11 통합은 후속이다.

## A03 연결
- SecurityEngine + MemoryAdminRepository: API_MOCK 권한/MFA/세션/초기화.
- SecurityEngine + BrowserAdminRepository: BROWSER_MOCK 동일 정책과 원자 저장.
- MockAuth: 전용 JWT issuer/audience, DEMO provider, session-backed guard.
- MockController: 기존 A02 API와 draft/runtime/accounts에 공통 권한 적용.
- BrowserSecurityClient + SecurityPages: 역할/범위/필드/위임/세션/정책 초안 UI 및 DEMO MFA.
- LEGACY 기존 SQL/JWT 유지. 실제 ERP/OTP/SSO 미연결.

## A05 연결
- 공통 account-profile-* → 기존 field-profiles re-export 및 accountBaseline 변환.
- ConfigurationEngine → A05 도메인 합성 검증·공용보기 작성 상한.
- SecurityEngine → active release 거래처 CRUD, 조건·타입·마스킹·검색 검사.
- AccountDesigner → A04 초안·검증·게시; AccountRuntimePage → MockAccountRuntimePort → HttpAdminClient/BrowserSecurityClient.
- role.read field-registry → SecurityPages의 등록/확장 필드 선택기. key/type/active만 반환.
