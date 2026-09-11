# P0-05 Business Rule 정의

## 1. Lead / Customer

| Rule ID | Rule | 근거 |
|---|---|---|
| BR-LEAD-001 | 심평원 신규병원은 매일 4시 기준 자동 업데이트/생성 대상이다. | PDF |
| BR-LEAD-002 | 지역담당자는 ERP의 시군구 담당자 데이터를 기준으로 자동할당한다. | PDF |
| BR-LEAD-003 | 본인 소유가 아닌 Lead는 조회 가능하나 수정 제한된다. | PDF |
| BR-LEAD-004 | Lead Convert 시 Account, Contact, Opportunity로 변환하며 기존 활동기록도 이관한다. | PDF |
| BR-LEAD-005 | Lead Convert 시 기존 Account/Contact/Opportunity 중복을 확인한다. | PDF |
| BR-ACC-001 | ERP 거래처 등록요청 전 사업자번호로 중복 거래처를 검증한다. | PDF |
| BR-ACC-002 | 중복 거래처 병합은 최대 3개까지 선택 가능하며 완료 후 실행취소 불가하다. | PDF |
| BR-ACC-003 | ERP 거래처 등록 필수정보가 모두 준비되어야 요청 가능하다. | PDF |
| BR-ACC-004 | ERP 등록 요청 진행중/완료 시 등록요청 버튼을 노출하지 않는다. | PDF |

## 2. Activity

| Rule ID | Rule | 근거 |
|---|---|---|
| BR-ACT-001 | 위치 권한/정확한 위치가 활동지도 사용의 전제다. | PDF |
| BR-ACT-002 | 병원과 사용자 위치가 설정된 제한거리 이내일 때만 IN 가능하다. | PDF |
| BR-ACT-003 | 제한거리 수치는 설정값으로 두며 현재 값은 미정이다. | GAP |
| BR-ACT-004 | OUT하지 않은 기존 활동이 존재하면 다른 활동의 IN을 할 수 없다. | PDF |
| BR-ACT-005 | IN 정보가 없으면 활동정보는 업데이트 제한되며 병원 상세정보만 수정 가능하다. | PDF |
| BR-ACT-006 | IN/OUT이 완료된 일정은 수정 불가하다. | PDF |
| BR-ACT-007 | 활동보고 승인완료 건은 수정 불가하다. | PDF |
| BR-ACT-008 | 본인 소유가 아닌 Lead/Account의 병원 상세정보는 수정할 수 없다. | PDF |
| BR-ACT-009 | 동일 Lead/Account + 동일일자에 기존 활동계획이 있으면 단건 등록 오류를 안내한다. | PDF |
| BR-ACT-010 | 다건 활동계획은 PC 전용이며 시간은 09:00으로 일괄 등록된다. | PDF |
| BR-ACT-011 | Event 종료시간은 방문일정 + 1시간으로 자동 생성된다. | PDF |

## 3. Activity Report / Direct Work

| Rule ID | Rule |
|---|---|
| BR-REP-001 | 활동보고 활동결과는 선택 일자 내 완료 활동을 대상으로 한다. |
| BR-REP-002 | 활동계획은 기준일자 이후 5일 내 계획을 표시한다. |
| BR-REP-003 | OUT 미등록 활동이 있으면 활동보고 승인요청 불가하다. |
| BR-REP-004 | 승인요청 이후 진행한 활동은 해당 승인 요청에 포함되지 않는다. |
| BR-REP-005 | 승인완료 활동내용은 수정 불가하다. |
| BR-DW-001 | 직출/직퇴 선택 시 사유 입력은 필수다. |
| BR-DW-002 | 직출/직퇴 승인순서는 담당자→지점장→본부장이다. |
| BR-DW-003 | 승인 진행중/완료 시 직출/직퇴 내용 수정 불가다. |
| BR-DW-004 | 반려되면 담당자가 재승인 요청 가능하다. |
| BR-DW-005 | Activity OUT 완료 시 직출/직퇴 정보가 ERP로 자동 전송된다. |

