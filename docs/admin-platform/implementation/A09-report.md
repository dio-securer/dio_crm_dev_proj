# A09 완료 보고

MOCK 전용 ERP profile·필수 mapping·preview·7개 시나리오 및 request/attempt/event ledger를 구현했다. 거래처 실제 UI 요청→모의 승인/반려 상태 갱신, 계약/주문/수금/납품 합성 fixture와 관리 화면을 연결했다. 실제 ERP/EMAIL egress는 0이며 기존 enqueuePending은 변경하지 않았다.

- IF-ERP-002/004/007 기존 코드의 의미를 유지하는 명시적 sample handler. 운영 SQL handler 호출 성공으로 간주하지 않는다.
- 계약 상품 snapshot/계획합계, 주문 contract/items/address, 수금 date, 납품 item/date를 검증한다.
- transport와 businessOutcome 분리, 반려 사유, retry 동일 requestId와 attempt 증가, timeout late response의 request/revision 검사, terminal 불변, event hash 충돌409.
- 수금/납품은 externalEventId+version 전체 payload hash를 비교하고 최신 값을 교체해 exact decimal 합계를 다시 계산한다.
- 성공·실패 알림은 A08 outbox에 연결한다. 관리자 ERP 응답에서 거래처 원문 payload가 노출되지 않는다.

검증: `pnpm build` PASS; 기존 공통+HTTP 회귀108 PASS(최종 경합 테스트 추가 전), `pnpm test:admin:integration` 최종7 PASS. `CHROMIUM_PATH=/tmp/a04-chromium pnpm test:admin:integration-ui` BROWSER_MOCK/API_MOCK 둘 다 설정저장/검증/게시, preview, 실패→재시도, 반려 사유, 실제 거래처 생성→ERP 승인 PASS. 캡처 a09-erp/rejected/account-{mode}.png. 작업자 B 독립7 PASS 및 코드 최종 승인.

T18~T24,T53,T54,T80 증거: a09-http.log, a09-ui.log. 실제 OTP·ERP·EMAIL 공급자 연동은 범위 밖이다.
