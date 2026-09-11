# DIO CRM 자체개발 AI 오케스트레이션 전체 설계서

- 문서명: DIO CRM 자체개발 AI 오케스트레이션 전체 설계서
- 버전: v1.0
- 작성일: 2026-09-11
- 대상 레포지토리: `dio-securer/dio_crm_dev_proj`
- 문서 목적: 기존 CRM 영업활동/영업판매 프로세스를 기준으로 자체 CRM을 개발하기 위한 전체 설계 원칙, 업무범위, 데이터/상태/연동 기준, AI Agent 역할 및 개발 통제 방식을 정의한다.

---

## 1. 문서의 기준 자료

본 설계서는 다음 사용자 교육자료를 1차 업무 기준으로 사용한다.

1. `디오_교육자료_영업활동프로세스_250115.pdf`
   - 영업활동 계획
   - 지도/GPS 기반 IN/OUT
   - 활동내용 등록
   - 활동보고 및 지점장/본부장 승인
   - 직출/직퇴 관리 및 ERP 연동
2. `디오_교육자료_영업판매프로세스_250115.pdf`
   - 신규병원발굴(Lead)
   - 거래처/연락처/패키지제안(Opportunity)
   - 거래처 ERP 등록
   - 계약 생성 및 ERP 등록
   - 수금계획
   - 주문/출고/매출/수금
   - 패키지원장
   - 월합 거래명세서

### 1.1 자료에서 확인된 핵심 업무 흐름

```text
심평원 신규병원
    ↓
Lead 신규병원발굴
    ↓
영업활동 계획 / 방문 / GPS IN / 상담 / GPS OUT / 활동보고
    ↓
기회 포착
    ↓
Lead Convert
    ├─ Account 거래처
    ├─ Contact 연락처
    └─ Opportunity 패키지제안
             ↓
       니즈파악 → 제안 → 협상
             ↓
       수주성공 / 수주실패
             ↓
         계약 생성
             ↓
        수금계획 생성
             ↓
      ERP 계약 등록/승인
             ↓
            주문
             ↓
     출고 / 매출 / 수금
             ↓
패키지원장 / 월합 거래명세서
```

### 1.2 본 설계서에서 추가로 정의하는 프로젝트 설계 원칙

아래 항목은 PDF에 직접 명시된 기존 업무가 아니라, 자체개발을 안정적으로 수행하기 위해 본 프로젝트에서 채택하는 설계 원칙이다.

- Spec-first 개발
- AI Orchestrator 중심의 Agent 분업
- Git 기반 문서/코드 단일 기준 관리
- Human-in-the-loop 승인 게이트
- API/DB/ERP 연동 변경의 자동 테스트 우선
- 운영 DB 및 운영 ERP에 대한 AI 직접 변경 금지
- 요구사항 미정의 시 AI 임의 결정 금지

---

# 2. 프로젝트 목표

## 2.1 업무 목표

기존 Salesforce 기반의 영업활동 및 판매 프로세스를 DIO 자체 CRM으로 구현하되, 다음을 유지 또는 개선한다.

- 고객 360도 정보 관리
- Lead부터 계약/주문/수금까지 영업 Funnel 표준화
- 현장 영업활동 계획 및 GPS 기반 방문 기록
- 활동보고/직출직퇴 승인
- 거래처/계약/주문/매출/수금의 ERP 연동
- 영업정보의 자산화
- 보고/승인 중복업무 최소화
- 실시간 현황과 분석 기반 의사결정 지원

## 2.2 개발 목표

- 기능 단위로 AI가 요구사항 분석, 설계, 구현, 테스트, 리뷰를 수행할 수 있는 개발체계를 만든다.
- AI가 채팅 기억이 아니라 Git의 명세를 기준으로 개발하도록 한다.
- 업무 규칙을 UI/Backend/DB 각각에 중복 구현하지 않고 공통 Spec에서 추적 가능하도록 한다.
- 모든 변경은 Work Package, 테스트, 리뷰 이력을 남긴다.

---

# 3. 핵심 개발 원칙

## 3.1 Spec-first

