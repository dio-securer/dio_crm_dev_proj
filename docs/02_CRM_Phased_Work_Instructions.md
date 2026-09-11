# DIO CRM AI 오케스트레이션 단계별 작업지시서

- 문서명: DIO CRM AI 오케스트레이션 단계별 작업지시서
- 버전: v1.0
- 작성일: 2026-09-11
- 선행문서: `docs/01_CRM_AI_Orchestration_Design.md`
- 목적: 전체 설계서를 실제 AI Orchestrator와 Agent가 수행 가능한 단계/작업/검증 단위로 분해한다.

---

# 1. 공통 실행 원칙

모든 단계는 다음 순서로 실행한다.

```text
1. Orchestrator: Work Package 생성
2. Requirement Agent: 요구사항/Acceptance Criteria 작성
3. Domain Agent: 업무규칙/상태 검증
4. Architect Agent: 기술영향/Transaction/API 경계 정의
5. Data/Integration Agent: 필요 시 선행 설계
6. Backend/Frontend Agent: 구현
7. QA Agent: 테스트
8. Review Agent: Spec/보안/품질 검토
9. Human Gate: 승인
10. Merge / 다음 Phase 진행
```

## 1.1 작업 중단 조건

다음 조건 중 하나라도 해당하면 Agent는 임의구현하지 말고 `SPEC GAP`을 생성하고 작업을 중단한다.

- PDF/Spec에 업무규칙이 없음
- 서로 다른 문서 간 규칙 충돌
- ERP Interface 규격 미확정
- 필수 코드값/상태값 미정의
- 권한/승인주체 미확정
- 데이터 Master가 불명확
- 운영 영향이 있으나 승인 없음

## 1.2 Work Package 필수항목

```yaml
work_id:
title:
phase:
source:
scope:
dependencies:
business_rules:
acceptance_criteria:
required_tests:
spec_gaps:
human_gate:
```

---

# 2. Phase 0 — Specification Baseline

## 목표

코딩 전에 CRM 업무를 AI가 안정적으로 이해할 수 있는 Canonical Spec으로 변환한다.

## 선행자료

- 영업활동프로세스 PDF
- 영업판매프로세스 PDF
- `01_CRM_AI_Orchestration_Design.md`

## Agent 실행순서

```text
Orchestrator
 → Requirement Agent
 → Domain Agent
 → Architect Agent
 → Human Review
```

## 작업지시

### P0-01 전체 프로세스 분해

생성파일:

```text
spec/process/lead.md
spec/process/account.md
spec/process/activity.md
spec/process/opportunity.md
spec/process/contract.md
spec/process/collection.md
spec/process/order.md
spec/process/sales.md
spec/process/direct_work.md
```

각 파일은 최소 다음 내용을 포함한다.

- 시작조건
- 사용자
- 처리단계
- 상태
- 입력값
- 출력값
- 예외
- 승인
- 외부연동
- 후속 프로세스
- PDF 근거 페이지
- 미정의 사항

### P0-02 Entity Dictionary 작성

생성파일:

```text
spec/entities/entity_catalog.yaml
spec/entities/*.yaml
```

필수 Entity:

- Lead
- Account
- Contact
- Opportunity
- OpportunityProduct
- ActivityPlan
- Event
- Activity
- ActivityReport
- DirectWork
- Contract
- CollectionPlan
- Collection
- Product
- Package
- Order
- OrderItem
- Delivery
- Sales
- ReturnExchange
- Approval
- ApprovalHistory
- InterfaceLog
- AuditLog
- Attachment

### P0-03 ERD 초안

산출물:

```text
spec/entities/erd.md
```

요구사항:

- PK
- FK
- 1:1 / 1:N
- 외부키(ERP code)
- 상태이력
- 삭제정책
- 업무키/중복키

### P0-04 상태전이 정의

생성파일:

```text
spec/states/lead.yaml
spec/states/activity.yaml
spec/states/activity_report.yaml
spec/states/direct_work.yaml
spec/states/opportunity.yaml
spec/states/contract.yaml
spec/states/integration.yaml
```

각 전이는 다음을 포함한다.

```yaml
from:
to:
action:
actor:
preconditions:
side_effects:
forbidden_when:
```

### P0-05 Business Rule 목록

생성파일:

```text
spec/rules/activity.yaml
spec/rules/customer.yaml
spec/rules/opportunity.yaml
spec/rules/contract.yaml
spec/rules/collection.yaml
spec/rules/order.yaml
```

Rule ID는 변경하지 않는 영구 식별자로 사용한다.

예:

```text
BR-ACT-001
BR-LEAD-001
BR-OPP-001
BR-CON-001
```

