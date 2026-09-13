# DIO CRM Globalization Foundation

이 폴더는 DIO CRM의 **다국어(i18n) + 국가별 현지화(Localization) + 국가별 업무/UI Profile**을 설계하고 구현하기 위한 기준 문서 모음이다.

현재 Phase 0~8 Source Baseline은 한국 영업 프로세스를 중심으로 구현되어 있으며, 이후 해외 법인/영업조직 확장을 위해 국가와 언어를 분리한 Globalization Foundation을 선행한다.

## 문서

1. `01_Globalization_Architecture_Design.md`
   - Locale / Market / Currency / Timezone 분리 원칙
   - 국가별 UI Profile / Feature Profile / Workflow Profile
   - Frontend / Backend / DB / Integration 설계
   - 주소, 날짜, 금액, 지도 Provider, ERP 연동 현지화 기준

2. `02_Globalization_Work_Instructions.md`
   - 실제 구현 순서와 Work Package
   - 산출물, 테스트, Human Gate, 완료기준
   - UI Completion / Responsive / PWA 이전에 수행할 작업 정의

## 핵심 원칙

```text
하나의 CRM Core
  + 사용자 Locale
  + Company Market Profile
  + Feature / Workflow Profile
  = 국가별 DIO CRM
```

국가별 소스 저장소나 프론트엔드를 별도로 복제하지 않는다.

```text
금지
CRM-KR / CRM-US / CRM-JP 별도 Fork

권장
DIO CRM Core
  ├─ Locale
  ├─ Market Profile
  ├─ Feature Policy
  ├─ Workflow Profile
  └─ Integration Adapter
```

## 현재 상태

`DESIGN_BASELINE_CREATED / IMPLEMENTATION_NOT_STARTED`

본 폴더의 문서는 설계/작업 기준이며, 아직 실제 i18n Library 추가, DB Migration, 국가별 UI 변경, PWA/앱 적용을 완료했다는 의미가 아니다.

## 다음 실행 순서

```text
Globalization Design Review
 → i18n Foundation
 → Market/Profile Foundation
 → DB/Backend Enforcement
 → 공통 UI Design System
 → 국가별 UI Variation
 → Responsive
 → PWA / App
 → 국가별 Pilot
```
