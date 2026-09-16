# CRM-DEMO-001 — Lead → Account / Contact 프로세스 설계 v2

- Work ID: `CRM-DEMO-001`
- 기준자료: 해외법인 판매 프로세스 사용자 교육자료 v1.0 (2025-07-24), p.4~12
- 적용대상: `GLOBAL_TEMPLATE` Executive Prototype / 향후 Global CRM Standard
- UI 방향: `A. Split Workspace + B. Step Form / Progressive Detail`
- Dashboard 방향: Concept C는 향후 Dashboard / Account 360 요약 화면에 별도 적용

## 0. 설계 기준의 구분

이 문서는 `원본 교육자료에서 확인된 업무 사실`과 `DIO CRM에서 채택할 UX 설계결정`을 구분한다.

### Source-derived — 교육자료에서 확인된 내용

- Lead는 기존 거래처가 아닌 향후 개척 가능한 잠재고객이다.
- Lead 단계는 `신규등록 → 초도방문 → 키맨미팅 → 변환`이며 `컨택제외` 분기가 있다.
- Lead는 요약, 활동, 단계/Key Field, 기본정보, Keyman, 병원 규모/시스템, 기타정보를 관리한다.
- Lead 변환 시 병원정보는 Account, Keyman 정보는 Contact, 관심품목은 Opportunity 시작정보로 이어진다.
- Account는 기존 거래 중이거나 향후 거래가 예정된 병원정보를 관리한다.
- Account는 요약, 활동, 거래처 기본정보, 거래상태, 관리정보, 주소, ERP 연동정보를 관리한다.
- Contact는 Account의 담당자/관련 인원이며 기본/추가/개원정보를 관리한다.
- ERP 거래처 등록요청에는 교육자료가 명시한 10개 필수항목이 있다.

### DIO UX decision — 이번 설계에서 정하는 내용

- PC 조회는 `Split Workspace`를 사용한다.
- 신규/수정은 `Quick Create + Progressive Detail`을 사용한다.
- Mobile은 PC 화면을 축소하지 않고 `List → Full Detail → Edit` 흐름으로 재구성한다.
- 다수 속성을 한 화면에 평면적으로 나열하지 않고 Section / Tab / Accordion으로 계층화한다.
- 조회 목록에는 전체 등록속성이 아니라 업무 판단에 필요한 핵심속성만 표시한다.
- 한국어를 포함한 모든 표시문구는 i18n Resource Key로 관리한다.
- Country, Locale, Currency, Timezone, Workflow/Profile은 서로 분리한다.

## 1. 핵심 Entity 관계

```text
Lead (잠재 거래처)
  │
  ├─ 신규등록
  ├─ 초도방문
  ├─ 키맨미팅
  ├─ 컨택제외
  └─ 변환
       ├─ Account      : 병원 / 거래처 정보
       ├─ Contact      : Keyman / 담당자 정보
       └─ Opportunity  : 관심품목 / 제안 시작점

Account
  ├─ Contacts
  ├─ Activities
  ├─ Opportunities
  ├─ Contracts
  ├─ Orders
  └─ ERP Integration
```

Lead와 Account는 단절된 메뉴가 아니다. Lead에서 축적한 정보가 변환 후 Account / Contact / Opportunity로 연결되고, 변환된 Account에서는 `Source Lead`를 역참조할 수 있어야 한다.

## 2. Lead 프로세스와 단계별 정보보강

### 2.1 신규등록 — Quick Create

목적은 `최소 입력으로 Lead를 먼저 등록하고 영업활동을 시작`하는 것이다.

우선입력 후보:

- 병원/거래처명
- 국가/법인 Context
- 전화번호
- 이메일
- 병원주소
- 영업담당자
- 관심품목

교육자료의 개원일자/웹사이트 등은 같은 기본정보 Section에서 관리하되 최초 저장을 과도하게 막지 않는다. 실제 Required 여부는 Source 또는 이후 Fit/Gap에서 확정한다.

### 2.2 초도방문 — Hospital / System 보강

- 총 의사 수
- 치과 전문의 수
- 메인 시스템
- 서브 시스템
- 특이사항

### 2.3 키맨미팅 — Keyman 보강

- 고객유형
- Keyman 이름
- 휴대폰
- 이메일
- 출신학교
- 전공
- 기수
- 특이사항

### 2.4 컨택제외

- 컨택제외 사유
- 컨택제외 상세사유

### 2.5 변환

```text
Lead Hospital / Business Data  → Account
Lead Keyman Data               → Contact
Lead Interest                  → Opportunity Seed
Lead Code                      → Source Lead Reference
Lead Activity History          → Related History Linkage
```

Prototype에서는 변환 전 `Conversion Preview`를 표시하여 사용자가 어떤 값이 어느 Entity로 이동하는지 확인한 뒤 실행하도록 한다.

## 3. Account / Contact 프로세스

### 3.1 Account 정보영역

교육자료의 Account 정보를 PC/Mobile 공통 Information Architecture로 재배치한다.

1. `Summary`
   - 거래처 상태
   - 거래처 등급
   - ERP 연동상태
   - 영업담당자
   - 대표 연락수단
   - Source Lead
2. `Basic`
   - 거래처명
   - 법인/국가 Context
   - 거래처 유형
   - 전화번호
3. `Trade Status`
   - 거래처 상태
   - 거래처 등급
   - 거래여부
   - 거래처 현황