개발 순서는 다음을 원칙으로 한다.

```text
업무자료/PDF
  ↓
Process Spec
  ↓
Entity / Relationship
  ↓
State / Transition
  ↓
Business Rule
  ↓
Permission
  ↓
API Contract
  ↓
Acceptance Test
  ↓
Implementation
```

코드가 업무규칙의 원본이 되어서는 안 된다.

## 3.2 Single Source of Truth

다음 정보를 Git 저장소의 `spec/` 문서로 관리한다.

- 업무 프로세스
- Entity 및 관계
- 필드 정의
- 상태 및 전이
- Business Rule
- 사용자/권한
- ERP/외부 Interface
- 화면 정의
- Acceptance Criteria

## 3.3 미정의 요구사항 처리

AI Agent는 자료에 없는 값을 추측하여 구현하지 않는다.

예:

```text
SPEC GAP: ACTIVITY-GPS-001
항목: 병원 GPS IN 허용거리
자료 확인: 제한거리 이내에서만 IN 가능
미정의: 실제 거리(m)
상태: BLOCKED
결정권자: Product Owner / 영업관리
```

미정의 사항은 `spec/gaps/`에 등록하고 확정 후 개발한다.

## 3.4 Human-in-the-loop

다음 단계에는 사람의 승인 절차를 둔다.

1. 업무 요구사항/업무규칙 확정
2. DB 및 Architecture 변경 승인
3. Pull Request 승인
4. Production 배포 승인

---

# 4. 목표 시스템 범위

## 4.1 CRM Foundation

- 사용자
- 조직
- 역할/권한
- 공통코드
- 메뉴/권한
- 파일 첨부
- 알림
- 감사로그
- Interface 로그

## 4.2 Customer / Lead

- 심평원 기반 신규병원 수신
- 신규병원 Lead 생성
- 지역 담당자 자동 할당
- Lead 단계 관리
- 키맨/병원정보 관리
- 중복검사
- Lead Convert

## 4.3 Account 360

- 거래처 기본정보
- 병원현황
- 연락처
- 영업활동
- Opportunity
- 계약
- 주문/납품
- 매출/수금
- 반품/교환
- 고객센터 정보
- 패키지원장

## 4.4 Sales Activity

- 활동계획
- 캘린더
- 지도
- GPS 위치
- IN/OUT
- 방문목적
- 상담내용
- 병원 상세정보
- 활동보고
- 활동보고 승인
- 직출/직퇴
- 직출/직퇴 승인

## 4.5 Opportunity

- 니즈파악
- 제안
- 협상
- 수주성공
- 수주실패
- 패키지/제품 제안
- 제안금액
- 예상수주일
- 성공확률
- 특약/결제조건

## 4.6 Contract / Collection Plan

- Opportunity 기반 계약 생성
- 제품/상품/계약금액
- 할인율/할증율
- 계약 ERP 등록요청
- 최초 수금계획
- 변경 수금계획
- 일부수금/미수금 처리
- ERP 수금현황 동기화

## 4.7 Order / Sales

- 계약 기준 제품/상품 검색
- 가격/재고 조회
- 수량 및 배송지
- 주문 요청
- ERP 주문 전송
- 주문/납품 현황
- 매출현황
- 반품/교환

## 4.8 Documents / Analytics

- 패키지원장
- 엑셀 출력
- 월합 거래명세서
- PDF 생성/보관
- Pipeline
- Funnel
- 활동 KPI
- 수주율
- 수금/미수 분석
- 이탈가능 거래처

---

# 5. 핵심 Domain Entity

초기 설계 대상 핵심 Entity는 다음과 같다.

