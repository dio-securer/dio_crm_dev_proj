# DIO CRM — UI Interaction Design Baseline

- 문서유형: UX / UI Architecture Baseline
- 적용범위: HQ / GLOBAL / 향후 Country Profile 공통
- 상태: DESIGN BASELINE
- 목적: 현재 모든 UI 규칙을 선행 확정하지 않되, 향후 상용 ERP/CRM 수준의 화면 연계 기능을 추가할 때 구조 변경 없이 확장할 수 있도록 기본 원칙과 Extension Point를 정의한다.

> **확정 UI Design Model:** 화면 레이아웃·등록/편집 패턴·다국어 원칙의 Source of Truth는 [`docs/ui/00_UI_Design_Confirmed_Baseline.md`](../ui/00_UI_Design_Confirmed_Baseline.md) (A+B 운영형, C 대시보드, i18n)이다. 본 문서는 Entity Drill-down / Reference Navigation / State Preservation 보조 Baseline이다.

---

## 1. 기본 원칙

본 문서는 완성된 UI Rule Book이 아니다. 현재 확정 가능한 공통 원칙만 정의하고, 실제 화면/업무 요구가 추가될 때 세부 규칙을 확장한다.

앞으로 별도 요청이 없어도 신규 화면/리팩터링 시 아래 원칙을 기본 검토 항목으로 적용한다.

```text
업무 Entity 간 관계를 UI에서도 탐색 가능하게 설계
표시용 Business Key와 내부 Navigation Key를 분리
PC / Mobile에서 동일 정보관계를 유지
권한/상태/업무규칙을 우회하지 않는 Drill-down 제공
화면별 임시 링크 구현 대신 공통 Registry/Component 사용
상세 Route와 참조 구조를 안정적인 Contract로 관리
```

국가별 업무 차이는 기존 Market Template / Country Profile 구조를 따르며, UI Interaction 자체는 가능한 한 공통 규칙으로 유지한다.

---

## 2. Entity Reference Navigation

상용 ERP/CRM과 동일하게 기준정보와 Transaction 간 주요 Reference는 상세정보로 Drill-down 할 수 있도록 설계한다.

대표 예:

```text
Order
  ├─ Contract No.    → Contract Detail
  ├─ Account Code    → Account Detail
  └─ Product Code    → Product Detail

Contract
  ├─ Account Code    → Account Detail
  └─ Opportunity No. → Opportunity Detail

Activity
  ├─ Account / Lead  → Related Entity Detail
  └─ Contact         → Contact Detail
```

초기 Link 후보 Entity:

```text
LEAD
ACCOUNT
CONTACT
OPPORTUNITY
CONTRACT
ORDER
PRODUCT
PACKAGE
COLLECTION
ACTIVITY
```

실제 Detail Screen이 존재하지 않거나 업무상 노출이 승인되지 않은 Entity는 Link를 활성화하지 않는다.

---

## 3. Business Key와 Navigation Key 분리

사용자에게 보이는 값과 실제 Navigation 식별자는 분리한다.

예:

```text
표시값
Contract No. = CONT-00031

내부 Navigation Key
contract_public_id = <public id>

URL
/contracts/<public id>
```

원칙:

```text
화면 표시        → 사람이 이해하는 Business Key
URL / API Lookup → public_id 등 외부 노출용 Stable Identifier
DB Identity PK   → 가능하면 직접 URL에 노출하지 않음
```

향후 API/ViewModel 설계 시 Reference 항목은 가능하면 다음 두 값을 함께 제공할 수 있는 구조를 고려한다.

```text
referencePublicId
referenceDisplayKey
```

현재 API/DB Contract를 이 문서만으로 즉시 변경하지는 않는다. 실제 화면 구현 시 필요한 범위에서 Backward-compatible하게 확장한다.

---

## 4. 공통 Route Registry 방향

화면마다 URL 문자열을 직접 조합하지 않고 Entity Route Registry를 통해 상세 Route를 Resolve할 수 있도록 설계한다.

개념 예:

```ts
ENTITY_ROUTE_REGISTRY = {
  ACCOUNT: '/accounts/:id',
  PRODUCT: '/products/:id',
  OPPORTUNITY: '/opportunities/:id',
  CONTRACT: '/contracts/:id',
  ORDER: '/orders/:id'
}
```

향후 실제 구현 시 공통 UI Primitive 후보:

```text
EntityLink / ReferenceLink
EntityRouteRegistry
EntityQuickView (Optional)
RelatedEntitySection
```

단, 현재 단계에서는 모든 Entity의 Detail Route 존재를 가정하지 않는다.

---

## 5. 화면별 기본 적용 방식

### 5.1 List / Grid

Business Key가 관련 Entity를 식별하고 상세 화면이 존재하면 Link 후보로 본다.

```text
Contract No.
Order No.
Account Code
Product Code
Opportunity No.
```

단순 코드값이라고 해서 무조건 Link로 만들지는 않는다. 다음 조건을 만족해야 한다.

