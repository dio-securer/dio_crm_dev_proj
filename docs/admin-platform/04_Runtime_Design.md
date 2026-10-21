# 04. 설정·승인·모의 ERP 실행 상세설계

## 1. 설정 상속과 유효 설정
입력은 company membership, release manifest, 사용자 언어다. resolver는 immutable version만 읽는다.
1. COMMON baseline 로드.
2. 회사가 선택한 HQ/GLOBAL TEMPLATE version 적용.
3. COUNTRY version 적용.
4. COMPANY version 적용.
5. 잠금 속성/코드 registry/기능 dependency 검증.
6. 역할별 액션·데이터·필드 권한 적용.
7. 법인 업무 명칭을 선택한 뒤 언어별 번역.
8. schemaVersion, releaseId, contentHash와 property provenance를 반환.

scope마다 parentVersionIds를 고정한다. 부모 초안 변경만으로 하위 회사의 ACTIVE가 바뀌지 않는다. 부모 게시 후 하위 법인은 rebase preview와 별도 게시를 수행한다.

### 병합 규칙
- scalar override: 하위 명시값 우선. false/0/빈 문자열을 “없음”으로 취급하지 않는다.
- override 제거: 상속값 복원 명령으로 해당 patch 제거. null은 nullable 스키마에만 허용.
- 배열: stable key 기준 merge; 삭제는 tombstone. 필수 기본 항목은 삭제 불가.
- order 동률은 stable key 정렬. 등록되지 않은 key/reference는 게시 오류.
- 상위 lockedPaths는 하위 해제 불가. template/국가의 일반 값은 허용 경로 내 override 가능.
- feature 최종 off이면 메뉴/화면/액션 비활성. 다른 기능에 필요한 선행 기능 off는 게시 오류.
- readOnly 최종값은 설정 또는 권한 제한 중 하나라도 참이면 참.
- 필드 읽기 불허 시 JSON 응답 제거; mask는 허용 read 범위 내 표시용 처리.
- business invariant 필수 항목을 숨기면 제공 가능한 서버 기본값 없이는 게시 불가.

### 조건식
허용 op: all, any, not, eq, ne, in, isEmpty, gt, gte, lt, lte.
참조: 등록 필드, document.state, actor.roleCodes, context.companyId.
effects: visible, required, readOnly, actionEnabled. 원본 값을 바꾸는 계산·스크립트는 제외.
동일 target에 서로 다른 effect가 동시에 발생하면 validation conflict로 처리하고 게시를 막는다.
decimal 비교는 부동소수점 대신 decimal 구현을 사용한다. 서버가 최종 검증하며 브라우저 결과를 신뢰하지 않는다.

~~~json
{
  "id": "require_followup_for_priority",
  "trigger": "SAVE",
  "condition": {"op":"eq","field":"x_priority","value":"HIGH"},
  "effects": [{"target":"x_nextContactDate","required":true}],
  "errorKey": "validation.nextContactRequired"
}
~~~
x_nextContactDate는 02 §9의 합성 확장 필드다. 기존 account 필드라고 가정하지 않는다.

## 2. 사용자 문맥·권한
- 인증 → 활성 사용자/membership → 현재 법인 → 기능 → 액션 권한 → 데이터 범위 → 필드 읽기/쓰기 순으로 판단.
- 복수 역할 allow는 합집합이나 명시 deny가 우선한다. 허용 데이터 범위의 합집합도 현재 법인을 넘지 않는다.
- 기존 ALL은 COMPANY로 해석한다. SYSTEM은 자동 다법인 조회가 아니라 명시된 cross-company permission과 membership을 요구한다.
- 기존 BRANCH/DIVISION은 조직 subtree adapter로 매핑한다.
- 사용자 중지·역할 회수·위임 만료 때 permissionVersion을 갱신한다. 기존 JWT만으로 만료 전 권한을 계속 허용하지 않는다.
- JWT의 permissionVersion과 서버 현재값이 다르면 재인증/문맥 갱신. 세션 해지 상태 확인.
- 법인 전환 때 query cache key는 companyId+membershipId+releaseId+permissionVersion이다. 진행 중 이전 회사 요청을 취소하고 contextEpoch가 다른 늦은 응답은 버린다.
- API 오류를 해외 사용자에게 KR 설정으로 조용히 fallback하지 않는다. BROWSER_MOCK만 명시 seed 문맥을 사용한다.