| Domain | Entity | 설명 |
|---|---|---|
| Customer | Lead | 신규병원/잠재고객 |
| Customer | Account | 거래처/병원 |
| Customer | Contact | 원장/실장/스텝 등 키맨 |
| Sales | Opportunity | 패키지 제안/영업기회 |
| Activity | ActivityPlan | 방문/영업활동 계획 |
| Activity | Event | 캘린더 일정 |
| Activity | Activity | 활동내역 Master |
| Activity | ActivityReport | 일일 활동보고/승인 |
| Activity | DirectWork | 직출/직퇴 |
| Contract | Contract | 패키지 계약 |
| Contract | CollectionPlan | 수금계획 |
| Contract | Collection | 실제 수금 |
| Order | Order | 주문 |
| Order | OrderItem | 주문상세 |
| Order | Delivery | 출고/납품 |
| Order | Sales | 매출 |
| Order | ReturnExchange | 반품/교환 |
| Product | Product | 제품/상품 Master |
| Product | Package | 제안/계약 패키지 |
| Common | User | 사용자 |
| Common | Organization | 본부/지점/부서 |
| Common | Approval | 승인 인스턴스 |
| Common | ApprovalHistory | 승인 이력 |
| Integration | InterfaceLog | ERP/외부 연동로그 |
| Common | AuditLog | 주요 변경 감사로그 |
| Common | Attachment | 파일/문서 |

## 5.1 중요한 관계

```text
Lead
 ├─ Activity
 └─ Convert
      ├─ Account
      ├─ Contact
      └─ Opportunity

Account
 ├─ Contact
 ├─ Activity
 ├─ Opportunity
 ├─ Contract
 ├─ Order
 ├─ Sales
 └─ Collection

Opportunity
 ├─ OpportunityProduct
 └─ Contract (수주 후 최초 1회)

Contract
 ├─ CollectionPlan
 ├─ Order
 ├─ Sales
 └─ Collection
```

---

# 6. 핵심 상태 정의

## 6.1 Lead

```text
NEW(신규등록)
 → FIRST_VISIT(초도방문)
 → KEYMAN_MEETING(키맨미팅)
 → CONVERTED(변환)

별도 종료:
 → CONTACT_EXCLUDED(컨택제외)
```

## 6.2 Activity

```text
PLANNED(예정)
 → IN_PROGRESS(IN 완료)
 → COMPLETED(OUT 완료)
```

## 6.3 Activity Report Approval

```text
DRAFT
 → REQUESTED
 → BRANCH_APPROVED
 → HQ_APPROVED
 → FINAL_APPROVED
```

PDF상 승인 상태 명칭과 실제 조직별 최종단계는 구현 전에 업무담당자 확인이 필요하다.

## 6.4 Direct Work Approval

```text
REQUESTED
 → BRANCH_APPROVED
 → HQ_APPROVED

반려:
 → BRANCH_REJECTED
 → HQ_REJECTED
```

## 6.5 Opportunity

```text
NEEDS_ANALYSIS
 → PROPOSAL
 → NEGOTIATION
 → CLOSED_WON
   또는
 → CLOSED_LOST
```

## 6.6 Integration

```text
NOT_REQUESTED
 → REQUESTING
 → SUCCESS
   또는
 → FAILED
```

---

# 7. PDF 기반 주요 Business Rule

초기 규칙은 코드보다 먼저 `spec/rules/`에 등록한다.

## 7.1 Activity

- BR-ACT-001: GPS 허용범위 이내에서만 IN 가능.
- BR-ACT-002: OUT 미완료 활동이 있으면 신규 IN 불가.
- BR-ACT-003: 활동완료(IN/OUT) 후 일정 수정은 제한한다.
- BR-ACT-004: 활동보고 승인완료 후 상담/활동내용 수정은 제한한다.
- BR-ACT-005: 활동보고 승인요청 시 OUT 미완료 활동이 존재하면 요청 불가.
- BR-ACT-006: 사용자 소유가 아닌 리드/거래처의 병원 상세정보 수정은 제한한다.

## 7.2 Lead / Account

- BR-LEAD-001: 신규병원은 심평원 연동 데이터에서 생성될 수 있다.
- BR-LEAD-002: 지역/시군구 기준으로 영업담당자 자동할당.
- BR-LEAD-003: Lead Convert 시 Account, Contact, Opportunity로 변환하며 기존 활동기록을 연결한다.
- BR-ACC-001: ERP 등록 요청 시 사업자번호 중복검사.
- BR-ACC-002: 중복 거래처 병합은 되돌릴 수 없는 업무로 별도 승인/확인이 필요하다.

