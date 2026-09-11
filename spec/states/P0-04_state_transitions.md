# P0-04 상태전이 정의

## 1. Lead 상태

| Current | Next | 조건/의미 |
|---|---|---|
| 신규등록 | 초도방문 | 신규 등록 후 첫 방문 |
| 초도방문 | 키맨미팅 | 병원장/실장 미팅 진행 |
| 신규등록/초도방문/키맨미팅 | 컨택제외 | 더 이상 영업 대상이 아님 |
| 키맨미팅 | 변환 | 계약 의지/수주 가능성이 높아 기회 포착 |
| 변환 | - | Terminal |

> PDF는 모든 역방향 전이 허용 여부를 정의하지 않는다. 역전이 정책은 GAP.

## 2. Opportunity 단계

```text
NEEDS_ANALYSIS
  → PROPOSAL
    → NEGOTIATION
      → CLOSED_WON
      → CLOSED_LOST
```

| Current | Next | 주요 조건 |
|---|---|---|
| NEEDS_ANALYSIS | PROPOSAL | 고객 니즈 파악 후 패키지 제안 |
| PROPOSAL | NEGOTIATION | 제안 조건 협상 |
| NEGOTIATION | CLOSED_WON | 계약확정, ERP 거래처 승인 필요 |
| NEGOTIATION | CLOSED_LOST | 제안 실패 |

자료상 기회의 `마감됨` 처리 시 ERP 승인여부 경고/확인이 필요하다.

## 3. Activity 상태

| 상태 | 정의 | 전이 |
|---|---|---|
| PLANNED(예정) | 계획은 있으나 IN 미완료 | → IN_PROGRESS |
| IN_PROGRESS(진행중) | IN 완료, OUT 미완료 | → COMPLETED |
| COMPLETED(완료) | IN/OUT 모두 완료 | Terminal(수정 제한) |

추가 Rule:
- 다른 미완료 IN 활동이 존재하면 새 IN 불가.
- GPS 허용범위 밖이면 IN 불가.
- 완료된 일정은 수정 제한.

## 4. Activity Report 승인상태

```text
승인요청 전
 → 승인요청 완료
   → 지점장 승인완료
     → 본부장 승인완료
       → 최종 승인완료
```

주의:
- 실제 시스템에서 `본부장 승인완료`와 `최종 승인완료`가 별도 단계인지 표시상 상태인지 확인 필요.
- 지점장/본부장 반려 상태는 활동보고 자료에서 명확히 정의되지 않음.

## 5. 직출/직퇴 승인상태

```text
승인요청
 ├→ 지점장 승인
 │    ├→ 본부장 승인
 │    └→ 본부장 반려
 └→ 지점장 반려
```

반려 후 담당자의 재승인 요청이 가능하다. 동일 레코드 재활성화인지 새 승인차수 생성인지는 GAP.

## 6. ERP 연동상태

거래처, 계약, 직출/직퇴에서 반복 사용되는 공통 상태:

```text
연동요청전
 → 연동요청중
   ├→ 연동성공
   └→ 연동실패
```

권장 내부코드:
- NOT_REQUESTED
- REQUESTING
- SUCCESS
- FAILED

FAILED → REQUESTING 재시도 전이는 자체개발에서 필요하나 자료에는 상세정책이 없어 GAP.

## 7. Contract 생명주기(초안)

- DRAFT: CRM Contract 생성
- ERP_REQUESTED: 계약 등록요청
- ERP_APPROVED: ERP 승인/계약번호 반영
- CLOSED: 마감

정확한 계약 상태코드는 자료에 완전한 목록이 없으므로 Phase 1 확정 대상.

## 8. Collection Plan 상태(초안)

자료는 상태코드보다 조건을 설명한다.
- 최초계획
- 수정필요
- 수금됨
- 미수 발생
- 변경계획 ERP 전송

구현 시 상태를 임의 확정하지 말고 `correction_required_yn`, 실제수금 존재여부, `erp_sync_status` 조합으로 우선 설계 검토한다.
