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

3. `03_CRM-GL-001_Execution_Report.md`
   - CRM-GL-001 G0~G9 실행 결과
   - CI 결과와 수정 이력
   - Environment Gate / SPEC GAP
   - Human Review 및 Merge 결과

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

`CRM-GL-001 / SOURCE_COMPLETE / CI_PASS / HUMAN_REVIEW_APPROVED / MAIN_MERGED`

PR #9은 2026-09-13 Human Review 승인 후 `main`에 병합되었다.

```text
PR #9 Merge Commit
a609b26cbc70c64cecdf9a8bc8e593aa764a7462
```

다음은 아직 실행하지 않았다.

```text
DEV/UAT Migration 009 적용
국가별 실제 Workflow / Identifier / ERP / Map 활성화
Responsive UI Completion
PWA / App
Country Pilot
Production Rollout
```

특히 Migration 009는 Source Draft만 존재하며 실제 DEV/UAT/Production DB에는 적용하지 않았다.

## 다음 실행 순서

```text
DIO UI Completion
 → Responsive Mobile UI
 → PWA Foundation
 → DEV/UAT Migration 009
 → 국가별 ERP/Map 연동
 → Country Pilot
 → Production Rollout
```
