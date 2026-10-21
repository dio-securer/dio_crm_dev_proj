# DIO CRM — i18n Label Catalog (Lead / Account A+B)

- 문서유형: i18n / Localization Catalog
- 상태: **ACTIVE (Step 3 Complete)**
- 작성일: 2026-09-16
- 상위 Baseline: [`00_UI_Design_Confirmed_Baseline.md`](./00_UI_Design_Confirmed_Baseline.md)
- 화면설계: [`02_Lead_Account_AB_Screen_Design.md`](./02_Lead_Account_AB_Screen_Design.md)

---

## 1. 목적

Lead / Account A+B 복합형 화면에 필요한 **i18n 키 체계**를 확정하고, locale 리소스 파일 위치·네이밍 규칙·마이그레이션 가이드를 정의한다.

---

## 2. Locale 전략

### 2.1 Runtime Locale (구현 완료)

| Locale | 상태 | Resource |
|--------|------|----------|
| `ko-KR` | **Active** | `common.json` + `lead.json` + `account-ext.json` |
| `en-US` | **Active** | `common.json` + `lead.json` + `account-ext.json` |

### 2.2 Planned Locale (Stub — en-US Fallback)

| Locale | 상태 | Fallback |
|--------|------|----------|
| `es-MX` | Stub | `en-US` |
| `pt-PT` | Stub | `en-US` |
| `tr-TR` | Stub | `en-US` |
| `hi-IN` | Stub | `en-US` |

Locale 라벨: `locale.{code}` (`common.json`)

### 2.3 Fallback Chain

```text
요청 Locale → ko-KR (FALLBACK_LOCALE)
Planned Locale → en-US copy + localeMeta (번역 TODO)
```

---

## 3. Resource 파일 구조

```text
frontend/src/i18n/
├── index.ts                    # i18n init + merge
├── merge-resources.ts          # deep merge utility
├── locale-resolver.ts          # ko-KR / en-US runtime switch
├── planned-locales.ts          # es-MX, pt-PT, tr-TR, hi-IN registry
└── locales/
    ├── ko-KR/
    │   ├── common.json         # App shell, nav, legacy account, other modules
    │   ├── lead.json           # lead.* canonical (A+B)
    │   ├── account-ext.json    # account.* A+B extension keys
    │   └── lead-mock.ts        # leadV2.* legacy (deprecated)
    ├── en-US/
    │   └── (동일 구조)
    └── _stubs/
        └── locale-meta.json    # planned locale metadata
```

### Merge 순서 (나중 wins)

```text
common.json → lead.json → account-ext.json → lead-mock.ts (legacy)
```

---

## 4. Key Naming Convention

```text
{entity}.{category}.{name}
```

| Category | 용도 | 예 |
|----------|------|-----|
| `title`, `subtitle` | 화면 제목 | `lead.title` |
| `actions.*` | 버튼 / CTA | `lead.actions.convert` |
| `tabs.*` | Detail Tab | `account.tabs.erp` |
| `sections.*` | Accordion Section | `lead.sections.keyman` |
| `fields.*` | Form Label | `lead.fields.hospitalName` |
| `status.*` | Entity Status | `lead.status.NEW` |
| `columns.*` | List Column | `account.columns.country` |
| `filters.*` | Filter Tab/Option | `lead.filters.inProgress` |
| `empty.*` | Empty State | `lead.empty.list` |
| `toast.*` | Toast Message | `account.toast.draftSaved` |
| `quick.*` | Quick Create | `lead.quick.title` |

### 공통 Status (Cross-Entity)

Lead API Status 등 공통 코드는 **두 곳**에서 사용 가능:

```text
status.NEW              ← common.json (legacy / global)
lead.status.NEW         ← lead.json (Entity scoped, A+B canonical)
```

신규 UI는 **`lead.status.*` / `account.statuses.*`** 를 우선 사용한다.

---

## 5. Lead Key Catalog

### 5.1 Screen / Shell