## 3. 명칭과 언어
semanticKey(account.name) → 법인 term override(customer.name) → locale 번역 순서.
번역 fallback: 선택 언어 → 회사 기본 언어 → 템플릿 기본 언어 → 공통 기본 언어. 마지막까지 없으면 key와 누락 표시.
code 값과 API field key는 번역하지 않는다. ko-KR/en-US로 우선 시연한다. MX가 있다는 이유로 스페인어 번역 완료를 가정하지 않는다.
법인 통화/시간대는 locale에서 추론하지 않고 회사 설정을 따른다. 금액 표시 언어 변경은 저장 금액 환산이 아니다.

## 4. 설정 버전 게시
초안 DRAFT → VALIDATED → (SCHEDULED) → ACTIVE → SUPERSEDED.
초안 수정은 validation을 무효화한다. 게시 시 draft revision, dependency hash, active release, registry schema를 모두 재확인한다.
단일 회사의 menu/field/term/workflow 등을 한 release manifest로 묶어 일관되게 활성화한다. 여러 회사 게시에는 개별 결과를 반환하며 전체 원자성을 약속하지 않는다.
예약은 UTC effectiveAt으로 저장하고 회사 시간대로 표시한다. API memory scheduler 재시작 시 예약이 사라지는 한계를 명시한다. Browser mode는 앱 재진입/clock advance 시 적용하며 닫힌 브라우저에서 자동 게시한다고 설명하지 않는다.
게시 실패 시 기존 release 유지. 게시 후 cache invalidate. 진행 중 편집이 이전 release이면 저장 시 409 CONFIG_CHANGED와 최신 정책 차이를 반환한다.
rollback은 이전 내용을 새 릴리스로 만들고 현 registry와 권한으로 재검증한다. 사용자 권한 회수, 이미 기록한 거래, 승인 완료, sequence, extension 값을 되돌리지 않는다.

## 5. 승인 실행
업무 상태와 승인 상태를 분리한다. 신규 샘플 APPROVAL_DEMO_DOCUMENT로 엔진을 먼저 검증하고 기존 activity adapter를 뒤에 연결한다.

### 제출
문서 revision 검증 → 승인 정책 매칭 → route/조건/문서 요약 snapshot → 현재 membership 기반 승인자 해석 → 빈 승인자/자기승인 검사 → instance와 첫 단계 task 생성 → 알림 생성.
정책은 priority 내림차순. 같은 priority의 복수 일치는 오류. 승인 필수인데 정책이 없거나 GLOBAL baseline처럼 승인자가 미확정이면 제출 차단. 시연용 GLOBAL 결재선에는 DEMO_ONLY 표시.

### 상태
| 현재 | 명령 | 결과 |
|---|---|---|
| DRAFT 샘플 문서 | submit | IN_PROGRESS instance |
| IN_PROGRESS | approve 현재 task | 다음 단계 활성화 또는 APPROVED |
| IN_PROGRESS | reject | REJECTED, 남은 task CANCELLED |
| IN_PROGRESS | withdraw 작성자 | WITHDRAWN, 남은 task CANCELLED |
| REJECTED/WITHDRAWN | resubmit | 새 document revision과 새 instance, 이전 이력 유지 |
| APPROVED | approve/reject 재요청 | 동일 idempotency면 기존 결과, 그 외 409 |