## 7.3 Opportunity / Contract

- BR-OPP-001: Opportunity 단계는 니즈파악 → 제안 → 협상 → 수주성공/실패 순으로 관리.
- BR-OPP-002: 수주/계약 전에 거래처 ERP 등록/승인 상태를 확인.
- BR-CON-001: Contract는 수주성공 Opportunity에서만 생성 가능.
- BR-CON-002: Opportunity당 Contract 생성은 최초 1회.
- BR-CON-003: Contract 생성 후 기존 Opportunity 수정 제한.
- BR-CON-004: 계약 ERP 등록 요청에는 계약 필수정보와 수금계획이 포함된다.

## 7.4 Collection / Order

- BR-COL-001: 계약 승인 후 최초 수금계획 금액/일자 수정 제한.
- BR-COL-002: 일부 수금 또는 미수 발생 시 미수금이 새 계획에 모두 재할당되어야 저장 가능.
- BR-ORD-001: ERP 승인 완료되고 마감되지 않은 계약만 주문 가능.
- BR-ORD-002: 주문 품목은 ERP의 제품/재고/가격 기준과 연동한다.

---

# 8. Source of Truth / Master System

PDF 기준과 자체개발 원칙을 결합하여 초기 Master 기준을 다음처럼 둔다. 실제 ERP Interface 분석 후 확정한다.

| 데이터 | 초기 Master 기준 | 비고 |
|---|---|---|
| 심평원 병원 기본정보 | 심평원 | 주기 동기화 |
| Lead 영업정보 | CRM | CRM 생성/수정 |
| 상담/활동 | CRM | CRM Master |
| 키맨 | CRM | 필요 시 ERP 연계 검토 |
| Opportunity | CRM | CRM Master |
| ERP 거래처코드 | ERP | CRM 수정 금지 |
| Contract 영업정보 | CRM | ERP 승인결과 반영 |
| ERP 계약번호 | ERP | CRM 수정 금지 |
| 제품/재고/가격 | ERP | 주문 시 조회/동기화 |
| 주문 실행 | ERP | CRM 요청/조회 |
| 출고 | ERP | CRM 조회 |
| 매출 | ERP | CRM 조회 |
| 실제 수금 | ERP | CRM 조회 |
| 수금계획 | CRM + ERP 연동 | 업무규칙 상세확정 필요 |

---

# 9. 권한 모델

초기 역할은 다음을 기준으로 한다.

- 영업담당자
- 지점장
- 본부장
- 영업관리
- 마케팅/교육
- CRM 관리자
- 시스템/연동 관리자

권한은 최소 다음 단위로 정의한다.

```text
Object Permission
- Read
- Create
- Update
- Delete

Record Scope
- Own
- Branch
- Headquarters
- All

Action Permission
- Approve
- Reject
- Merge
- ERP Request
- Export
- Admin
```

`spec/permissions/role_matrix.yaml`에서 객체/행위/데이터범위를 관리한다.

---

# 10. 목표 Application Architecture

> 이 절은 PDF의 기존 Salesforce 구조가 아니라 자체개발 프로젝트의 기술 설계 기준이다.

초기 구현 기준:

```text
[Web / Mobile PWA]
       React
         │
         ▼
     .NET API
         │
   ┌─────┴─────────────┐
   ▼                   ▼
SQL Server       Integration Layer
                       │
          ┌────────────┼─────────────┐
          ▼            ▼             ▼
         ERP         심평원        기타 시스템
```

### 10.1 Backend

- .NET Web API
- Domain Service / Application Service 분리
- Validation Rule 공통화
- Transaction 경계 명확화
- Interface retry/idempotency 적용
- API versioning 적용

### 10.2 Frontend

- React 기반 CRM Web/PWA
- 역할 기반 메뉴
- 공통 Grid/Form/Dialog 컴포넌트
- 모바일 영업활동/GPS 지원
- 상태에 따른 Action 제어는 Backend Rule과 불일치하지 않도록 서버 검증을 최종 기준으로 한다.

### 10.3 Database

