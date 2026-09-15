# RM-MKT-001 M0 — HQ Regression Baseline

- Work ID: `RM-MKT-001-M0`
- Baseline: `main@f7cbc53d88152aa8b753e4e6525df1adbe7d70d6`
- 목적: Multi-Market Refactoring 중 본사 CRM의 기능/규칙/화면 진입점이 손상되지 않도록 Regression 기준을 고정
- Source change: `NO`

---

## 1. 기준 자료

본 문서는 두 종류의 기준을 함께 사용한다.

### A. 현재 Source 기준

```text
frontend/
backend/
packages/contracts/
database/migrations/
```

현재 구현되어 있는 API, Rule, Feature Toggle, UI Route를 회귀 기준으로 사용한다.

### B. 본사 사용자 교육자료 기준

```text
디오_교육자료_영업활동프로세스_250115.pdf
디오_교육자료_영업판매프로세스_250115.pdf
```

교육자료에 정의되어 있으나 현재 UI가 단순화되어 있거나 일부 미연결된 기능은 `HQ BUSINESS BASELINE`으로 별도 표시한다.

즉 RM-MKT-001은 기존 Source의 기능을 보존하는 동시에, 이미 합의된 본사 업무규칙을 GLOBAL Template 때문에 제거하거나 변형하지 않아야 한다.

---

## 2. Regression 분류

| 등급 | 의미 |
|---|---|
| `MUST_KEEP` | Refactoring 후에도 반드시 동일 동작 유지 |
| `HQ_ONLY` | HQ Template에서 유지하고 GLOBAL에 강제하지 않음 |
| `CORE_REUSE` | 국가 공통 Core로 유지 |
| `PROFILE_CONTROL` | Market/Feature/Workflow Profile로 제어 |
| `GAP_KEEP` | 현재 미구현/미확정 상태 자체를 유지. 임의 구현 금지 |

---

## 3. Authentication / Company Context

### 체크리스트

- [ ] 기존 JWT 인증 흐름 유지 — `MUST_KEEP`
- [ ] `companyId` 기준 데이터 격리 유지 — `MUST_KEEP`
- [ ] `/api/me/context` 응답 유지 — `MUST_KEEP`
- [ ] Locale / Currency / Timezone Resolve 유지 — `CORE_REUSE`
- [ ] `marketProfileCode`, `workflowProfileCode`, `mapProfileCode` 기존 Contract 제거 금지 — `MUST_KEEP`
- [ ] KR 회사의 기존 Context가 `KR_SALES`로 계속 Resolve — `MUST_KEEP`
- [ ] 기존 `ko-KR` 기본 Locale 유지 — `HQ_ONLY`

### 현재 HQ Profile

```text
countryCode         KR
currencyCode        KRW
timezone            Asia/Seoul
marketProfileCode   KR_SALES
workflowProfileCode KR_SALES_APPROVAL
mapProfileCode      KR_DEFAULT
```

---

## 4. Lead — 신규병원발굴

본사 교육자료의 신규병원 발굴은 심평원 기반 신규 리드 유입, 중복 검증, 담당자 할당, 영업 단계 진행, 리드 변환 흐름을 가진다.

### HQ Business Baseline

- [ ] HIRA/심평원 병원 데이터 유입 기능 유지 — `HQ_ONLY`
- [ ] 암호화 요양기관번호 기반 중복 기준 유지 — `HQ_ONLY`
- [ ] 사업자등록번호 중복 검증 구조 유지 — `HQ_ONLY`
- [ ] 지역별 영업담당자 할당 개념 유지 — `HQ_ONLY`
- [ ] Lead 상태 흐름 유지 — `CORE_REUSE`

```text
NEW
FIRST_VISIT
KEYMAN_MEETING
CONTACT_EXCLUDED
CONVERTED
```

- [ ] Contact Excluded 사유 저장 유지 — `CORE_REUSE`
- [ ] Lead → Account / Contact / Opportunity 변환 흐름 유지 — `CORE_REUSE`
- [ ] Lead 변환 시 기존 활동 연결관계 보존 — `MUST_KEEP`

### 현재 Source Baseline

Backend에 다음 기능이 존재한다.

```text
GET/PATCH Lead
Lead Status Transition
Owner Assignment
Lead Convert
HIRA Hospital Import
```

현재 Frontend `LeadsPage`는 목록/검색 중심이므로 RM-MKT-001에서 현재보다 기능을 축소하지 않는다.

---

## 5. Account / Contact

### HQ Business Baseline