### P0-06 권한 Matrix

생성파일:

```text
spec/permissions/role_matrix.yaml
```

역할:

- SALES_REP
- BRANCH_MANAGER
- HQ_MANAGER
- SALES_ADMIN
- MARKETING
- CRM_ADMIN
- INTEGRATION_ADMIN

각 역할별 Object CRUD + Action + Record Scope를 정의한다.

### P0-07 Interface Catalog

생성파일:

```text
spec/interfaces/interface_catalog.yaml
spec/interfaces/erp_account.yaml
spec/interfaces/erp_contract.yaml
spec/interfaces/erp_product.yaml
spec/interfaces/erp_order.yaml
spec/interfaces/erp_sales.yaml
spec/interfaces/erp_collection.yaml
spec/interfaces/hira_hospital.yaml
```

미확정 API는 `status: GAP`으로 표시한다.

### P0-08 Screen Catalog

생성파일:

```text
spec/screens/screen_catalog.yaml
```

최소 화면:

- Dashboard
- Lead List/Detail
- Account List/360
- Contact
- Activity Map
- Activity Calendar
- Activity Detail
- Activity Report
- Approval Inbox
- Opportunity List/Detail
- Contract Detail
- Collection Plan
- Order
- Package Ledger
- Monthly Statement
- Admin/User/Permission
- Interface Monitor

### P0-09 Spec Gap 등록

생성파일:

```text
spec/gaps/open_gaps.md
```

우선 확인:

- GPS IN 제한거리
- GPS 정확도/Mock Location
- Opportunity 승인조건
- 실제 조직계층
- ERP Interface 상세
- 제품/가격/재고 연동방식
- 주문취소/정정
- 반품/교환 역할분담
- 수금계획 Master
- 보존기간
- 알림방식

## Phase 0 완료기준

- [ ] 전체 Process 문서 존재
- [ ] Entity Catalog 존재
- [ ] ERD 리뷰 완료
- [ ] 주요 상태전이 정의
- [ ] Business Rule ID 부여
- [ ] 권한 Matrix 초안
- [ ] Interface Catalog 초안
- [ ] Screen Catalog 초안
- [ ] Open Gap 목록 작성
- [ ] Product Owner 승인

---

# 3. Phase 1 — Platform Foundation

## 목표

향후 모든 CRM 기능이 공통으로 사용할 기반을 구현한다.

## 의존성

Phase 0 승인 완료.

## Work Package

### P1-01 Repository/Application Skeleton

구현:

```text
backend/
frontend/
database/
integration/
tests/
```

완료기준:

- Backend Build 성공
- Frontend Build 성공
- 기본 Health Check
- 공통 환경설정 분리

### P1-02 Authentication

작업:

- 로그인
- Access Token
- Refresh 정책
- Logout
- 비밀번호 정책/SSO 여부는 별도 결정

테스트:

- 정상로그인
- 잘못된 계정
- Expired Token
- 권한없는 API

### P1-03 User / Organization

작업:

- 사용자
- 본부/지점/부서
- 관리자
- 영업담당자 배정 기반

### P1-04 Role / Permission

Backend에서 최종 권한을 검증한다.
Frontend 버튼 숨김만으로 권한을 보장하지 않는다.

### P1-05 Common Code

- 상태
- 방문목적
- 리드소스
- 관심품목
- 결제수단
- 승인상태
- 연동상태 등

### P1-06 Audit Log

최소 추적:

```text
who
when
entity
entity_id
action
before
after
request_id
```

### P1-07 Interface Framework

기능:

- Request ID
- Idempotency Key
- Retry
- Timeout
- Error Mapping
- Interface Log

### P1-08 File / Notification Foundation

- 첨부파일 Metadata
- 저장소 추상화
- 앱 내부 알림
- 이메일/Push/SMS는 Spec 확정 후 Adapter 추가

## Phase 1 완료기준

- [ ] 인증/권한 공통모듈
- [ ] 조직/사용자 관리
- [ ] 공통코드
- [ ] Audit
- [ ] Interface Log
- [ ] CI Build/Test
- [ ] Human Architecture Review

---

# 4. Phase 2 — Customer / Lead / Account

## 목표

신규병원부터 거래처 전환까지 Customer Domain을 완성한다.

## Agent 순서

```text
Requirement → Domain → Data → Integration → Backend → Frontend → QA → Review
```

## Work Package

### P2-01 심평원 신규병원 수신

기능:

- 병원 기본정보 수신
- 암호화요양기호 기반 중복검사
- 신규 Lead 생성
- 기존 레코드 업데이트 규칙
- 연동제외 규칙

