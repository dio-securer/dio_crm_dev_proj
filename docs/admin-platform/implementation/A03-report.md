# A03 역할·데이터·필드 권한과 DEMO MFA

2026-10-21 · 대상 ADM-04/05/06/13/28 · 검토 코드 커밋 `2fc8cd6`.
기준: PR #27 확정 문서와 PR #28 A02 완료 상태. 작업자 B가 이 코드의 A03 게이트를 승인했고, 보안 HTTP 19/19를 독립 재실행했다.

## 구현과 기존 경로 연결

- `permissions.ts`: 등록 permission allowlist, grants/denies, SELF/ORG/SUBTREE/COMPANY/SHARED, 필드 ALLOW/DENY/UNSET, read DENY→write DENY, LAST4 결합. 관리 전용 admin1에는 업무 조회를 자동 부여하지 않는다. 관리자의 업무 역할 배정 권한과 개인 업무 조회 권한은 별개다.
- `security.ts`: 역할 저장·배정, 데이터/필드 상한, 위임과 만료, 세션 요약·회수, 법인 MFA 초기화 요청/전역 승인·실행, 거래처 read/create/update 권한 적용을 공통 엔진으로 구현했다.
- `mock-auth.ts`와 `mock.module.ts`: API_MOCK 인증을 공통 엔진에 연결하고 기존 A02 변경 경로, 초안, runtime/accounts에 권한 검사를 적용했다. 변경 트랜잭션 안에서 세션/권한을 재검사해 인증 직후 회수와 쓰기의 경합을 막는다. LEGACY SQL/JWT 경로는 변경하지 않았다.
- `BrowserSecurityClient`: 같은 엔진을 Web Locks 브라우저 repository에서 실행한다. 브라우저 권한은 DEMO이며 보안 경계로 주장하지 않는다.
- `SecurityPages`/`MockEntry`: 역할·복수 필드/데이터 범위·배정·위임·세션·MFA 초기화·정책 초안 폼과 DEMO MFA 등록/확인/skip UI를 연결했다. 복수 필드 DENY/범위 항목은 한 항목 수정 시 보존한다.

화면 경로: `/admin/roles`, `/admin/data-scopes`, `/admin/field-permissions`, `/admin/admin-delegation`, `/admin/security-policies`, `/admin/sessions`, `/admin/mfa-reset-requests`. 데이터/필드 권한은 role DTO의 typed 하위 구조로 편집한다.

## MFA와 세션

OFF/OPTIONAL/REQUIRED 및 상위·회사·활성 역할의 최댓값을 적용한다. 정책 fixture는 SECURITY의 mfaPolicy.default/roleOverrides를 읽고, 간단한 테스트 fixture의 policy도 지원한다. 미등록 OPTIONAL만 skip 가능하다. 제한 JWT는 별도 audience와 MFA_PENDING 용도이고 업무 API는 403으로 거부한다. 중간 응답에는 access/refresh를 발급하지 않는다.

DEMO provider(코드 `123456`)만 지원한다. 챌린지 5분, 실패 5회 잠금 15분, idle 30분/max 8시간, MFA freshness 30분이다. 성공·등록·챌린지 소비·업무 세션 발급은 하나의 저장소 트랜잭션으로 처리한다. 잘못된 코드 재전송의 동일 key는 실패 횟수를 중복 증가시키지 않는다. refresh는 idle/max·권한·현재 MFA 정책을 재검사한다.

회사 전환에서 추가 MFA가 필요하면 기존 회사 세션은 인증 완료 전까지 유지한다. 전역 reset은 모든 법인 세션/진행 챌린지/등록을 원자 회수한다. 법인 요청은 전역 상태를 바꾸지 않고, 전역 승인에는 identity revision/24시간 TTL/idempotency를 적용한다. 전역 영향 membership은 플랫폼 조회에서만 표시한다.

Memory adapter의 단일 dataset 직렬 트랜잭션과 Browser의 dataset Web Lock으로 다회사 회수를 원자 처리한다. 여러 잠금을 다른 순서로 획득하지 않아 교착을 만들지 않는다. 운영 DB 잠금 구현은 범위 밖이다. 세션 활동시간은 운영 상태이므로 조회 요청 시 dataset revision이 증가할 수 있다. 기존 회귀 테스트는 업무 collection/events/receipts 불변과 세션 heartbeat를 분리했다. 순수 repository 조회의 revision 불변 테스트는 유지했다.

## 실행 검증

| 명령 | 결과 | 증거 |
|---|---|---|
| pnpm build | PASS | evidence/a03-build.log |
| pnpm test | 131 PASS: frontend 57 + backend 74 | evidence/a03-unit.log |
| pnpm test:admin:api | 기존 HTTP 21/21 | evidence/a03-api.log |
| pnpm test:admin:security | 신규 보안 HTTP 19/19 | evidence/a03-security.log |
| pnpm test:admin:security-ui | API_MOCK/BROWSER_MOCK 실제 UI + 브라우저 공통 엔진 경계 PASS | evidence/a03-ui.log |
| pnpm test:admin:entry | A01/A02 양 모드 UI 회귀 PASS | evidence/a03-entry.log |
| pnpm test:admin:browser | reload/cross-tab CAS/초안 DTO PASS | evidence/a03-browser.log |

