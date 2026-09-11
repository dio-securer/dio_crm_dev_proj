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

## 2. Open Spec Gaps

우선순위:
- P1: Phase 1~3 개발 전 반드시 결정
- P2: 해당 도메인 개발 전 결정
- P3: 운영 상세설계 시 결정 가능

| GAP ID | 우선 | 미정의 사항 | 왜 필요한가 | 결정 주체 |
|---|---:|---|---|---|
| GAP-001 | P1 | GPS IN 허용거리(m) | Activity IN Validation | 영업/관리 |
| GAP-002 | P1 | 위치 오차 허용/Mock GPS 정책 | 모바일 현장통제 | IT/영업 |
| GAP-003 | P1 | 사용자/조직 Master 원천(ERP/인사/CRM) | 인증/권한 | IT |
| GAP-004 | P1 | 지점/본부 승인자 결정 로직 및 대리승인 | Approval 엔진 | 영업관리 |
| GAP-005 | P2 | 활동보고 반려 상태/재요청 프로세스 | State machine | 영업관리 |
| GAP-006 | P2 | 직출/직퇴 반려 후 동일 승인건 재사용 vs 신규 차수 | Approval history | 영업관리 |
| GAP-007 | P1 | Lead 단계 역전이 허용 여부 | 상태통제 | 영업 |
| GAP-008 | P1 | Opportunity 단계 역전이/재오픈 정책 | Pipeline | 영업 |
| GAP-009 | P2 | Opportunity 지점장/본부장 승인 조건 | PDF에 미결정으로 명시 | 영업관리 |
| GAP-010 | P2 | 할인율/할증율 계산 공식 및 반올림 | 계약금액 정확성 | ERP/영업 |
| GAP-011 | P2 | Contract 상태코드/마감 기준 | 주문가능 조건 | ERP/영업 |
| GAP-012 | P2 | ERP API/SP/DB 실제 연동방식 | Integration 구현 | ERP/IT |
| GAP-013 | P2 | ERP 인증, Endpoint, Payload, 오류코드 | Interface contract | ERP/IT |
| GAP-014 | P2 | 연동 Retry 횟수/간격/운영자 재처리 정책 | 장애복구 | IT |
| GAP-015 | P2 | 제품/패키지 Master 연동 방식 | 제안/주문 | ERP/IT |
| GAP-016 | P2 | 심평원 데이터 수신 기술 방식 | Lead 자동수신 | IT |
| GAP-017 | P2 | 심평원 수동수정 충돌/덮어쓰기 정책 | 데이터 정합성 | 영업관리/IT |
| GAP-018 | P1 | PK(bigint/UUID), Soft Delete, 법인키 | 물리 DB 설계 | Architect |
| GAP-019 | P2 | Lead Convert 시 Activity 이관 방식 | 이력 보존 | Architect |
| GAP-020 | P2 | 중복 Account 병합 권한/감사/복구정책 | 데이터 안전 | 영업관리/IT |
| GAP-021 | P2 | 수금계획 변경이력 저장/ERP 전송 단위 | 금액 이력 | ERP/IT |
| GAP-022 | P3 | 파일 저장소/보관기간/용량정책 | 거래명세서/첨부 | IT |
| GAP-023 | P3 | Audit/Interface payload 보관기간/마스킹 | 감사/보안 | IT/보안 |
| GAP-024 | P3 | 알림 채널(앱/메일/SMS) 및 재알림 | Workflow | 영업/IT |
| GAP-025 | P2 | 거래처 이탈가능성 9개월 조건의 정확한 ERP 데이터/fixture 정의 | 이탈 로직 | 영업/ERP |

## 3. Phase 0 판정

### 작성 완료
Phase 0 Specification Baseline 산출물은 작성 완료.

### 승인 상태
`APPROVAL_PENDING`

이유:
- PDF에서 확인 가능한 업무는 Baseline으로 정리했으나 P1 우선순위 GAP들이 사람의 결정을 필요로 한다.
- 특히 `GAP-001`, `003`, `004`, `007`, `008`, `018`은 Phase 1 또는 Activity 개발 이전에 확정 필요.

## 4. Phase 1 진입 조건

1. 본 문서 Product Owner 승인
2. P1 Gap 결정 또는 명시적으로 '설계 중 결정' 승인
3. 기술스택 최종 고정
4. 개발/DEV DB 환경 기준 확정
5. Git branch / PR / CI 기본정책 확정

## 5. Product Owner 승인 체크리스트

- [ ] 전체 업무 범위가 실제 현행 프로세스와 일치한다.
- [ ] Lead → Account/Opportunity → Contract → Order 흐름에 누락이 없다.
- [ ] Activity / Activity Report / Direct Work 분리가 맞다.
- [ ] ERP를 Master로 둘 데이터 범위가 맞다.
- [ ] 권한/승인 경로가 맞다.
- [ ] 화면 목록에 핵심 업무가 빠지지 않았다.
- [ ] Open Gap의 담당자와 우선순위를 승인한다.
- [ ] Phase 1 착수를 승인한다.

## 6. 다음 작업

승인 전:
- Open Gap 검토/답변

승인 후:
- `P1-01 Repository/Application Skeleton`
- `P1-02 Authentication`
- `P1-03 User / Organization`
순으로 Phase 1을 실행한다.
