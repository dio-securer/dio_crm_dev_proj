# CRM-DEMO-001 — Global Subsidiary CRM Executive Prototype

## 1. 목적

다음 경영진 보고에서 기존 상용 CRM(인도 Zoho CRM) 기반 별도 개발 검토안 대신, DIO가 자체 구축 중인 해외법인 CRM 공통 플랫폼을 실제 화면으로 시연한다.

본 Prototype은 India 최종 요구사항 구현이 아니다. 미국/멕시코 해외법인 자료를 기반으로 승인된 `GLOBAL_TEMPLATE`을 경영진/인도 법인에게 보여줄 수 있는 `DIO Global CRM Standard v1.0` 시안으로 정리한다.

## 2. Prototype 범위

```text
GLOBAL 메뉴 / 기본화면
Lead
Account
Activity
Activity Report
Opportunity
Contract
Order

Account Mock CRUD
- 목록
- 상세
- 신규
- 편집
- Browser Local Storage 유지
- Demo Seed Reset

Reference Drill-down
- Opportunity → Account
- Contract → Account
- Order → Account
- Order → Contract
- Order → Product Quick View

Responsive
- PC Sidebar / Topbar
- Tablet
- Mobile Bottom Navigation / More Drawer
```

실제 ERP, 실제 Map Provider, India Zoho API, 실제 Production DB는 연결하지 않는다.

## 3. 실행 방법

Frontend만 실행한다.

```powershell
pnpm dev:web -- --host 0.0.0.0
```

브라우저:

```text
http://localhost:5173/?demo=global
```

최초 `?demo=global` 접근 시 Demo Mode를 Browser Local Storage에 기록하므로 내부 메뉴 이동 시 Query String이 사라져도 Demo Mode를 유지한다.

Demo 종료:

```text
http://localhost:5173/?demo=off
```

Account Mock Data 초기화는 Account 화면의 `Reset demo` 버튼을 사용한다.

## 4. 데모 데이터 정책

Prototype 데이터는 브라우저 Local Storage에만 저장한다.

```text
실제 DB Write       없음
ERP Write           없음
India Zoho Write    없음
Production 영향     없음
```

초기 Seed에는 US / MX와 India Fit/Gap 설명용 Sample Account가 포함된다. India Sample은 업무규칙을 의미하지 않으며 UI 검토용 Mock Data다.

## 5. 경영진 시연 시나리오

```text
1. GLOBAL 메뉴 구조 소개
2. Lead 기본화면
3. Account 목록
4. India Dental Demo 상세 조회
5. New Account 등록
6. 등록한 Account 편집
7. Opportunity에서 Account Code 클릭
8. Order에서 Contract No. 클릭
9. Contract Detail 확인
10. Order Product Code → Quick View
11. Browser 폭을 줄여 Mobile Navigation 시연
12. India Fit/Gap 방식 설명
```

권장 시연 시간은 5~7분이다.

## 6. India 제시 메시지

```text
DIO가 제시하는 GLOBAL 표준을 먼저 확인
        ↓
India가 그대로 사용할 항목 / 변경할 항목을 구분
        ↓
Screen / Field / Workflow / Integration Fit-Gap
        ↓
GLOBAL reuse 또는 최소 Override 결정
```

India 고유 Workflow, Approval Actor, ERP/Zoho Interface, Locale/Currency/Timezone 세부값은 실제 India 자료 확보 후 확정한다.

## 7. 완료 후 PPT

Prototype 화면 및 시연 흐름이 Human Review를 통과한 뒤 경영진 보고용 PPT를 별도 작성한다.

PPT 주요 구성 후보:

```text
1. 추진 배경 — Zoho 기반 별도 구축 vs DIO 자체 플랫폼
2. DIO Global CRM Standard 구조
3. PC 화면
4. Mobile 화면
5. Account Mock CRUD 시연
6. Entity Drill-down 시연
7. US/MX → India 확장 방식
8. 기대효과 / 향후 일정
```

실제 PPT 제작은 Prototype 화면 확정 이후 진행한다.

## 8. Safety Boundary

- HQ Runtime 변경 목적 아님
- GLOBAL 운영 DB 변경 없음
- DB Migration 없음
- ERP/Map Provider 운영 연결 없음
- Production 변경 없음
- India 업무규칙 추정 구현 없음