- SQL Server
- PK는 내부 식별자와 업무키를 구분
- ERP Code/Contract No는 외부키로 관리
- 상태 변경 이력 보존
- 승인/연동/Audit 이력 삭제 금지 원칙
- Migration Script는 Git 관리

---

# 11. AI Orchestration Architecture

```text
                    Product Owner
                         │
                 요구/변경/승인
                         │
                         ▼
                 AI Orchestrator
                         │
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
Requirement Agent   Domain Agent      Architect Agent
       │                 │                 │
       └────────────┬────┴───────┬─────────┘
                    ▼            ▼
                Data Agent   Integration Agent
                    │            │
                    ├──────┬─────┘
                    ▼      ▼
              Backend   Frontend Agent
                    │      │
                    └──┬───┘
                       ▼
                    QA Agent
                       ▼
                  Review Agent
                       ▼
                   Pull Request
                       ▼
                   Human Review
                       ▼
                      CI/CD
```

## 11.1 Agent 역할

### Orchestrator

- 요구사항을 Work Package로 분해
- 의존성 분석
- 작업 순서 결정
- 각 Agent에 필요한 Spec만 전달
- Spec Gap 발견 시 작업 중단/상신
- 결과물 통합
- 테스트/리뷰 완료 여부 확인

### Requirement Agent

- PDF/업무요청에서 기능 요구사항 추출
- Acceptance Criteria 작성
- Source 근거와 설계추가사항 구분

### Domain Agent

- CRM 영업업무 해석
- Entity/State/Business Rule 검증
- 업무 간 충돌 탐지

### Architect Agent

- API 경계
- Transaction 경계
- 모듈 의존성
- 비기능 요구사항
- 변경 영향 분석

### Data Agent

- ERD
- Table/Index
- Migration
- Seed/Common Code
- 데이터 정합성 제약

### Backend Agent

- API
- Domain/Application Service
- Validation
- Transaction
- Unit Test

### Frontend Agent

- Screen
- Routing
- Form/Grid
- UX 상태제어
- API 연동
- Component Test

### Integration Agent

- CRM ↔ ERP
- CRM ↔ 심평원
- DTO Mapping
- Retry
- Idempotency
- Interface Log

### QA Agent

- Unit/API/Integration/E2E
- Business Rule 테스트
- Regression Test
- Negative Case

### Review Agent

- Spec 준수
- 보안
- 예외처리
- 성능
- 테스트 누락
- 코드 품질

---

# 12. Repository 구조

목표 구조:

```text
dio_crm_dev_proj/
│
├─ docs/
│  ├─ 01_CRM_AI_Orchestration_Design.md
│  └─ 02_CRM_Phased_Work_Instructions.md
│
├─ spec/
│  ├─ process/
│  ├─ entities/
│  ├─ states/
│  ├─ rules/
│  ├─ permissions/
│  ├─ interfaces/
│  ├─ screens/
│  ├─ tests/
│  └─ gaps/
│
├─ backend/
├─ frontend/
├─ database/
│  ├─ migrations/
│  ├─ seeds/
│  └─ scripts/
│
├─ integration/
├─ tests/
│  ├─ unit/
│  ├─ api/
│  ├─ integration/
│  └─ e2e/
│
├─ work/
│  ├─ backlog/
│  ├─ active/
│  └─ done/
│
└─ .github/
   ├─ workflows/
   └─ pull_request_template.md
```

---

# 13. Canonical Spec 형식

## 13.1 Entity 예시

```yaml
entity: Opportunity
key: opportunity_id
owner: sales_user_id
relationships:
  account: required
  products: multiple
  contract: zero_or_one
```

## 13.2 State 예시

```yaml
entity: Opportunity
states:
  - NEEDS_ANALYSIS
  - PROPOSAL
  - NEGOTIATION
  - CLOSED_WON
  - CLOSED_LOST

transitions:
  NEEDS_ANALYSIS: [PROPOSAL]
  PROPOSAL: [NEGOTIATION]
  NEGOTIATION: [CLOSED_WON, CLOSED_LOST]
```

## 13.3 Rule 예시