- [ ] Account가 Lead 변환 또는 기존 거래처에서 관리되는 구조 유지 — `CORE_REUSE`
- [ ] 거래처 상세에서 영업/계약/수금/주문/매출/활동의 관계를 유지 — `CORE_REUSE`
- [ ] ERP 거래처 등록 요청 기능 유지 — `MUST_KEEP`
- [ ] ERP 연동상태 유지 — `CORE_REUSE`

```text
연동요청전
연동요청중
연동성공
연동실패
```

- [ ] Account Duplicate / Merge 기능 유지 — `MUST_KEEP`
- [ ] Contact 관계 유지 — `CORE_REUSE`

### HQ 전용 Field Baseline

다음 Field/Section은 HQ 화면에서 사라지면 안 된다.

```text
HIRA / 요양기관 정보
providerNo
encryptedProviderNo
doctorLicenseNo
사업자정보
병원 주소
개원일
ERP 고객코드 / 거래상태 / 승인상태
```

분류: `HQ_ONLY + PROFILE_CONTROL`

### 중요 원칙

GLOBAL Account를 만들기 위해 HQ HIRA Section을 삭제하지 않는다.

정답은:

```text
HQ_ACCOUNT → HIRA 포함
GLOBAL_ACCOUNT → Global Field Profile
```

이다.

---

## 6. Activity Plan / Event

본사 교육자료는 영업활동 계획과 직출/직퇴를 연결한다.

### HQ Business Baseline

- [ ] Lead / Account / Opportunity에 활동계획 연결 가능 — `CORE_REUSE`
- [ ] 방문 예정일시 / 방문목적 유지 — `CORE_REUSE`
- [ ] 동일 대상·동일 일자 계획 중복 제한 유지 — `MUST_KEEP`
- [ ] Event와 Activity의 관계 유지 — `MUST_KEEP`
- [ ] 직출/직퇴 선택 및 사유 유지 — `HQ_ONLY`
- [ ] 직출/직퇴 선택 시 사유 필수 — `HQ_ONLY`

현재 Source `validatePlanInput`도 직출/직퇴가 선택되면 사유를 필수로 검증한다.

---

## 7. GPS IN / OUT

### HQ Business Baseline

- [ ] 브라우저/단말 GPS 기반 IN 유지 — `CORE_REUSE`
- [ ] 병원 좌표가 없으면 IN 불가 — `MUST_KEEP`
- [ ] 허용 거리 밖 IN 차단 — `MUST_KEEP`
- [ ] 다른 활동이 IN 상태이면 추가 IN 차단 — `MUST_KEEP`
- [ ] IN 이후 OUT 전 활동정보 수정 가능 — `MUST_KEEP`
- [ ] OUT 후 Activity 완료 처리 — `MUST_KEEP`
- [ ] GPS 정확도 값 저장 유지 — `MUST_KEEP`
- [ ] Mock GPS 여부 값 저장 유지 — `MUST_KEEP`

현재 허용거리 설정:

```text
crm_system_setting.ACTIVITY_GPS_IN_DISTANCE_M
```

설정 미존재/비정상 시 기본값:

```text
200m
```

### GAP 유지

GPS Mock/Accuracy 정책은 기록은 하지만 현재 Source에서 별도 차단 기준으로 사용하지 않는다.

RM-MKT-001에서 임의로 보안정책을 추가하지 않는다 — `GAP_KEEP`.

---

## 8. Activity Report

### HQ Business Baseline

- [ ] 보고일자의 완료 활동을 Result로 포함 — `MUST_KEEP`
- [ ] 보고일 기준 향후 5일의 활동계획을 Plan으로 포함 — `MUST_KEEP`
- [ ] 보고내용 수정 지원 — `MUST_KEEP`
- [ ] OUT하지 않은 활동이 존재하면 승인요청 불가 — `MUST_KEEP`
- [ ] 승인요청 후 상태관리 유지 — `MUST_KEEP`
- [ ] 최종승인된 보고에 포함된 Activity Lock 유지 — `MUST_KEEP`

현재 Source 보고상태:

```text
DRAFT
REQUESTED
BRANCH_APPROVED
FINAL_APPROVED
```

---

## 9. HQ Approval Route

현재 HQ Workflow:

```text
Sales Rep
  ↓
BRANCH_MANAGER
  ↓
DIVISION_MANAGER
```

### 체크리스트

- [ ] `KR_SALES_APPROVAL` 유지 — `HQ_ONLY`
- [ ] Activity Report 2단계 승인 유지 — `HQ_ONLY`
- [ ] Direct Work 2단계 승인 유지 — `HQ_ONLY`
- [ ] 조직/승인자 Snapshot 원칙 유지 — `MUST_KEEP`
- [ ] 해외법인 Workflow를 만들 때 KR Workflow를 수정하지 않음 — `MUST_KEEP`

