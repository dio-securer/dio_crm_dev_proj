# 관리자 플랫폼 DEMO 사용 안내

이 안내는 PR #28의 BROWSER_MOCK/API_MOCK 구현을 대상으로 한다. 실제 OTP·SSO·ERP·EMAIL 연결과 운영 배포는 포함하지 않는다.

## 시작

Node 및 pnpm 9 환경에서 저장소 의존성을 설치하고 `pnpm build`를 실행한다.

- 브라우저 저장 방식: `pnpm dev:admin:browser`
- API 메모리 방식: 별도 터미널에서 `pnpm dev:admin:api`, `pnpm dev:admin:web`
- 표시되는 Vite 주소의 `/admin/configuration`으로 접속한다. API backend 기본 포트는 3000이며 Vite가 `/api`를 프록시한다.
- 전체 검증: `CHROMIUM_PATH=/path/to/chromium pnpm test:admin:all`. 기본 Playwright Chromium이 설치되어 있으면 경로 지정은 생략한다.

## 계정과 법인

API_MOCK 비밀번호는 `DemoOnly!2026`, DEMO MFA 코드는 `123456`이다. 운영 계정·실제 인증번호가 아니다.

| 로그인 법인 | ID | 용도 |
|---|---|---|
| HQ_DEMO | platform1 | 플랫폼 관리, 상위 설정, 보안 정책, 전역 DEMO 초기화 |
| HQ_DEMO / US_A / US_B / MX_A | admin1 | 해당 법인 관리; 업무 데이터 전체 조회 권한을 자동 부여하지 않음 |
| 같은 네 법인 | sales1 / sales2 | 영업 업무, 담당 데이터, 승인 제출 |
| 같은 네 법인 | manager1 | 팀 범위 업무 및 승인 |
| US_A | shared1 | US_A/US_B 소속 전환 및 저장/폐기/취소 시연 |

법인 코드와 API UUID는 다르다. 고정 UUID와 소속은 `packages/contracts/src/admin/core.ts`의 manifest/seed를 사용한다. HQ_DEMO는 HQ 화면, 다른 법인은 GLOBAL 화면이다. US_A/US_B는 같은 국가에서 서로 다른 회사 설정을 유지한다. 업무 명칭·필드 라벨은 ko-KR/en-US 전환이 가능하다. 관리자 운영 폼의 안내 문구는 현재 한국어 locale 리소스를 사용한다.

## 시연 순서

1. **조직·권한:** `/admin/companies`, `/admin/organizations`, `/admin/users`에서 법인·조직·사용자와 소속을 관리한다. `/admin/roles`에서 데이터 범위와 필드 DENY/마스킹을 조정한다. 변경 후 기존 세션 회수를 확인한다.
2. **설정 편집:** `/admin/features`, `/admin/menus`, `/admin/screens`, `/admin/sections`, `/admin/fields`, `/admin/list-views`, `/admin/actions`, `/admin/rules`, `/admin/extension-fields`에서 typed 폼을 편집한다. 합성 샘플 미리보기는 실제 사용자로 가장하지 않으며 데이터를 저장하지 않는다.
3. **상속·게시:** `/admin/configuration`에서 출처·부모 버전과 초안을 확인하고 검증한 다음 게시한다. 부모 변경은 rebase와 회사 게시 전까지 기존 화면을 바꾸지 않는다. 다른 관리자가 수정한 초안은 다시 조회·비교·검증한다.
4. **기준정보:** `/admin/translations`, `/admin/codes`, `/admin/numbering`, `/admin/calendars`에서 용어·코드·번호·휴일을 편집하고 게시한다. 번호 미리보기는 번호를 소모하지 않는다. 기존 승인 건의 달력·기한 snapshot은 유지한다.
5. **승인:** `/admin/workflows`, `/admin/approval-policies`, `/admin/approval-routes`에서 DEMO_ONLY 정책을 명시적으로 설정·게시한다. 영업 사용자가 `/admin/approval-operations`에서 문서를 생성·제출하고 manager1이 승인/반려한다. ALL/ANY, 회수·수정·재상신, 기간 대결·회수·재배정 이력을 확인한다. 미확정 GLOBAL 결재선을 자동 승인하지 않는다.
6. **알림:** `/admin/notifications`에서 IN_APP/EMAIL 채널과 ko/en 템플릿을 설정하고 미리보기한다. `/notifications`에서 본인 수신 알림을 확인한다. EMAIL은 MOCK_SENT 이력만 기록한다.
7. **ERP:** `/admin/integration-profiles`에서 MOCK profile·매핑을 미리보기하고 게시한다. `/admin/integration-runs`의 DEMO 데이터 준비 후 SUCCESS, BUSINESS_REJECTED, TRANSIENT_FAILURE, TIMEOUT, DELAYED, DUPLICATE, OUT_OF_ORDER를 실행한다. 실패 건만 사유와 revision을 확인해 재시도한다. 거래처의 ERP 모의 요청 액션도 사용할 수 있다.
8. **운영:** `/admin/releases`에서 예약·취소·수동 예약 실행·복원을 확인한다. 자동 백그라운드 스케줄러가 아닌 목업 실행 명령이다. 복원은 새 release를 만들며 업무·번호·보안 회수 이력을 되돌리지 않는다.
9. **DEMO 보안:** platform1으로 `/admin/security-policies`에서 SECURITY 초안을 저장한 뒤 설정 화면에서 검증·게시한다. REQUIRED가 적용되면 영업 사용자도 DEMO MFA를 통과해야 한다. 실제 OTP 공급자는 연결하지 않는다.

## 데이터 수명과 초기화

BROWSER_MOCK는 `dio-crm:admin:v1:ADMIN_DEMO_V1`에 저장되어 새로고침 후 유지된다. 같은 브라우저 탭의 경쟁 저장은 Web Locks와 revision으로 보호하며 Web Locks가 없으면 쓰기를 차단한다. API_MOCK는 서버 메모리 저장이므로 프로세스 재시작 시 결정적 seed로 복원되고 기존 세션은 사용할 수 없다.

platform1의 **DEMO 데이터 초기화**에서 미리보기로 대상 회사·삭제/복원 수·회수 세션 수를 확인한 다음 사유를 입력하고 실행한다. 미리보기 유효기간은 10분이며 중간 변경·만료 시 다시 미리보기해야 한다. ADMIN_DEMO_V1만 초기화하며 원본 CRM 및 다른 저장 namespace는 보존한다. 실행 후 모든 DEMO 세션을 폐기하므로 다시 로그인한다.

## 검증 범위와 한계

- LEGACY 인증 회귀는 SQL stub 기반이며 운영 DB 로그인 검증이 아니다.
- ERP interface는 기존 IF-ERP-002/004/007 의미를 참고한 등록된 목업 handler다. 실제 전송·운영 payload 확정을 뜻하지 않는다.
- SECURITY 게시 통합은 DEMO 정책으로 구현했다. 실제 OTP 비밀키 저장, SSO, 복구 본인확인은 후속 범위다.
- 환경별 DB·메일·ERP 자격증명이 필요한 검사는 목업 통과와 별도로 보고한다.
- production 설정에서는 mock 기동을 거부한다. PR은 draft로 유지하며 main 병합·운영 배포는 수행하지 않는다.
