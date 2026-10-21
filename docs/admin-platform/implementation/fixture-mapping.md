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

## A07 승인 시연 문서

승인 설정 게시 후 관리자 승인 화면의 `시연 문서 준비`로 회사별 DRAFT 1건과 IN_PROGRESS 1건을 동일 트랜잭션에서 준비한다. `/api/admin/companies/:company/approval-fixtures`는 approval.simulate 권한을 요구하고 일반 제출 엔진을 거친다. 기존 원본 seed를 자동 덮어쓰지 않는다. DRAFT 문서 ID는 `71000000-0000-4000-8000-<company 마지막12자리>`, 진행 문서는 `72000000-0000-4000-8000-<company 마지막12자리>`다. 같은 요청 키는 재사용하고 새 요청으로 중복 준비하면409다. 인스턴스/task ID는 실행 시 생성되며 문서 ID로 추적한다. 업무 사용자 시나리오는 자신의 문서 생성/제출 버튼을 사용한다.
