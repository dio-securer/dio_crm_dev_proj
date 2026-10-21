# Lead / Account — A+B 복합형 화면설계안 (PC · Mobile)

- 문서유형: UX / UI Screen Design
- 상태: **DESIGN SPEC (Confirmed Baseline 적용)**
- 작성일: 2026-09-16
- 상위 Baseline: [`00_UI_Design_Confirmed_Baseline.md`](./00_UI_Design_Confirmed_Baseline.md)
- 적용범위: HQ / GLOBAL / 향후 Country Profile
- 대상 화면: **Lead**, **Account**

---

## 1. 설계 목적

본 문서는 DIO CRM 운영형 Lead / Account 화면의 **PC · Mobile A+B 복합형** 상세 설계안이다.

```text
A (Split Workspace)  → 조회 / 업무처리
B (Quick Create + Sections) → 신규등록 / 편집
```

Dashboard(C안)는 본 문서 범위에 포함하지 않는다.

---

## 2. 공통 설계 원칙

### 2.1 Layout Baseline

| Device | A (조회) | B (등록/편집) |
|--------|----------|---------------|
| **PC (>1100px)** | 좌 38~42% List Panel + 우 58~62% Detail Panel | Quick Create Drawer/Modal → 저장 후 Detail Section 편집 |
| **Tablet (821~1100px)** | List 100% → Detail Overlay 또는 Stack | Full-width Form Panel |
| **Mobile (≤820px)** | Search/Filter → List → Detail Page | Full-page Quick Create → Accordion Sections |

### 2.2 공통 App Shell

```text
[Sidebar Nav]  Lead | Account | Contact | ...
[Topbar]       Global Search | Market/Locale | User
[Workspace]    A+B Composite Area
```

- Sidebar / Bottom Nav 메뉴 라벨: i18n 키 (`nav.lead`, `nav.account`)
- Market / Locale Context는 Topbar에 항상 표시

### 2.3 상태 보존 (State Preservation)

Drill-down / Mobile Detail 진입 후 복귀 시 보존:

```text
검색어 / 필터
목록 Page / Scroll
선택 Row
Detail Tab / Section 위치
작성 중 Form Draft (임시저장)
```

### 2.4 i18n / Profile 원칙

- 화면 문구: **고정 텍스트 금지**, i18n 키 사용
- 국가별 필드 노출: **Field Section Profile** 기반 (화면 if/else 금지)
- 날짜 / 통화 / 시간대 / 주소: Locale Context + Country Profile
- 라벨 길이: Tab / Button min-width 여유, truncate + tooltip

---

## 3. Lead 화면설계

### 3.1 Route / Screen Key

| Item | Value |
|------|-------|
| Route | `/` (slot: `lead`) |
| HQ ScreenKey | `HQ_LEAD` |
| GLOBAL ScreenKey | `GLOBAL_LEAD` |
| API Base | `/api/leads` |

### 3.2 업무 프로세스 (Status Flow)

운영 Baseline 프로세스 (API Contract 기준):

```text
NEW (신규등록)
  → FIRST_VISIT (초도방문)
  → KEYMAN_MEETING (키맨미팅)
  → CONVERTED (변환) | CONTACT_EXCLUDED (컨택제외)
```

**UI 표현**

- PC/Mobile Detail 상단: **Step Progress Bar** (4단계)
- 현재 단계 Badge + 다음 액션 CTA
- 상태 전이: 권한·업무규칙 검증 후 API `POST /api/leads/:id/status`

