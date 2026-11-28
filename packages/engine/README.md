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

### 이름 바꾸기와 날짜 (F2-4 보강)

- 표·열의 실제 이름은 처음 만들 때 정해 `dbo.crm_meta_obj_name` 에 적습니다. 별칭을 남긴 이름 바꾸기는 같은 표·열을 계속 씁니다(ADR 0004 덧붙임).
- 날짜(`date`)와 일시(`datetime`)는 `DATE`, `DATETIME2(3)` 형식을 밝혀 보냅니다(`backend/src/database/sql-params.ts`). 0001~9999년, 밀리초 그대로입니다.
- 표를 만들 수 없는 개체(형식이 어긋남 등)는 그 개체만 503 `OBJECT_TABLE_UNAVAILABLE` 로 닫히고, 30초 뒤 다시 시도합니다. 다른 개체는 그대로 동작합니다.

### 알려진 한계 (F2-4)

- **개체 단위 권한이 없습니다.** 로그인한 사용자는 게시된 모든 개체의 API 를 부를 수 있고, 무엇이 보이는지는 행 권한(`access.json`)만 정합니다.
  "이 개체를 읽을 권한", "만들 권한", "고칠 권한" 같은 구분은 아직 없습니다(주인 결정 대기). 행 권한 규칙이 없는 개체는 닫혀 있습니다.
- 필드 단위 권한(누구는 이 필드를 못 봄)이 없습니다. 볼 수 있는 행은 모든 필드가 보입니다.
- 삭제, 사용자가 고르는 검색·정렬(목록 뷰가 정한 조건·정렬은 F2-5 부터 있음), 낙관적 잠금이 없습니다. `members` 규칙은 팀 정보의 출처가 없어 지금은 아무것도 열지 않습니다.
- 이미 만든 열의 형식 바꾸기(허용된 넓히기 포함)는 자동으로 하지 않습니다. 사람이 마이그레이션합니다.
- 한 번 쓴 필드 이름을 다른 뜻으로 다시 쓰면 옛 열을 읽습니다(ADR 0004 덧붙임).
- 실제 SQL Server 에서의 동작은 `node scripts/meta-db/run-engine-api.mjs` 를 DB 가 있는 PC 에서 돌려야 확인됩니다. 이 저장소의 검사는 SQLite 가짜 DB 로 한 합성 검사입니다.

## 범용 화면 (F2-5)

게시된 설정만 읽어 그리는 화면 네 가지(목록, 상세, 생성·편집 폼, 관련 목록)가 `packages/engine-ui/` 에 있습니다.
프런트에서는 `/engine/<개체>` 로 열립니다(`frontend/src/app/engine-screen.tsx`). 기존 리드 화면은 그대로입니다.

- 화면 설정은 `GET /api/engine/objects/:object/ui?locale=ko-KR|en-US` 가 줍니다(`buildUiModel`, `src/ui-model.ts`). 글자는 `metadata/terms/` 에서 그 언어로 바꿔서 줍니다. 행 권한 규칙과 행 자체는 담지 않습니다.
- 목록은 `view=<뷰 키>`(뷰의 조건·정렬·쪽 크기)와 `ref.<참조 필드>=<값>`(관련 목록) 을 받습니다. 둘 다 매개변수 SQL 이고, 회사·행 권한 조건과 AND 로만 묶입니다.
- 화면 자체의 글자(버튼, 오류 문구)는 `metadata/terms/<언어>/engine.json` 에 있습니다.
- 화면 확인: `node scripts/engine-ui/browser-check.mjs`(가짜 API, Chromium). 화면 사진은 `.guard/engine-ui/` 에 남고 커밋되지 않습니다.

알려진 한계: 실제 백엔드·로그인과 붙여서는 확인하지 않았습니다(가짜 API 로 한 합성 검사). 참조 필드는 id 를 글자로 입력합니다(찾기 창 없음).
목록에 검색·사용자 정렬·전체 건수가 없습니다(뷰가 정한 조건·정렬, 이전/다음 쪽만). 삭제가 없습니다. 개체 단위 권한이 없어 `access.create` 는 "행 권한 규칙이 하나라도 적용되는가"만 뜻합니다.
`verify` 는 `packages/engine-ui` 의 단위 테스트는 돌리지만 브라우저 확인은 돌리지 않습니다.

## 적용되는 규칙

| 규칙 | 내용 |
| --- | --- |
| G02 | 엔진은 `frontend/`, `backend/`, `extensions/`, 그리고 이관 대상(legacy) 파일을 가져다 쓸 수 없습니다. 자기 패키지 밖은 패키지 이름으로만 가져옵니다. |
| G03 | 한 파일 300줄 상한. 이 구역에는 예외 폴더가 없습니다. |
| G06 | 회사·국가·시장 값으로 갈라지는 코드를 쓸 수 없습니다. 차이는 설정으로 표현합니다. |
| G07 | DB·네트워크 직접 호출은 허용 목록에 있는 인프라 폴더에서만 됩니다. 엔진의 데이터 접근 폴더가 정해지면 사람이 허용 목록에 추가합니다. |

규칙 전체 설명: [docs/framework/guard-rules.md](../../docs/framework/guard-rules.md)