병렬 승인: ALL 또는 ANY를 명시. ALL은 모두 승인 시 통과, ANY는 최초 승인 시 통과하며 나머지 task를 CANCELLED 처리. 반려는 ANY에서도 최초 확정 결정이 반려면 단계 반려로 정의한다. 모호한 정책을 UI 도움말에 명시한다. 동시 결정은 instance revision을 잠그고 한 건씩 처리한다.
기본 자기승인 금지; approver selector가 신청자를 반환하면 alternate 또는 승인 관리자 재배정 없이는 제출 불가. 대결은 원승인자·실결정자·기간·사유를 기록하며 대결자도 현재 활성/권한을 검사한다.
진행 중 문서는 잠금. 수정하려면 회수 후 새 revision으로 재상신. 완료 후 변경은 별도 업무 변경 절차이며 관리자 설정이 승인 이력을 수정하지 못한다.
승인자 퇴사/중지 시 자동 승인하지 않는다. BLOCKED 담당자 문제로 표시하고 권한 있는 관리자가 재배정한다.
실행 시작 당시 definitionSnapshot/releaseId를 고정한다. 새 결재선을 게시해도 기존 건은 유지하며 “진행 중 건 일괄 마이그레이션”은 이번 범위 밖이다.

## 6. 알림
승인 요청/승인/반려/지연, 설정 게시, 모의 ERP 성공/실패 이벤트를 지원한다.
(eventId, recipientMembershipId, channel)로 중복을 막는다. 수신자 선택은 허용 법인 범위에서 해석한다. 생성 시 locale와 렌더링된 텍스트를 고정한다.
IN_APP은 사용자 알림함에 기록하고 EMAIL은 mock outbox에 MOCK_SENT로 표시한다. 실제 이메일/메신저 전송 도구는 연결하지 않는다. 영업일 지연 계산은 제출 시 달력 snapshot으로 dueAt을 산출한다.

## 7. ERP 모의 연계
기존 enqueuePending 기본 동작은 유지하고 MOCK adapter를 명시적으로 선택한 호출에만 응답을 생성한다. “ERP 연동됨”은 샘플 상태를 재현한다는 의미이며 실 ERP 연결 성공이라는 의미가 아니다.

### 최소 모의 계약
| 시나리오 종류 | 요청 핵심 | 모의 결과 | 반영 위치 |
|---|---|---|---|
| 거래처 등록 | entityId,companyId,사업자/거래처 필드 | MOCK-ERP-ACC 번호, 승인/반려 | account status와 모의 log |
| 계약 등록 | contract fixture,상품 snapshot,계획 합계 | MOCK-ERP-CON 번호, 승인/실패 | 샘플 계약 상태 |
| 주문 등록 | contract fixture,items,deliveryAddress | MOCK-ERP-ORD 번호, 접수/거부 | 샘플 주문 상태 |
| 수금 수신 | externalEventId,contractId,amount,date | 수금 추가/정정 version | 수금 read model |
| 납품 수신 | externalEventId,orderId,itemId,quantity,date | 납품 추가/정정 version | 납품 read model |

실제 기존 interfaceCode를 조사해 위 의미와 매핑한다. 새로운 번호를 추정해서 기존 IF-ERP 번호에 덮어쓰지 않는다. 계약·주문·수금·납품은 엔진 테스트용 fixture이며 이번 단계에서 전체 업무 화면 재구현을 요구하지 않는다.

### transport 상태와 업무 승인 상태
REQUESTING → SUCCESS / FAILED / TIMED_OUT.
SUCCESS는 transport 응답 처리가 성공했다는 뜻이다. payload의 businessOutcome=APPROVED/REJECTED/PENDING과 별도이며, 수신이 성공했어도 거래처 승인 반려가 가능하다.
실패 재시도는 원 requestId와 business idempotency를 유지하고 attempt만 증가한다. 새 업무 요청은 새 idempotencyKey를 사용한다.
모든 응답에 mode=MOCK, scenarioId, eventId, externalMockCode를 넣고 UI에 “ERP 모의 승인”을 표시한다.