### 3.3 PC — A: Split Workspace

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [+ Quick Create]  Lead (1,328)          [All][In Progress][Converted]   │
│ [Search........................] [Filter▼] [Sort▼]                         │
├─────────────────────────────┬────────────────────────────────────────────┤
│ LIST PANEL (38~42%)         │ DETAIL PANEL (58~62%)                      │
│                             │                                            │
│ □ 서울미래병원              │ 서울미래병원                    [Edit][···] │
│   김영업 · 010-xxx · NEW    │ Step: ●신규 ○초도 ○키맨 ○변환              │
│                             │ ─────────────────────────────────────────  │
│ □ 부산센트럴병원            │ [Overview][Activity][Keyman][System][Conv.]│
│   이영업 · FIRST_VISIT      │                                            │
│                             │ ■ Basic Info (always open)                 │
│ □ ...                       │   병원명 / 국가 / 전화 / 담당자 / 주소      │
│                             │ ■ Keyman Info          [2 registered]      │
│                             │ ■ Hospital Scale       [300 beds / EMR]    │
│                             │ ■ System Info          [collapsed]         │
│                             │ ■ Activity History     [collapsed]         │
│                             │ ■ Conversion           [collapsed]         │
│                             │                                            │
│ [Pagination]                │ [Save Draft] [Save] [Convert to Account]    │
└─────────────────────────────┴────────────────────────────────────────────┘
```

#### List Panel 구성

| 영역 | 요소 |
|------|------|
| **Header** | Quick Create 버튼, 총 건수, Status Tab Filter |
| **Search** | 병원명 / 담당자 / 전화 / Lead No. |
| **Filter** | Stage, Owner, Country, Region, Source, Date Range |
| **List Item** | 병원명(Primary), 담당자, 전화, Stage Badge, Owner, Last Activity |
| **Footer** | Pagination, Rows per page |

#### Detail Panel 구성

| 영역 | 요소 |
|------|------|
| **Header** | Entity Name, Stage Badge, Edit / More Actions |
| **Step Bar** | 4단계 Progress (B안 Step Form 시각화) |
| **Tabs** | Overview, Activity, Keyman, System, Conversion |
| **Sections** | Accordion (PC에서도 Section 접기/펼치기 가능) |
| **Footer Actions** | Save Draft, Save, Status Transition, Convert |

#### Detail Tabs

| Tab Key | i18n Key | 내용 |
|---------|----------|------|
| `overview` | `lead.tabs.overview` | Basic Info, Next Action, Tags, Note Summary |
| `activity` | `lead.tabs.activity` | 활동 이력 Timeline |
| `keyman` | `lead.tabs.keyman` | Keyman 목록 / 등록 |
| `system` | `lead.tabs.system` | 병원 규모, EMR/HIS, Sub System |
| `conversion` | `lead.tabs.conversion` | Account 변환, 컨택제외 사유 |

### 3.4 PC — B: Quick Create + Section Edit

#### Quick Create (Drawer, width 480~560px)

**필수 필드 (저장 전)**

| Field | i18n Key | Required | Profile |
|-------|----------|----------|---------|
| 병원명 | `lead.fields.hospitalName` | ✓ | GLOBAL |
| 국가 | `lead.fields.country` | ✓ | GLOBAL |
| 전화번호 | `lead.fields.phone` | ✓ | GLOBAL |
| 담당자명 | `lead.fields.contactName` | ✓ | GLOBAL |
| 주소 | `lead.fields.address` | ○ | GLOBAL |
| 담당 영업 | `lead.fields.owner` | ✓ | GLOBAL |
| Lead Source | `lead.fields.source` | ○ | Profile |

**동작**

```text
[Quick Create] → Drawer Open → 필수값 입력 → [Save]
  → List에 즉시 반영 + Detail Panel Auto Select
  → Step Bar = NEW
  → Section 보강 유도 (Incomplete Badge)
```

#### Section 보강 (저장 후 Detail에서)

| Section | i18n Key | 주요 필드 | Profile |
|---------|----------|-----------|---------|
| **Keyman** | `lead.sections.keyman` | keymanName, keymanType, mobile, email | GLOBAL |
| **Hospital Scale** | `lead.sections.hospitalScale` | bedCount, departmentCount, doctorCount | KR / GLOBAL 분기 |
| **System Info** | `lead.sections.system` | mainSystem, subSystem | KR |
| **Activity** | `lead.sections.activity` | 활동 등록 / Timeline | GLOBAL |
| **Conversion** | `lead.sections.conversion` | convertTarget, excludeReason | GLOBAL |

> **KR 전용 예:** HIRA 연계, sido/sigungu, business_no — HQ Field Profile에서 노출  
> **GLOBAL:** hospital_name, phone, address, owner 중심 최소셋

### 3.5 Mobile — A: List → Detail

```text
┌─────────────────────────┐
│ ☰  Lead        🔔  👤   │
│ [Search...........][≡]  │
│ [All][Progress][Done]   │
├─────────────────────────┤
│ 서울미래병원      [NEW] │
│ 김영업 · 010-xxx        │
│ 2024.10.25              │
├─────────────────────────┤
│ 부산센트럴병원 [FIRST]  │
│ ...                     │
├─────────────────────────┤
│ [🏠][Lead][Act][···][+] │
└─────────────────────────┘

        ↓ Tap List Item

