# P0-02 Entity / Data Dictionary

> 본 문서는 Phase 0의 논리 데이터 사전이다. 실제 DB 컬럼명/자료형 길이/PK 전략은 Phase 1 상세설계에서 확정한다.

## 1. Core Entity Catalog

| Entity | 한글명 | 역할 | Master/Source | 주요 관계 |
|---|---|---|---|---|
| User | 사용자 | 로그인 사용자/영업담당자/승인자 | CRM/조직연계 | Organization, Role |
| Organization | 조직 | 본부/지점/팀 구조 | ERP 또는 인사 기준 미확정 | User |
| Role | 역할 | 권한 역할 | CRM | Permission |
| Lead | 신규병원발굴 | 아직 거래처가 아닌 잠재 병원 | 심평원+CRM | Activity |
| Account | 거래처 | 병원 Customer Master | CRM + ERP 연동 | Contact, Opportunity, Contract |
| Contact | 연락처 | 병원 의사/실장/스텝/키맨 | CRM | Account |
| Opportunity | 패키지 제안 | 판매기회/Pipeline | CRM | Account, OpportunityProduct |
| ProductPackage | 패키지/제품 | 제안·주문 품목 기준 | ERP 연동 추정 | OpportunityProduct, OrderItem |
| OpportunityProduct | 기회제품 | Opportunity에 제안한 패키지 | CRM | Opportunity |
| ActivityEvent | 이벤트 | 캘린더/일정 | CRM | ActivityMaster |
| ActivityMaster | 활동내역 | 승인/보고 기준 Master | CRM | Lead/Account/Opportunity |
| ActivityReport | 활동보고 | 일자별 결과/계획 승인 | CRM | ActivityMaster |
| DirectWork | 직출/직퇴 | 직출/직퇴 승인/ERP연동 | CRM | ActivityMaster |
| Approval | 승인 | 승인 단계/승인자/이력 | CRM | ActivityReport, DirectWork |
| Contract | 계약 | Opportunity 수주 후 계약 | CRM→ERP | Account, Opportunity |
| CollectionPlan | 수금계획 | 계약 기준 계획 수금 | CRM→ERP | Contract |
| CollectionActual | 실제수금 | ERP 실제 수금내역 | ERP | Contract |
| Order | 주문요청/주문 | CRM 요청 및 ERP 주문연계 | CRM→ERP | Contract |
| OrderItem | 주문상세 | 주문 품목/수량/단가 | CRM/ERP | Order |
| Delivery | 납품/출고 | ERP 출고 결과 | ERP | Order |
| Sales | 매출 | ERP 매출내역 | ERP | Account/Contract |
| ReturnExchange | 반품/교환 | 반품/교환 처리현황 | ERP | Order/Sales |
| InterfaceLog | 인터페이스 로그 | ERP/심평원 연동 추적 | CRM | 모든 연동 |
| AuditLog | 감사로그 | 변경 추적 | CRM | 주요 Entity |
| Attachment | 첨부파일 | 사업자등록증/문서/PDF | CRM Storage | Account/Contract |
| Notification | 알림 | 승인/배정/완료 알림 | CRM | User |
| StatementFile | 거래명세서 파일 | 생성된 월합 PDF | CRM | Account/Contract |

## 2. 주요 필드 사전

### Lead

| Field | 한글명 | Type(논리) | 필수 | Source | 비고 |
|---|---|---:|---|---|---|
| lead_id | Lead ID | UUID/Bigint | Y | CRM | PK |
| name | 병원명 | string | Y | 심평원/CRM | |
| owner_user_id | 담당자 | FK | 조건 | CRM | 지역 자동할당 |
| status | 리드상태 | code | Y | CRM | 신규등록/초도방문/키맨미팅/컨택제외/변환 |
| lead_source | 리드소스 | code | N | CRM | |
| mql_yn | MQL 여부 | boolean | N | CRM | 마케팅/교육 인입 |
| interest_product | 관심품목 | string/code | N | CRM | |
| phone | 전화번호 | string | N | 심평원 | 일일 갱신 |
| address | 주소 | string | N | 심평원 | |
| sido/sigungu/eupmyeondong | 지역정보 | string/code | N | 심평원 | |
| coord_x/coord_y | 좌표 | decimal | N | 심평원 | 활동지도 |
| encrypted_provider_no | 암호화요양기호 | string | 조건 | 심평원 | 중복 기준 |
| open_date | 개원일자 | date | N | 심평원/CRM | |
| keyman_name | 키맨 이름 | string | N | CRM | |
| keyman_type | 연락처 유형 | code | N | CRM | 의사/실장/스텝 |
| keyman_mobile/email | 연락정보 | string | N | CRM | |
| school/cohort/major | 출신교/기수/전공 | string | N | CRM | |
| main_system/sub_system | 사용 시스템 | string | N | CRM | |
| business_no | 사업자번호 | string | 조건 | CRM | ERP 거래처 등록에 사용 |
| contact_exclude_reason | 컨택제외사유 | code/string | 조건 | CRM | |
| hira_sync_exclude_yn | 심평원연동제외 | boolean | N | CRM | 수동수정 시 고려 |

