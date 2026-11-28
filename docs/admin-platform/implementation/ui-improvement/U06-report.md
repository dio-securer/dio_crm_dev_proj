# U06 — 사용성·회귀·인수 경계

상태: 구현·검증 수행, 전체 인수 완료는 UI29로 보류.

검증 코드 기준 4885dde. BROWSER_MOCK/API_MOCK 각 30행, 합계 58 PASS / 2 BLOCKED / 0 NOT_RUN. `acceptance-results.json`의 tcId/mode/input/expected/actual/sourceCommit/증거를 따른다. 마지막 실제 실행은 u06-final-acceptance.log. frontend build, designer-unit 10개, i18n parity/hardcode PASS. 기존 account21/configuration8/operations10, 기존 account UI 양 모드 PASS.

키보드 Escape/Enter·상세창 포커스 복귀·locale·390/1024/1440px, 실제 두 탭 충돌, 응답 유실 후 같은 요청키로 revision 1회 증가, 숨겨진 오류 셀 이동, 부분 저장/재시도, 게시 후 실제 SALES 입력 화면과 표시·필수·읽기전용·순서 동일성, 실제 읽기전용 역할과 직접 API 거부, 법인 전환 저장/폐기/취소/실패 차단, 지연된 A 응답과 B scope 분리, 브라우저 재조회 및 새 API 프로세스 시드 복원을 확인했다.

당시 API context의 축약된 membership을 보완하기 위해 membership/roles 조회로 권한을 계산했으나, U07 독립 검토에서 role.read 추가 의존을 발견했다. U07에서 자기 법인의 기존 approval-metadata permissions로 교체했다. 확인 전에는 편집·검증·게시를 잠근다. 새로운 API나 권한 엔진 변경은 없다. 조회 중 입력을 잠그고 오래된 응답을 무시한다. 상세창 포커스 복귀는 layout effect 및 종료 후 프레임에서 보완했다.

## UI29 보류 근거

기존 FIELD 스키마의 extensionDefinitions 최대50개, 기본 등록 필드26개이므로 유효한 최대 구성이76행이다. 유효한100행 목표는 기존 계약 유지 조건과 양립하지 않는다. 76행/예열5회/측정30회 p95는 양 모드300ms 이내이며 입력 누락이 없었다(정확한 측정치·userAgent·코어 수는 u06-performance-*.json). 이를 100행 PASS로 바꾸지 않았다. 신규 인수 명령은 필수 BLOCKED/NOT_RUN이 있으면 종료코드2를 낸다.

## 별도 작업 폴더

원래 공유 작업 폴더의 packages/contracts/src/admin/schemas.ts에서 출처가 확인되지 않은 max50→100 미커밋 변경이 발견됐다. 해당 변경은 보존하고 이 브랜치에 포함하지 않았다. 검증은 UI 변경만 커밋한 `/workspace/scratch/60bbf1e11d53/crm-ui-verify`에서 원래 max50 계약으로 수행했다. 사용자 PC main/env.ts/salesforce는 변경하지 않았다.