┌─────────────────────────┐
│ ← Lead Detail           │
│ 서울미래병원      [NEW] │
│ Step 1/4 ●○○○           │
├─────────────────────────┤
│ ▼ Basic Info            │
│   병원명 / 국가 / ...   │
│ ▶ Keyman Info    (2)    │
│ ▶ Hospital Scale        │
│ ▶ System Info           │
│ ▶ Activity History      │
│ ▶ Conversion            │
├─────────────────────────┤
│ [Save Draft]  [Save]    │
└─────────────────────────┘
```

- List → Detail: Full Page Navigation
- Back: List 상태(검색/스크롤/선택) 복원
- FAB `[+]` : Quick Create Full Page

### 3.6 Mobile — B: Quick Create

```text
┌─────────────────────────┐
│ ← New Lead              │
│ Step: Quick Registration│
├─────────────────────────┤
│ 병원명 *                │
│ 국가 *                  │
│ 전화번호 *              │
│ 담당자명 *              │
│ 주소                    │
│ 담당 영업 *             │
├─────────────────────────┤
│ [Save Draft]  [Save]    │
└─────────────────────────┘
```

저장 후 Detail Page로 이동, Section Accordion에서 보강.

### 3.7 Lead List Columns

#### 기본 컬럼 (GLOBAL 공통)

| Column | i18n Key | Width |
|--------|----------|-------|
| Hospital Name | `lead.columns.hospitalName` | flex |
| Status | `lead.columns.status` | 100px |
| Owner | `lead.columns.owner` | 120px |
| Phone | `lead.columns.phone` | 120px |
| Last Activity | `lead.columns.lastActivity` | 100px |

#### 국가별 보조 컬럼 (Profile)

| Profile | 추가 Column |
|---------|-------------|
| **HQ (KR)** | Region(sido/sigungu), Business No., HIRA Status |
| **GLOBAL** | Country (flag), Address Summary |
| **IN / PT / TR** | TBD — Profile 확장 시 추가 |

### 3.8 Lead i18n Key 구조

```text
lead.title
lead.subtitle
lead.actions.{create,edit,save,saveDraft,convert,exclude}
lead.tabs.{overview,activity,keyman,system,conversion}
lead.sections.{basic,keyman,hospitalScale,system,activity,conversion}
lead.fields.{hospitalName,country,phone,contactName,address,owner,source,...}
lead.status.{NEW,FIRST_VISIT,KEYMAN_MEETING,CONTACT_EXCLUDED,CONVERTED}
lead.columns.{hospitalName,status,owner,phone,lastActivity,...}
lead.filters.{all,inProgress,converted,...}
lead.empty.{list,detail,search}
lead.toast.{created,saved,converted,...}
```

기존 `leadV2.*` (HQ Mock) 키는 위 구조로 **점진 통합**한다.

---

## 4. Account 화면설계

### 4.1 Route / Screen Key

| Item | Value |
|------|-------|
| Route | `/accounts` (slot: `account`) |
| HQ ScreenKey | `HQ_ACCOUNT` |
| GLOBAL ScreenKey | `GLOBAL_ACCOUNT` |
| HQ 360 Route | `/account360` (HQ only) |
| API Base | `/api/accounts` |

### 4.2 PC — A: Split Workspace

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [+ Quick Create]  Account (524)     [Managed][Mine][All]                 │
│ [Search: name/code/owner/country...] [Country▼][Grade▼][Status▼][Filter]│
├─────────────────────────────┬────────────────────────────────────────────┤
│ LIST PANEL                  │ DETAIL PANEL                               │
│                             │                                            │
│ □ Samsung Electronics       │ Samsung Electronics           [Edit][···]  │
│   AC-2024-001 · KR · A      │ [A Grade] [ERP Linked]                     │
│                             │ ─────────────────────────────────────────  │
│ □ Toyota Motor              │ [Summary][Contacts][Trade][Manage][ERP][+] │
│   AC-2024-002 · JP · S      │                                            │
│                             │ ■ Summary (Basic Info Grid)                │
│ □ ...                       │   Code / Name / Country / Type / Grade     │
│                             │ ■ Contacts (3)           [Quick Add]       │
│                             │ ■ Trade Status           [collapsed]       │
│                             │ ■ Management Info        [collapsed]       │
│                             │ ■ Address                [collapsed]       │
│                             │ ■ ERP Readiness          [collapsed]       │
│                             │ ■ Related Data           [collapsed]       │
│                             │   Opp(5) Contract(3) Activity(7)           │
│                             │                                            │
│ [Pagination]                │ [Save Draft] [Save] [ERP Request]          │
└─────────────────────────────┴────────────────────────────────────────────┘
```