```yaml
id: BR-CON-001
entity: Contract
when:
  action: CREATE
requires:
  opportunity.status: CLOSED_WON
  account.erp_approved: true
on_fail:
  code: CONTRACT_CREATE_NOT_ALLOWED
```

## 13.4 Acceptance Test 예시

```yaml
id: AT-CON-001
scenario: 수주성공 기회에서 계약 생성
precondition:
  opportunity.status: CLOSED_WON
  account.erp_approved: true
when:
  action: create_contract
then:
  contract.count: 1
  opportunity.editable: false
```

---

# 14. Work Package 표준

모든 개발작업은 다음 단위로 요청한다.

```yaml
work_id: CRM-LEAD-001
title: Lead Convert
source:
  - spec/process/lead.md
  - spec/entities/lead.yaml
  - spec/rules/lead.yaml
scope:
  database: true
  backend: true
  frontend: true
  integration: false
acceptance_criteria:
  - Account 생성
  - Contact 생성
  - Opportunity 생성
  - 기존 Activity 연결
  - 전체 Transaction 보장
required_tests:
  - 정상 변환
  - 중복 Account
  - 중복 Contact
  - 필수값 누락
  - rollback
```

Agent는 Work Package에 없는 기능을 임의 추가하지 않는다.

---

# 15. 개발 단계

## Phase 0. Specification / Foundation Design

- 업무프로세스 확정
- Entity
- ERD
- 상태
- Business Rule
- 권한
- Interface
- 화면목록
- Spec Gap 목록

## Phase 1. Platform Foundation

- 인증
- 사용자/조직
- 권한
- 공통코드
- Audit
- Interface Framework
- 파일/알림

## Phase 2. Customer / Lead

- 심평원 연동
- Lead
- Account
- Contact
- 담당자 자동할당
- 중복검사/병합
- Lead Convert

## Phase 3. Sales Activity

- 활동계획
- 캘린더
- 지도
- GPS IN/OUT
- 활동내역
- 활동보고
- 승인
- 직출/직퇴

## Phase 4. Opportunity / Pipeline

- Opportunity
- 패키지 제안
- 단계관리
- Pipeline
- 수주/실패

## Phase 5. ERP Account / Contract / Collection Plan

- ERP 거래처 등록
- 계약생성
- 수금계획
- ERP 계약등록/승인
- 실제수금 연동
- 미수처리

## Phase 6. Order / Sales / Return

- 품목검색
- 재고/가격
- 주문
- 배송지
- 주문/납품
- 매출
- 반품/교환

## Phase 7. Ledger / Statement / Analytics

- 패키지원장
- Excel
- 월합 거래명세서 PDF
- Dashboard
- KPI/Funnel

## Phase 8. Hardening / Rollout

- Security
- 성능
- 장애/Retry
- 백업/복구
- Monitoring
- 사용자 교육
- 단계적 전환

---

# 16. CI/CD 및 품질 게이트

PR Merge 전에 최소 다음을 통과해야 한다.

```text
Spec Validation
    ↓
Build
    ↓
Unit Test
    ↓
API Test
    ↓
Integration Test
    ↓
Security/Lint
    ↓
Review Agent
    ↓
Human Review
```

운영 배포는 별도 승인 Gate를 둔다.

## 운영 변경 금지 규칙

AI는 직접 다음 행위를 하지 않는다.

- Production DB Schema 변경
- 운영 ERP 데이터 수정
- 운영 공통코드 임의변경
- 승인 이력 삭제
- 계약/수금/매출 데이터 강제 수정
- 비밀정보를 코드/문서에 저장

---

# 17. 로깅/감사/연동 추적

## 17.1 Interface Log 필수 항목

```text
interface_log_id
interface_code
request_id
source_system
target_system
source_key
request_time
response_time
status
retry_count
request_payload
response_payload
error_code
error_message
```

민감정보는 로그에서 Masking한다.

## 17.2 Audit Log 대상

- Lead Convert
- Account Merge
- Opportunity Won/Lost
- Contract 생성
- 수금계획 변경
- 주문요청
- 승인/반려
- ERP 등록요청
- 관리자 권한 변경