필수 테스트:

- 신규병원
- 기존병원
- 중복
- 데이터 누락
- Batch 재실행

### P2-02 Lead 관리

필드 범위:

- 병원정보
- 주소/좌표
- 키맨
- 관심품목
- 병원규모/시스템
- 사업자정보
- Lead Source
- MQL
- 컨택제외

### P2-03 담당자 자동할당

규칙:

- 지역/시군구 기준
- 미할당 Queue
- 관리자 수동 재할당
- 변경 이력

### P2-04 Lead 상태전이

```text
신규등록 → 초도방문 → 키맨미팅 → 변환
                         └→ 컨택제외
```

### P2-05 Account / Contact

Account 360 기본골격과 Contact를 생성한다.

### P2-06 거래처 중복검사/병합

중복 기준:

- 암호화요양기관번호
- 사업자번호
- 연락처 이메일 등 PDF에 등장하는 기준을 객체별로 구분

병합은 irreversible 작업이므로:

- 관리자 권한
- 최종 확인
- Audit 필수

### P2-07 Lead Convert

Transaction 단위:

```text
Lead
 → Account
 → Contact
 → Opportunity
 → 기존 Activity 연결
```

한 단계라도 실패하면 전체 rollback.

## Phase 2 E2E

```text
심평원 신규병원
 → Lead 생성
 → 영업담당자 할당
 → Lead 정보수정
 → 키맨미팅
 → Convert
 → Account/Contact/Opportunity 생성 확인
```

---

# 5. Phase 3 — Sales Activity

## 목표

영업담당자의 실제 현장 활동을 자체 CRM에서 수행 가능하게 한다.

## 선행 Gap

GPS 제한거리 및 정확도 기준을 확정해야 한다.

## Work Package

### P3-01 Activity Plan

- Lead/Account/Opportunity 연결
- 방문예정일시
- 방문목적
- 직출/직퇴
- 사유
- 단건/다건 등록

### P3-02 Calendar / Event

Event는 캘린더 표시용이며 Activity Master와 역할을 분리한다.

### P3-03 Map

- 사용자 현재위치
- 주변 병원
- 오늘 방문 예정
- 진행중
- 완료

### P3-04 GPS IN

검증 순서:

```text
사용자 권한
 → 대상 Activity
 → 기존 미완료 Activity 존재 여부
 → 위치정보 존재
 → 위치정확도
 → 병원거리
 → IN 저장
```

### P3-05 Activity Update / OUT

- 상담내용
- 방문목적
- 병원정보
- OUT 시간
- 완료상태

### P3-06 Activity Report

- 일자별 활동결과
- 향후 활동계획
- OUT 미완료 존재 시 승인요청 금지

### P3-07 Activity Approval

- 담당자 요청
- 지점장
- 본부장
- 코멘트
- 승인 이력
- 승인 후 수정 제한

### P3-08 Direct Work

- 직출/직퇴
- 사유
- 지점장/본부장 승인
- ERP 전송

## Phase 3 E2E

```text
방문계획
 → 지도
 → 범위 내 IN
 → 상담내용
 → OUT
 → 활동보고
 → 지점장 승인
 → 본부장 승인
```

Negative Case:

- 범위 밖 IN
- 미완료 활동 존재
- 승인 후 수정
- 타인 거래처 수정

---

# 6. Phase 4 — Opportunity / Sales Pipeline

## 목표

Lead Convert 이후 실제 제안/협상/수주 Funnel을 구현한다.

## Work Package

### P4-01 Opportunity 생성/조회

- 신규/재계약 유형
- 거래처
- 금액
- 예상수주일
- 관심제품
- 성공확률

### P4-02 Opportunity Stage

```text
NEEDS_ANALYSIS
 → PROPOSAL
 → NEGOTIATION
 → CLOSED_WON / CLOSED_LOST
```

### P4-03 Opportunity Product / Package

- 패키지 검색
- 제안금액
- 제품 편집

### P4-04 협상정보

- 특약
- 결제수단
- 결제일
- 할부개월

### P4-05 Closed Won Validation

확인:

- Account ERP 승인 여부
- 필수 패키지 존재
- 필수 제안정보

### P4-06 Pipeline / Funnel

- 단계별 건수
- 단계별 금액
- 예상수주일
- 담당자/지점/본부

## Phase 4 완료기준

- [ ] Opportunity CRUD
- [ ] 단계전이 Server Validation
- [ ] Package
- [ ] Won/Lost
- [ ] Pipeline
- [ ] 권한/감사로그

---

# 7. Phase 5 — ERP Account / Contract / Collection