#### List Panel 구성

| 영역 | 요소 |
|------|------|
| **Header** | Quick Create, 총 건수, Scope Tab (Managed / Mine / All) |
| **Search** | Account Name, Code, Owner, Country |
| **Filter** | Country, Industry, Grade, Status, ERP Status, Last Activity |
| **List Item** | Name(Primary), Code, Country(flag), Grade Badge, Owner, ERP Status |
| **Footer** | Pagination |

#### Detail Panel Tabs

| Tab Key | i18n Key | 내용 |
|---------|----------|------|
| `summary` | `account.tabs.summary` | Basic Info Grid, Recent KPI Cards |
| `contacts` | `account.tabs.contacts` | 연락처 목록 + Quick Add |
| `trade` | `account.tabs.trade` | 거래상태, ERP Trade Code |
| `manage` | `account.tabs.manage` | Grade, Approval, Use YN, Churn Risk |
| `address` | `account.tabs.address` | Address Fields (Locale format) |
| `erp` | `account.tabs.erp` | ERP Readiness, Integration Status |
| `related` | `account.tabs.related` | Opportunity, Contract, Order, Activity Count + Drill-down Link |

### 4.3 PC — B: Quick Create + Section Edit

#### Quick Create (Drawer)

**필수 필드**

| Field | i18n Key | Required | Profile |
|-------|----------|----------|---------|
| 거래처명 | `account.fields.accountName` | ✓ | GLOBAL |
| 국가 | `account.fields.country` | ✓ | GLOBAL |
| 거래처 유형 | `account.fields.accountType` | ✓ | GLOBAL |
| 전화번호 | `account.fields.phone` | ✓ | GLOBAL |
| 주소 | `account.fields.address` | ○ | GLOBAL |
| 담당 영업 | `account.fields.owner` | ✓ | GLOBAL |

**동작**

```text
[Quick Create] → Drawer → Save → Detail Auto Select
  → Summary Tab Open
  → Incomplete Section Badge 표시
```

#### Section 보강 (Field Section Profile 기반)

| Section Code | i18n Key | HQ Profile | GLOBAL Profile |
|--------------|----------|------------|----------------|
| `identity` | `account.sections.identity` | ✓ (co_cd) | ✓ (co_cd, readonly) |
| `hira` | `account.sections.hira` | ✓ (KR 전용) | ✗ |
| `basic` | `account.sections.basic` | ✓ | ✓ |
| `address` | `account.sections.address` | ✓ | ✓ |
| `erp` | `account.sections.erp` | ✓ (readonly) | ✓ (readonly) |
| `manage` | `account.sections.manage` | ✓ | ✓ |

**Profile Resolver**

```text
KR + KR_SALES market → HQ_FIELD_PROFILE (hira 포함)
explicit fieldProfileCode → 해당 Profile
default → GLOBAL_FIELD_PROFILE
```

