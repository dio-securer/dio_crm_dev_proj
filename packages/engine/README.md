# packages/engine — 엔진 구역 (`@dio-crm/engine`)

`metadata/` 의 설정을 읽어 화면과 API를 만들어 내는 공통 코드가 들어갈 곳입니다. 모든 회사·국가가 같은 엔진을 씁니다.

F2-1 에서 패키지를 만들었습니다. 지금 있는 것:

- `loadRuntimeModel(files)`: `metadata/` 파일 내용을 받아 검사(`bundleFromFiles` + `validateBundle`)한 뒤 읽기 전용 모델(개체, 필드·별칭, 용어, 코드 값)을 돌려줍니다. 오류가 하나라도 있으면 모델 없이 문제 목록만 돌려줍니다. 파일은 호출자가 읽어 넘깁니다(G07).
- 행 권한 평가기 `canAccessRow`, `filterRows`, `accessPredicate`: 규칙(`all`, `none`, `own`, `members`, `unit`, 선택적 권한 조건)을 OR 로 묶고, 규칙이 없으면 거부합니다. 규칙을 설정에서 읽는 일은 F2-2 입니다.

테스트: `pnpm --filter @dio-crm/engine test`.

## 무엇이 들어가나

- 설정을 해석해 목록·상세·입력 화면을 그리는 공통 화면 부품.
- 설정을 해석해 조회·저장·권한 검사를 처리하는 공통 서버 부품.

## 누가 고치나

- 프레임워크 작업 단위(F2 이후)를 맡은 AI 작업자만 고칩니다.
- 개별 화면 요청(REQ) 작업에서는 엔진을 고치지 않고 `metadata/` 를 고칩니다.

## 메타데이터 버전 (F2-3)

`src/versions/` 는 설정 묶음의 버전을 staging → publish → rollback 으로 옮기는 순수 규칙입니다. 저장은 `VersionStore` 포트로만 합니다.
- 상태 표: `transitions.ts` 하나가 정합니다. publish 는 설정 검사(오류 0)와 지금 게시본과의 하위 호환 검사(`diffBundles`, 행 권한 넓히기 D05 포함)를 통과해야 합니다.
- 메모리 포트 `memoryVersionStore()` 는 테스트용입니다. MS SQL 어댑터는 `backend/src/database/crm-meta-version-store.ts`(전용 표 `crm_meta_*`)입니다.
- 실제 DB 확인은 `node scripts/meta-db/run-publish-rollback.mjs` 를 DB 가 있는 PC 에서 돌립니다. 연결 정보는 환경 변수 `CRM_META_DB_*` 이고 기본은 SQL 로그인(USER/PASSWORD)입니다. PowerShell 예시는 스크립트 머리말에 있습니다.

## 자동 API 의 쓰기 검사 (F2-4)

`src/records/` 의 `validateWrite(model, objectKey, body, 'create' | 'update')` 는 요청 본문을 설정의 필드로 검사합니다(순수).
알 수 없는 필드, 시스템 필드, 화면 어디서든 읽기 전용인 필드, 필수 누락, 형식·길이·범위·코드 값 오류를 모두 모아 돌려줍니다. 별칭은 정식 키로 바꿉니다.
`withOwnerDefault` 는 생성 때 `own` 규칙의 담당자 필드가 비어 있으면 행위자로 채웁니다.

API 자체는 백엔드에 있습니다: 끝점 `backend/src/modules/engine-api/`(`/api/engine/objects/:object/records`), 표와 SQL `backend/src/database/crm-obj-*.ts`(전용 표 `crm_obj_<개체>`).
게시된 설정 버전만 API 를 움직이고, 행 권한(`accessPredicate`)은 매개변수 SQL 조건으로 바뀐 뒤 엔진이 한 번 더 확인합니다.
실제 DB 확인은 `node scripts/meta-db/run-engine-api.mjs`(연결 정보는 `CRM_META_DB_*` 환경 변수)입니다.

## 적용되는 규칙

| 규칙 | 내용 |
| --- | --- |
| G02 | 엔진은 `frontend/`, `backend/`, `extensions/`, 그리고 이관 대상(legacy) 파일을 가져다 쓸 수 없습니다. 자기 패키지 밖은 패키지 이름으로만 가져옵니다. |
| G03 | 한 파일 300줄 상한. 이 구역에는 예외 폴더가 없습니다. |
| G06 | 회사·국가·시장 값으로 갈라지는 코드를 쓸 수 없습니다. 차이는 설정으로 표현합니다. |
| G07 | DB·네트워크 직접 호출은 허용 목록에 있는 인프라 폴더에서만 됩니다. 엔진의 데이터 접근 폴더가 정해지면 사람이 허용 목록에 추가합니다. |

규칙 전체 설명: [docs/framework/guard-rules.md](../../docs/framework/guard-rules.md)