## 목표

영업기회를 실제 ERP 거래 및 계약으로 연결한다.

## 선행조건

ERP Interface Spec이 확정되어야 한다.

## Work Package

### P5-01 ERP 거래처 등록요청

순서:

```text
Account
 → ERP Code 존재 확인
 → 사업자번호 중복검사
 → 필수정보 검증
 → ERP 요청
 → 연동상태
 → 승인결과 반영
```

### P5-02 Contract 생성

조건:

- Opportunity CLOSED_WON
- ERP Account 승인
- OpportunityProduct 존재
- 최초 1회

생성 후 Opportunity 수정 제한.

### P5-03 최초 수금계획

- 행 수
- 분할금액
- 계획일
- 수금방법
- 합계 = 계약금액 검증

### P5-04 ERP 계약등록

계약 + 수금계획 전송.

### P5-05 ERP 계약승인 결과

- 계약번호
- 승인상태
- 추가 ERP 정보

### P5-06 실제 수금 조회

ERP 실제수금 데이터를 CRM에 반영한다.

### P5-07 미수/수금계획 변경

- 일부수금
- 계획분할
- 변경일
- 미수재할당
- 미수 = 0 검증 후 ERP 전송

## Integration Test 필수

- 정상
- ERP Timeout
- 동일 Request 재전송
- ERP 응답 지연
- 중복등록
- 실패 후 Retry

---

# 8. Phase 6 — Order / Delivery / Sales / Return

## 목표

ERP 승인 계약을 기준으로 영업이 CRM에서 주문하고 이후 현황을 조회한다.

## Work Package

### P6-01 제품/상품 검색

ERP 기준:

- 유형
- 대분류
- 중분류
- 품목검색
- 단가
- 패키지가
- 주문가능여부
- 재고

### P6-02 Cart / 수량

- 품목 추가
- 수량
- 삭제
- 주문불가 품목 제외

### P6-03 배송지/특송

- 배송지 유형
- 특송
- 비고

### P6-04 주문요청

조건:

- ERP 승인 Contract
- 미마감
- 유효 품목

### P6-05 주문/납품현황

ERP 결과 동기화.

### P6-06 매출

ERP 매출 조회/동기화.

### P6-07 반품/교환

PDF에서 전체 ERP 업무경계가 완전히 정의되어 있지 않으므로 상세 Spec 승인 후 구현한다.

---

# 9. Phase 7 — Ledger / Statement / Analytics

## 목표

영업담당자가 거래현황을 조회/출력하고 관리자가 분석한다.

## Work Package

### P7-01 패키지원장

- 거래처
- 패키지
- 일반거래
- 상세거래
- Excel

### P7-02 월합 거래명세서

- 기간
- 패키지/일반거래
- 선택건
- PDF 생성
- 파일 보관
- 모바일 조회

### P7-03 Account 360

한 화면에서:

- 병원정보
- 연락처
- 활동
- 기회
- 계약
- 주문
- 매출
- 수금
- 고객센터

### P7-04 Dashboard

최소 KPI:

- 신규 Lead
- Lead Conversion
- 활동계획/완료
- IN/OUT 정상률
- Pipeline 금액
- 단계별 Opportunity
- 수주율
- 계약금액
- 수금계획 대비 수금
- 미수금
- 이탈가능 거래처

---

# 10. Phase 8 — Hardening / Rollout

## 목표

운영 가능한 수준으로 보안/성능/장애/배포를 완성한다.

## Work Package

### P8-01 Security

- 인증/권한 점검
- IDOR
- SQL Injection
- XSS
- File Upload
- Secret 관리
- 개인정보 Masking

### P8-02 Performance

- 주요 List Query
- Account 360
- 지도
- Dashboard
- ERP Bulk Sync

### P8-03 Resilience

- ERP Timeout
- Retry
- Circuit Breaker 검토
- Batch 재처리
- Dead Letter/실패 Queue

### P8-04 Backup / Recovery

- DB Backup
- 첨부파일
- Interface 재처리
- 복구 Runbook

### P8-05 Monitoring

- API Error Rate
- DB
- ERP Interface 실패
- Batch
- 로그인 실패
- 알림 실패

### P8-06 Pilot

권장 순서:

```text
관리자/테스트계정
 → 특정 영업팀
 → 특정 지점
 → 전체 국내 영업
```

### P8-07 Cutover

- 기준일 결정
- Salesforce 데이터 이관 범위
- Open Opportunity
- Open Contract
- 미수/수금계획
- 사용자/조직
- 첨부파일
- 과거 Activity

이관범위는 별도 Migration Spec으로 승인한다.

---

