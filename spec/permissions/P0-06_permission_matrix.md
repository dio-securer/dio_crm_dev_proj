# P0-06 권한 Matrix

> PDF에 직접 확인되는 역할/행위만 Baseline으로 정의한다. 세부 CRUD/데이터범위는 Phase 1에서 RBAC/ABAC 설계로 확정한다.

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
| Lead Convert | C/U | R | R | M | - | M | - |
| Account 조회 | R(지점범위) | R | R | R | 제한 | R | R |
| 본인 Account 수정 | U | R | R | M | - | M | - |
| ERP 거래처 등록요청 | C | R | R | M | - | M | 전송 |
| Opportunity 생성/수정 | C/U | R | R | R/M | - | M | - |
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
| 캠페인/리드 인입 | R | R | R | R | C/U/M | M | 자동 |
| 중복 거래처 병합 | - | - | - | M(추정) | - | M | - |
| Interface 실패 재처리 | - | - | - | 제한 | - | M | 실행 |
| 공통코드/권한설정 | - | - | - | - | - | M | - |

## 3. 데이터 Scope

PDF에서 확인 가능한 기준:
- 모든 Lead 레코드는 볼 수 있으나 본인 담당 Lead만 수정 가능.
- 거래처는 나의 지점 담당 거래처들을 볼 수 있으나 본인 거래처만 수정 가능.
- 지점장/본부장은 자신의 승인 대상 보고를 조회/승인.

자체개발 권장 Scope:
- SELF: 본인 소유
- BRANCH: 소속 지점
- DIVISION: 본부
- ALL: 전사
- SYSTEM: Integration 전용

## 4. 승인권한

```text
Activity Report / Direct Work
Sales Rep → Branch Manager → Division Manager
```

직출/직퇴에는 승인자 재할당 기능이 존재한다. 재할당 가능 대상범위, 재할당 로그, 대리승인 정책은 GAP.

## 5. 보안설계 원칙
- UI 메뉴권한 + API 권한 + 데이터 Scope 분리.
- JWT/세션에 user_id, organization_id, role/permission scope 포함 권장.
- 승인 API는 대상 승인자의 권한과 조직경로를 서버에서 재검증.
- ERP Integration 자격정보는 사용자 권한과 분리.
- AuditLog에 권한변경/승인/병합/ERP 재처리 기록.
