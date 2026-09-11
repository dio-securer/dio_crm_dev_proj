# P0-07 ERP / 심평원 Interface Catalog

## 1. Interface 목록

| IF ID | Source → Target | Interface | Trigger/Frequency | 주요 데이터 | 결과 |
|---|---|---|---|---|---|
| IF-HIRA-001 | 심평원 → CRM | 신규병원/병원정보 수신 | 매일 04:00 | 병원명, 전화, 주소, 지역코드, 좌표, 암호화요양기호 등 | Lead/Account 갱신 |
| IF-ERP-001 | ERP → CRM | 지역 담당자 기준정보 | 주기 미정 | 시군구, 담당자 | Lead 자동할당 |
| IF-ERP-002 | CRM → ERP | 거래처 등록요청 | 사용자 요청 | 사업자/병원/담당 정보 | 거래처 승인 프로세스 |
| IF-ERP-003 | ERP → CRM | 거래처 승인결과 | 방식 미정 | ERP 거래처코드, 승인여부/상태 | Account 갱신 |
| IF-ERP-004 | CRM → ERP | 계약 등록요청 | 사용자 요청 | 계약기본, 금액, 패키지, 수금계획 | ERP 계약등록/승인 |
| IF-ERP-005 | ERP → CRM | 계약 승인결과 | 방식 미정 | 계약번호, 승인결과, 추가정보 | Contract 갱신 |
| IF-ERP-006 | ERP → CRM | 제품/상품/단가/재고 조회 | 주문 시 | 품목, 분류, 단가, 재고, 주문가능 | 주문 UI |
| IF-ERP-007 | CRM → ERP | 주문 요청 | 주문하기 | 계약, 품목, 수량, 배송지, 특송, 비고 | ERP 주문 |
| IF-ERP-008 | ERP → CRM | 주문/납품현황 | API/주기 미정 | 주문번호, 출고, 납품 | Order/Delivery |
| IF-ERP-009 | ERP → CRM | 수금현황 | 정시 자동 + 수동조회 | 수금번호/금액/일자 | CollectionActual |
| IF-ERP-010 | ERP → CRM | 매출현황 | 정시 자동 + 수동조회 | 매출내역 | Sales |
| IF-ERP-011 | CRM → ERP | 변경 수금계획 전송 | 사용자 편집 후 | 변경금액/일자/분할/미수재할당 | ERP 계획갱신 |
| IF-ERP-012 | CRM → ERP | 직출/직퇴 정보 | Activity OUT 완료 | 유형/사유/활동정보 | ERP 등록/승인요청 |
| IF-ERP-013 | ERP → CRM | 직출/직퇴 결과 | 방식 미정 | 승인여부/연동결과 | DirectWork 상태 |
| IF-ERP-014 | ERP → CRM | 반품/교환현황 | 주기/API 미정 | 반품/교환 데이터 | ReturnExchange |

## 2. 공통 Interface Envelope 권장

```json
{
  "requestId": "uuid",
  "interfaceCode": "IF-ERP-002",
  "sourceSystem": "CRM",
  "targetSystem": "ERP",
  "requestedAt": "ISO-8601",
  "businessKey": {
    "entityType": "ACCOUNT",
    "entityId": "..."
  },
  "payload": {}
}
```

응답 권장:
```json
{
  "requestId": "uuid",
  "success": true,
  "resultCode": "...",
  "message": "...",
  "externalKey": "...",
  "processedAt": "..."
}
```

## 3. InterfaceLog 권장 필드
- interface_log_id
- request_id
- interface_code
- direction
- entity_type / entity_id
- request_payload (민감정보 마스킹 고려)
- response_payload
- status
- retry_count
- requested_at / responded_at
- http_status 또는 ERP result code
- error_message
- created_by/system_user

## 4. Source of Truth

| 데이터 | 기준 시스템 |
|---|---|
| 병원 심평원 정보 | 심평원 |
| 영업 Lead/Activity/Opportunity | CRM |
| ERP 거래처코드/승인 | ERP |
| ERP 계약번호/승인 | ERP |
| 수금계획 | CRM 작성 후 ERP 전송 |
| 실제 수금 | ERP |
| 주문 실행/출고 | ERP |
| 매출 | ERP |
| 반품/교환 실행 | ERP |

## 5. 연동 구현 필수 정책
1. `request_id` 기반 중복요청 방지(Idempotency).
2. 업무 Entity 대표 연동상태와 상세 InterfaceLog 분리.
3. Timeout/Retry/Dead-letter 또는 재처리 Queue 정책 필요.
4. ERP가 비동기 승인하는 경우 요청/결과수신을 분리.
5. 연동실패의 운영자 재처리 UI 필요.
6. 심평원 수동수정 필드와 재동기화 충돌정책 필요.
7. 계약/주문/수금은 금액 데이터이므로 요청/응답 감사로그 필수.

## 6. 미확정
- 실제 ERP API/SP/DB 방식
- 인증 방식
- API endpoint/schema
- 실시간 vs Batch
- 정시 자동동기화 정확한 실행시간
- Retry 횟수/간격
- 심평원 수신 방식
- 품목 Master 전체동기화 vs 실시간조회