구현 참조:

- `frontend/src/market/field-profiles/HQ_ACCOUNT.ts`
- `frontend/src/market/field-profiles/GLOBAL_ACCOUNT.ts`
- `frontend/src/market/field-profiles/field-profile-resolver.ts`

#### Detail 상단 CRM 전용 필드 (Section Profile 외)

| Field | i18n Key | 비고 |
|-------|----------|------|
| accountName | `account.fields.accountName` | Display / Edit |
| accountStatus | `account.fields.accountStatus` | Status Badge |
| accountGrade | `account.fields.accountGrade` | Grade Badge |

### 4.4 Mobile — A: List → Detail

```text
┌─────────────────────────┐
│ ← Account      [Search] │
│ [Managed][Mine][All]    │
├─────────────────────────┤
│ 🏢 Samsung Electronics  │
│ AC-2024-001 · A · ERP ✓ │
├─────────────────────────┤
│ 🏢 Toyota Motor         │
│ ...                     │
├─────────────────────────┤
│ [Bottom Nav]      [+]   │
└─────────────────────────┘

        ↓ Tap

┌─────────────────────────┐
│ ← Samsung Electronics   │
│ [A Grade][ERP Linked]   │
│ [Summary|Contact|ERP|+]│
├─────────────────────────┤
│ ▼ Summary               │
│   Code / Country / ...  │
│ ▶ Contacts         (3)  │
│ ▶ Trade Status          │
│ ▶ Management            │
│ ▶ Address               │
│ ▶ ERP Readiness         │
│ ▶ Related Data          │
├─────────────────────────┤
│ [Edit]        [Save]    │
└─────────────────────────┘
```

- Tab Bar: Horizontal Scroll
- Section: Accordion
- Related Data: Card List + Drill-down Link

### 4.5 Mobile — B: Quick Create

Quick Create Full Page → Save → Detail Accordion 보강.  
Lead Mobile과 동일 패턴, Bottom Action `[Save Draft] [Save]`.

### 4.6 Account List Columns

#### 기본 컬럼

| Column | i18n Key | Source |
|--------|----------|--------|
| Account Name | `account.table.accountName` | GLOBAL |
| Account Code | `account.table.accountCode` | GLOBAL |
| Country | `account.table.country` | GLOBAL (flag) |
| Grade | `account.table.grade` | GLOBAL |
| Owner | `account.table.owner` | GLOBAL |
| Status | `account.table.status` | GLOBAL |
| ERP Status | `account.table.erpStatus` | GLOBAL |
| Last Activity | `account.table.lastActivity` | GLOBAL |

#### 국가별 보조 컬럼

| Profile | 추가 Column |
|---------|-------------|
| **HQ** | HIRA Provider No., Business No., Region |
| **GLOBAL** | Industry, Integration Status |
| **IN / PT / TR** | TBD |

Desktop column set: `DESKTOP_TABLE_FIELDS` (`packages/contracts/src/account-interface.ts`)

### 4.7 Account i18n Key 구조

```text
account.title / account.subtitle
account.actions.{create,edit,save,saveDraft,erpRequest,...}
account.tabs.{summary,contacts,trade,manage,address,erp,related}
account.sections.{identity,hira,basic,address,erp,manage}
account.fields.{accountName,accountType,country,phone,address,owner,...}
account.table.{accountName,accountCode,country,grade,owner,status,erpStatus,...}
account.statuses.{ACTIVE,NEW,NON_TRADING,...}
account.grades.{S,A,B,...}
account.integrationStatus.{...}
account.filters.{managed,mine,all,...}
account.empty.{list,detail,search}
```

---

## 5. A+B 전환 흐름 (Interaction Flow)

### 5.1 Lead — 신규 등록 → 보강 → 변환

```text
1. [Quick Create] → 최소 필드 Save
2. Detail Auto Open (Step = NEW)
3. Section 보강 (Keyman, System, Activity)
4. Status Transition: NEW → FIRST_VISIT → KEYMAN_MEETING
5. [Convert to Account] → Account Quick Create Pre-fill
6. Lead Status = CONVERTED
```