| 시나리오 | 동작 |
|---|---|
| SUCCESS | 결정된 mock 코드와 성공 business outcome |
| BUSINESS_REJECTED | transport SUCCESS + 업무 REJECTED/사유 |
| TRANSIENT_FAILURE | 첫 attempt 실패, 다음 attempt 성공 |
| TIMEOUT | 응답 적용 없이 TIMED_OUT; 재시도 가능 |
| DELAYED | fake clock 경과/수동 응답 주입 전 REQUESTING |
| DUPLICATE | 같은 eventId 재수신, 업무 적용 1회 |
| OUT_OF_ORDER | 최신 event version보다 낮은 응답 무시·이력 기록 |

idempotencyKey가 같고 payloadHash가 다르면 409. entity가 다른 법인이면 응답 적용 전 거부한다.
terminal outcome 뒤 모순되는 응답은 무시/충돌 로그 처리한다. TIMED_OUT 후 늦은 성공은 현재 업무 revision과 request identity가 유효할 때 단 한 번 적용한다. 새 요청으로 대체되었다면 stale event로 기록한다.
수금/납품 정정은 externalEventId+version으로 동일 외부 건의 최신 상태를 갱신한다. 금액/수량은 누적 덧셈을 반복하지 않는다.
모의 자동 진행은 fake clock과 deterministic seed를 사용한다. 무작위 결과를 테스트 통과 근거로 사용하지 않는다.

## 8. 샘플 데이터 유지
기존 account-sandbox 원본 seed를 덮어쓰지 않는다. migration adapter는 기존 localStorage 백업 key를 1회 만들고 schemaVersion을 기록한다. 실패하면 이전 데이터 유지 및 오류 표시.
데모 fixture에는 회사/사용자/조직/역할/설정/문서/연계 이벤트 식별자를 고정한다. reset은 이 fixture dataset만 복원하고 브라우저 토큰이나 다른 앱 저장 데이터를 지우지 않는다.

## 9. v1.1 모호성 해소 및 실행 규칙

### 9.1 동시 저장와 설정 검증
BROWSER_MOCK 쓰기는 dataset 단위 Web Locks API exclusive lock 안에서 최신 envelope를 다시 읽고 revision 비교 후 단일 envelope로 저장한다. 지원하지 않는 브라우저는 쓰기를 차단하고 API_MOCK 사용 안내를 표시한다. storage event 감지만으로 원자성을 보장한다고 하지 않는다. 공통 설정과 회사 변경이 함께 있으면 동일 dataset lock을 사용한다. API_MOCK는 memory transaction의 동일 결과를 보장한다.

조건은 저장 예정 문서(기존 값+허용 PATCH), 현재 actor/context로 평가한다. null/누락/빈 문자열/빈 배열은 isEmpty=true, 0/false는 false. null의 eq/ne는 같은 타입의 명시 null 비교만 허용, 순서 비교는 false. 문자열 비교는 대소문자 구분, decimal/date는 정규화된 타입 비교다.
임의 조건식의 중첩 가능성을 추정하지 않는다. v1에서는 같은 target+effect에 상반 값을 쓰는 두 규칙은 조건이 달라도 게시 거부한다. 동일 값은 허용한다. 다른 effect 조합 결과 hidden+required이며 서버 기본값이 없으면 게시 거부한다. 조건은 다른 규칙의 effect가 아니라 원본 필드값만 참조한다. 권한 deny/불변식은 조건 effect로 완화할 수 없다.

보안 정책의 게시 및 rollback은 securityVersion을 증가시킨다. 권한·등록 상태·세션 회수는 release에서 복원하지 않는다. MFA REQUIRED가 된 현재 세션은 다음 요청부터 추가 인증을 요구한다. LOCKED 상위 필수 정책은 rollback으로 완화 불가다.

### 9.2 DEMO MFA 결정표
정책 병합은 OFF < OPTIONAL < REQUIRED의 최댓값(상위/법인/사용자의 활성 역할)이다. 실제 인증 수단을 확정하는 결정이 아니라 목업 정책이다.

