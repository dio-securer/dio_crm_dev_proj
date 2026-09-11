# P0-09 P1 우선 Gap 결정서

- 프로젝트: DIO CRM 자체개발
- 결정일: 2026-09-11
- 목적: Phase 0 승인 및 Phase 1 착수를 위해 P1 선행 Gap을 개발 Baseline으로 확정한다.
- 원칙: 아래 결정은 **자체개발 Baseline**이며, 운영 검증에서 문제가 확인되면 ADR/변경이력으로 수정한다.

## 1. 결정 요약

| GAP ID | 결정 | 상태 |
|---|---|---|
| GAP-001 | GPS IN 기본 허용거리 200m, 시스템 설정값으로 관리 | RESOLVED |
| GAP-003 | 사용자/조직 Master는 ERP를 기준으로 하고 CRM은 동기화 사본 + CRM 전용 권한을 관리 | RESOLVED |
| GAP-004 | 승인경로는 요청시점 조직 Snapshot 기준 `영업담당자 → 지점장 → 본부장`, 대리/재할당은 명시적 위임과 Audit 필수 | RESOLVED |
| GAP-007 | Lead 일반 사용자는 정방향 중심, 역전이는 관리자 권한 + 사유 + Audit, `CONVERTED`는 Terminal | RESOLVED |
| GAP-008 | Opportunity Open 단계는 역전이 허용하되 Audit, Closed Lost 재오픈은 관리자, Closed Won은 계약생성 후 재오픈 금지 | RESOLVED |
| GAP-018 | 내부 PK `bigint IDENTITY`, 외부/API용 `public_id uniqueidentifier`, `company_id` 필수, Soft Delete는 Master/Config에만 적용 | RESOLVED |

> 기존 Gap 표의 `GAP-002 위치 오차 허용/Mock GPS 정책`은 Activity 구현 전 결정하면 되므로 우선순위를 **P1 → P2(Phase 3 착수 전 필수)** 로 조정한다. 따라서 Phase 1 Foundation 착수를 막지 않는다.

---

## 2. GAP-001 — GPS IN 허용거리

### 결정
- 기본값: `200m`
- 하드코딩하지 않고 시스템 설정 `ACTIVITY_IN_RADIUS_M`로 관리한다.
- 최초 운영값은 200m이며, 향후 법인/지역별 Override 필요 시 설정 계층을 확장한다.
- 일반 사용자는 값을 변경할 수 없고 CRM 관리자 설정으로 제한한다.

### 구현 기준
```text
거리 <= ACTIVITY_IN_RADIUS_M  → IN 허용
거리 >  ACTIVITY_IN_RADIUS_M  → IN 거부
```

### 이유
- 교육자료는 GPS 기반 제한거리 검증을 요구하지만 정확한 수치는 제시하지 않는다.
- 현장 GPS 편차를 고려하면서도 실제 병원 방문 여부를 검증할 수 있도록 200m를 초기 Baseline으로 채택한다.

---

## 3. GAP-003 — 사용자/조직 Master 원천

### 결정
- **ERP를 사용자/조직/영업담당자 기본 Master의 Source of Truth로 사용한다.**
- CRM은 업무 수행을 위해 필요한 사용자/조직 정보를 동기화하여 보관한다.
- CRM 전용 정보는 CRM에서 별도 관리한다.
  - Login/인증 연결정보
  - CRM Role / Permission
  - 데이터 Scope
  - 승인 위임정보
  - 활성/비활성 CRM 사용여부

### 데이터 소유권
```text
ERP
 └─ 사번 / 성명 / 조직 / 지점 / 본부 / 재직/담당정보
        ↓ sync
CRM User / Organization Shadow Master
 └─ CRM Role / Permission / Scope / Delegation
```

### 구현 원칙
- ERP Master 필드는 CRM에서 임의 수정하지 않는다.
- CRM에서 ERP와 다른 조직정보를 별도로 만들지 않는다.
- ERP 동기화 실패 시 기존 CRM 사본으로 업무는 유지하되 관리자에게 오류를 노출한다.

---

## 4. GAP-004 — 승인자 결정 및 대리승인

### 결정
기본 승인경로:
```text
영업담당자
  → 지점장 (Step 1)
    → 본부장 (Step 2)
```

