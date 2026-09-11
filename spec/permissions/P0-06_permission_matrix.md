# P0-06 권한 Matrix

> PDF에 직접 확인되는 역할/행위를 Baseline으로 정의하고, Phase 0 승인된 Gap 결정사항을 반영한다.

## 1. 역할
- 영업담당자
- 지점장
- 본부장
- 영업관리팀
- 마케팅/교육팀
- CRM 관리자
- Integration/System 계정
- ERP 사용자/승인자(외부 시스템 역할)

## 2. 업무 권한 Matrix

범례: `R` 조회, `C` 생성, `U` 수정, `A` 승인, `M` 관리/재할당, `-` 기본 없음/미정

| 업무 | 영업담당자 | 지점장 | 본부장 | 영업관리 | 마케팅/교육 | CRM관리자 | System |
|---|---|---|---|---|---|---|---|
| Lead 전체조회 | R | R | R | R | R(관련) | R | R |
| 본인 Lead 수정 | U | R | R | M | - | M | - |
| Lead 재할당 | - | - | - | M | - | M | 자동 |
| Lead 정방향 상태변경 | U | U | U | M | - | M | - |
| Lead 역전이/컨택제외 재오픈 | - | M | R | M | - | M | - |
| Lead Convert | C/U | R | R | M | - | M | - |
| Account 조회 | R(지점범위) | R | R | R | 제한 | R | R |
| 본인 Account 수정 | U | R | R | M | - | M | - |
| ERP 거래처 등록요청 | C | R | R | M | - | M | 전송 |
| Opportunity 생성/수정 | C/U | R | R | R/M | - | M | - |
| Opportunity Open 단계변경 | U | U | U | M | - | M | - |
| Opportunity Closed 재오픈 | - | M | R | M | - | M | - |
| Contract 생성 | C | R | R | R | - | M | - |
| 수금계획 작성/수정 | C/U | R | R | R | - | M | 수신/전송 |
| 주문요청 | C | R | R | R | - | M | 전송 |
| Activity Plan | C/U | R | R | R | - | M | - |
| Activity IN/OUT | C/U(본인) | R | R | R | - | M | - |
| Activity Report 요청 | C/U(본인) | R | R | R | - | M | 알림 |
| Activity Report 지점장 승인 | - | A | R | R | - | M | 알림 |
| Activity Report 본부장 승인 | - | R | A | R | - | M | 알림 |
| 직출/직퇴 요청 | C/U | R | R | R | - | M | 알림 |
| 직출/직퇴 지점장 승인 | - | A | R | R | - | M | 알림 |
| 직출/직퇴 본부장 승인 | - | R | A | R | - | M | 알림 |
| 승인 재할당/대리승인 | - | 조건부 | 조건부 | M | - | M | - |
| 캠페인/리드 인입 | R | R | R | R | C/U/M | M | 자동 |
| 중복 거래처 병합 | - | - | - | M(추정) | - | M | - |
| Interface 실패 재처리 | - | - | - | 제한 | - | M | 실행 |
| 공통코드/권한설정 | - | - | - | - | - | M | - |
| GPS IN 거리 설정 | - | - | - | - | - | M | - |

## 3. 데이터 Scope

PDF에서 확인 가능한 기준:
- 모든 Lead 레코드는 볼 수 있으나 본인 담당 Lead만 수정 가능.
- 거래처는 나의 지점 담당 거래처들을 볼 수 있으나 본인 거래처만 수정 가능.
- 지점장/본부장은 자신의 승인 대상 보고를 조회/승인.

자체개발 Scope:
- SELF: 본인 소유
- BRANCH: 소속 지점
- DIVISION: 본부
- ALL: 전사
- SYSTEM: Integration 전용

모든 업무 데이터 접근에는 `company_id` 경계를 우선 적용하고 그 안에서 Scope를 적용한다.

## 4. 승인권한

```text
Activity Report / Direct Work
Sales Rep → Branch Manager → Division Manager
```

### 승인자 결정
- 승인 요청 시점의 ERP 기반 조직 Snapshot으로 지점장/본부장을 확정한다.
- 승인 진행 중 조직개편이 발생해도 기존 승인자의 자동 변경은 하지 않는다.

### 대리승인/재할당
- `ApprovalDelegation`에 등록된 유효기간 내 위임만 허용한다.
- 직출/직퇴의 재할당은 동일 승인엔진에서 처리한다.
- 재할당/대리승인 주체, 원 승인자, 대상 승인자, 시각, 사유를 AuditLog에 남긴다.
- 승인자가 누락된 조직은 단계를 자동 Skip하지 않고 `APPROVER_NOT_CONFIGURED`로 요청을 차단한다.

## 5. 사용자/조직 Master

- ERP가 사용자/조직/지점/본부의 Source of Truth다.
- CRM은 동기화 사본을 보유한다.
- CRM에서만 관리하는 항목:
  - CRM Role
  - Permission
  - Data Scope
  - Approval Delegation
  - CRM 사용여부/인증 연결정보

ERP 원천 조직필드는 CRM에서 일반 사용자가 수정할 수 없다.

## 6. 보안설계 원칙
- UI 메뉴권한 + API 권한 + 데이터 Scope 분리.
- JWT/세션에 user_id, company_id, organization_id, role/permission scope 포함 권장.
- 승인 API는 대상 승인자의 권한과 요청시점 승인 Snapshot을 서버에서 재검증.
- ERP Integration 자격정보는 사용자 권한과 분리.
- AuditLog에 권한변경/승인/병합/ERP 재처리/상태 역전이 기록.

## 7. 관련 결정서
- `spec/gaps/P0-09_p1_gap_decisions.md`
