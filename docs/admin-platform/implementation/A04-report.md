# A04 설정 상속·버전·게시 최소 기반

2026-10-21 · ADM-07/26 · 기준 `2f1dca25cb1b14d67c45d6086b61e6c27b89f62e` (PR #28 A03).
A04 코드 검토: 작업자 B 승인. PR #28은 A00–A11 전체 완료 전이므로 초안을 유지한다.

## 구현

- 공통 `resolver.ts`: stable key 배열 SET/REMOVE_ITEM, false/0/빈 문자열 유지, RESET 정규화, 경로 중복·위험 속성·잠금 경로·스키마 검증. 합성 FIELD/account/taxId 필수 항목은 변경·삭제 차단.
- 공통 `ConfigurationEngine`: COMMON→TEMPLATE→COUNTRY→COMPANY의 불변 부모 버전, 초안 묶음 검증과 hash, 불변 문서/ScopeVersion/회사 release, expected pointer CAS, 이벤트·receipt 원자 쓰기, 즉시 게시, 이전 설정을 새 release로 복원.
- 부모 게시 및 rebase apply는 기존 회사 ACTIVE를 변경하지 않는다. rebase preview는 actor/hash/current/10분 TTL에 바인딩되고 충돌·만료·수정 시 적용하지 않는다.
- 회사 생성 transaction에서 부모 참조와 profile baseline을 고정한다. 별도 configScopes COMPANY 레코드에 보관해 회사 조회·수정 revision을 불필요하게 변경하지 않는다. profile 초안은 현재 활성 release의 부모를 우선 사용한다.
- 초안은 법인 scope 소유권으로 저장한다. 플랫폼 관리자가 만든 법인 초안도 해당 법인 관리자가 편집하고 중복 생성은 거부된다.
- 게시·검증·rebase·rollback은 현재 세션, config 권한, domain/path 위임 상한을 transaction 안에서 재검사한다. SECURITY 게시 통합은 A10 오류로 명시 차단한다.
- `MockController`와 `BrowserSecurityClient`에 동일 엔진을 연결했다. 명세의 config validate/preview/version/rebase API와 scope API, 회사 releases API를 제공한다. validate의 companyId 생략은 현재 회사, rebase apply는 previewId에서 scope를 조회한다.
- `/admin/configuration`, `/admin/releases`: 범위 선택, 기능 checkbox 초안, 상속 복원, 검증 결과, 즉시 게시, 부모 변경 비교·적용, 게시 이력·복원, 충돌 비교. 일반 업무 사용자에게는 게시된 설정과 releaseId만 보여준다.
- `/api/me/context`에 releaseId를 제공하고 runtime/account 쓰기는 활성 release와 다른 요청을 CONFIG_CHANGED로 거부한다. 실제 업무 필드·메뉴 renderer 통합은 A05다.

## 실행 검증

| 묶음 | 결과 | 증거 |
|---|---|---|
| pnpm build | PASS | evidence/a04-build.log |
| pnpm test | 기존 단위 131 PASS (frontend 57/backend 74) | evidence/a04-unit.log |
| A04 공통 엔진 | 7 PASS | evidence/a04-tests.log |
| 기존 HTTP 40 + 신규 A04 HTTP 1 | 41 PASS | evidence/a04-tests.log |
| pnpm test:admin:configuration-ui | 양 모드 실제 Chromium PASS | evidence/a04-ui.log |
| 작업자 B 독립 실행 | A04 8/8, 기존 API/A02/A03 38/38 PASS | evidence/a04-worker-b*.log |
| git diff --check | PASS | 커밋 전 확인 |

`a04-tests.log`의 48개는 A04 공통 7 + HTTP 41이며, pnpm test의 131개와 중복되지 않는다. 총 단위 138, HTTP 41이다.

UI: 초안 저장→검증→게시→RESET→재게시→rollback→sales1 조회. BROWSER_MOCK 두 탭 동일 revision 저장에서 성공 1/409 1. Browser 공통 엔진에서 상위 공통 게시→템플릿 rebase/게시→국가 rebase/게시→회사 rebase/게시를 실행해 마지막 회사 게시 전 불변, US_B 불변을 확인했다. API_MOCK의 실제 HTTP에서 일반 사용자 게시 403/타 회사 404, 초안 소유권·중복, 동시 게시 성공 1/409 1, profile metadata를 가진 회사의 A02 수정도 확인했다. DB/ERP/EMAIL 외부 호출 0.

| 인수 항목 | A04 결과 |
|---|---|
| T04 | 잠금 필드 제거 검증 거부 PASS (합성 registry fixture) |
| T09/T45 | 기존 HTTP revision CAS + 브라우저 두 탭 성공1/충돌1 PASS; 충돌 비교 UI 연결 |
| T10 | 검증 후 초안 수정 게시 거부 PASS |
| T11/T56 | 부모 불변 pin, 명시 rebase, 회사 게시 전 불변/US_B 격리 PASS |
| T57 | false/0/빈 문자열, key 삭제/RESET, lock, 게시 경합, stale/conflict rebase PASS |
| T25/T44 기반 | rollback 새 ID, profile 원복, sequence/security/membership/account/session 보존, idempotency/실패 transaction 불변 PASS |
| T33/T43-INTEGRATION/T81 | A10 예약·보안정책 게시·통합 영향분석 범위, 이번 PASS 아님 |

## B 지적 및 조치

1. 플랫폼 초안 소유권·중복 → scope 기준 소유권/유일성, HTTP 회귀.
2. 회사 strict schema metadata 오류 → 내부 metadata 제외 후 업무 속성 검증, HTTP 회귀.
3. 신규 회사 부모 pin 누락 → 생성 transaction 초기화 및 별도 pin 저장.
4. 위임 상한 우회 → 대상 문서별 checkDraft 재검사.
5. API 경로·입력 차이 → 명세 aliases와 생략 입력 지원.
6. rebase 오류 계약 → preview conflicts 및 apply REBASE_CONFLICT, stale 차단.
7. RESET 표시/늦은 응답 → draftEffective와 generation guard.
8. profile rollback 및 초안 부모 → immutable profileBaseline, 활성 부모 우선 사용, 회귀 테스트.

B 승인은 코드와 독립 명령 검증에 대한 승인이다. UI는 주 작업자의 실제 실행 증거이며 실제 OTP나 A10 통합 승인이 아니다.

## 재현 및 제한

- `pnpm build && pnpm test`
- `pnpm test:admin:configuration`
- `pnpm test:admin:api && pnpm test:admin:security`
- `CHROMIUM_PATH=<실행 가능한 Chromium 경로> pnpm test:admin:configuration-ui`
- `pnpm dev:admin:browser` 또는 API/web mock 실행 후 `/admin/configuration`. US_A/admin1, API 암호 DemoOnly!2026. 공통/템플릿/국가는 HQ_DEMO/platform1.

이번 호스트의 Playwright 자동 브라우저 다운로드는 손상 응답으로 실패했다. 이미 제공된 @sparticuz Chromium 압축본을 로컬에서 풀어 실제 UI 검증을 완료했다. 캡처에는 호스트 제공 한국어 폰트를 주입했고, 브라우저 네트워크 외부 호출은 차단했다.

schemaVersion=1/datasetId=ADMIN_DEMO_V1 유지, 기존 계정 저장소 초기화 없음. API memory 재시작 시 목업 상태는 초기화된다. mock runtime의 상속·게시 기반만 완료했으며 모든 domain 편집 UI·전체 업무 화면 반영은 A05 이후다. 현재 FEATURE 폼은 account/activity 합성 기준이다. 회사 templateCode 전환의 전체 활성화, 예약·전체 영향분석, SECURITY 게시·정책 강화는 A10으로 남는다. 실제 ERP/SQL/SSO/TOTP/운영 배포/외부 발송은 수행하지 않았다. 빌드의 500KB 청크 경고는 비차단이다.

다음 단계: A05 기능·메뉴·화면·그룹·필드·조건·확장 필드와 거래처 수직 구현.