| Key | ko-KR | en-US |
|-----|-------|-------|
| `lead.title` | Lead | Lead |
| `lead.subtitle` | 잠재 고객을 발굴하고… | Discover prospects… |
| `lead.listTitle` | Lead 목록 | Lead list |
| `lead.detailTitle` | Lead 상세 | Lead detail |
| `lead.quickCreateTitle` | Lead 빠른 등록 | Quick create Lead |
| `lead.searchPlaceholder` | 병원명, 담당자… | Hospital, owner… |

### 5.2 Actions

| Key | ko-KR | en-US |
|-----|-------|-------|
| `lead.actions.create` | 신규 등록 | New registration |
| `lead.actions.save` | 저장 | Save |
| `lead.actions.saveDraft` | 임시 저장 | Save draft |
| `lead.actions.convert` | Account 변환 | Convert to Account |
| `lead.actions.exclude` | 컨택 제외 | Exclude contact |
| `lead.actions.nextStatus` | 다음 단계 | Next stage |

### 5.3 Tabs (A+B Detail)

| Key | ko-KR | en-US |
|-----|-------|-------|
| `lead.tabs.overview` | 개요 | Overview |
| `lead.tabs.activity` | 활동 | Activity |
| `lead.tabs.keyman` | Keyman | Keyman |
| `lead.tabs.system` | 시스템 | System |
| `lead.tabs.conversion` | 변환 | Conversion |

### 5.4 Sections (B — Progressive)

| Key | ko-KR | en-US |
|-----|-------|-------|
| `lead.sections.basic` | 기본 정보 | Basic information |
| `lead.sections.keyman` | Keyman 정보 | Keyman information |
| `lead.sections.hospitalScale` | 병원 규모 | Hospital scale |
| `lead.sections.system` | 시스템 정보 | System information |
| `lead.sections.activity` | 활동 이력 | Activity history |
| `lead.sections.conversion` | 변환 처리 | Conversion |

### 5.5 Quick Create Fields (B)

| Key | Required | ko-KR |
|-----|----------|-------|
| `lead.fields.hospitalName` | ✓ | 병원명 |
| `lead.fields.country` | ✓ | 국가 |
| `lead.fields.phone` | ✓ | 전화번호 |
| `lead.fields.contactName` | ✓ | 담당자명 |
| `lead.fields.address` | ○ | 주소 |
| `lead.fields.owner` | ✓ | 담당 영업 |

### 5.6 Status / Steps (API Contract)

| Code | Key | ko-KR |
|------|-----|-------|
| `NEW` | `lead.status.NEW` | 신규등록 |
| `FIRST_VISIT` | `lead.status.FIRST_VISIT` | 초도방문 |
| `KEYMAN_MEETING` | `lead.status.KEYMAN_MEETING` | 키맨미팅 |
| `CONTACT_EXCLUDED` | `lead.status.CONTACT_EXCLUDED` | 컨택제외 |
| `CONVERTED` | `lead.status.CONVERTED` | 변환 |

Step Progress Bar: `lead.steps.*` (동일 라벨)

### 5.7 List Columns

| Key | Profile | ko-KR |
|-----|---------|-------|
| `lead.columns.hospitalName` | GLOBAL | 병원명 |
| `lead.columns.status` | GLOBAL | 상태 |
| `lead.columns.owner` | GLOBAL | 담당자 |
| `lead.columns.phone` | GLOBAL | 전화 |
| `lead.columns.lastActivity` | GLOBAL | 최근 활동 |
| `lead.columns.region` | HQ | 지역 |
| `lead.columns.businessNo` | HQ | 사업자번호 |
| `lead.columns.country` | GLOBAL | 국가 |

---

## 6. Account Key Catalog

### 6.1 기존 Keys (`common.json` — 유지)

아래는 기존 `account.*` 키로 **그대로 유지**한다.

```text
account.title / subtitle / search / name / phone / owner / grade
account.sections.{identity,hira,basic,address,erp,manage}
account.fields.{erpCode,accountName,accountType}
account.table.* / statuses.* / grades.* / integrationStatus.*
account.filters.* / actions.{plan,order,erp}
```

### 6.2 A+B Extension Keys (`account-ext.json`)

