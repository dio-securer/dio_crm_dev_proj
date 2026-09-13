# Globalization Open Gaps

- Work: `CRM-GL-001`
- Status: OPEN / REVIEW_REQUIRED
- Date: 2026-09-13

## Confirmed baseline

- 기존 한국 CRM 업무규칙은 그대로 보존한다.
- `ko-KR / KR / KRW / Asia/Seoul`을 현재 시스템의 호환 Baseline으로 사용한다.
- `en-US`는 i18n/Formatting 검증용 Reference Locale로 Source에 포함하되, 특정 해외법인 Production 활성화로 간주하지 않는다.
- 국가별 Repository/App Fork는 만들지 않는다.

## Open gaps

| ID | 항목 | 상태 | 처리 원칙 |
|---|---|---|---|
| GL-GAP-001 | 1차 Production 지원 Locale 목록 | OPEN | Product Owner 승인 전 국가 활성화 금지 |
| GL-GAP-002 | 1차 해외 Market 목록 | OPEN | KR 외 실제 Market Profile 활성화 금지 |
| GL-GAP-003 | 국가별 승인 Workflow | OPEN | 현지 요구 승인 전 추정 구현 금지 |
| GL-GAP-004 | 국가별 고객/사업자 식별번호 | OPEN | 규칙 없는 Identifier Validation 금지 |
| GL-GAP-005 | 국가별 ERP/현지 시스템 | OPEN | Adapter 계약 확정 후 연결 |
| GL-GAP-006 | 국가별 Map Provider | OPEN | Provider/API Key는 환경 Gate에서 결정 |
| GL-GAP-007 | 개인정보/보존정책 | OPEN | 법무/보안 검토 필요 |
| GL-GAP-008 | 국가별 직출/직퇴 사용 여부 | OPEN | Feature Profile로 제어 |
| GL-GAP-009 | 국가별 GPS 정책/Mock 제한 | OPEN | 기존 KR GAP-002와 연계 |
| GL-GAP-010 | 국가별 세금/통화 Reporting | OPEN | 회계/ERP 기준 확정 필요 |
| GL-GAP-011 | PDF/XLSX 번역 검수 및 CJK Font | OPEN | Export 활성화 전 Locale별 검증 |

## Non-blocking decision

GL-GAP-001~011은 Globalization 공통 Layer 구현을 막지 않는다. 단, KR 외 Market을 Production-ready로 표시하거나 실제 업무규칙을 활성화하는 것은 각 Gap 승인 후 수행한다.
