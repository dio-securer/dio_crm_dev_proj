# A07 프로세스·승인 엔진·관리 화면

2026-10-21 · ADM-19~22 · 기준 원격 a08598d · PR #28 초안.

## 구현

- WORKFLOW/APPROVAL typed 편집과 A04 초안·검증·게시 연결. 신규 승인 엔진은 WORKFLOW.enabled를 켜고 명시 정책을 게시한 샘플 문서에 적용한다. 기존 activity 승인 경로는 유지한다. 기본 GLOBAL 정책은 미확정(빈 policies)이라 제출을 차단하며 route에는 DEMO_ONLY를 표시한다.
- 문서 생성/조회/수정/제출, 일반 승인함, 상세 task/event, 순차·ALL·ANY, 반려·회수·재상신·관리자 재배정. 자동 승인과 임의 quorum은 없다. 완료 APPROVED 재제출·진행 문서 수정은 금지한다.
- 제출에서 정책 우선순위·동순위 충돌, 활성 회사 membership/권한, 빈 승인자·자기승인·alternate, 문서/release를 검사한다. 실패하면 문서/instance/task/event/outbox가 부분 저장되지 않는다. 정의/정책/결재선/문서/달력/timezone/release/dueAt snapshot을 고정한다.
- task와 instance revision 및 If-Match를 검사하고 멱등 receipt와 결과를 동일 트랜잭션에 저장한다. ANY는 최초 확정 승인/반려를 적용하고 나머지를 취소한다. ALL은 전원 승인 후 완료한다. 설정 변경은 기존 snapshot을 바꾸지 않는다.
- 대결 등록/조회/회수 및 기간 [startsAt,endsAt), 자기·연쇄·겹침 거부. 원승인자 중지 시 대결도 거부하고 IN_PROGRESS.blockedReason을 표시한다. 재배정은 기존 task SUPERSEDED와 새 task를 연결한다. 원승인자·실결정자·deputyId·시각·사유를 기록한다.
- 정책/결재선/프로세스/문서/결정/재배정/대결 권한 분리. UI도 실제 permission으로 조회/조작을 분리한다. APPROVAL PATCH는 transaction 내 기존·정규화된 신규 override 대칭차를 검사하므로 결재선 override 삭제를 정책 권한으로 우회할 수 없다.
- 운영자 simulation facade와 명시 `시연 문서 준비`로 DRAFT+IN_PROGRESS 두 문서를 원자 생성한다. 결정적 문서 ID, 동일키 재시도, 중복409이며 원본 seed를 자동 덮어쓰지 않는다. fixture-mapping.md 참조.
- A08용 EVENT_OUTBOX를 생성한다. 이번 T13은 결정/멱등성/이벤트 생성 UNIT이며 전달 INTEGRATION과 최종 T13 PASS는 A08에 남는다.

## 실행 검증

| 묶음 | 결과 | 증거 |
|---|---|---|
| pnpm build | PASS | evidence/a07-build.log |
| pnpm test | 기존131 PASS | evidence/a07-unit-all.log |
| 기존 공통/HTTP + A07 | 96 PASS (공통28+HTTP68) | evidence/a07-tests-all.log |
| A07 단독 | 공통5+HTTP11=16 PASS | evidence/a07-tests.log |
| Chromium 양 모드 | 설정 게시→작성자 제출→승인자 반려→수정·재상신→승인, 대결 등록/회수 PASS | evidence/a07-ui.log |
| Browser 경계 | ANY 경합/취소/snapshot/권한/원자성9 PASS | evidence/a07-ui.log |

중복 제외 단위159(기존154+5), HTTP68(기존57+11). 테스트에는 비배정자403, 회사404, 이중결정/재시도, ALL/ANY, 정책 없음/자기/빈승인자/동순위 제출422 원자성, inactive/reassign, 대결 경계·회수·자기문서, snapshot, 잘못된 workflow/조건, 금액 정책, query 필터, override 삭제권한, fixtures를 포함한다. 외부 egress0. 실제 OTP/ERP/EMAIL 전송 검증을 뜻하지 않는다.

작업자 B가 금액 조건, 완료 문서 전이, 권한별 UI/영역, query, 조건 검증 및 override 삭제 우회를 검토했고 수정 후 독립 테스트15/15와 코드를 승인했다. 마지막 fixture 추가도 B가 집중 HTTP 검증 후 승인했고 최종 검토 결과는 evidence/a07-worker-b.log에 남긴다. B는 UI를 독립 실행했다고 주장하지 않는다.

재현: `pnpm test:admin:approval`, `CHROMIUM_PATH=/path/to/chromium pnpm test:admin:approval-ui`. 캡처는 a07-settings/deputy/submitted/approved-{BROWSER_MOCK,API_MOCK}.png.

다음 단계 A08은 승인/반려/지연/게시 이벤트의 실제 알림함 및 mock EMAIL 전달·중복·언어 snapshot을 완성한다. PR은 초안 유지, main 병합·운영 배포는 하지 않는다.