| Key | ko-KR | en-US |
|-----|-------|-------|
| `account.tabs.summary` | 요약 | Summary |
| `account.tabs.contacts` | 연락처 | Contacts |
| `account.tabs.trade` | 거래상태 | Trade status |
| `account.tabs.manage` | 관리정보 | Management |
| `account.tabs.address` | 주소 | Address |
| `account.tabs.erp` | ERP | ERP |
| `account.tabs.related` | 관련 데이터 | Related data |
| `account.actions.saveDraft` | 임시 저장 | Save draft |
| `account.actions.erpRequest` | ERP 등록요청 | Request ERP registration |
| `account.quick.title` | Account 빠른 등록 | Quick create Account |
| `account.columns.accountCode` | 거래처 코드 | Account code |
| `account.columns.country` | 국가 | Country |
| `account.columns.erpStatus` | ERP 상태 | ERP status |
| `account.badges.erpLinked` | ERP 연동 | ERP linked |

### 6.3 Quick Create Fields (B)

| Key | Required |
|-----|----------|
| `account.fields.accountName` | ✓ |
| `account.fields.country` | ✓ |
| `account.fields.accountType` | ✓ |
| `account.fields.phone` | ✓ |
| `account.fields.address` | ○ |
| `account.fields.owner` (common: `account.owner`) | ✓ |

---

## 7. Legacy Migration Map

HQ Mock UI (`LeadsPage`)의 `leadV2.*` → `lead.*` 점진 전환:

| Legacy (`leadV2`) | Canonical (`lead`) |
|-------------------|---------------------|
| `leadV2.title` | `lead.title` |
| `leadV2.tabs.overview` | `lead.tabs.overview` |
| `leadV2.quick.title` | `lead.quick.title` |
| `leadV2.stage.NEW` | `lead.status.NEW` (API) 또는 Mock stage 별도 |
| `leadV2.columns.lead` | `lead.columns.lead` |
| `leadV2.toast.created` | `lead.toast.created` |

> **Note:** Mock `LeadStage` (CONTACTED, PROPOSAL 등)와 API `LeadStatus` (FIRST_VISIT 등)는 **다른 enum**이다.  
> 4단계 프로토타입에서 API Status 기준으로 UI 통합한다. Mock stage 라벨은 `leadV2.stage.*` 유지 후 제거.

GLOBAL Lead/Account 하드코드 EN 문자열 → 본 Catalog 키로 교체 (4단계).

---

## 8. Formatting / Profile Keys (Non-Label)

라벨 외 i18n/format은 Globalization Context에서 처리:

```text
날짜   → Intl.DateTimeFormat(locale)
통화   → Intl.NumberFormat(locale, { style: 'currency', currency })
주소   → Country Profile address template
필드   → Field Section Profile visible/required
```

화면 코드에서 `country === 'KR'` 분기 금지 → Profile resolver 사용.

---

## 9. 구현 규칙

```text
[ ] UI JSX/TSX에 사용자 노출 문자열 하드코딩 금지
[ ] 신규 Lead/Account UI는 lead.* / account.* Catalog 키만 사용
[ ] leadV2.* 신규 추가 금지 (기존 Mock 호환만 유지)
[ ] Tab/Section/Column 추가 시 본 Catalog + locale JSON 동시 업데이트
[ ] Planned locale 번역 시 lead.json / account-ext.json 복제 후 번역
[ ] 긴 라벨(PT/TR) UI 테스트 후 min-width / wrap 확인
```

---

## 10. Acceptance (Step 3)

```text
[x] Key naming convention 확정
[x] lead.json ko-KR / en-US 작성
[x] account-ext.json ko-KR / en-US 작성
[x] Planned locale stub (es-MX, pt-PT, tr-TR, hi-IN)
[x] merge-resources + index.ts 통합
[x] i18n spec test 추가
[x] Legacy migration map 문서화
```

---

## 11. 다음 단계 (4단계)

```text
LeadsPage / GlobalLeadPage / AccountsPage / GlobalAccountPage
  → lead.* / account.* 키 적용
  → leadV2.* / hardcoded EN 제거
  → A+B UI 프로토타입 정렬
```
