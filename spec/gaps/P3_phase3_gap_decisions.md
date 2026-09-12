# Phase 3 Gap Decision Record

## 목적
Phase 3 Sales Activity 구현 중 Phase 0 Open Gap 중 실제 구현에 영향을 주는 항목을 명시적으로 처리한다. 교육자료에 없는 정책은 임의로 영업정책으로 확정하지 않는다.

## GAP-002 — 위치 정확도 / Mock GPS 정책

- 상태: `OPEN / NON-BLOCKING FOR SOURCE BASELINE`
- 현재 구현:
  - GPS IN/OUT 시 `accuracyM`, `isMocked`를 저장한다.
  - Phase 0 승인값인 GPS IN 거리 200m는 적용한다.
  - Mock GPS 여부 또는 정확도 값만으로 IN을 차단하지 않는다.
- 이유:
  - 교육자료에는 위치기반 IN 제한은 있으나 Mock GPS/정확도 임계값 정책이 없다.
- 운영 적용 전 결정 필요:
  - 허용 accuracy 기준(m)
  - Mock GPS 감지 시 차단/경고/감사만 수행 여부
  - GPS 불가 시 예외승인 절차

## GAP-005 — 활동보고 반려 및 재요청

- 상태: `OPEN / BASELINE EXCLUDED`
- 현재 구현:
  - 담당자 승인요청 → 지점장 승인 → 본부장 최종승인만 구현한다.
  - 활동보고 Reject API는 제공하지 않는다.
- 이유:
  - 원 교육자료에서 활동보고의 반려 상태/재요청 규칙이 명확히 정의되지 않았다.
- 향후 업무결정 후 State Machine을 추가한다.

## GAP-006 — 직출/직퇴 반려 후 재요청 방식

- 상태: `RESOLVED AS PROJECT DESIGN DECISION`
- 결정:
  - 동일 `crm_direct_work` Master를 유지한다.
  - 반려 후 재요청 시 `approval_round`를 +1 한다.
  - 모든 승인/반려 행동은 `crm_approval_action`에 Append-only로 기록한다.
- 근거:
  - 교육자료의 반려 후 재승인 요청 요구를 만족하면서 감사이력을 보존하기 위한 기술 설계다.

## 추가 기술 Gap — Map Provider

- 상태: `DEFERRED`
- 현재 구현은 Provider 독립적인 Map Data API와 브라우저 Geolocation을 제공한다.
- 실제 지도 SDK/Provider(Kakao/Naver/Google 등)는 인프라/라이선스 결정 후 연결한다.

## 추가 기술 Gap — ERP 직출/직퇴 Transport

- 상태: `DEFERRED`
- Activity OUT 및 CRM 본부장 승인 완료 조건을 만족하면 `crm_interface_log`에 `IF-ERP-012` 요청을 `REQUESTING`으로 생성한다.
- 실제 ERP Endpoint/SP/인증/응답 Adapter는 P5 또는 ERP Interface 상세 확정 시 연결한다.
- Adapter가 연결되기 전에는 성공으로 간주하지 않는다.