### 승인자 확정 시점
- **승인 요청 시점의 조직구조를 Snapshot**하여 승인자 ID를 저장한다.
- 승인 진행 중 조직개편이 발생해도 기존 요청의 승인자는 자동 변경하지 않는다.

### 대리승인/재할당
- `ApprovalDelegation` 개념을 둔다.
- 위임자는 시작일/종료일과 대리승인자를 명시해야 한다.
- 직출/직퇴의 재할당 기능도 동일 승인 엔진을 사용한다.
- 재할당/대리승인은 반드시 AuditLog에 남긴다.

### 예외
- 지점장 또는 본부장이 지정되지 않은 조직은 승인단계를 자동 Skip하지 않는다.
- 승인요청을 차단하고 `APPROVER_NOT_CONFIGURED` 오류로 관리자 설정을 요구한다.

---

## 5. GAP-007 — Lead 역전이 정책

### 결정
정상 영업담당자는 정방향 전이를 기본으로 한다.

```text
신규등록 → 초도방문 → 키맨미팅 → 변환
                   └→ 컨택제외
```

### 역전이
- `신규등록 / 초도방문 / 키맨미팅` 사이의 역전이는 **지점장 또는 CRM 관리자**만 가능하다.
- 역전이 시 `reason` 입력 및 AuditLog 기록을 필수로 한다.
- `컨택제외`는 지점장/CRM 관리자가 활성 단계로 재오픈할 수 있다.
- `변환(CONVERTED)`은 Terminal 상태이며 역전이 금지한다.
- Convert 오류는 상태 Rollback이 아니라 별도의 관리자 보정/병합 프로세스로 처리한다.

---

## 6. GAP-008 — Opportunity 역전이 / 재오픈

### 결정
Open 단계:
```text
NEEDS_ANALYSIS ↔ PROPOSAL ↔ NEGOTIATION
```

- 영업담당자는 Open 단계 내에서 앞/뒤 단계 변경 가능.
- 역전이 시 사유를 기록하고 Stage History를 보존한다.

Closed 단계:
- `CLOSED_LOST` → 재오픈: 지점장 또는 CRM 관리자만 가능.
- `CLOSED_WON` → 재오픈:
  - Contract 미생성: 지점장 또는 CRM 관리자만 가능, 사유 필수.
  - Contract 생성 완료: 재오픈 금지.
- Contract 생성 이후 Opportunity 수정불가 Rule을 유지한다.

### 구현 권장
`opportunity_stage_history`를 두고 다음을 보존한다.
- from_stage
- to_stage
- changed_at/by
- reason

---

## 7. GAP-018 — PK / Soft Delete / 법인키

### PK 결정
SQL Server 내부 PK:
```sql
id bigint IDENTITY(1,1) PRIMARY KEY
```

외부/API 노출 식별자:
```sql
public_id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID()
```

원칙:
- 내부 Join/FK는 `bigint` 사용.
- URL/API/외부 연동에서 내부 Identity 직접 노출을 지양하고 `public_id` 사용.

### 법인키
- 업무 Master/Transaction 테이블에 `company_id`를 필수 적용한다.
- 국내 1개 법인으로 시작해도 글로벌 확장을 고려하여 데이터 경계를 처음부터 둔다.

### Soft Delete
적용:
- User/Organization의 CRM 관리정보
- Lead
- Account
- Contact
- 공통코드/설정 등 Master/Config

권장 컬럼:
```text
is_deleted
 deleted_at
 deleted_by
```

미적용:
- Contract
- CollectionPlan/Actual
- Order/Delivery/Sales
- Approval
- AuditLog
- InterfaceLog

Transaction/Audit 데이터는 삭제 대신 상태취소/무효화 이력을 사용한다.

---

## 8. Phase 1 반영사항

Phase 1에서 반드시 반영한다.

1. `company_id + bigint PK + public_id` 공통 Entity 규칙
2. ERP User/Organization Sync 구조
3. RBAC + Data Scope
4. Approval Engine 및 ApprovalDelegation
5. 시스템 설정 테이블(`ACTIVITY_IN_RADIUS_M` 포함)
6. AuditLog 및 상태변경 History

## 9. 승인효과

위 6개 결정을 Phase 0 개발 Baseline으로 채택한다.
남은 P2/P3 Gap은 각 도메인 착수 전 해결하며 Phase 1 Foundation 착수는 허용한다.