### Account

| Field | 한글명 | Type | 필수 | Source | 비고 |
|---|---|---:|---|---|---|
| account_id | 거래처 ID | PK | Y | CRM | |
| account_name | 병원명 | string | Y | CRM | Lead 변환 가능 |
| owner_user_id | 영업담당자 | FK | Y | CRM | |
| account_status | 거래처상태 | code | Y | CRM/ERP | 정상/비거래처/비거래처_기회/이탈/이탈가능 등 |
| account_grade | 거래처등급 | code | N | CRM | 기준 미확정 |
| business_name | 사업자명 | string | ERP 등록시 Y | CRM | |
| business_no | 사업자번호 | string | ERP 등록시 Y | CRM | 중복검사 기준 |
| ceo_name | 대표자명 | string | ERP 등록시 Y | CRM | |
| provider_no | 요양기관기호 | string | ERP 등록시 Y | CRM/심평원 | |
| tax_email | 계산서 이메일 | string | ERP 등록시 Y | CRM | |
| erp_customer_code | ERP 거래처코드 | string | N | ERP | 수정불가 |
| erp_approved_yn | ERP 승인여부 | boolean | N | ERP | |
| integration_status | 연동상태 | code | Y | CRM | 요청전/요청중/성공/실패 |
| churn_risk_yn/date | 이탈가능/진입일 | boolean/date | N | CRM/ERP | 최근 9개월 조건 자료 존재 |
| churn_response_status/content | 이탈대응 | code/string | N | CRM | |
| address/phone/coord | 병원정보 | mixed | N | 심평원 | |

### Contact
- contact_id (PK)
- account_id (FK)
- type: 치과의사/실장/스텝
- name, mobile, email
- school, cohort, major, note

### Opportunity
- opportunity_id, account_id, owner_user_id
- record_type: 신규/재계약
- opportunity_name, amount, expected_close_date
- stage: NEEDS_ANALYSIS / PROPOSAL / NEGOTIATION / CLOSED_WON / CLOSED_LOST
- interest_product, success_probability, forecast_category
- special_terms, payment_method, payment_date, installment_months
- competitor_usage, owned_equipment, treatment_fee_info
- contract_created_yn, account_erp_approved_yn, currency

### ActivityEvent / ActivityMaster

**ActivityEvent**
- event_id, subject, start_at, end_at
- related_type / related_id
- is_activity_plan, visit_purpose
- direct_work_type / direct_work_reason

**ActivityMaster**
- activity_id, event_id, owner_user_id
- related_type: LEAD / ACCOUNT / OPPORTUNITY
- related_id, visit_purpose, consultation_content, planned_at
- in_at / out_at
- in_lat/in_lng / out_lat/out_lng는 자체개발 제안이며 PDF는 위치기반 IN만 명시
- status: PLANNED / IN_PROGRESS / COMPLETED
- report_approval_status

### ActivityReport / Approval

**ActivityReport**
- report_id, reporter_user_id, report_date, request_at, status
- 포함 Activity는 관계테이블 권장

**Approval**
- approval_id, target_type / target_id, approval_type
- step_no, approver_user_id, status, comment
- approved_at / rejected_at

### Contract
- contract_id, account_id, opportunity_id
- contract_name/no, contract_date
- package_type, package_name
- product_amount, goods_amount, contract_amount
- package_classification, discount_rate, surcharge_rate, special_terms
- erp_contract_no, erp_approval_status, integration_status, close_yn

### CollectionPlan / CollectionActual

**CollectionPlan**
- collection_plan_id, contract_id, installment_no
- collection_method, original_amount, original_date
- changed_amount, changed_date
- adjustment_type: ORIGINAL / SPLIT / ARREARS_REALLOCATION
- correction_required_yn, erp_sync_status

**CollectionActual**
- collection_actual_id, contract_id, erp_collection_no, amount, collected_at, source=ERP

### Order / OrderItem

**Order**
- order_id, contract_id, account_id
- delivery_address_type, express_yn, note
- request_status, erp_order_no, integration_status

**OrderItem**
- order_item_id, order_id, erp_item_code, item_name, item_type
- category_large/category_middle, quantity
- unit_price, package_discount_price, order_available_yn

## 3. 공통 필드 권장안

모든 업무 Entity에 아래 필드 공통 적용을 Phase 1에서 검토:
- created_at, created_by
- updated_at, updated_by
- row_version
- deleted_yn (실삭제 정책은 GAP)
- source_system
- external_id
