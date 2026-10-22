# A02 실행 보고서

2026-10-21 · ADM-01/02/03/30 · 기준 b6f1b75 + 원격 8d41669 통합.

## 구현
- OrganizationCommands를 HTTP/Browser adapter에서 공유한다. 회사 생성·프로필 초안, 중지·재개, template preview/apply 초안을 지원한다. 실제 release 활성화는 A04/A10이다.
- 조직 트리, 사용자, 회사 membership, 복수 회사 전환 및 담당자 이관 preview/job을 구현했다. 원본 user.company_id/숫자 JWT는 변경하지 않는다.
- 회사 관리자는 자신의 membership만 중지하고 플랫폼 관리자는 전역 identity를 중지할 수 있다. 이전 토큰은 재활성화 후에도 permissionVersion으로 무효화한다. 마지막 도달 가능한 플랫폼/회사 관리자 보호를 적용한다.
- 이관은 거래처/리드/기회/계약/주문 종류와 recordIds를 선택한다. 부분 성공/충돌 결과, 동일 job 재실행 방지, 비활성·타 회사 대상 거부를 지원한다. 승인 task 담당자는 변경하지 않는다.
- MockEntry에서 플랫폼 관리 대상 법인을 별도 선택하며 이전 회사의 늦은 응답을 버린다. 편집 중 전환은 저장/버리기/취소를 제공한다.

## 검증
`pnpm build`, `pnpm test`(57+74=131), `pnpm test:admin:api`(21/21), `pnpm test:admin:entry`, `pnpm test:admin:browser` 통과. logs: evidence/a02-{build,test,api,entry,browser}.log.

T68 조직 순환·타 회사 parent·원자 rollback, T38 미소속 전환과 이전 토큰, T49 중지/재개와 마지막 관리자, T58-UNIT 프로필/템플릿 초안 및 stale preview, T82 부분 이관/충돌/재실행/비활성 대상, T26 늦은 응답 제거를 실행했다. T82는 API HTTP와 브라우저 shared adapter에서 각각 검증했다. UI 조직 생성/순환 오류/입력 보존은 두 모드에서 실제 Chromium으로 확인했다. screenshots: evidence/a02-organization-{API_MOCK,BROWSER_MOCK}.png.

작업자 B의 refresh/switch 경합, 토큰 부활, 프로필 직접 적용, 사용자 중지 범위, template revision, 관리 대상 선택, 이관 UI, 활성 소속 선택, 마지막 플랫폼 관리자 잔여 지적을 수정했다. 최종 고정 커밋 cc99d9a에서 작업자 B가 A02 게이트를 승인했다. B는 A02 HTTP 10/10을 독립 재실행하고 통합 빌드·131 단위·21 HTTP·양 모드 화면·CAS 로그를 확인했다. A03 진행 가능 판정이며 A03~A11 전체 완료 승인은 아니다.

## 남은 범위
A03 역할·필드·데이터 권한/DEMO MFA, A04 게시 엔진, A05 동적 화면과 T83 모바일 전체, A06 번호/달력, A07 승인, A08 알림, A09 ERP 목업, A10 운영 통합, A11 전체 83 TC는 미완료다. T43/T58 INTEGRATION은 후속 단계이며 현재 일부 단계 시나리오 성공을 전체 PASS로 올리지 않는다. 실제 DB/ERP/운영 MFA는 수행하지 않았다.
