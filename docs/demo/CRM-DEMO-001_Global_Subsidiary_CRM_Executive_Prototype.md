# CRM-DEMO-001 — Global Subsidiary CRM Executive Prototype

## 1. 목적

다음 경영진 보고에서 기존 상용 CRM(인도 Zoho CRM) 기반 별도 개발 검토안 대신, DIO가 자체 구축 중인 해외법인 CRM 공통 플랫폼을 실제 화면으로 시연한다.

본 Prototype은 India 최종 요구사항 구현이 아니다. 미국/멕시코 해외법인 자료를 기반으로 승인된 `GLOBAL_TEMPLATE`을 경영진/인도 법인에게 보여줄 수 있는 `DIO Global CRM Standard v1.0` 시안으로 정리한다.

## 2. Prototype 범위

```text
GLOBAL 메뉴 / 기본화면
Lead
Account / Contact
Activity
Activity Report
Opportunity
Contract
Order

Lead
- 목록 / 검색 / 단계 필터
- 신규 / 편집
- 단계별 상세정보
- Lead → Account / Contact 변환
- Source Lead 역참조

Account / Contact
- Account 목록 / 상세 / 신규 / 편집
- Contact 목록 / 신규
- Summary / Contacts / Management & ERP
- ERP 등록요청 필수정보 Readiness
- Browser Local Storage 유지
- Demo Seed Reset

Reference Drill-down
- Lead → Account
- Account → Source Lead
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

## 3. Lead / Account 기준자료 반영

해외법인 판매 프로세스 교육자료 p.4~12의 모바일 화면과 설명을 업무 기준으로 사용한다.

```text
Lead
신규등록 → 초도방문 → 키맨미팅 → 변환 / 컨택제외
                              │
                              └─ 변환
                                  ├─ Account
                                  ├─ Contact
                                  └─ Opportunity seed
```

모바일 화면을 그대로 확대하지 않고, PC에서는 List + Detail 동시 확인과 Quick registration 방식으로 재구성한다.

세부 설계:

- `CRM-DEMO-001_Lead_Account_Process_Design.md`
- `CRM-DEMO-001_Lead_Account_PC_Screen_Design.md`
- `CRM-DEMO-001_Lead_Account_Work_Instructions.md`

## 4. 실행 방법

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

## 5. 데모 데이터 정책

Prototype 데이터는 브라우저 Local Storage에만 저장한다.

```text
실제 DB Write       없음
ERP Write           없음
India Zoho Write    없음
Production 영향     없음
```

초기 Seed에는 US / MX와 India Fit/Gap 설명용 Sample Data가 포함된다. India Sample은 업무규칙을 의미하지 않으며 UI 검토용 Mock Data다.

## 6. 경영진 시연 시나리오

```text
1. GLOBAL 메뉴 구조 소개
2. Lead 목록 / 단계 확인
3. Lead 신규등록 / 편집
4. Keyman / 병원 규모정보 확인
5. Lead Convert
6. 생성된 Account / Contact 확인
7. Account ERP Readiness 확인
8. Opportunity / Contract / Order Drill-down
9. Browser 폭을 줄여 Mobile Navigation 시연
10. India Fit/Gap 방식 설명
```

권장 시연 시간은 5~7분이다.

## 7. India 제시 메시지

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

## 8. 완료 후 PPT

Prototype 화면 및 시연 흐름이 Human Review를 통과한 뒤 경영진 보고용 PPT를 별도 작성한다.

PPT 주요 구성 후보:

```text
1. 추진 배경 — Zoho 기반 별도 구축 vs DIO 자체 플랫폼
2. DIO Global CRM Standard 구조
3. Lead → Account / Contact 연결 프로세스
4. PC Lead / Account 화면
5. Mobile 화면
6. Mock CRUD / Drill-down 시연
7. US/MX → India 확장 방식
8. 기대효과 / 향후 일정
```

실제 PPT 제작은 Prototype 화면 확정 이후 진행한다.

## 9. Safety Boundary

- HQ Runtime 변경 목적 아님
- GLOBAL 운영 DB 변경 없음
- DB Migration 없음
- ERP/Map Provider 운영 연결 없음
- Production 변경 없음
- India 업무규칙 추정 구현 없음
