# DIO CRM — UI Design Confirmed Baseline

- 문서유형: UX / UI Design Decision (Confirmed)
- 상태: **CONFIRMED BASELINE**
- 확정일: 2026-09-16
- 적용범위: HQ / GLOBAL / 향후 Country Profile 공통
- 목적: 운영형 화면·대시보드·다국어 UI의 **확정 설계 모델**을 정의하고, 이후 프로토타입·구현·AI 작업의 기준 Source of Truth로 사용한다.

---

## 1. 확정 의사결정 요약

| 구분 | 확정 방향 |
|------|-----------|
| **운영형 메인 UI** | **A + B 복합형** |
| **대시보드 / 요약 화면** | **C안** (후속 단계) |
| **다국어** | 처음부터 i18n 키 기반 |
| **한국어** | 다국어 체계에 포함 (`ko-KR`) |
| **국가 확장** | US / MX / IN / PT / TR 등 전제 |

이 문서 이후 신규 화면 설계, 프로토타입, Frontend 구현, AI Agent 작업은 **별도 승인 없이도 본 Baseline을 기본 모델**로 따른다.

---

## 2. Concept 모델 정의

### Concept A — Split Workspace (조회 / 업무처리 골격)

**역할:** 운영 화면의 기본 레이아웃

**PC**

```text
좌측: 목록 / 검색 / 필터
우측: 상세 / 탭 / 관련정보
```

**Mobile**

```text
상단: 검색 / 필터
중앙: 목록
하단 또는 별도 진입: 상세 페이지
```

**적용 대상:** Lead, Account, Contact, Opportunity, Contract, Order 등 속성이 많은 Entity

**시안 참조:** `Concept A — Split Workspace`

---

### Concept B — Step Form + Detail Sections (등록 / 편집)

**역할:** 신규등록·편집 UX

**패턴**

```text
1. Quick Create   → 필수 최소값만 먼저 저장
2. Detail Sections → 저장 후 탭/섹션에서 점진적 보강
```

**원칙:** 사용자가 처음부터 많은 필드를 한 번에 입력하지 않게 한다.

**시안 참조:** `Concept B — Step Form + Detail Sections`

---

### Concept C — Dashboard Summary + Deep Detail (대시보드)

**역할:** 경영·KPI·요약 화면 (운영 화면과 분리)

**후속 활용 예**

```text
경영진 보고
영업 KPI 요약
국가별 실적 비교
파이프라인 / Funnel 현황
활동 요약 / 승인 현황
```

**시안 참조:** `Concept C — Dashboard Summary + Deep Detail`

> **주의:** C안은 현재 운영 화면 구축 범위에 포함하지 않는다. Dashboard Phase에서 적용한다.

---

### Concept D — Workspace Tabs + Drawer Detail (참고)

**역할:** 탭형 Workspace + Drawer 상세 변형

**상태:** 참고 시안. 운영 메인 UI의 확정 모델은 **A + B**이며, D안의 Drawer/탭 패턴은 A+B 구조 내 보조 UX로만 참고한다.

**시안 참조:** `Concept D — Workspace Tabs + Drawer Detail`

---

## 3. A + B 복합형 운영 패턴

운영 화면 = **조회는 A, 등록/편집은 B**

```text
┌─────────────────────────────────────────────────────┐
│  A: Split Workspace (List + Detail)                 │
│  ┌──────────────┬──────────────────────────────┐  │
│  │ List/Filter  │ Detail / Tabs / Related Data   │  │
│  └──────────────┴──────────────────────────────┘  │
│                                                     │
│  B: Create/Edit (Quick Create → Sections)           │
│  [Quick Create] → Save → [Section 보강]            │
└─────────────────────────────────────────────────────┘
```

---

## 4. 화면별 적용

### 4.1 Lead

| 구분 | 패턴 |
|------|------|
| **조회 (A)** | 좌: Lead 목록 / 우: Lead 상세 |
| **등록/편집 (B)** | Quick Create → 단계별 정보 보강 |

**Quick Create 최소 필드**

```text
병원명
국가
전화번호
담당자명
주소
```

**저장 후 보강 섹션**

```text
Keyman
병원 규모
시스템 정보
활동 이력
변환 처리
```

**프로세스**

```text
신규등록 → 초도방문 → 키맨미팅 → 변환 / 컨택제외
```

---

### 4.2 Account

| 구분 | 패턴 |
|------|------|
| **조회 (A)** | 좌: 거래처 목록 / 우: 거래처 상세 |
| **등록/편집 (B)** | Section 기반 입력 |

**Quick Create 최소 필드**

```text
거래처명
국가
거래처 유형
전화번호
주소
```

**저장 후 상세 섹션**

```text
Summary
Contacts
거래상태
관리정보
주소
ERP
관련 데이터
```

---

### 4.3 Contact