---

## 10. Direct Work / Direct Leave

본사 교육자료는 직출/직퇴 승인과 ERP 전송을 별도 업무로 관리한다.

### HQ Business Baseline

- [ ] Direct Work / Direct Leave 구분 유지 — `HQ_ONLY`
- [ ] 사유 필수 유지 — `HQ_ONLY`
- [ ] 지점장 → 본부장 승인 유지 — `HQ_ONLY`
- [ ] 반려 후 동일 DirectWork 기준 재승인 가능 구조 유지 — `HQ_ONLY`
- [ ] OUT / 최종승인 조건 충족 후 ERP Queue 연동 유지 — `HQ_ONLY`
- [ ] ERP 연동상태 이력 유지 — `HQ_ONLY`

현재 `DIRECT_WORK` Feature로 메뉴/입력 일부를 제어한다.

해외법인에서 `DIRECT_WORK=false`가 되더라도 HQ에서는 반드시 `true` 유지가 Regression 기준이다.

---

## 11. Opportunity / Pipeline

### HQ Business Baseline

- [ ] Opportunity Stage 유지 — `CORE_REUSE`

```text
NEEDS_ANALYSIS
PROPOSAL
NEGOTIATION
CLOSED_WON
CLOSED_LOST
```

- [ ] 제품/패키지 제안 등록 유지 — `CORE_REUSE`
- [ ] Stage 변경 Audit 유지 — `MUST_KEEP`
- [ ] CLOSED_WON 이전 ERP 거래처 승인 조건 유지 — `MUST_KEEP`
- [ ] Contract 생성 이후 Won Opportunity Lock 원칙 유지 — `MUST_KEEP`
- [ ] Funnel/Pipeline 조회 유지 — `CORE_REUSE`

### GAP 유지

Opportunity 관리자 승인 여부는 별도 GAP로 남아 있으며 RM-MKT-001에서 임의로 승인 Workflow를 추가하지 않는다 — `GAP_KEEP`.

---

## 12. Contract / Collection Plan

본사 교육자료 기준으로 Opportunity가 수주 성공한 뒤 ERP 승인된 거래처에 대해 Contract를 생성한다.

### 체크리스트

- [ ] Won Opportunity에서 Contract 생성 — `MUST_KEEP`
- [ ] ERP 승인 완료 Account 조건 유지 — `MUST_KEEP`
- [ ] Opportunity당 최초 Contract 1회 원칙 유지 — `MUST_KEEP`
- [ ] Contract 생성 후 Opportunity 수정 제한 유지 — `MUST_KEEP`
- [ ] 제품금액 / 상품금액 / 계약금액 관계 유지 — `CORE_REUSE`
- [ ] Collection Plan 생성 유지 — `CORE_REUSE`
- [ ] Contract ERP Request Queue 유지 — `CORE_REUSE`
- [ ] 실제 수금 ERP Reconciliation 유지 — `CORE_REUSE`

---

## 13. Order / Delivery / Sales / Return

### HQ Business Baseline

- [ ] ERP 승인되고 마감되지 않은 Contract만 주문가능 — `MUST_KEEP`
- [ ] Product 검색/선택/수량 유지 — `CORE_REUSE`
- [ ] 재고/주문가능 상태 조회 유지 — `CORE_REUSE`
- [ ] 배송지 선택 유지 — `CORE_REUSE`
- [ ] Order ERP Request Queue 유지 — `CORE_REUSE`
- [ ] Delivery Status 조회 유지 — `CORE_REUSE`
- [ ] Sales 조회 유지 — `CORE_REUSE`
- [ ] Return / Exchange 조회 유지 — `CORE_REUSE`

GLOBAL Order 화면이 달라져도 위 Domain Rule을 복제하지 않고 Core API를 재사용하는 것을 기본 원칙으로 한다.

---

## 14. Package Ledger / Monthly Statement

본사 교육자료에 패키지원장과 월합 거래명세서 기능이 명시되어 있다.

### 체크리스트

- [ ] Contract 기준 패키지원장 조회 유지 — `HQ_ONLY/CORE_REUSE`
- [ ] 일반 거래내역 조회 옵션 유지 — `HQ_ONLY/CORE_REUSE`
- [ ] XLSX 다운로드 유지 — `MUST_KEEP`
- [ ] 월합 거래명세서 기본기간 = 전월 유지 — `MUST_KEEP`
- [ ] 조회 시작일 최소 `2018-01-01` 유지 — `MUST_KEEP`
- [ ] Desktop에서 거래선택 후 PDF 생성 가능 구조 유지 — `MUST_KEEP`
- [ ] Mobile 전체 상세 기준 유지 — `MUST_KEEP`
- [ ] Locale/Currency/Timezone 기반 Export 유지 — `CORE_REUSE`

