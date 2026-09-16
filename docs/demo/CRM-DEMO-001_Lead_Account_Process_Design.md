# CRM-DEMO-001 — Lead → Account / Contact 프로세스 설계

- Work ID: `CRM-DEMO-001`
- 기준자료: 해외법인 판매 프로세스 사용자 교육자료 v1.0 (2025-07-24), p.4~12
- 적용대상: `GLOBAL_TEMPLATE` Executive Prototype
- 목적: 모바일 Salesforce 교육화면의 업무 의미를 보존하면서 PC에서 더 빠르고 직관적으로 입력·조회할 수 있는 Lead / Account / Contact Prototype 정의

## 1. 핵심 관계

```text
Lead (잠재 거래처)
  │
  ├─ 영업 단계 진행
  │   신규등록 → 초도방문 → 키맨미팅
  │                    ├─ 컨택제외
  │                    └─ 변환
  │
  └─ 변환
       ├─ Account  : 병원/거래처 정보
       ├─ Contact  : 키맨/담당자 정보
       └─ Opportunity : 관심품목 기반 패키지 제안 시작점
```

Lead와 Account는 별개 화면이지만 단절된 데이터가 아니다. Lead에서 확인·입력한 병원 정보는 변환 시 Account로 이어지고, 키맨 정보는 Contact로 이어진다. 사용자는 Account 상세에서 Source Lead를 다시 확인할 수 있어야 한다.

## 2. Lead 단계와 관리 정보

### 신규등록
빠른 등록에 필요한 기본정보를 우선 입력한다.

- 거래처/병원명
- 개원일자
- 병원주소
- 웹사이트
- 전화 / 이메일
- 영업담당자
- 관심품목

### 초도방문
병원 규모·시스템 정보를 보완한다.

- 총 의사 수
- 치과 전문의 수
- 메인 시스템
- 서브 시스템
- 특이사항

### 키맨미팅
Contact로 전환될 키맨 정보를 구체화한다.

- 키맨 이름
- 고객유형
- 휴대폰 / 이메일
- 출신학교
- 전공
- 기수
- 특이사항

### 컨택제외

- 컨택제외 사유
- 컨택제외 상세사유

### 변환
교육자료의 변환 개념을 Prototype에서 다음처럼 보존한다.

```text
Lead 병원정보 → Account
Lead 키맨정보 → Contact
Lead 관심품목 → Opportunity 시작정보
Lead Code     → Account의 Source Lead reference
```

## 3. Account / Contact 관리 구조

### Account
교육자료의 화면속성을 PC에서 다음 Section으로 재배치한다.

1. Summary
   - 거래처 상태
   - 거래처 등급
   - ERP 연동 상태
   - 영업담당자
2. Basic
   - 거래처명
   - 법인/국가
   - 거래처 유형
   - 전화
3. Trade / Management
   - 거래 상태
   - 사업자명
   - 사업자번호
   - 법정대리인
   - 개원일자
4. Address
   - 우편번호
   - 병원주소
5. ERP Integration
   - 연동 상태
   - ERP 거래처 코드
   - 승인 여부
6. Contacts
   - 거래처에 연결된 담당자/키맨 목록
7. Source / Related
   - Source Lead
   - Opportunity / Contract / Order

### Contact

1. Summary / Basic
   - 거래처
   - 고객유형
   - 이름
   - 전화
   - 이메일
2. Additional
   - 생년월일
   - 결혼여부
   - 관심품목
   - 성향
3. Opening
   - 개원 예정일자
   - 개원 희망지역

## 4. ERP 거래처 등록 요청

교육자료에서 명시된 등록요청 필수값은 별도 `ERP Readiness` 영역으로 관리한다.

1. 사업주 이름
2. 사업자번호
3. 법정대리인 성명
4. 의료기관 코드
5. 송장 발행 이메일
6. 고객 유형
7. 전화번호
8. 우편번호
9. 병원주소
10. 개원일자

Prototype에서는 실제 ERP 호출을 하지 않는다. 대신 필수정보 충족 여부와 연동 상태 흐름만 시연한다.

```text
BEFORE_REQUEST → REQUESTING → SUCCESS / FAILED
```

## 5. PC UX 원칙

모바일 화면을 그대로 확대하지 않는다. 모바일에서 확인된 정보구조와 업무단계를 PC에 맞게 재배치한다.

```text
List / Search                      Detail / Action
┌──────────────────────────┐      ┌────────────────────────────┐
│ 검색 / 상태필터 / 신규   │      │ 선택 Record Summary        │
│ 핵심 조회컬럼            │  →   │ Stage / Edit / Convert     │
│ 여러 건 빠른 비교        │      │ Section / Related records  │
└──────────────────────────┘      └────────────────────────────┘
```

입력은 `Quick Create + Progressive Detail` 방식으로 설계한다.

- 최초 등록: 이름/국가/전화/담당자 등 최소정보를 상단에 배치
- 상세정보: Keyman, 병원규모/시스템, 사업자정보는 접이식 Section
- 단계전환: 해당 단계에서 필요한 정보가 무엇인지 바로 보이게 함
- 변환: Account / Contact / Opportunity에 전달되는 값을 한 화면에서 확인
- Account: Contacts와 ERP Readiness를 상세 화면에서 즉시 접근

## 6. 조회화면 핵심 컬럼

조회 Grid는 등록 필드를 모두 펼치지 않는다.

### Lead List
- Lead / 병원명
- 단계
- 키맨
- 전화
- 영업담당자

### Account List
- 거래처코드 / 거래처명
- 거래처 상태
- ERP 연동상태
- 전화
- 영업담당자

### Contact List (Account 상세 내부)
- 연락처명
- 고객유형
- 전화
- 이메일

## 7. Prototype Boundary

- 실제 ERP 등록 요청 없음
- 실제 India Zoho 연동 없음
- 실제 DB write 없음
- Local Storage mock only
- 인도 고유 업무규칙은 정의하지 않음
- 교육자료에 없는 국가별 필수값은 임의 추가하지 않음

## 8. Acceptance

- Lead 신규/편집 가능
- Lead 단계와 단계별 정보가 한눈에 보임
- Lead 변환 시 Account + Contact 연결 생성
- Account에서 Source Lead 확인 가능
- Account 신규/편집 가능
- Account별 Contact 조회/신규 가능
- ERP 등록필수 10개 항목의 readiness 확인 가능
- PC에서 List + Detail 동시 확인 가능
- Mobile 폭에서도 동일 데이터관계 유지