4. `Management`
   - 사업자명
   - 사업자등록번호
   - 대표자명/법정대리인 관련 정보
   - 개원일자
5. `Address`
   - 우편번호
   - 병원주소
6. `ERP`
   - 연동상태
   - ERP 거래처코드
   - 승인여부
   - ERP Registration Readiness
7. `Contacts`
   - 연결 Contact 목록 / 등록 / 편집
8. `Activities`
   - 방문 이력
   - 통화 이력
9. `Related Records`
   - Opportunity
   - Contract
   - Order

### 3.2 Contact 정보영역

1. `Summary / Basic`
   - 거래처
   - 고객유형
   - 이름
   - 전화
   - 이메일
2. `Additional`
   - 생년월일
   - 결혼여부
   - 관심품목
   - 성향
3. `Opening`
   - 개원 예정일자
   - 개원 희망지역
4. `Source / Related`
   - Source Lead
   - 활동 / 관련 Opportunity 연결 가능성

## 4. ERP 거래처 등록 요청

교육자료에 명시된 필수입력 10개를 `ERP Readiness`의 기준으로 사용한다.

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

Prototype은 실제 ERP를 호출하지 않는다.

```text
BEFORE_REQUEST → REQUESTING → SUCCESS / FAILED
```

UI는 `7 / 10 complete`처럼 준비도를 보여줄 수 있으나 실제 운영 Required Rule은 향후 Integration / Country Fit-Gap에서 확정한다.

## 5. 조회정보와 입력정보 분리 원칙

속성이 많다는 이유로 List Grid에 모든 컬럼을 노출하지 않는다.

### Lead List 핵심정보

- Lead / 병원명
- 단계
- Keyman
- 전화번호
- 영업담당자
- 최근 활동 또는 다음 Action — 실제 Source/요구 확인 후 활성화

### Account List 핵심정보

- 거래처코드
- 거래처명
- 거래처 상태
- 거래처 등급
- ERP 연동상태
- 영업담당자
- 대표 연락처

### Detail

전체 관리속성은 Detail의 Section/Tab에서 확인한다.

### Create/Edit

`첫 저장에 필요한 최소정보`와 `업무진행 중 보강정보`를 분리한다.

## 6. PC / Mobile 공통 UX 프로세스

### PC

```text
Search / Filter / List  |  Selected Record Detail
                         |  Summary + Sections + Related
                         |  [Edit] [Process Action]
```

### Mobile

```text
List
 ↓ select
Full Detail
 ↓ edit
Quick / Section Form
 ↓ save
Return to same Detail context
```

Mobile에서 List와 Detail을 단순 세로로 이어붙이지 않는다. 정보량이 많은 Entity는 화면전환 방식이 더 읽기 쉽고 상태보존도 명확하다.

## 7. Globalization / i18n 기본원칙

### 7.1 Locale은 Country와 분리

예시:

```text
countryCode   = US / MX / KR / IN / ...
locale        = ko-KR / en-US / ...
currency      = USD / KRW / ...
timezone      = company/user configuration
```

하나의 국가가 하나의 언어라는 가정을 두지 않는다.

### 7.2 한국어도 동일 i18n 체계 사용

하드코딩 예:

```tsx
<button>신규등록</button> // 금지
```

Resource Key 예:

```text
crm.common.action.create
crm.lead.title
crm.lead.stage.new
crm.account.section.erp
crm.account.field.businessNo
```

`ko-KR` Resource도 다른 언어와 동일한 방식으로 로딩한다.

### 7.3 UI Layout 규칙

- 번역문구가 길어져도 Button / Tab / Label이 깨지지 않도록 Fixed Width 최소화
- Tab이 많거나 번역이 길면 Horizontal Scroll 또는 More 메뉴 사용
- Label과 Value를 분리하여 번역에 따라 필드폭이 무너지지 않도록 함
- Date / Number / Currency는 locale formatter 사용
- Address는 국가별 형식차이를 고려해 Section 단위 확장 가능하게 설계
- RTL은 현재 요구가 없으므로 구현범위가 아니지만 DOM 구조를 불필요하게 방향 고정하지 않는다.

## 8. Prototype Boundary

- 실제 ERP 등록요청 없음
- 실제 India Zoho 연동 없음
- 실제 DB Write 없음
- Browser Local Storage mock only
- Production 변경 없음
- India/PT/TR 등 국가별 업무규칙 임의추정 금지
- 한국어 포함 다국어 `구조`는 반영하되 실제 번역 범위는 별도 작업에서 확정

## 9. Acceptance

- Lead → Account / Contact 연결관계가 UI와 데이터 양쪽에서 명확하다.
- PC는 Split Workspace로 다건 조회와 상세확인이 동시에 가능하다.
- Create/Edit은 Quick + Progressive Section으로 구성한다.
- Mobile은 List → Detail → Edit의 명확한 Navigation을 사용한다.
- 다수 속성은 Tab / Section / Accordion으로 관리한다.
- Account 화면에서 교육자료의 기본/상태/관리/주소/ERP/활동/연락처 정보영역을 모두 수용할 수 있다.
- 한국어를 포함한 UI 문자열은 i18n Resource 체계로 확장 가능하다.
- Country와 Locale을 분리한다.
- Dashboard(C)는 이번 운영화면 구현과 분리한다.
