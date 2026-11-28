# 거래처 화면 설계 UI 개선 작업지시서
버전: 1.0 · 2026-10-22 · 상태: 전 단계 PENDING / 구현 전
기준: [08 UI 개선 설계서](08_UI_Improvement_Design.md), 기존 01~06, A05/A10/A11 코드·증거.
이 지시서는 신규 U01~U07이다. A00~A11 대기열의 DONE 기록을 재사용하거나 변경하지 않는다.
이번 요청은 설계·지시서 작성이다. 아래 구현은 후속 실행 요청 시 진행한다.

## 1. 실행 원칙
- 시작 시 원격 feat/admin-platform-a00-a11 최신 head, PR #28, 작업 트리, AGENTS.md 유무를 확인한다.
- 사용자 PC의 main ahead19, env.ts 수정, salesforce/ 미추적 파일을 덮어쓰지 않는다. 별도 구현 브랜치/작업 폴더를 사용한다.
- 기존 저장·검증·게시 API와 엔진, 두 목업 어댑터를 유지한다. 신규 일괄 저장 API는 이번 기본 범위에 없다.
- 실제 ERP/OTP/DB 연결, main 병합, 배포는 포함하지 않는다.
- 단계별 구현→필수 검증→보고서→GitHub 반영. 실패를 PASS로 기재하지 않는다.
- 작업자 B 독립 검토는 U07에서 코드·검증 증거를 대상으로 수행한다. 차단 지적은 수정·재검증 후 승인받는다.
- 중단 시 완료 단계, 기준 commit, dirty 파일, 마지막 테스트, 실패 원인, 다음 명령을 implementation/ui-improvement/checkpoint.md에 남긴다.
- 변경 범위 확대나 API 보안 규칙 완화로 UI 오류를 우회하지 않는다.

## 2. 코드 연결과 제안 파일
| 기존/제안 | 역할 |
|---|---|
| 기존 frontend/src/admin/AccountDesigner.tsx | 편집 진입·domain 전환, 새 workspace 조립 |
| 기존 frontend/src/admin/SyntheticPreview.tsx | 진단 결과 보존, 합성 미리보기 평가 재사용 |
| 기존 frontend/src/admin/AccountRuntimePage.tsx | 실제 입력 화면 결과 비교; 필요 시 표현 컴포넌트 추출 |
| 기존 packages/contracts/src/admin/account-runtime.ts | 필드·권한·규칙·유효성 검증 재사용 |
| 기존 HttpAdminClient, useDirtyEditor | 실제 선언 위치 검색 후 재사용 |
| 제안 frontend/src/admin/designer/useDesignerWorkspace.ts | 작업본·revision·dirty·저장 상태 |
| 제안 frontend/src/admin/designer/FieldGrid.tsx | 셀 편집·다중 선택·오류 이동 |
| 제안 GroupNavigator / FieldDetailPanel | 그룹·상세 설정 |
| 제안 AccountFormPreview / ChangeReviewPanel | 시각적 합성 미리보기·게시 전 비교 |
| 제안 designer/labels 및 기존 locale | 사용자 명칭·안내 |
제안 파일은 아직 존재한다고 가정하지 않는다. 공용 디자인 시스템을 먼저 확인하고 기존 컴포넌트를 우선 재사용한다.

## 3. 단계별 작업

### U01 — 기준 고정·편집 상태 분리
입력: AccountDesigner, client, 두 mock adapter, changes/resolveOverrides, 기존 오류·상속 계약.
작업: API/DTO 호출표 작성, index 기반 편집을 stable key로 전환, loadedDraftSnapshot/workingCopy/dirty/revision/generation 분리. 변경 diff 유틸을 UI 밖으로 추출하되 의미 유지.
산출물: baseline.md(실제 경로·endpoint·권한), 상태 모델 코드, diff 단위 검증.
완료: false/0/빈 문자열/기본값 제거/배열 항목 제거 round trip; 로드된 초안과 게시본 비교 구분.
의존: 없음.

### U02 — 공통 레이아웃·필드 그리드
작업: 3영역, 필드 검색/그룹 필터, 한글 열 이름, 인라인 편집, 상태 배지, 상세 패널. FIELD와 SCREEN을 우선 개선하고 나머지 탭은 기존 기능을 연결한다.
기본 필드 key 불변, 필수 불변 조건 안내, 번역 키 선택과 번역된 결과를 분리한다.
산출물: FieldGrid, 상세 패널, 반응형 스타일, 화면 캡처.
완료: 드롭다운으로 한 필드씩 바꾸지 않고 서로 다른 10개 행을 연속 편집; 390px에서도 저장/오류 확인 가능.
의존: U01.

