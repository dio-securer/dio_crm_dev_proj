# A08 알림·운영 이벤트

2026-10-21 · ADM-23 · 기준 f308c216 · 작업자 B 코드 승인.

## 구현

- 승인 요청/완료/반려, 기한 경과, 회사 설정 게시를 EVENT_OUTBOX와 알림에 같은 transaction으로 연결한다. IN_APP 알림함과 EMAIL MOCK_SENT(text/plain)만 제공하며 외부 전송은 없다. A09 ERP 성공/실패 이벤트 계약도 등록했으며 실제 모의 ERP 연결 검증은 A09에 남는다.
- NOTIFICATION typed 이벤트·채널·ko/en template 편집→초안→검증→게시, 초안 텍스트 미리보기와 수신자 미리보기를 연결했다. title/eventKey placeholder 정확 일치를 검증하고 React 텍스트 출력으로 markup을 실행하지 않는다. preview는 저장소를 변경하지 않는다.
- 회사·활성 membership·업무 접근·알림 권한으로 수신자를 제한한다. 목록과 읽음 처리도 본인/현재 업무 권한을 재검사한다. 알림 생성 시 locale/렌더 텍스트/template/release를 저장하고 이후 언어/템플릿 변경으로 고치지 않는다.
- eventId/recipient/channel 중복을 막고 COMPLETE outbox 재처리는 건너뛴다. 읽음, 읽지않음 필터, 20건 페이지 탐색, 모의 EMAIL outbox를 제공한다. 알림 언어 변경은 이후 생성 알림에 적용한다.
- 기한 경과 실행은 A07 제출 시 고정된 dueAt과 현재 미결 task를 사용하며 instance/step별 1회 생성한다. fake clock으로 기한 직전/경계/중복/완료 후를 검사했다.
- 관리·일반 알림 조회와 설정 read/edit/validate/publish 권한을 UI에서도 구분했다. 별도 관리자 설정권한 없이 업무 알림함을 사용한다.

## 검증

| 실행 | 결과 | 증거 |
|---|---|---|
| pnpm build / pnpm test | PASS / 기존131 PASS | a08-build.log, a08-unit-all.log |
| 기존 공통·HTTP+A08 HTTP6 | 102 PASS (공통28+HTTP74) | a08-tests-all.log |
| A08 HTTP | 독립6 PASS | a08-tests.log |
| Chromium 양 모드 | 초안 preview/escape·비인가수신자 제외·게시·승인 알림·2채널·재dispatch·언어고정·읽음/필터 PASS | a08-ui.log |
| 작업자 B | 독립 HTTP6 PASS, 코드 승인, diff check PASS | a08-worker-b.log |

누적 단위159, HTTP74. UI와 독립 재실행은 중복 집계하지 않는다. 실제 외부 egress0. T13 승인 결정+알림1회 통합, T32 언어/중복, T79 권한/EMAIL 목업을 검증했다. 기존 A07 스냅샷·결정 회귀도 포함한다.

B 지적사항인 초안 미리보기의 게시버전 오조회와 첫20건 이후 접근 불가를 보완했다. 필터 체크 상태는 입력 즉시 반영하고 요청 중에는 잠가 비동기 조회가 입력을 덮어쓰지 않도록 했다. 실제50건 이상 HTTP 페이지 탐색도 확인했다.

증거 위치: `implementation/evidence/a08-*`. 재현: `pnpm test:admin:notification`, `CHROMIUM_PATH=/path/to/chromium pnpm test:admin:notification-ui`. B는 UI를 독립 실행하지 않았으며 작업자 A 실행 증거를 검토했다. 다음 단계 A09는 mock ERP 결과를 A08 이벤트로 연결한다.
