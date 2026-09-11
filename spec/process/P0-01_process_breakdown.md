# P0-01 전체 업무 프로세스 분해

- 프로젝트: DIO CRM 자체개발
- 단계: Phase 0 — Specification Baseline
- 상태: Draft Baseline
- 근거: 「디오 영업활동프로세스」, 「디오 영업판매프로세스」 교육자료
- 원칙: PDF에서 확인되지 않는 세부 조건은 `Spec Gap`으로 분리하고 임의 확정하지 않는다.

## 1. End-to-End 업무 범위

```text
심평원 신규병원
  ↓
Lead(신규병원발굴)
  ↓ 영업활동/초도방문/키맨미팅
Lead Convert
  ├─ Account(거래처)
  ├─ Contact(연락처)
  └─ Opportunity(패키지 제안)
       ↓ 니즈파악 → 제안 → 협상 → 수주성공/실패
Account ERP 등록/승인 확인
       ↓
Contract 생성
       ↓
Collection Plan(수금계획)
       ↓
ERP 계약 등록/승인
       ↓
Order 요청
       ↓
ERP 주문/출고
       ↓
Sales / Collection / Return / Exchange
       ↓
패키지원장 / 월합 거래명세서 / Account 360 / Dashboard
```

병행 프로세스:
```text
Activity Plan
  ↓
Calendar/Event + Activity Master 생성
  ↓
GPS IN
  ↓
상담/병원정보 업데이트
  ↓
GPS OUT
  ↓
Activity Report 승인요청
  ↓
지점장 승인
  ↓
본부장 승인

직출/직퇴:
Activity Plan에서 직출/직퇴 지정
  ↓
직출/직퇴 관리 레코드 생성
  ↓
지점장 → 본부장 승인
  ↓
활동 OUT 완료 시 ERP 전송
```

## 2. 프로세스 영역 분해

| Process ID | 업무영역 | 시작조건 | 주요처리 | 종료/산출물 |
|---|---|---|---|---|
| PRC-LEAD-01 | 심평원 신규병원 수신 | 매일 연동 | 신규병원 확인, 중복 확인 | Lead 생성/갱신 |
| PRC-LEAD-02 | Lead 담당자 할당 | Lead 생성 | ERP 시군구 담당자 기준 자동할당 | Lead Owner |
| PRC-LEAD-03 | Lead 육성 | 신규등록 | 초도방문, 키맨미팅, 정보수집 | 변환/컨택제외 |
| PRC-LEAD-04 | Lead Convert | 기회 포착 | Account/Contact/Opportunity 변환, 중복확인 | 고객/기회 생성 |
| PRC-ACC-01 | 거래처 관리 | Account 존재 | 병원현황, 거래상태, 이탈정보 관리 | Account 360 |
| PRC-ACC-02 | ERP 거래처 등록 | ERP 코드 없음 | 사업자번호 중복검사, 필수값 입력, ERP 요청 | ERP 거래처 코드/승인상태 |
| PRC-ACT-01 | 활동계획 | Lead/Account/Opportunity | 방문일정, 목적, 직출/직퇴 입력 | Event + Activity Master |
| PRC-ACT-02 | 현장 방문 | 활동계획/즉시방문 | 지도 선택, GPS 검증, IN | 진행중 Activity |
| PRC-ACT-03 | 활동 종료 | IN 완료 | 상담/병원정보 수정, OUT | 완료 Activity |
| PRC-ACT-04 | 활동보고 | 완료 Activity | 일자별 결과/계획 조회, 승인요청 | Activity Report |
| PRC-ACT-05 | 활동보고 승인 | 승인요청 | 지점장/본부장 검토 및 코멘트 | 최종 승인 |
| PRC-DW-01 | 직출/직퇴 승인 | 활동계획에서 선택 | 담당자→지점장→본부장 | 승인/반려 |
| PRC-DW-02 | 직출/직퇴 ERP 전송 | OUT 완료 | ERP 등록요청/결과수신 | ERP 연동상태 |
| PRC-OPP-01 | Opportunity 관리 | Lead Convert 또는 기존 Account | 니즈파악→제안→협상 | Won/Lost |
| PRC-OPP-02 | 패키지 제품관리 | Opportunity 존재 | 패키지 선택, 제안금액 입력/수정 | Opportunity Product |
| PRC-CON-01 | 계약 생성 | Closed Won + ERP 승인 거래처 | 패키지 기반 Contract 생성 | Contract |
| PRC-COL-01 | 최초 수금계획 | Contract 존재 | 회차/방법/금액/일자 등록 | Collection Plan |
| PRC-CON-02 | ERP 계약 등록 | 계약/수금계획 준비 | 필수값 검증, ERP 요청 | ERP 계약번호/승인 |
| PRC-COL-02 | 수금현황 관리 | ERP 수금 발생 | 실수금 조회, 계획대비 미수 계산 | Collection 현황 |
| PRC-COL-03 | 수금계획 변경 | 미수/분할 필요 | 변경금액/일자, 미수 재할당 | 변경 계획 ERP 전송 |
| PRC-ORD-01 | 주문 요청 | ERP 승인·미마감 Contract | 상품검색, 장바구니, 배송지, 주문 | CRM Order Request |
| PRC-ORD-02 | 주문/납품 동기화 | ERP 주문처리 | 주문/출고 상태 수신 | Order/Delivery |
| PRC-SAL-01 | 매출/수금 조회 | ERP 데이터 존재 | 정시/수동 조회 | Sales/Collection |
| PRC-RET-01 | 반품/교환 | 요청 발생 | ERP 중심 처리/현황 수신 | Return/Exchange |
| PRC-LED-01 | 패키지원장 | Account/Contract 존재 | 계약/거래내역 조회 | 원장/Excel |
| PRC-STM-01 | 월합 거래명세서 | 거래내역 존재 | 기간/패키지 조회, 선택 | PDF 거래명세서 |
| PRC-ANL-01 | Account 360/분석 | 데이터 축적 | Sales/Order/Service/Activity 통합 조회 | Dashboard/Insight |

