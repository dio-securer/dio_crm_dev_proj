# A06 명칭·다국어·기준정보·번호·달력

2026-10-21 · ADM-14/15/33/37 · PR #28 A05 `56d1081` 기준.
작업자 B 코드 승인 및 목록 코드 번역 추가 변경 승인. PR은 A07–A11 후속을 위해 초안 유지한다.

## 구현

- TERM/CODE/NUMBERING/CALENDAR typed 편집기를 A04 상속·초안·검증·게시 엔진에 연결했다. 게시 전 업무 화면은 기존 release를 유지한다. 관리 권한은 translation.manage/code.manage/numbering.manage/calendar.manage로 분리하고 발급은 numbering.allocate로 검사한다.
- semanticKey는 등록된 업무 의미를 유지하며 회사 termKey와 ko-KR/en-US 번역을 편집한다. 키 변경 시 번역을 이동하며 신규 코드 표시 키의 추가 번역도 편집한다. 기존 i18n 자원을 재사용하고 선택 언어→회사 기본→템플릿 기본→공통 한국어→키+missing 순으로 조회한다. 필수 번역 공백과 placeholder 불일치는422이고 markup은 React 텍스트로 출력한다. 스페인어는 미지원이다.
- 거래처 업무 언어 전환은 명칭·코드 표시를 변경하며 입력값, 저장 코드, 회사, release 및 권한을 유지한다. 전체 관리 UI 번역을 완료한 것은 아니다. 회사별 추가 코드, 표시 순서, 활성 상태를 게시한다. 참조 중 코드를 REMOVE_ITEM으로 삭제하면422, 비활성 코드는 신규 선택에서 제외하고 과거 저장값·표시는 유지한다. US_A와 US_B를 격리한다.
- 번호 미리보기는 회사 시간대의 기간과 현재 nextValue를 조회하며 저장소를 변경하지 않는다. 실제 발급은 회사+entity+period 단위로 직렬 트랜잭션에서 증가하며 요청 키 재시도는 동일 번호를 반환한다. 발급 원장을 남겨 후속 업무 실패와 설정 rollback에도 번호를 재사용하지 않는다. YEAR/MONTH/NONE과 YYYY/YYYYMM/ALL 조합을 검사하며 자리수 초과는409 SEQUENCE_EXHAUSTED다.
- 영업일은 시작일을 제외하고 회사 달력 근무요일·휴일을 적용한다. 0일은 시작 시각 그대로다. DST gap은 다음 유효 현지 시각, overlap은 빠른 instant를 선택한다. 계산 요청에 달력·시간대·release snapshot과 dueAt을 저장하여 달력 변경/rollback 후에도 보존한다. 실제 승인 제출 시 snapshot 연결은 A07 후속이다.
- API_MOCK와 BROWSER_MOCK가 공통 엔진을 사용한다. Browser 저장은 기존 localStorage/WebLocks 트랜잭션을 사용한다. LEGACY 엔진을 교체하지 않는다.

## 검증 결과

| 묶음 | 결과 | 증거 |
|---|---|---|
| 전체 build | PASS | evidence/a06-build.log |
| 기존 단위 테스트 | 131 PASS (frontend57/backend74) | evidence/a06-unit.log |
| 공통 엔진 | A04 7 + A05 9 + A06 7 = 23 PASS | evidence/a06-tests.log |
| HTTP | 기존40 + A04 1 + A05 12 + A06 4 = 57 PASS | evidence/a06-tests.log |
| A06 실제 Chromium | 양 모드 PASS, egress0 | evidence/a06-ui.log |
| Browser A06 경계 | 12 검사 PASS | evidence/a06-ui.log |
| A05 화면 회귀 | 양 모드 PASS + Browser29 검사 | evidence/a06-a05-ui.log |
| 작업자 B | A06 11/11 독립 PASS, 추가 권한/키 변경 검증, 코드 승인 | evidence/a06-worker-b.log |

중복 제외 단위 **154**, HTTP **57**. Node 집계80은 공통23+HTTP57이며 기존 단위131과 별도다. Browser/UI 검사 수는 이 합계에 포함하지 않는다. B는 UI를 독립 재실행하지 않았고 A의 실행 증거를 검토했다.

양 모드 UI: placeholder 오류 거부 → placeholder 용어 키 연속 변경 → 신규 코드 ko/en 번역 → 초안/검증/게시 → 번호 미리보기 반복/연속 발급 → 휴일 기한 계산 → 회사 코드 추가 → sales 언어 전환 중 HIGH 저장값/입력/회사/release 유지 → US_B 격리. 입력 markup이 HTML 요소가 되지 않음도 검사한다. 캡처는 evidence/a06-{terms,codes,numbering,calendar,runtime-en,runtime-ko}-{BROWSER_MOCK,API_MOCK}.png다.

| 인수 항목 | 범위 |
|---|---|
| T03/T74 | 언어 전환·회사 격리·placeholder·markup escape PASS. 승인 정책 실행 통합은 A07 |
| T30/T50 | 미소모 preview·동시20건 유일·요청 키 재시도·회사 격리·기간 경계·padding 한도 PASS. 기존 A05 타입 검증 회귀 PASS |
| T73 | 추가 코드·참조중 REMOVE_ITEM 거부·비활성 신규 선택 제외·과거 값 유지 PASS |
| T51 | 서울 2026-10-21 09:00 +2영업일 → 10-26 09:00, 뉴욕 gap 03:00/overlap 앞선01:30 PASS, snapshot 보존 |
| T31 | 달력 계산 및 불변 snapshot 기반 PASS. 실제 승인 dueAt 연결은 A07 후속, 전체 PASS 처리하지 않음 |

B 지적 4건(enum option 저장값, 영역 권한, placeholder 키 변경, 신규 코드 번역 UI)을 수정하고 재검증했다. 최종 캡처 점검으로 목록 코드에도 번역을 적용했으며 B가 추가 승인했다.

재현: `pnpm build`, `pnpm test`, `pnpm test:admin:master`, `CHROMIUM_PATH=/path/to/chromium pnpm test:admin:master-ui`. 전체 공통/HTTP 실행 명령은 a06-tests.log에 대응하는 tests/admin/{api,legacy-auth,legacy-http,organization,security,configuration,configuration-http,account-configuration,account-http,master-data,master-http}.cjs의 node --test 실행이다.

다음 단계는 A07 승인·SLA·승인 시점 snapshot 통합이다. 실제 OTP와 SECURITY 정책 게시 통합은 이번 완료 범위에 포함하지 않는다.