| 유효 정책/등록 | 1차 인증 이후 |
|---|---|
| OFF | 업무 세션 발급 |
| OPTIONAL/미등록 | 제한 세션에서 등록 또는 명시 skip 후 업무 세션 발급 |
| OPTIONAL/등록 | MFA_REQUIRED |
| REQUIRED/미등록 | MFA_ENROLL_REQUIRED |
| REQUIRED/등록 | MFA_REQUIRED |

신규 POST /api/auth/mfa/skip은 OPTIONAL/미등록 제한 세션에서만 허용한다. 회사 전환은 membership을 확인하고 목적 회사 정책을 평가한다. MFA 부족 시 대상 전용 제한 세션만 반환하며 기존 회사 context는 유지한다. 인증 완료 후 새 회사 context로 교체한다.
목업 고정값: 제한 세션 5분, 최대 실패 5회, 실패 한도 도달 시 해당 챌린지 폐기 및 로그인 잠금 15분. 업무 세션 idle 30분/max 8시간, MFA freshness 30분. 모두 합성 fixture 값이며 실제 운영 정책으로 확정하지 않는다.
DEMO code 123456은 목업 화면에 DEMO임을 명시하고 테스트에만 사용한다. 등록 성공과 챌린지 소비/업무 세션 발급은 하나의 transaction이다. 만료 401 MFA_EXPIRED, 재사용 409 MFA_ALREADY_USED, 틀린 코드 401 MFA_INVALID, 한도 초과 429 AUTH_LOCKED. 제한 token은 tokenUse=MFA_PENDING이며 업무 Guard에서 403 MFA_REQUIRED로 거부한다. 일반 access token과 audience/type을 분리한다.
refresh와 회사 전환도 활성 사용자·세션·membership·정책 버전을 검사한다. refresh가 MFA를 우회해 새 access token을 발급해서는 안 된다. 초기화는 identity 등록을 해제하고 모든 세션과 진행 챌린지를 폐기한다. 재등록은 새 1차 인증 이후 시작한다.

### 9.3 승인·기한·번호
SEQUENTIAL은 한 step에 승인자 1명, ALL/ANY는 중복 제거된 복수 승인자다. ROLE selector는 해당 회사 활성 membership으로 해석한다. 0명 또는 신청자 포함이면 지정 alternate로 대체 후 재검증하고 미해소 시 제출 거부한다.
반려/회수/재배정은 사유 필수, 승인 comment는 선택이다. task와 instance revision을 모두 비교한다. ANY 최초 승인/반려는 서버 잠금 획득 순서로 확정하고 후속 결정은 409, 동일 key 재전송은 최초 결과를 반환한다. BLOCKED는 instance IN_PROGRESS의 blockedReason이며 별도 완료 상태가 아니다.
캘린더 businessDays는 0 이상 정수. start를 회사 시간대로 변환한 후 시작일을 제외하고 근무일만 세어 동일 현지 시각을 반환한다(0은 start 그대로). DST gap은 다음 유효 시각, overlap은 이른 offset으로 선택한다. 샘플은 dueBusinessDays=2. 계산 시 달력/시간대 snapshot을 저장한다.
번호는 periodKey를 회사 시간대 YYYY/YYYYMM/ALL로 정하고 nextValue부터 원자적으로 할당한다. preview는 미소모, 발급 실패 후 번호 재사용 금지, padding 초과는 409 SEQUENCE_EXHAUSTED. 초기 nextValue=1/padding=6인 DEMO fixture를 사용한다.