최종 로그 점검에서 이전 entry 실행의 조직 저장 대기 timeout과 일부 security 로그의 끝부분 누락을 발견했다. 코드 변경 없이 고정 커밋에서 Node 실행 명령으로 재실행해 보안 HTTP 19/19, 양 모드 entry, browser CAS의 종료 상태와 완전한 출력을 확인했다. 일시 실패 원인은 확정하지 않았으며 진단 기록은 evidence/a03-entry-transient-failure.log에 보존한다. 최종 증거는 a03-entry.log/a03-security.log/a03-browser.log다.

브라우저 명령은 `CHROMIUM_PATH=/tmp/crm-chromium`, 한글 캡처는 `FONTCONFIG_FILE=/tmp/crm-fonts/fonts.conf`로 실행했다. 재현 환경에서는 설치된 Chromium 경로와 한글 글꼴을 사용한다. 빌드의 기존 bundle size 경고는 오류가 아니며 code splitting은 이번 보안 기능 범위에서 변경하지 않았다.

검증 내용: T07 숨김/마스킹 필드 query·정렬·필터·집계 거부, T39~T43-UNIT 인증 분기·경합·회수·정책 강화, T62/T63 요청/전역 실행 분리·stale/만료·중복, T66 DENY/UNSET/LAST4, T69 본인·자손·형제·타조직 GET/PATCH, T70 FIELD 위임·SECURITY/상위권한 거부·만료. 신규 테스트 수는 인수 TC 수와 다르다.

API T69의 ORG/SUBTREE/COMPANY는 서로 다른 3/4/6건을, 브라우저는 별도 fixture의 2/3/5건을 반환하며 상세/PATCH도 검증한다. 실제 화면에서 두 모드의 MFA 오답/성공, 다중 필드·범위 저장 보존, 세션 회수 후 재로그인과 저장값 유지를 확인했다. 캡처: evidence/a03-{mfa,permissions}-{API_MOCK,BROWSER_MOCK}.png. 전체 과정에서 실제 ERP/외부 발송 및 브라우저 외부 egress는 0회다.

## 작업자 B 지적 조치

1. 관리 전용 계정의 자동 업무 조회 제거.
2. 역할 생성과 배정 모두 액션·데이터·필드·마스킹 상한 검사. 업무 권한 배정 예외가 delegation.manage 등 상위 관리 액션으로 확장되지 않도록 별도 검사.
3. 빈 orgIds를 이용한 명시 조직 상한 우회 거부.
4. API/Browser 초안 권한을 config.read/edit 기준으로 통일.
5. 다중 필드/범위 편집 시 다른 항목 보존.
6. 자손·형제·타조직을 구분하는 양 모드 데이터 범위 테스트 추가.

2026-10-21 작업자 B 최종 판정: `2fc8cd6` A03 코드 게이트 승인. A04 진입을 막는 미해결 지적 없음. 독립 보안 HTTP 19/19 PASS.

## 시연

`pnpm dev:admin:api` + `pnpm dev:admin:web` 또는 `pnpm dev:admin:browser`.
기본 US_A/admin1/DemoOnly!2026으로 관리 화면에 들어간다. 플랫폼 관리: HQ_DEMO/platform1. 모든 인증값은 합성 DEMO 전용이다.

1. 권한·보안 관리 → 역할 생성: account.read/update, SELF, phone LAST4, secret DENY, 역할 MFA REQUIRED 선택.
2. 사용자/소속 목록에서 sales1 membership UUID와 최신 revision을 확인해 역할 배정한다. 관리 변경 후 기존 세션이 거부되면 종료 후 다시 로그인한다.
3. sales1로 로그인하면 DEMO MFA 등록·확인이 필요하다. `123456` 검증 전에는 업무 세션이 없다.
4. admin1은 회사 MFA 초기화 요청만 등록할 수 있다. platform1은 전역 심사에서 승인/거절하거나 전역 초기화를 실행한다.

## 후속 단계 경계

A03은 실제 TOTP/Google·Microsoft Authenticator/SSO 도입이 아니다. SECURITY 화면은 초안 저장이며 보안 정책의 게시·rollback·강화 통합(T43-INTEGRATION)은 A10이다. 사용자 거래처 동적 화면과 전체 마스킹 교체 UI(T67), 모바일 전체 흐름(T83)은 A05 이후다. 전체 31 ADM/83 TC 완료나 A04~A11 완료를 주장하지 않는다. 유효 필드 예제는 합성 account name/phone/secret/ownerMembershipId이며 기존 전체 업무 화면/확장 필드 연결은 A05 범위다.