해외법인 매뉴얼에서 이 기능의 사용여부는 확인되지 않았으므로 GLOBAL에서는 자동 활성화하지 않는다.

---

## 15. Account 360 / Service

- [ ] Account360의 Sales / Order / Activity 요약 유지 — `CORE_REUSE`
- [ ] Service가 미구현 상태인 경우 `available=false`를 유지 — `GAP_KEEP`
- [ ] Customer Center / Service를 RM-MKT-001에서 임의 구현하지 않음 — `GAP_KEEP`

---

## 16. ERP / Integration Baseline

- [ ] ERP Account Request Queue 유지 — `CORE_REUSE`
- [ ] ERP Contract Request Queue 유지 — `CORE_REUSE`
- [ ] ERP Order Request Queue 유지 — `CORE_REUSE`
- [ ] Delivery / Sales / Collection 결과 반영 구조 유지 — `CORE_REUSE`
- [ ] Interface Log 유지 — `MUST_KEEP`
- [ ] Retry / Circuit Breaker 유지 — `MUST_KEEP`
- [ ] Audit Log 유지 — `MUST_KEEP`
- [ ] Production ERP를 RM-MKT-001에서 직접 연결/변경하지 않음 — `MUST_KEEP`

국가별 ERP 차이는 `Integration Profile / Adapter`에서 해결하고 Core Interface Framework를 Fork하지 않는다.

---

## 17. PWA / Responsive Baseline

- [ ] DIO App Shell 유지
- [ ] Desktop / Tablet / Mobile Responsive 유지
- [ ] Mobile Bottom Navigation 유지
- [ ] PWA Manifest 유지
- [ ] Service Worker 유지
- [ ] API GET/POST Cache 안전정책 유지
- [ ] Offline App Shell만 허용하고 업무 Mutation Offline Sync를 임의 추가하지 않음

분류: `MUST_KEEP`.

---

## 18. HQ Feature Baseline

현재 KR Profile에서 다음 Feature는 모두 `true`다.

| Feature | HQ 기대값 | 분류 |
|---|---:|---|
| `HIRA_IMPORT` | true | HQ_ONLY |
| `DIRECT_WORK` | true | HQ_ONLY |
| `GPS_CHECKIN` | true | CORE_REUSE |
| `ACTIVITY_APPROVAL` | true | HQ_ONLY/PROFILE_CONTROL |
| `ERP_ACCOUNT_APPROVAL` | true | CORE_REUSE |
| `MONTHLY_STATEMENT` | true | HQ_ONLY/PROFILE_CONTROL |

M1~M8 과정에서 KR Profile의 값이 변경되면 Regression Failure로 본다.

---

## 19. HQ Regression Acceptance Checklist

### Critical

```text
[ ] KR /api/me/context 호환
[ ] KR Feature Set 유지
[ ] HIRA Import 유지
[ ] Direct Work 메뉴/입력/승인 유지
[ ] GPS 200m 기본값 및 설정 Override 유지
[ ] 동시 Open Activity IN 차단 유지
[ ] Activity Report D+5 유지
[ ] OUT 미완료 승인요청 차단 유지
[ ] Branch → Division 승인 유지
[ ] Won → Contract Rule 유지
[ ] ERP Approved Account Rule 유지
[ ] Approved/Non-closed Contract Order Rule 유지
[ ] Ledger XLSX 유지
[ ] Monthly Statement PDF 유지
[ ] Account360 유지
[ ] Interface/Audit/Circuit Breaker 유지
[ ] Responsive/PWA 유지
```

### Non-regression Principle

GLOBAL Template 구현을 위해 HQ 기능을 공통 최소기능으로 축소하지 않는다.

```text
나쁜 방향
HQ 기능 삭제 → GLOBAL에 맞춘 단일 화면

정상 방향
Core 유지
  ├─ HQ_TEMPLATE    : 본사 기능 보존
  └─ GLOBAL_TEMPLATE: 해외법인 화면/기능 구성
```

---

## 20. M0 Result

```text
HQ Regression 기준    COMPLETE
HQ Only 기능 식별      COMPLETE
Core 재사용 기능 식별  COMPLETE
GAP Preserve 항목      COMPLETE
```

본 문서는 M1~M10의 Regression Review Checklist로 사용한다.
