# P0-09 Spec Gap 정리 및 Phase 0 승인자료

## 1. Phase 0 산출물

- P0-01 전체 업무 프로세스 분해
- P0-02 Entity/Data Dictionary
- P0-03 논리 ERD 초안
- P0-04 상태전이
- P0-05 Business Rule
- P0-06 권한 Matrix
- P0-07 ERP/심평원 Interface Catalog
- P0-08 Screen/Menu Catalog
- P0-09 Spec Gap/승인자료
- P0-09 P1 우선 Gap 결정서

## 2. P1 우선 Gap 결정 결과

| GAP ID | 결정 | 상태 |
|---|---|---|
| GAP-001 | GPS IN 기본 허용거리 200m, 시스템 설정값으로 관리 | RESOLVED |
| GAP-003 | 사용자/조직 Master는 ERP 기준, CRM은 동기화 사본과 CRM 권한 관리 | RESOLVED |
| GAP-004 | 승인 요청 시점 조직 Snapshot 기준 `영업담당자 → 지점장 → 본부장`; 위임/재할당은 Audit 필수 | RESOLVED |
| GAP-007 | Lead 역전이는 지점장/관리자만 사유와 함께 허용, CONVERTED는 Terminal | RESOLVED |
| GAP-008 | Opportunity Open 단계 역전이 허용+History, Closed 재오픈은 관리자 제한, Contract 생성 후 Closed Won 재오픈 금지 | RESOLVED |
| GAP-018 | 내부 bigint IDENTITY + API public_id(UUID) + company_id 필수 + Master/Config Soft Delete | RESOLVED |

세부 결정은 `P0-09_p1_gap_decisions.md`를 따른다.

> 기존 `GAP-002 위치 오차 허용/Mock GPS 정책`은 Phase 1 Foundation 자체의 선행조건이 아니므로 **P2(Phase 3 Activity 착수 전 필수)** 로 조정한다.

## 3. 잔여 Open Spec Gaps

우선순위:
- P2: 해당 도메인 개발 전 결정
- P3: 운영 상세설계 시 결정 가능

| GAP ID | 우선 | 미정의 사항 | 왜 필요한가 | 결정 주체 |
|---|---:|---|---|---|
| GAP-002 | P2 | 위치 오차 허용/Mock GPS 정책 | 모바일 현장통제 | IT/영업 |
| GAP-005 | P2 | 활동보고 반려 상태/재요청 프로세스 | State machine | 영업관리 |
| GAP-006 | P2 | 직출/직퇴 반려 후 동일 승인건 재사용 vs 신규 차수 | Approval history | 영업관리 |
| GAP-009 | P2 | Opportunity 지점장/본부장 승인 조건 | PDF에 미결정으로 명시 | 영업관리 |
| GAP-010 | P2 | 할인율/할증율 계산 공식 및 반올림 | 계약금액 정확성 | ERP/영업 |
| GAP-011 | P2 | Contract 상태코드/마감 기준 | 주문가능 조건 | ERP/영업 |
| GAP-012 | P2 | ERP API/SP/DB 실제 연동방식 | Integration 구현 | ERP/IT |
| GAP-013 | P2 | ERP 인증, Endpoint, Payload, 오류코드 | Interface contract | ERP/IT |
| GAP-014 | P2 | 연동 Retry 횟수/간격/운영자 재처리 정책 | 장애복구 | IT |
| GAP-015 | P2 | 제품/패키지 Master 연동 방식 | 제안/주문 | ERP/IT |
| GAP-016 | P2 | 심평원 데이터 수신 기술 방식 | Lead 자동수신 | IT |
| GAP-017 | P2 | 심평원 수동수정 충돌/덮어쓰기 정책 | 데이터 정합성 | 영업관리/IT |
| GAP-019 | P2 | Lead Convert 시 Activity 이관 방식 | 이력 보존 | Architect |
| GAP-020 | P2 | 중복 Account 병합 권한/감사/복구정책 | 데이터 안전 | 영업관리/IT |
| GAP-021 | P2 | 수금계획 변경이력 저장/ERP 전송 단위 | 금액 이력 | ERP/IT |
| GAP-022 | P3 | 파일 저장소/보관기간/용량정책 | 거래명세서/첨부 | IT |
| GAP-023 | P3 | Audit/Interface payload 보관기간/마스킹 | 감사/보안 | IT/보안 |
| GAP-024 | P3 | 알림 채널(앱/메일/SMS) 및 재알림 | Workflow | 영업/IT |
| GAP-025 | P2 | 거래처 이탈가능성 9개월 조건의 정확한 ERP 데이터/fixture 정의 | 이탈 로직 | 영업/ERP |

## 4. Phase 0 판정

### 승인 상태
`APPROVED`

### 승인일
`2026-09-11`

### 승인 범위
- PDF 기반 현행 업무 Baseline 승인
- P1 선행 6개 Gap의 자체개발 Baseline 승인
- 나머지 P2/P3 Gap은 해당 도메인 착수 전 결정하는 조건부 후속과제로 이관

Phase 0은 더 이상 Phase 1 착수 Blocker가 아니다.

## 5. Phase 1 진입조건 판정

| 조건 | 상태 | 비고 |
|---|---|---|
| Phase 0 산출물 작성 | PASS | P0-01~P0-09 |
| P1 선행 Gap 결정 | PASS | 6건 Resolve |
| 기술스택 기준 | PASS | React + .NET API + SQL Server 기준으로 설계 진행 |
| 데이터 식별/법인키 기본정책 | PASS | GAP-018 결정 |
| 사용자/조직 원천 | PASS | ERP Master |
| 승인 기본경로 | PASS | 지점장→본부장 |

개발환경/CI 세부는 P1-01 Repository/Application Skeleton에서 구체화한다.

## 6. Product Owner 승인 체크리스트

- [x] 전체 업무 범위를 Phase 0 Baseline으로 채택한다.
- [x] Lead → Account/Opportunity → Contract → Order 흐름을 Baseline으로 채택한다.
- [x] Activity / Activity Report / Direct Work 분리구조를 채택한다.
- [x] ERP Master 데이터 범위를 채택한다.
- [x] P1 승인경로/권한 Baseline을 채택한다.
- [x] P1 선행 Gap 6건의 결정값을 채택한다.
- [x] 잔여 Gap은 해당 도메인 착수 전 해결하는 조건으로 Phase 0을 종료한다.
- [x] Phase 1 착수를 승인한다.

## 7. 다음 작업

Phase 1 시작:
1. `P1-01 Repository/Application Skeleton`
2. `P1-02 Authentication`
3. `P1-03 User / Organization`
4. `P1-04 Role / Permission`
5. 이후 Foundation Work Package 순차 실행
