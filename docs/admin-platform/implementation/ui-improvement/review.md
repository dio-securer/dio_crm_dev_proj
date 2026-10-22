# 작업자 B 독립 검토 — U07

검토일: 2026-10-22. 검토 대상: `crm-ui-verify`, `feat/admin-designer-verification`, `ca03694d59dad29e8d880dcaefbcfa2966c37a14` (기준 `69533a0`). 원래 작업 폴더의 미커밋 FIELD max100 변경은 검토 대상에 포함하지 않았다.

## 최신 판정 (재검토)

**코드 검토: 승인. 전체 인수: 보류.** `76db69bc2999c8ccbedc39cbead670c06b0d770b`에서 R1~R4를 재검토하여 코드 차단 지적을 해소했다. 작업자 B가 직접 재실행한 designer-unit은 **12/12 PASS**(2026-10-22 20:51 UTC)다. 수정 후 양 모드 브라우저 인수 실행(source `1c01e437c18cf40fdbc52702230b9bf6bd9e4829`)의 로그와 acceptance-results.json을 최종 대조했다: **58 PASS / 2 BLOCKED / 0 NOT_RUN**, BLOCKED는 UI29뿐이며 종료코드2는 이를 반영한다. R1 상세 폐기 확인 취소/수락, R2 그룹 일괄 변경, R3 부분저장 undo/redo, R4 config 허용/role.read 거부 계정의 저장·검증·게시검토 접근이 양 모드에서 통과했다. UI29 양 모드 BLOCKED는 별도 인수 차단 사항으로 유지한다.

| 지적 | 재검토 결과 |
| --- | --- |
| R1 | canonical로 상세 변경을 비교하고 Cancel/Escape 공통 requestClose에서 폐기 확인을 거친다. 확인 취소는 입력을 유지하며 적용 성공은 바로 종료한다. 브라우저에 확인 취소/수락 단언을 추가했다. |
| R2 | bulk sectionId 유지/대상 그룹 선택을 추가했다. 선택 행만 변경하고 전체 계약/잠금 검증 후 edit하므로 실패 시 작업본은 바뀌지 않는다. 단위 및 브라우저에서 그룹 이동과 한 번 undo를 검사한다. |
| R3 | 성공한 도메인 값을 undo/redo snapshot에 반영하고 중복 상태를 제거하여 실패 도메인의 이력을 유지한다. 새 단위 테스트가 FIELD undo/redo, SCREEN 고정, 최종 저장 후 이력 제거를 모두 검사하며 PASS했다. |
| R4 | 자기 법인의 기존 approval-metadata permissions를 사용한다. role.read 조회는 미리보기 역할 목록용으로만 남는다. 실제 role.read 거부 + config 권한 허용 계정의 저장/검증/게시 검토 접근 브라우저 검증을 추가했다. |

기존 전체 회귀 manifest `evidence/full-regression/a11-run-results.json`의 **20/20 PASS** 및 모든 exitCode 0을 확인했다. 해당 회귀 기준은 수정 전 ca03694이며 수정 후 전체 회귀 결과로 표현하지 않는다. 수정 후에는 위 단위 재실행과 작업자 A의 build, 추가 브라우저 경계 검증을 구분한다.

## 최초 판정 및 지적 이력

ca03694의 최초 판정은 코드 수정 요청이었다. 아래는 재현 가능한 최초 지적 기록이며 76db69b에서 해소되었다. 기존 58 PASS / 2 BLOCKED는 해당 실행 결과이지 모든 설계 조건을 충족했다는 뜻이 아니다.

## 차단 지적

