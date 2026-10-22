# U07 — 독립 검토 및 인수 결과

상태: U01~U06 UI 구현과 U07 검토·증거·초안 PR 반영 수행. 작업자 B 코드 승인. **전체 인수 완료는 UI29로 보류**. 사용자 화면 검토는 미실시이며 코드 승인과 구분한다.

## 단계별 결과
| 단계 | 구현 결과 | 기록 |
|---|---|---|
| U01 | stable key 기반 상태·diff·저장 기준 분리 | baseline.md |
| U02 | 그룹 탐색·표 직접 편집·상세창·모바일 영역 | U02-report.md |
| U03 | 다중 선택·속성/그룹 일괄 변경·순서·undo/redo·확장 필드 | U03-report.md |
| U04 | 영역별 저장·부분 실패 재시도·충돌·검증·게시 검토 | U04-report.md |
| U05 | 공유 엔진의 작업본/게시본 시각 미리보기 | U05-report.md |
| U06 | 키보드·다국어·반응형·경계 검증·사용 안내 | U06-report.md, user-guide.md |
| U07 | 독립 검토 지적 해소·전체 회귀·인수 대응표·초안 PR | review.md, acceptance-results.json, 본 문서 |

## 검증과 정확한 코드 기준
- 기존 전체 pnpm test:admin:all: ca03694에서 20/20 묶음 PASS. evidence/full-regression/a11-run-results.json 및 각 로그, evidence/u07-all.log. U07 보완 전 코드에서 실행한 결과다.
- 보완 후 frontend build PASS, designer-unit 12/12 PASS, i18n:check 및 i18n:hardcode PASS. evidence/u07-build.log, u07-unit.log, u07-i18n.log.
- 최종 신규 UI 인수: 1c01e43에서 BROWSER_MOCK/API_MOCK 각각30행, 합계58 PASS / 2 BLOCKED / 0 FAIL / 0 NOT_RUN. evidence/u07-designer.log 및 acceptance-results.json.
- 최종 UI 명령은 필수 BLOCKED를 반영해 exit2다. 전체 성공 명령으로 기록하지 않는다.
- 같은 최종 실행에서 기존 account/configuration/operations 회귀 및 새 API 프로세스 재시작 시드 복원도 통과했다.
- 작업자 B는 코드 및 자체 단위 재실행을 검토했다. 코드 승인을 전체 인수 승인 또는 운영 배포 승인으로 확대하지 않는다.

## 독립 검토 보완
R1 상세창 미적용 변경의 취소/Escape는 폐기 확인을 거치고 확인 취소 시 입력을 보존한다.
R2 선택 행 그룹 일괄 이동을 추가하고 유지 속성·선택하지 않은 행·원자적 실패·한 번 undo를 검증했다.
R3 부분 저장 성공 영역만 이력에 고정하여 실패 영역의 undo/redo를 보존한다.
R4 기존 자기 법인 approval-metadata permissions를 재사용하여 role.read 없는 합법적 config 편집자도 저장·검증·게시 검토에 접근한다. 기존 서버 권한은 그대로 적용한다.

## 남은 차단 조건
UI29는 유효한100행을 요구한다. 기존 기본 필드26개 + 확장 정의 최대50개 계약에서는76행까지만 가능하다. 엔진 불변 조건을 유지했고, 원래 작업 폴더에서 발견된 별도 max100 변경은 반영하지 않았다.

최종76행 측정: 예열5회 후30회, BROWSER_MOCK p95 약149.8ms / API_MOCK 약150.0ms, 입력 누락0. 환경과 원본 측정치는 evidence/u06-performance-*.json. 이 결과를100행 통과로 대체하지 않는다. 전체 완료에는 인수 기준 조정 또는 별도 엔진 한도 확대 범위 결정이 필요하다.

## 화면 증거와 인계
evidence의 양 모드 전체 편집·모바일·일괄 변경·부분 실패·게시 검토·미리보기·충돌·실제 업무 화면과 u07-bulk-dialog/u07-detail 캡처를 함께 제공한다. 최종 캡처의 한글 렌더링과 상세창 표시를 확인했다. 기존 전체 회귀는 로그와 결과 manifest를 PR에 포함하며 그 실행의 별도125개 진단 PNG는 로컬 실행 산출물로 보관했다.

GitHub: https://github.com/dio-securer/dio_crm_dev_proj/pull/29
head feat/admin-designer-u01-u07 → base feat/admin-platform-a00-a11, draft 유지. main 병합·운영 배포 미수행. 사용자 PC의 main 19개 로컬 커밋, env.ts, salesforce는 변경하지 않았다.