```text
Detail 대상 Entity가 명확함
조회 권한이 있음
Navigation Key를 확보할 수 있음
업무상 Drill-down이 유효함
```

### 5.2 Form / Transaction Entry

주문 작성 중 선택된 계약과 같이 이미 참조된 Master/Transaction은 사용자가 원본 정보를 확인할 수 있도록 상세 조회 진입점을 제공할 수 있다.

예:

```text
Order Form
Contract No. CONT-00031  [상세]
Account      CUST001     [상세]
```

조회 때문에 작성 중인 Form State가 소실되지 않도록 한다.

### 5.3 Detail Screen

Detail Screen은 Related Entity를 다시 Drill-down할 수 있어야 한다.

예:

```text
Order Detail
 → Contract
 → Opportunity
 → Account
```

Circular Navigation이 가능하더라도 URL/History Stack이 정상 동작하도록 한다.

---

## 6. PC / Mobile Interaction 원칙

동일 Reference 관계를 유지하되 표시 방식은 Device에 따라 달라질 수 있다.

PC 후보:

```text
Link Click
 → Detail Page
또는
 → Quick View Drawer / Popover
 → Full Detail
```

Mobile 후보:

```text
Link Tap
 → Full Detail Page
 → Back
 → 기존 List/Form 상태 복원
```

Quick View는 필수 기능이 아니라 향후 사용성 개선 옵션이다.

---

## 7. State Preservation

Drill-down 이후 이전 화면으로 돌아왔을 때 사용자의 작업 컨텍스트를 가능한 보존한다.

보존 후보:

```text
검색조건
현재 Page
선택 Row
Scroll 위치
작성 중 Form State
Tab / Section 위치
```

구체적인 보존 방식은 화면 특성에 따라 React Router State, Query State, Form State 또는 URL Query Parameter를 사용한다.

---

## 8. Authorization / Security

Reference Link는 권한을 우회하는 기능이 아니다.

원칙:

```text
Frontend Link Visibility ≠ Authorization
Backend 조회 API에서 최종 권한 검증
미권한 사용자 → 403 또는 Controlled Not Found
민감정보는 Detail API에서 별도 Field 권한 적용 가능
```

URL을 직접 입력해도 동일한 권한 검증이 적용돼야 한다.

---

## 9. Accessibility / Usability 기본선

향후 Entity Link 구현 시 다음을 기본으로 고려한다.

```text
키보드 접근 가능
명확한 Focus 상태
Link임을 시각적으로 식별 가능
모바일 Touch Target 확보
새 창 강제 오픈 지양
뒤로가기 동작 보존
Loading / Error 상태 명확화
```

---

## 10. Multi-Market 적용 원칙

Reference Navigation은 HQ / GLOBAL / 향후 India 등 모든 Template에서 공통 Framework를 사용한다.

국가별 차이가 필요한 경우:

```text
Link 자체를 국가 if/else로 분기하지 않음
Screen/Profile에서 Entity Detail 사용 가능 여부를 결정
Field/Profile에서 Reference Field 노출 여부를 결정
Feature/Permission에서 활성화 여부를 결정
```

따라서 향후 India가 GLOBAL Template을 재사용하거나 Override하더라도 Reference Navigation 구조를 다시 설계할 필요가 없도록 한다.

---

## 11. 현재 단계에서 확정하지 않는 것

아래는 실제 요구가 생겼을 때 확정한다.

```text
모든 Entity의 Detail Route 목록
모든 Business Key의 Link 여부
Quick View 대상 Field
Drawer vs Modal vs Full Page 정책
Country별 특수 Reference
ERP 외부화면 Deep Link
새 창/Open-in-new-tab 정책
Breadcrumb 전체 규칙
```

즉, Extension Point는 미리 확보하되 화면별 세부 UX를 과도하게 선행 구현하지 않는다.

---

## 12. 향후 구현 Acceptance 기준

Reference Link 기능을 추가할 때 최소한 아래 항목을 확인한다.

```text
[ ] Business Key와 public_id 분리
[ ] Route Registry 사용
[ ] Detail Screen 존재 확인
[ ] Backend 권한 검증
[ ] PC Navigation 정상
[ ] Mobile Navigation 정상
[ ] Back Navigation 시 상태보존
[ ] 없는/삭제된 Entity Controlled Error
[ ] HQ/GLOBAL Regression 없음
[ ] 국가코드 if/else 확산 없음
```

---

## 13. 설계 적용 선언

이 문서 이후 DIO CRM의 신규 UI 설계에서는 사용자가 매번 개별 요청하지 않더라도 다음을 기본 검토한다.

```text
관련 Entity 간 Drill-down 필요 여부
Business Key Reference Link 필요 여부
Detail 화면 확장 가능성
PC/Mobile Navigation 일관성
State Preservation
권한/오류 처리
공통 Component / Registry 재사용 가능성
```

단, 실제 업무규칙이나 국가별 요구를 근거 없이 확정하지 않는다. 기본 Architecture는 미리 확장 가능하게 두고, 구체적인 기능 활성화는 Source of Truth 또는 사용자의 승인에 따라 진행한다.