## 4. Opportunity / Contract

| Rule ID | Rule |
|---|---|
| BR-OPP-001 | Opportunity 단계는 니즈파악→제안→협상→수주성공/수주실패이다. |
| BR-OPP-002 | 기회에서 제안 패키지/제안금액을 관리한다. |
| BR-OPP-003 | 수주성공(마감) 시 거래처 ERP 승인여부를 확인한다. |
| BR-CON-001 | Contract 생성은 Opportunity가 수주성공일 때만 가능하다. |
| BR-CON-002 | ERP 승인 및 연동 완료 거래처만 Contract 자동생성 가능하다. |
| BR-CON-003 | Contract는 Opportunity당 최초 1회만 생성한다. |
| BR-CON-004 | 기회제품이 없으면 Contract 생성 불가하다. |
| BR-CON-005 | Contract 생성 후 해당 Opportunity는 수정 불가하다. |
| BR-CON-006 | 제품금액/상품금액 중 하나는 계약생성 시 필수이며 미입력 금액은 계약금액 기준으로 계산된다. |
| BR-CON-007 | 할증율 입력 시 할인율이 자동 계산된다. 계산식 상세는 GAP. |

## 5. Collection

| Rule ID | Rule |
|---|---|
| BR-COL-001 | 최초 수금계획 행 추가 시 계약금액을 행수로 분할하며 소수점은 절삭한다. |
| BR-COL-002 | 계약 승인 이후 최초 수금계획 금액/일자는 수정 불가하다. |
| BR-COL-003 | 실제수금과 계획이 불일치하거나 계획일이 도래했는데 수금이 없으면 수정필요 대상이다. |
| BR-COL-004 | 미수금은 변경 수금계획으로 모두 재할당되어야 저장 가능하다. |
| BR-COL-005 | 변경된 수금계획은 ERP로 전송한다. |
| BR-COL-006 | 총 수금계획금액은 계약금액과 일치해야 한다. |

## 6. Order / Ledger / Statement

| Rule ID | Rule |
|---|---|
| BR-ORD-001 | ERP 승인 완료이며 마감되지 않은 계약만 주문 가능하다. |
| BR-ORD-002 | 주문불가 품목은 검색결과에 표시될 수 있으나 주문에는 포함되지 않는다. |
| BR-ORD-003 | 주문 시 배송지유형, 특송여부, 비고를 입력할 수 있다. |
| BR-LED-001 | 패키지원장 상세 거래내역은 PC에서 Excel 다운로드 가능하다. |
| BR-STM-001 | 월합 거래명세서는 기간/패키지 또는 일반거래를 조회해 PDF 생성한다. |
| BR-STM-002 | PC에서는 일부 거래건 선택 PDF 생성이 가능하다. |
| BR-STM-003 | 모바일에서는 전체 내역 PDF 생성만 가능하다. |
| BR-STM-004 | 모바일 생성 PDF는 거래처 파일 영역에 저장된다. |

## 7. 공통 Integration Rule

| Rule ID | Rule |
|---|---|
| BR-INT-001 | 연동상태는 요청전/요청중/성공/실패를 공통 사용한다. |
| BR-INT-002 | 연동실패는 관리자 확인이 필요하다. |
| BR-INT-003 | 외부 원천 데이터는 Source of Truth 정책을 따른다. |
| BR-INT-004 | 모든 ERP 요청/응답은 InterfaceLog로 추적한다. |

## 8. 구현 원칙
- UI에서만 막지 않고 Backend Validation에 동일 규칙 적용.
- 상태전이는 중앙 정의 사용.
- ERP/심평원 원천필드는 Read-only 또는 동기화 정책 적용.
- PDF에 없는 임계값/코드/공식은 `GAP-*` 결정 전 하드코딩 금지.