| 구분 | 패턴 |
|------|------|
| **조회** | Account 내부 연결 관리 + 별도 상세 |
| **등록/편집 (B)** | 빠른 등록 (Quick Create) |

---

### 4.4 Opportunity / Contract / Order

| 구분 | 패턴 |
|------|------|
| **조회** | A안 Split Workspace |
| **등록/편집** | B안 Section / Step 기반 |

**확장 구조**

```text
계약번호 / 거래처코드 / 품목코드 → 클릭형 Drill-down 확장 가능 구조 확보
```

Drill-down 상세 규칙은 `docs/multi-market/UI_Interaction_Design_Baseline.md`를 따른다.

---

## 5. 다국어 / 다국가 UI 원칙

### 5.1 Locale 체계

한국어는 별도 예외가 아니라 다국어 체계의 하나다.

**기본 Locale 후보**

```text
ko-KR
en-US
es-MX
pt-PT
tr-TR
hi-IN  (또는 인도 법인 운영언어 기준)
```

### 5.2 i18n 적용 범위

단순 번역을 넘어 다음까지 Baseline에 포함한다.

```text
화면 문구          → i18n 키 기반 (고정 텍스트 금지)
날짜 형식
통화
시간대
주소 형식
국가별 필드 표시 여부
국가별 프로세스 / 승인 차이
```

### 5.3 UI 설계 원칙

**1) 라벨 길이 대응**

```text
영어 / 포르투갈어 / 튀르키예어는 한국어보다 길어질 수 있음
→ 버튼, 탭, 필드 레이블 폭 여유 필요
```

**2) 국가별 필드 노출 제어**

```text
KR 전용 필드
GLOBAL 공통 필드
IN / PT / TR 전용 필드
→ Country Profile / Field Section Profile 기반 제어
```

**3) 리스트 컬럼 유연성**

```text
기본 컬럼
+ 국가별 보조 컬럼
```

---

## 6. PC / Mobile 일관성

동일 Entity·동일 정보관계를 PC/Mobile 모두에서 유지한다.

| Device | A (조회) | B (등록/편집) |
|--------|----------|---------------|
| **PC** | Split Workspace | Quick Create Modal/Panel + Section Tabs |
| **Mobile** | List → Detail Page | Quick Create Form + Accordion Sections |

Mobile 상세는 Accordion / Bottom Action(저장·임시저장) 패턴을 사용한다.

---

## 7. 관련 문서

| 문서 | 관계 |
|------|------|
| `docs/ui/02_Lead_Account_AB_Screen_Design.md` | Lead / Account PC·Mobile A+B 상세 설계 |
| `docs/ui/03_i18n_Label_Catalog.md` | Lead / Account i18n 키 Catalog |
| `docs/ui/04_AB_Prototype_Execution_Report.md` | Step 4 A+B 구조 프로토타입 |
| `docs/ui/05_Visual_Design_Execution_Report.md` | Step 4.5 시안 Visual 매칭 |
| `docs/ui/06_Demo_Prototype_Verification_Report.md` | Step 5 시연 Prototype 검증 |
| `docs/ui/01_DIO_UI_Responsive_PWA_Design.md` | Responsive / PWA / Design Token |
| `docs/multi-market/UI_Interaction_Design_Baseline.md` | Drill-down / Entity Link / State Preservation |
| `docs/multi-market/01_RM-MKT-001_Multi-Market_UI_Architecture_Design.md` | Market Template / Country Profile |
| `docs/globalization/01_Globalization_Architecture_Design.md` | Locale / i18n Architecture |

---

## 8. 작업 순서 (로드맵)

```text
1단계  Lead / Account A+B 구조 확정                    ← 본 문서로 확정
2단계  PC / Mobile 화면설계안 작성                      ← 02_Lead_Account_AB_Screen_Design.md
3단계  i18n 라벨 기준 정리                              ← 03_i18n_Label_Catalog.md
4단계  프로토타입 수정 (Lead / Account / Contact)        ← 04_AB_Prototype_Execution_Report.md
4.5단계 시안 Visual Design Implementation              ← 05_Visual_Design_Execution_Report.md
5단계  시연용 Prototype 확정                              ← 06_Demo_Prototype_Verification_Report.md
6단계  경영진 보고 PPT
```

---

## 9. AI / 구현 적용 선언

이후 DIO CRM UI 관련 작업(설계, 프로토타입, Frontend, Mock)은 **본 문서를 Design Model**로 사용한다.

```text
운영 화면 신규/수정  → A + B 복합형
Dashboard / KPI     → C안 (별도 Phase)
UI 문구             → i18n 키
국가별 차이         → Profile 기반 (화면 if/else 금지)
Entity Drill-down   → UI Interaction Baseline
```

Concept A/B/C/D 시안 이미지는 경영진 보고·프로토타입 참조용 Visual Model로 사용한다.
