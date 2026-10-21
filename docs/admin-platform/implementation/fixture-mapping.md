# A00 fixture 연결표

| 기존 | 새 목업/보존 |
|---|---|
| frontend/src/account-sandbox.ts seed 회사 DIO (주소에 MX 포함) | 원본 수정/회사 추론 안 함. 신규 ADMIN_DEMO_V1 별도 namespace |
| account-model.ts STORAGE_KEY | 원래 key 유지; 신규 dio-crm:admin:v1:ADMIN_DEMO_V1 |
| 기존 숫자 companyId/JWT | 변경 없음. 신규 seed UUID는 COMPANY_IDS에 고정 |
| HQ/US/MX screen registry | 기존 HQ_ACCOUNT/GLOBAL_ACCOUNT 유지. 새 runtime adapter 미구현 |
| IF-ERP-002 | ACCOUNT 기존 enqueuePending 유지; 신규 MOCK 연결 미구현 |
| IF-ERP-004 | CONTRACT 기존 enqueuePending 유지 |
| IF-ERP-007 | ORDER 기존 enqueuePending 유지 |
| IF-ERP-011 | 수금계획 요청 기존 동작 유지; 수금 수신과 혼동 금지 |
| GLOBAL 승인자 | 기존 미확정 유지. DEMO 인증 사용자 16명 추가. 승인 fixture 미구현 |

합성 회사 seed는 HQ_DEMO/US_A/US_B/MX_A 네 행이다. 인증 저장소에는 회사별 admin1/sales1/sales2/manager1 합계 16개 identity와 membership을 별도로 제공한다. org/업무 role/approval/account fixture 연결은 후속 단계이며 원본 고객을 임의 이관하지 않았다.