---

# 18. 테스트 전략

## 18.1 Unit Test

- Business Rule
- State Transition
- Calculation
- Mapping

## 18.2 API Test

- 정상
- 권한오류
- 필수값
- 중복
- 잘못된 상태
- Concurrency

## 18.3 Integration Test

- ERP 정상
- ERP Timeout
- ERP Duplicate
- ERP Retry
- Idempotency
- 심평원 Batch

## 18.4 E2E 핵심 Scenario

1. 신규병원 → Lead → 방문활동 → Convert → Opportunity
2. Opportunity → 수주 → Contract → 수금계획 → ERP 승인
3. Contract → 주문 → ERP 출고 → 매출/수금 조회
4. 활동계획 → GPS IN → 상담 → OUT → 보고 → 승인
5. 직출/직퇴 → 승인 → ERP 연동

---

# 19. 현재 반드시 추가 확인해야 하는 Spec Gap

PDF만으로 확정할 수 없는 대표 항목이다.

| Gap | 확인 필요사항 |
|---|---|
| GPS 허용거리 | 실제 거리(m), 예외처리 |
| GPS 위변조 대응 | Mock Location/정확도 기준 |
| Opportunity 승인 | 지점장/본부장 승인 적용 조건 및 시점 |
| 조직 구조 | 본부/지점/팀과 대행권한 |
| ERP API | Request/Response/에러코드/Timeout |
| 심평원 Interface | 수신방식/필드/배치 실패 재처리 |
| 제품/가격/재고 | 실시간 API인지 동기화 Master인지 |
| 주문 취소 | 취소/정정/부분취소 규칙 |
| 반품/교환 | CRM 입력범위와 ERP 업무경계 |
| 수금계획 | CRM/ERP 중 최종 Master와 변경승인 규칙 |
| 데이터 보존 | 활동/GPS/감사로그/첨부 보존기간 |
| 알림 | 앱/메일/SMS/Push 적용범위 |
| 문서 | 거래명세서 PDF 양식 및 전자서명 여부 |

Gap이 해결되지 않은 기능은 Production 개발 완료로 간주하지 않는다.

---

# 20. Definition of Done

기능 하나의 완료 기준:

- [ ] Process Spec 존재
- [ ] Entity/Field 정의 완료
- [ ] State/Rule 정의 완료
- [ ] 권한 정의 완료
- [ ] API Contract 완료
- [ ] Migration 완료
- [ ] Backend 구현
- [ ] Frontend 구현
- [ ] Unit Test
- [ ] API Test
- [ ] 필요 시 Integration Test
- [ ] Acceptance Test 통과
- [ ] Review Agent 검토
- [ ] Human Review
- [ ] 사용자 문서 업데이트
- [ ] Spec과 코드의 불일치 없음

---

# 21. 프로젝트 성공 기준

본 프로젝트의 성공은 단순히 Salesforce 화면을 복제하는 것이 아니다.

성공 기준은 다음과 같다.

1. Lead → Activity → Opportunity → Contract → Order → Collection 전체 흐름이 추적된다.
2. 업무상태와 승인규칙이 명확하다.
3. CRM과 ERP의 Master 데이터 경계가 명확하다.
4. 모든 중요 Action이 감사 가능하다.
5. Agent가 동일 Spec을 보고 개발/테스트한다.
6. 미정의 요구사항을 AI가 임의로 구현하지 않는다.
7. 변경사항이 PR/Test/Review 이력을 가진다.
8. 운영 데이터 변경은 사람의 승인 없이 수행되지 않는다.

---

# 22. 다음 산출물

본 설계서를 기준으로 다음 파일을 순차적으로 생성한다.

```text
spec/process/*.md
spec/entities/*.yaml
spec/states/*.yaml
spec/rules/*.yaml
spec/permissions/*.yaml
spec/interfaces/*.yaml
spec/screens/*.yaml
spec/tests/*.yaml
spec/gaps/*.md
```

실제 구현 작업의 순서와 Agent별 지시사항은 `docs/02_CRM_Phased_Work_Instructions.md`를 기준으로 한다.