### U03 — 일괄 편집·그룹·순서
작업: 다중 선택, 속성 유지/예/아니오, 대상 요약, 전체 로컬 검증 후 적용. 필터 변경 시 선택 해제. 드래그+위아래 버튼, 실행 취소/다시 실행 50건.
확장 필드 생성은 정의+배치를 함께 추가하고 그룹 삭제/이동은 SCREEN/FIELD를 함께 변경한다.
산출물: 일괄 작업 reducer, 그룹 편집, 추가/비활성화 대화상자.
완료: 10개 행 일괄 변경과 1회 되돌리기; 위반 행 포함 시 변경 0건; 필터된 행만 선택됨.
의존: U02.

### U04 — 저장·충돌·검증·게시 통합
작업: dirty domain 순차 저장, 영역별 결과, 실패 영역 재시도, ambiguous response의 idempotency 유지. 부분 성공은 성공 영역만 기준 갱신.
검증 전 미저장/실패/충돌 차단, 실제 대상 초안 목록 표시. 검증 후 변경 시 validation 무효화.
게시 확인창에 법인·버전·변경 전후·사유 표시. 기존 releases API 사용.
409 비교 패널, 422 셀 이동, 403 입력 보존/권한 재검사, 조회·법인·경로 전환 보호.
완료: SCREEN 성공/FIELD 실패 주입 시 게시 불가, 입력 유지, 실패 영역만 재시도, 최종 검증 후 한 release로 게시.
의존: U03.

### U05 — 합성 화면 미리보기
작업: 기존 엔진 평가를 이용해 탭/그룹/필드와 필수·읽기 전용을 시각화. 게시본/작업본 전환, 역할/언어/화면 폭/샘플 조건.
실제 저장 버튼은 렌더링하지 않거나 시연 전용 비활성 표시. 미리보기 작업은 네트워크 업무 mutation 0건.
부정합 작업본에는 오류 표시, 이전 결과의 stale 표시. 고급 진단 JSON 유지.
완료: 동일 fixture의 미리보기와 실제 게시 후 화면에서 표시/필수/읽기 전용/순서가 일치; 마스킹 원문 미노출.
의존: U04.

### U06 — 접근성·안내·회귀
작업: 키보드 편집과 행 이동, 오류 포커스, live region, locale, 모바일 패널, 사용 예시.
안내 시나리오: 전화번호 순서 변경 → 선택 필드 읽기 전용 일괄 변경 → 초안 저장 → 미리보기 → 검증 → 게시 → 실제 화면 비교.
산출물: implementation/ui-improvement/user-guide.md 및 개선 전후 캡처.
완료: 아래 UAT 수행, 기존 설정·권한·상속·게시 회귀, build/i18n 통과.
의존: U05.

### U07 — 독립 검토·완료 기록
작업: 작업자 B가 코드, API 재사용, 실패/경합 시나리오, UAT 결과, 두 모드 캡처를 독립 검토. 모든 차단 지적 해소.
산출물: U01~U07-report.md 또는 단계 통합 보고서, acceptance-results.json, evidence/, review.md.
GitHub 문서에 새 UI 완료 상태를 별도로 표시한다. PR 초안 유지, main 병합/배포 미수행.
완료: 필수 UAT PASS, B 승인, 커밋과 증거 참조 유효. 화면 사용자 검토는 별도 상태로 표시.
의존: U06.

