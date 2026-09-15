# RM-MKT-001 M11 — India Source Intake Checklist

- Work ID: `RM-MKT-001-M11`
- Country: `IN`
- Purpose: 인도 외부 CRM을 DIO CRM으로 통합/대체하기 전에 실제 운영자료를 수집하고 증거 기반 Fit/Gap 분석을 수행하기 위한 입력자료 체크리스트
- Status: `INPUT_COLLECTION_PENDING`

## 1. 원칙

M11에서는 인도 업무규칙을 추정하지 않는다.

다음 항목은 실제 자료가 확보되기 전까지 모두 `EVIDENCE_REQUIRED`로 관리한다.

```text
INDIA_ACCOUNT 전용 화면
INDIA_ORDER 전용 화면
INDIA_WORKFLOW 전용 승인규칙
INDIA_INTEGRATION 전용 연동규칙
INDIA_FEATURE 전용 기능
```

자료가 없는 경우 HQ 또는 GLOBAL의 규칙을 자동 상속한다고 판단하지 않는다.

## 2. 필수 입력자료

| ID | 영역 | 요청 자료 | 최소 확인 내용 | 상태 |
| --- | --- | --- | --- | --- |
| IN-SRC-001 | System Overview | 현재 인도 CRM 개요/구성도 | 제품명, 사용자군, 접속방식, Web/Mobile 여부 | EVIDENCE_REQUIRED |
| IN-SRC-002 | Process | 업무 프로세스 문서 | Lead→Account→Opportunity→Contract→Order 등 실제 흐름 | EVIDENCE_REQUIRED |
| IN-SRC-003 | Screen | 주요 화면 캡처 또는 매뉴얼 | 메뉴, 화면, 탭, 액션, 조회/등록/승인 흐름 | EVIDENCE_REQUIRED |
| IN-SRC-004 | Field | 화면/Entity별 Field List | 필드명, 타입, 필수, 읽기전용, 코드값 | EVIDENCE_REQUIRED |
| IN-SRC-005 | Status | 상태값/전이 목록 | Lead, Opportunity, Contract, Order, Activity 상태 전이 | EVIDENCE_REQUIRED |
| IN-SRC-006 | Approval | 승인 프로세스 | 승인대상, 승인자, 단계, 반려/재승인, 잠금 | EVIDENCE_REQUIRED |
| IN-SRC-007 | Role/Permission | 역할/권한표 | 사용자 역할, 조회/등록/수정/승인 범위 | EVIDENCE_REQUIRED |
| IN-SRC-008 | Integration | 외부 연동 목록 | ERP, Customer Master, Product, Map, Email/SMS 등 | EVIDENCE_REQUIRED |
| IN-SRC-009 | API/File | 연동 Interface Spec | Endpoint/File, 인증, 주기, Payload, 오류/재처리 | EVIDENCE_REQUIRED |
| IN-SRC-010 | Report | 보고서/대시보드 목록 | 영업/활동/매출/수금 등 보고서 및 필터 | EVIDENCE_REQUIRED |
| IN-SRC-011 | Mobile | 모바일 운영 흐름 | 현장방문, GPS, 사진, 알림, Offline/PWA 요구 | EVIDENCE_REQUIRED |
| IN-SRC-012 | Localization | 현지화 요구 | 언어, 통화, 시간대, 날짜/번호/주소/전화 형식 | EVIDENCE_REQUIRED |
| IN-SRC-013 | Master Data | 기준정보 | 고객, 제품, 조직, 사용자, Territory 등의 SOR | EVIDENCE_REQUIRED |
| IN-SRC-014 | Data Migration | 기존데이터 현황 | 대상 Entity, 건수, 이력, 첨부, 코드 매핑 | EVIDENCE_REQUIRED |
| IN-SRC-015 | Audit/Security | 보안/감사 요구 | 감사로그, 데이터 접근통제, 개인정보/보존 정책 | EVIDENCE_REQUIRED |
| IN-SRC-016 | Exception | 예외/현장운영 | 취소, 정정, 반품, 재처리, Offline/Network 예외 | EVIDENCE_REQUIRED |

## 3. 화면 단위 수집 양식

각 화면은 아래 형식으로 증거를 기록한다.

```text
Screen ID:
Screen Name:
Source File / Screenshot:
User Role:
Entry Point:
Primary Actions:
Sections / Tabs:
Fields:
Status / Transition:
Approval:
Integration:
Mobile Difference:
Known Exception:
Source Evidence:
Open Question:
```

## 4. 프로세스 단위 수집 양식

```text
Process ID:
Process Name:
Start Condition:
Actors:
Main Steps:
State Transition:
Approval Point:
External Integration:
End Condition:
Exception Flow:
Source Evidence:
Open Question:
```

## 5. 증거 등급

| 등급 | 의미 |
| --- | --- |
| `CONFIRMED` | 인도 공식 매뉴얼/정책/시스템 화면/담당자 승인으로 확인 |
| `OBSERVED` | 화면 또는 운영데이터에서 확인했으나 정책문서 미확보 |
| `ASSUMPTION` | 추정. 구현 근거로 사용 금지 |
| `EVIDENCE_REQUIRED` | 자료 미확보 |

`ASSUMPTION`과 `EVIDENCE_REQUIRED`는 Country Profile/Workflow/Integration 구현 근거로 사용하지 않는다.

## 6. 제출 파일 권장 구조

```text
India CRM 자료/
  01_overview/
  02_process/
  03_screens/
  04_fields/
  05_status_approval/
  06_roles_permissions/
  07_integrations/
  08_reports/
  09_mobile/
  10_data_migration/
  11_security_audit/
  12_exceptions/
```

## 7. M11 입력 완료 Gate

아래가 충족되면 실제 Fit/Gap 분석을 시작할 수 있다.

```text
[ ] 핵심 Sales Process 확보
[ ] 핵심 Activity Process 확보
[ ] 주요 화면 증거 확보
[ ] Field/Status 목록 확보
[ ] 승인 흐름 확보
[ ] Integration 목록 확보
[ ] Report 목록 확보
[ ] Mobile 운영자료 확보
[ ] Master/SOR 확인
[ ] Data Migration 범위 확인
[ ] 미확정 항목 Open Question으로 분리
```

현재 Gate:

```text
M11_INPUT_COLLECTION_PENDING
NO_INDIA_RULE_IMPLEMENTED
```