## 3. 시스템 경계

### CRM이 주도하는 영역
- Lead, Account 고객/영업정보
- Contact/키맨
- Activity Plan / Event / Activity Master
- Activity Report
- Opportunity / Opportunity Product
- Contract 초안
- Collection Plan
- 주문 요청 UI
- 360 View, Dashboard

### ERP가 기준 시스템인 영역
- ERP 거래처 코드/승인 결과
- ERP 계약번호/계약 승인 결과
- 주문 실행, 출고, 매출, 실제 수금, 반품/교환 실행 데이터

### 외부 기준 데이터
- 심평원 병원 기본정보/주소/전화/좌표/요양기관 관련정보

## 4. 주요 선행/후행 의존성

1. Lead Convert 이전에는 Lead 중심으로 Activity를 연결할 수 있어야 한다.
2. Lead Convert 시 과거 활동기록의 연결 대상 보존/이관이 필요하다.
3. Opportunity Closed Won과 Contract 생성 사이에 ERP 거래처 승인 검증이 존재한다.
4. Contract 생성 후 Opportunity는 수정 제한된다.
5. 수금계획이 계약 ERP 등록요청과 함께 전달된다.
6. ERP 승인되고 마감되지 않은 Contract만 주문 가능하다.
7. 직출/직퇴는 활동보고와 별도의 승인 체계를 가진다.
8. OUT 완료가 직출/직퇴 ERP 전송의 트리거다.

## 5. Phase 0 이후 권장 개발 도메인 경계

- Identity & Organization
- Customer (Lead/Account/Contact)
- Activity
- Sales Pipeline (Opportunity)
- Contract & Collection Plan
- ERP Integration
- Order / Delivery / Sales
- Document / Ledger
- Analytics
- Common Platform (Audit, File, Notification, Code)

## 6. 미정의 항목

세부값/정책이 자료에 없거나 불완전한 항목은 P0-09 `GAP-*`로 관리한다.