## 4. 필수 인수검증
BOTH = BROWSER_MOCK와 API_MOCK 각각 실행. 현재 모든 항목은 NOT_RUN.
| ID | 시나리오 | 기대 결과 | 모드 |
|---|---|---|---|
| UI01 | 10행 직접 편집·그룹 전환 | 입력 유지, stable key 대상만 변경 | BOTH |
| UI02 | 필터 후 전체 선택 | 필터 결과만 선택; 필터 변경 시 선택 해제 | BOTH |
| UI03 | 다중 행 일괄 변경 | 유지 속성 불변; 선택 행만 변경 | BOTH |
| UI04 | 불변 필수 행 포함 일괄 숨김 | 전체 로컬 변경 취소, 오류 행 안내 | BOTH |
| UI05 | 순서 드래그/키보드 | 같은 최종 순서; 필터 중 드래그 차단 | BOTH |
| UI06 | 일괄 실행 취소/다시 실행 | 1회로 일괄 동작 복원, 저장 이력과 구분 | BOTH |
| UI07 | 기본값 false/0/빈값/미지정 | 저장·재조회 후 의미 유지 | BOTH |
| UI08 | 확장 필드 생성/비활성화 | 정의·배치 일치, 참조 오류 안내 | BOTH |
| UI09 | 필드 포함 그룹 삭제·이동 | 대상 그룹 필수, orphan 0개 | BOTH |
| UI10 | 초안 저장 후 실제 업무 화면 조회 | 게시 전 실제 설정 불변 | BOTH |
| UI11 | SCREEN 성공/FIELD 저장 실패 | 부분 성공 표시, 실패 입력 유지, 게시 차단 | BOTH |
| UI12 | UI11 재시도 | 성공 영역 중복 저장 없이 실패만 저장 | BOTH |
| UI13 | 응답 유실 후 동일 요청 재전송 | idempotency로 중복 변경 방지 | BOTH |
| UI14 | 두 탭 동일 초안 동시 수정 | 409, 입력 보존, 3방향 비교 후 명시 재적용 | BOTH |
| UI15 | 422 필드 오류와 필터 | 요약→숨겨진 오류 행 표시→해당 셀 포커스 | BOTH |
| UI16 | 검증 후 편집/부모·버전 변경/만료 | 기존 validation으로 게시 불가 | BOTH |
| UI17 | 게시 확인·사유·버전 | 대상 명확, 성공 시 새 release와 실제 반영 | BOTH |
| UI18 | 다른 탭에서 생성된 관련 초안 | 검증 대상 포함 여부 표시, 숨겨진 게시 없음 | BOTH |
| UI19 | 저장/폐기/취소 법인 전환 | 선택대로 동작, 저장 실패 시 이동 차단 | BOTH |
| UI20 | 늦은 법인 A 응답이 B 전환 후 도착 | B 상태에 A 데이터 미혼입 | BOTH |
| UI21 | 읽기 전용 권한/세션 만료/직접 API | 편집·게시 거부, 권한 우회 없음 | BOTH |
| UI22 | 작업본/게시본 미리보기 | 각 snapshot 구분, 편집 결과 시각 반영 | BOTH |
| UI23 | 조건·역할·마스킹 미리보기 | 같은 엔진 결과, 원문 노출·업무 mutation 0건 | BOTH |
| UI24 | 부정합 작업본 미리보기 | 오류 안내, 이전 화면을 최신으로 오인하지 않음 | BOTH |
| UI25 | 동일 설정 게시 후 실제 거래처 확인 | 표시·필수·읽기 전용·순서 결과 일치 | BOTH |
| UI26 | 390/1024/1440px 및 키보드 | 핵심 조작 접근, 상세창 포커스 복귀 | BOTH |
| UI27 | ko/en 및 미등록 번역 키 | UI locale 적용, 키 경고, 번역 자동 생성 없음 | BOTH |
| UI28 | 기존 A05/A10 상속·게시·복원 회귀 | 기존 동작 유지, 관련 자동 검증 PASS | BOTH |
| UI29 | 100개 필드 fixture 편집 | 입력 누락 0, 단일 셀 편집→preview p95≤300ms | BOTH |
| UI30 | 저장 후 새로고침 | 브라우저 저장 유지; API 실행 중 유지/재시작 seed 복원 | BOTH |
UI29는 동일 브라우저·장비 사양을 기록하고 예열 후 30회 측정한다. 서버 저장 왕복 시간은 측정 범위 밖이며, 기준 변경은 사유를 별도 기록한다.

## 5. 테스트·증거
기존 등록 명령 pnpm build, pnpm i18n:check, pnpm i18n:hardcode, test:admin:account, test:admin:ui, test:admin:configuration, test:admin:operations를 실제 package.json에서 확인 후 실행한다.
신규 제안 명령 test:admin:designer-unit / test:admin:designer-ui는 구현 시 먼저 등록한다. 실행하지 않은 명령을 실행 완료로 쓰지 않는다.
신규 UI 변경과 관련된 회귀를 우선 수행하고 U07에 기존 test:admin:all을 1회 실행해 전체 결함 유무를 확인한다.
결과 행 필드: tcId, mode, status, sourceCommit, datasetId, input, expected, actual, command, evidencePaths, blocker.
각 UI01~UI30은 BOTH 2행으로 기록한다. PASS/FAIL/BLOCKED/NOT_RUN을 구분하며 필수 NOT_RUN이 있으면 완료 불가.
화면 증거: 전체 편집, 일괄 변경, 상세 입력, 변경 검토, 충돌, 부분 저장 실패, 미리보기, 모바일, 게시 후 실제 화면. 통과 문구만 캡처하지 않는다.

## 6. 후속 실행용 지시
“docs/admin-platform/08_UI_Improvement_Design.md와 09_UI_Improvement_Instructions.md를 읽고 U01~U07을 순서대로 구현하라. 기존 저장·검증·게시·권한 엔진을 유지하고 BROWSER_MOCK/API_MOCK에서 인수검증하라. 작업자 B 독립 검토와 차단 지적 보완을 완료하고 GitHub 초안 PR에 반영하라. 단계별 결과·실패·제한을 기록하되 main 병합과 운영 배포는 하지 마라.”