### 5.2 Account — 신규 등록 → ERP 연동

```text
1. [Quick Create] → 최소 필드 Save
2. Detail Summary Open
3. Section 보강 (Contacts, Address, Manage)
4. [ERP Request] → Integration Workflow
5. ERP Tab에서 연동 상태 Tracking
```

### 5.3 List ↔ Detail ↔ Edit

```text
PC:
  List Row Click → Detail Panel (A)
  [Edit] or Section Edit → Inline / Section Form (B)
  Save → Detail Refresh (A)

Mobile:
  List Tap → Detail Page (A)
  [Edit] → Section Accordion Edit Mode (B)
  Back → List State Restore
```

---

## 6. Drill-down / Related Entity

Account Detail `Related` Tab 및 List Business Key는 [`UI_Interaction_Design_Baseline.md`](../multi-market/UI_Interaction_Design_Baseline.md)를 따른다.

| Reference | Display Key | Navigation |
|-----------|-------------|------------|
| Account Code | `AC-2024-001` | `/accounts/:public_id` |
| Opportunity No. | `OPP-00031` | `/opportunities/:public_id` |
| Contract No. | `CONT-00031` | `/contracts/:public_id` |
| Contact Name | Display Name | Contact Detail |

---

## 7. Responsive Breakpoint 매핑

[`01_DIO_UI_Responsive_PWA_Design.md`](./01_DIO_UI_Responsive_PWA_Design.md) 기준:

| Breakpoint | Lead / Account Layout |
|------------|----------------------|
| Desktop >1100 | Split Workspace (A) |
| Tablet 821~1100 | List Full → Detail Stack/Overlay |
| Mobile ≤820 | List → Detail Page |
| Small Mobile ≤430 | Single Column, Compact Tabs |

---

## 8. 현재 구현과 Gap (참고)

| 항목 | 현재 | Target (본 설계) |
|------|------|------------------|
| HQ Lead | `LeadsPage` Mock, `leadV2.*` i18n | API Contract Status Flow + Profile 통합 |
| GLOBAL Lead | `GlobalLeadPage` Table only | A+B Split Workspace 적용 |
| HQ Account | `AccountsPage` + `FORM_SECTIONS` | Field Profile Resolver 통합 |
| GLOBAL Account | `GlobalAccountPage` + Profile | 본 설계 Tabs/Sections 정렬 |
| Lead Field Profile | 없음 | **신규** `HQ_LEAD` / `GLOBAL_LEAD` Profile 추가 필요 |
| GLOBAL i18n | 일부 Hardcode EN | i18n 키 전환 |

본 Gap은 4단계 프로토타입 수정 시 해소 대상이다.

---

## 9. 프로토타입 Acceptance Criteria

### Lead

```text
[ ] PC Split Workspace (List + Detail)
[ ] Mobile List → Detail Navigation
[ ] Quick Create (최소 5필드)
[ ] Step Progress Bar (4단계)
[ ] Section Accordion 보강
[ ] Status Transition Actions
[ ] Convert to Account Flow
[ ] i18n 키 적용 (ko-KR / en-US 최소)
[ ] Country Profile 필드 노출
[ ] State Preservation (List/Detail)
```

### Account

```text
[ ] PC Split Workspace (List + Detail)
[ ] Mobile List → Detail + Accordion
[ ] Quick Create (최소 5필드)
[ ] Detail Tabs (7개)
[ ] Field Section Profile (HQ/GLOBAL)
[ ] ERP Tab / Request Action
[ ] Related Entity Drill-down Link
[ ] i18n 키 적용
[ ] List Column (기본 + Profile 보조)
[ ] State Preservation
```

---

## 10. 다음 단계

```text
3단계  i18n 라벨 기준 정리 (lead.* / account.* 키 Catalog)
4단계  프로토타입 수정 (Lead / Account / Contact)
5단계  시연용 Prototype → 경영진 PPT
```

Contact 화면설계는 Account `Contacts` Tab / Quick Add 패턴을 확장하여 별도 문서로 작성한다.
