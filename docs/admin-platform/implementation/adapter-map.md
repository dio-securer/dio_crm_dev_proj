# 기존/신규 adapter 연결표

| 기존 경로 | 신규 연결 및 경계 |
|---|---|
| frontend/src/main.tsx → App.tsx | LEGACY 그대로. 명시 mock 모드일 때만 admin/MockEntry.tsx |
| market/globalization-context.tsx | LEGACY provider 그대로. mock은 분리 context 사용; API 실행모드 일치 확인 |
| account-sandbox.ts / account-model.ts | 원본 seed·storage 보존. A05 runtime adapter 후속 |
| app/screen-registry.ts, screen-profile.ts | HQ/GLOBAL 원본 보존. 관리자 설정 효과 연결은 A05 |
| 기존 숫자 JWT companyId/userId | 기존 AuthService 유지, SQL stub login/refresh/logout 회귀. 신규 UUID로 덮어쓰지 않음 |
| backend/src/main.ts / app.module.ts | 기존 DB bootstrap 유지. mock-main.ts는 MockAppModule만 로드 |
| auth/auth.service.ts | LEGACY 유지. admin/mock-auth.ts는 주입된 합성 identity/session 저장소와 별도 issuer/audience/key |
| frontend/admin/client/admin-client.ts | HTTP/Browser AdminClient. 양쪽 공통 drafts command 사용 |
| contracts/admin/core.ts | versioned envelope, transaction, seed, errors, 모드 거부 |
| contracts/admin/schemas.ts,versions.ts,identity.ts | 도메인별 payload, scope override, identity/session/MFA 확장 계약 |
| integration enqueuePending/result handlers | 기존 동작 불변. 새 ERP mock binding은 A09 미구현 |

현재 폼은 A01 초안 명령 검증용이다. 권한/MFA 실행 완성은 A03, 설정 상속/게시 엔진은 A04, 사용자 거래처 수직 연결은 A05이며 해당 범위를 이 표만으로 완료 처리하지 않는다.