# 11. AI Orchestrator 작업지시 템플릿

새 기능마다 다음 형식으로 Orchestrator에 지시한다.

```text
[ROLE]
당신은 DIO CRM 개발 Orchestrator다.

[SOURCE OF TRUTH]
1. docs/01_CRM_AI_Orchestration_Design.md
2. 현재 Phase 작업지시서
3. spec/ 하위 Canonical Spec

[RULES]
- Spec에 없는 업무규칙을 임의 생성하지 않는다.
- 모호하면 SPEC GAP을 만든다.
- 운영 DB/ERP를 직접 변경하지 않는다.
- 코드 구현 전 Acceptance Criteria를 확정한다.
- 구현 후 반드시 테스트와 Review 단계를 수행한다.

[TASK]
<작업명>

[OUTPUT]
1. Work Package
2. 영향분석
3. 변경파일
4. 테스트
5. 발견된 Gap
6. PR 요약
```

---

# 12. Agent별 공통 금지사항

## Requirement/Domain Agent

- PDF에 없는 숫자/거리/승인조건 임의 생성 금지
- Salesforce의 세부 내부구현을 자체 CRM 필수요건으로 간주 금지

## Data Agent

- 운영 DB 직접 ALTER 금지
- FK/Index 없이 대량 테이블 생성 금지
- ERP 외부키를 내부 PK로 직접 사용 금지

## Backend Agent

- UI 검증만 신뢰 금지
- 승인/계약/주문 Business Rule 우회 API 금지

## Frontend Agent

- Backend 검증 없이 버튼숨김만으로 권한 구현 금지
- 서버 상태와 다른 임시 상태코드 생성 금지

## Integration Agent

- 무제한 Retry 금지
- Request/Response Log 없이 ERP 전송 금지
- Idempotency 없이 생성성 API 재시도 금지

## QA Agent

- Happy Path만 테스트 금지
- 상태전이 Negative Case 누락 금지

---

# 13. PR 생성 전 체크리스트

```text
[ ] Work ID 존재
[ ] 관련 Spec 링크
[ ] Business Rule ID
[ ] DB Migration 포함 여부
[ ] API Contract 변경 여부
[ ] 권한 변경 여부
[ ] ERP 영향 여부
[ ] Unit Test
[ ] API Test
[ ] Integration Test
[ ] E2E 영향
[ ] 보안 영향
[ ] Spec Gap 없음 또는 승인됨
[ ] Rollback 방법
```

---

# 14. Phase Gate

다음 Phase로 넘어가기 전 Product Owner/Tech Lead가 승인한다.

| Gate | 승인 대상 |
|---|---|
| G0 | Process/Entity/Rule/Gap |
| G1 | 공통플랫폼/권한/감사 |
| G2 | Lead/Account/Convert |
| G3 | Activity/GPS/Approval |
| G4 | Opportunity/Pipeline |
| G5 | ERP Account/Contract/Collection |
| G6 | Order/Sales/Return |
| G7 | Ledger/Statement/Analytics |
| G8 | Security/Performance/Pilot/Cutover |

---

# 15. 최초 실제 착수 순서

본 문서 등록 이후 실제 첫 작업은 다음 순서로 한다.

```text
1. Phase 0 Work Package 생성
2. 두 PDF에서 Process Spec 생성
3. Entity Catalog/ERD
4. State/Business Rule
5. Open Gap 리뷰회의
6. Role/Permission
7. ERP Interface 현행 분석
8. Screen Catalog
9. Phase 0 승인
10. 개발 Skeleton 생성
```

코딩은 1~9가 완료되기 전에 본격적으로 시작하지 않는다.

---

# 16. 첫 번째 Orchestrator 실행 지시

```text
WORK: CRM-P0-001
TITLE: DIO CRM Canonical Spec Baseline 작성

두 CRM 교육 PDF와
`docs/01_CRM_AI_Orchestration_Design.md`,
`docs/02_CRM_Phased_Work_Instructions.md`를 기준으로
Phase 0 산출물을 작성한다.

우선순위:
1. process
2. entities
3. states
4. rules
5. permissions
6. interfaces
7. screens
8. gaps

요구사항:
- PDF에서 확인되는 내용과 자체개발 설계 결정을 구분한다.
- PDF에서 확인되지 않는 값은 GAP으로 둔다.
- 각 Business Rule에 영구 ID를 부여한다.
- 각 상태전이에 허용 actor와 precondition을 명시한다.
- 완료 후 Phase 0 검토용 Summary를 생성한다.
```

이 지시가 향후 AI 오케스트레이션 개발의 첫 실행 단위가 된다.