### 9.4 ERP 경합 및 데이터 복구
requestId는 business 요청, attemptNo는 전송 시도다. timeout 이후 늦은 성공도 같은 requestId/entityRevision이면 적용할 수 있다. 성공이 먼저 확정되면 다른 attempt의 실패·성공은 업무 재적용 없이 기록만 한다. 새 업무 요청은 이전 요청을 supersededByRequestId로 표시한다. 같은 eventId/같은 hash는 무시, 다른 hash는 409 EVENT_PAYLOAD_CONFLICT다.
수금·납품의 externalEventId는 정정 대상 identity, version은 양의 정수다. 최신값을 교체한 뒤 전체 최신 read model에서 합계를 재계산한다. 같은 version/다른 내용은 충돌, 낮은 version은 stale 이력만 기록한다.
dataset reset은 preview의 datasetRevision과 일치할 때만 실행한다. 진행 중 DEMO 요청/승인/예약은 해당 dataset 안에서 함께 초기화한다. API 세션은 reset 이후 폐기하여 재로그인을 요구하고 다른 dataset·기존 앱 토큰 저장 키는 삭제하지 않는다.

## 10. v1.2 보완 실행 순서
### B-01/B-02: 게시·회사 변경
상위 게시: scope 권한→draft/hash/currentVersion 비교→immutable domain versions 및 ScopeVersion 생성→scope pointer 교체→event/receipt 저장, 하나의 transaction.
회사 rebase: 부모 diff preview→conflict 해소→apply로 draft parent refs 갱신→재검증→회사 release 게시. apply만으로 runtime은 바뀌지 않는다. scope lock 순서는 COMMON→TEMPLATE→COUNTRY→COMPANY 후 scopeKey 사전순, memory에서도 동일하다.
템플릿 변경은 기존 회사 필드 타입·불변식·진행 인스턴스 snapshot을 재검증한다. 진행 승인/ERP는 기존 version 유지, 새 문서만 새 템플릿을 사용한다. conflict가 남으면 apply/게시 거부. 회사 metadata와 release의 templateCode가 다르게 보이는 중간 상태를 외부에 노출하지 않는다.
reset은 preview 시 실제 상태를 읽고 모든 집합 건수와 datasetRevision을 고정한다. 실행 시 권한/TTL/revision 재검사 후 dataset lock 안에서 처리한다.

### B-03/B-04: 인증
03 §8.3은 “기존 Guard 유지”를 실행 모드별로 구체화한 기준이다. LEGACY 기존 토큰·로그인·refresh는 유지, API_MOCK는 별도 issuer/audience/키와 session 검증을 사용한다. 새 API_MOCK에 legacy token을 보내도 legacy 검증으로 fallback하지 않는다.
전역 MFA 초기화는 identity lock→company UUID 오름차순 lock으로 등록 해제/모든 세션·challenge 폐기/감사/receipt를 원자 기록한다. 법인 초기화 요청은 전역 상태를 바꾸지 않는다. 복수 법인 사용자에 대한 요청 승인 시 해당 identity의 전체 영향 범위를 전역 관리자에게만 표시한다.

### B-05: 대결 결정
task 조회→원승인자/행위자/문서 신청자 확인→활성 원승인자 확인→행위자가 원승인자가 아니면 유효 deputy 및 기간 확인→actor 권한·자기승인 금지→task/instance CAS→집계/event/outbox/receipt 저장.
대결 회수와 결정은 같은 company transaction lock으로 순서화한다. 회수가 먼저면 결정 거부, 결정이 먼저면 이력 유지. 유효기간 판정은 transaction 진입 시 서버 clock으로 한 번 고정한다. deputy가 자기 제출 문서를 승인하려 하면403 SELF_APPROVAL_DENIED. reassign 시 원래 task는 SUPERSEDED 처리하고 새 task를 만들어 기존 이력과 연결한다. 새 task는 새 assignee의 대결 정책을 조회한다.

### B-06: 필드 출력·저장
권한 결합→회사/행 범위 확인→field read/write/effective mask 계산→허용 검색 조건 검증→원문 조회→values/maskedFields로 분리한다. 권한 거부된 값은 provenance/오류/집계에서도 노출하지 않는다.
변경 요청은 values와 fieldReplacements를 분리 검증하고 마스킹 문자열을 기존 값으로 되쓰지 않는다. payload에 없는 필드는 유지한다. 허용된 replacement를 포함한 전체 변경과 확장값을 하나의 transaction으로 저장한다.