| ID | 위치 | 문제 및 재현 | 필요한 보완 |
| --- | --- | --- | --- |
| R1 | frontend/src/admin/designer/FieldDetailPanel.tsx | 상세 기본값/labelKey를 바꾸고 Cancel 또는 Escape를 누르면 변경 여부 확인 없이 close한다. 설계 3.5의 적용 전 입력 폐기 확인을 누락하여 입력이 조용히 소실된다. | 변경이 있는 상세창 닫기는 폐기 확인을 제공하고, 확인 취소 시 입력 및 포커스를 유지한다. 적용 성공 종료에는 중복 확인하지 않는다. |
| R2 | frontend/src/admin/designer/EditActions.tsx BulkPanel | 속성이 visible/required/readOnly로 고정되어 그룹 일괄 변경이 없다. 설계 3.4에서 명시한 선택 행 그룹 이동을 단일 셀 반복으로만 수행할 수 있다. | 유지/대상 그룹 선택을 추가하고 선택 행만 원자적으로 이동하며 한 번의 undo로 복구한다. 잠긴 행 포함 시 부분 변경하지 않는다. |
| R3 | frontend/src/admin/designer/model.ts save | 도메인 하나가 성공할 때 history/future 전체를 비운다. SCREEN 성공 후 FIELD 실패한 경우 실패 FIELD의 미저장 수정도 undo 불가하다. 설계의 성공 영역 이력 정리 범위를 넘어선다. | 저장한 도메인만 저장 기준으로 고정하고 실패 도메인의 로컬 undo/redo를 유지한다. 저장된 SCREEN이 undo로 되돌아가지 않는지 함께 검사한다. |
| R4 | frontend/src/admin/AccountDesigner.tsx 권한 조회 effect | 편집 권한 판정이 roles/memberships 조회에 의존한다. packages/contracts/src/admin/security.ts list는 두 자원 모두 role.read를 요구한다. config.read/edit/validate/publish만 있는 합법적 사용자는 config 권한이 있어도 모든 버튼이 비활성화되고 조회 오류도 숨겨진다. | 별도 role.read 권한 없이 자신의 config 권한을 확인하는 기존 API를 재사용한다. config 권한 보유/role.read 미보유 사용자 양 모드 검증을 추가한다. |

R3는 기존 모델을 Vite SSR로 불러 직접 실행하여 확인했다(파일 변경 없음). SCREEN/FIELD order를 999로 함께 변경 → SCREEN 성공/FIELD network 실패 → undo 결과: `dirty=["FIELD"], history=0, FIELD.order=999, loaded FIELD.order=0`. 기존 단위 테스트는 재시도 도메인과 요청키만 검사하고 이력 보존을 검사하지 않는다. UI06 화면 증거 역시 일괄 undo/redo만 확인하므로 부분 저장 이력 충족 증거로 사용할 수 없다.

R4의 가능한 기존 API: 현재 로그인 법인의 `GET /api/admin/companies/{companyId}/approval-metadata`. ApprovalEngine metadata는 config.read로 접근 가능하고 config.edit/validate/publish permissions를 반환한다. 최종 선택은 구현자가 실제 권한/대상 법인 경계를 확인해야 한다. 서버 권한 엔진을 완화할 이유는 없다.

## 확인 사항과 검증 범위

설계/작업지시서, U01 기준 및 U02~U06 보고서, 새 모델·그리드·상세·일괄·미리보기·검토 패널, AccountDesigner 연결, 단위 테스트와 인수 스크립트/결과를 대조했다. 작업자 B가 직접 실행한 `pnpm test:admin:designer-unit`은 10/10 PASS(2026-10-22 20:47 UTC)다. 별도로 위 R3 실행 재현을 수행했다. 이 단위 실행은 최초 검토 시점의 기록이다. 전체 회귀 및 수정 후 단위/브라우저 결과는 상단 최신 판정에서 별도로 확인했다.

기존 draft/validate/release API와 공유 계약 엔진 재사용, domain별 loaded/working 분리, 실패 도메인만 재시도, 같은 payload 요청키 재사용, 충돌 시 입력 보존, 기본 상태의 권한 차단, 순수 미리보기의 업무 저장 경로 부재는 코드에서 확인했다. 실패 응답 및 권한의 최종 판단은 기존 서버가 수행한다. 이 확인은 추가 경계 결함이 없다는 보증이 아니다.

## UI29 인수 차단

기존 FIELD 계약은 extensionDefinitions 최대50개이며 등록 기본 필드26개로 유효한100행 fixture를 만들 수 없다. 최대76행 측정값은100행 성능 증거로 바꿀 수 없다. 현 설계의100행 요구와 기존 엔진 불변 조건을 동시에 충족한 것으로 승인할 수 없으며, 엔진 한도를 임의 변경하거나 중복/미등록 필드를 유효 데이터처럼 사용해서는 안 된다. 기준 변경 없이 이 항목의 전체 인수 완료 판정은 불가능하다. BLOCKED와 명령 실패 종료코드2 기록은 정직한 처리다.

## 잔여 확인

최종 브라우저 실행 결과와 문서 대응을 확인했다. 실행 원본은 `/tmp/u07-designer-final.log`, 보관 로그는 `evidence/u07-designer.log`, 상세 결과는 `acceptance-results.json`이다. 코드 승인과 UI29를 포함한 전체 인수 승인은 분리한다. main 병합/운영 배포 승인은 이 검토 범위가 아니다.
