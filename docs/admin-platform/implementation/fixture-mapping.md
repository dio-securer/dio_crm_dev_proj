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
| GLOBAL 승인자 | 기존 미확정 유지. DEMO 인증 사용자 18명 추가. 승인 fixture 미구현 |

합성 회사 seed는 HQ_DEMO/US_A/US_B/MX_A 네 행이다. 공유 repository에 회사별 admin1/sales1/sales2/manager1 16명과 platform1/shared1을 제공한다. 기존 숫자 user.company_id는 변경하지 않고 신규 UUID homeCompanyId와 별도 memberships를 사용한다. 회사별 SALES/TEAM 조직과 합성 거래처 2건, COMPANY_ADMIN/MANAGER/SALES 역할을 연결했다. shared1은 US_A/US_B 소속이다. 기존 user_role의 의미를 합성 역할에 대응했으며 실제 DB 이관은 하지 않았다. 승인 fixture는 A07 후속이고 원본 고객은 임의 이관하지 않았다.
