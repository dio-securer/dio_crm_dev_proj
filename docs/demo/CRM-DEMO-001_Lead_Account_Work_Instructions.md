# CRM-DEMO-001 — Lead / Account Prototype 작업지시서

## 1. 목적

해외법인 Salesforce 사용자 교육자료 p.4~12를 기준으로 Lead → Account / Contact 연결 흐름을 경영진 시연 가능한 PC 중심 Prototype으로 구현한다.

## 2. 구현 원칙

- 모바일 화면을 그대로 복제하지 않고 업무 의미를 PC UX로 재배치한다.
- Source에 있는 단계/속성/연결관계는 유지한다.
- 등록은 빠르게, 상세정보는 단계별로 보완할 수 있게 한다.
- 목록은 핵심 컬럼만 노출한다.
- Business Key Drill-down을 사용한다.
- Mock data는 Local Storage에만 저장한다.
- 실제 DB / ERP / Zoho / Production은 변경하지 않는다.

## 3. Lead 구현

### L1. List
- Search
- Stage filter
- Columns: Lead/Hospital, Stage, Keyman, Phone, Owner
- Row click → Detail

### L2. Detail
- Stage Flow 표시
- Summary
- Keyman
- Hospital scale/system
- Other/business
- Edit / Convert action

### L3. Create / Edit
- Quick registration section
- Keyman section
- Hospital & System section
- Business / Exclusion section
- Local Storage persistence

### L4. Convert
- Account name 확인
- Contact name 확인
- Opportunity seed name 확인
- Convert 시 Account 생성
- Contact 생성
- Lead status `CONVERTED`
- Account profile에 Source Lead 저장
- Account 상세로 이동

## 4. Account / Contact 구현

### A1. Account List
- Search
- Columns: Code/Name, Status, ERP Integration, Phone, Owner
- Code click → Detail

### A2. Account Summary
- Basic identity
- Status / Grade
- ERP status
- Contact info
- Source Lead

### A3. Contacts
- Account에 종속된 Contact list
- New Contact
- Contact basic/additional/opening fields
- Local Storage persistence

### A4. Management / ERP
- 교육자료 ERP 등록요청 필수 10개 항목 표시
- Readiness count
- Mock request action only
- 실제 ERP 호출 금지

## 5. Responsive

- Desktop: 2-column List + Detail
- Tablet/Mobile: 1-column stacked
- Form field: mobile 1-column
- Touch target >= 44px

## 6. Test / Review

```text
[ ] pnpm build
[ ] pnpm test
[ ] pnpm regression:multi-market
[ ] pnpm i18n:check
[ ] pnpm i18n:hardcode
[ ] pnpm pwa:check
[ ] pnpm env:check
[ ] pnpm audit:critical
```

Manual demo:

```text
1. ?demo=global 접속
2. Lead 신규등록
3. Lead 편집 / 단계변경
4. Keyman 정보 입력
5. Convert
6. 생성된 Account 상세 확인
7. Source Lead 역참조 확인
8. Contact 생성/조회
9. Account 신규/편집
10. ERP readiness 확인 및 Mock request
11. Mobile width 확인
```

## 7. Human Gate

소스 구현 및 CI PASS 후 사용자 화면 검토를 받는다. 사용자가 승인하기 전 main에 병합하지 않는다. Prototype 화면 확정 후 경영진 보고용 PPT를 작성한다.
