# ADR 0007. 행 권한 규칙은 설정에 두고, 엔진은 읽기만 한다

## 상태

채택 (2026-11-28, F2-2).

## 맥락

F2-1 에서 엔진에 행 권한 평가기(`canAccessRow`, `accessPredicate`)를 만들었다. 규칙은 코드에서 넘겨야 했다.
회사마다 "누가 어떤 행을 보나"가 다른데, 이것을 코드에 적으면 회사별 분기(G06)가 되고, 주인이 설정으로 바꿀 수 없다.
또 규칙에 없는 필드나 없는 권한을 적어도 아무도 잡지 않는다.

## 결정

1. 개체마다 `metadata/objects/<개체>/access.json` 에 `{ entity, rules }` 를 둔다. 규칙 형식(`RowAccessRule`)은 계약(`packages/contracts/src/metadata/schemas.ts`)에 한 번만 정의하고, 엔진 평가기는 그 타입을 그대로 쓴다.
2. 규칙 종류는 `all`, `none`, `own`, `members`, `unit` 다섯 가지로 닫는다. `none` 외에는 선택적 `permission` 을 붙인다. 규칙끼리는 OR 이다.
3. 파일이 없으면 규칙 없음, 곧 아무 행도 보이지 않는다(닫힌 기본값). `rules` 는 비울 수 없다(형식 오류 M01). 막으려면 `none` 을 쓴다.
4. 검사: 없는 필드 R02, 없는 권한 R07(admin `permissionCatalog`), 개체 이름 불일치 R01, 별칭·폐기 예정 필드 사용 R09 경고,
   사용자·조직 ID 를 담을 수 없는 필드(글자·참조가 아닌 것) R11_ACCESS_FIELD_TYPE, 다른 규칙과 섞인 `none` R11_ACCESS_NONE_MIXED.
5. 엔진 `loadRuntimeModel` 이 규칙을 적재하고 `rowAccess(개체)` 로 내준다. 별칭으로 적은 필드는 정식 필드 키로 바꿔 내준다.
6. 넓히기 검사: P6(`diffBundles`)가 기준과 비교해 전보다 더 많은 행을 보이게 하는 규칙을 D05_ACCESS_WIDENED 오류로 잡는다(own→all, 규칙 추가, 필드·종류 변경, 권한 조건 제거).
   좁히기(규칙 삭제, 권한 조건 추가, `none`, 파일 삭제)는 통과한다. 기준에 없던 새 개체만 비교하지 않는다. 기준에 있던 개체에 `access.json` 이 없었으면 닫혀 있던 것(`none`)으로 보고, 첫 규칙도 넓히기로 잡는다.
7. 미룬 것: 덮어쓰기(overlay) 대상으로 행 권한을 여는 일, DB 조회 조건으로 바꾸는 일(F2-4), 리드 전용 권한(권한 목록 확장).

## 결과

- 좋은 점: 행 권한을 설정으로 바꾼다. 지어낸 필드·권한은 G12 에서 오류가 된다. 설정과 평가기의 형식이 갈라질 수 없다.
- 치르는 값: 권한 목록에 lead.* 권한이 없어 리드 규칙(`own`, `members`)에는 아직 권한 조건을 붙이지 않았다.
- 치르는 값: 넓히기는 규칙 하나씩 `guard-raises.json` 에 P6 예외로 선언해야 한다(file, 넓어진 규칙 그대로, reason, changeId). 선언은 PR 요약의 "예외 선언"에 나오고 사람이 승인한다. 다른 P6 위반은 선언할 수 없다.
- 한계: 담당자 필드(`owner_name`)가 사용자 ID 를 담는지는 형식(글자)만 본다. 실제 값이 사용자 ID 인지는 확인하지 않음.

## 기계 검사

- 보호 검사 P6 `metadata-compat`: D05 로 행 권한 넓히기를 막는다(`tests/metadata/access-diff.test.cjs`).
- 가드 규칙 G12 `metadata-valid`: `access.json` 도 `bundleFromFiles` + `validateBundle` 로 검사한다.
- `tests/metadata/access.test.cjs`(계약), `packages/engine/test/access-config.test.cjs`(엔진).

## 덧붙임 (F2-7, 조직 계층)

- 규칙 `subtree`(ownerField) 를 더한다. 조직도(`metadata/security/org/<키>.json`) 에서 사용자가 조직장인 조직의 아래 전체에 속한 사람이 담당한 행을 연다.
- 조직도는 `members`·`unit` 규칙을 넓히지 않는다. 계층으로 넓히는 것은 `subtree` 규칙을 `access.json` 에 적을 때만 생기므로 D05 가 잡고, P6 예외 선언과 사람의 승인이 필요하다.
- 깨진 조직도(중복 조직, 없는 상위, 순환)는 G12 에서 S07–S09 오류다. 엔진은 그래도 깨진 갈래만 닫는다.
- 개체·필드 권한은 `metadata/security/` 의 권한 세트와 프로필에서 온다. 요청이 권한을 실어 보낼 수 없다. 서버가 게시된 설정에서 읽는다.
- 소유자 승인: 이 변경(보호 파일 수정, 접근 규칙 형식 추가)은 소유자가 결정 카드로 승인했다. 리드 `subtree` 규칙의 P6 선언은 PR 검토에서 다시 승인받는다.
- 조직도·프로필·권한 세트를 고쳐 누군가 더 보게 되거나 더 할 수 있게 되면 diffBundles 가 D07(조직도)·D08(권한)로 잡는다. 프로필 파일이 없던 기준(아무것도 좁히지 않음)에서 프로필을 처음 두는 것은 좁히기뿐이라 비교하지 않는다. 프로필 파일은 비어 있어도 선언이며 모두 막는다. 파일을 지우면 D08 이다. 조직도는 회사로 구분하고, 그 회사의 조직도가 기준에 없으면 빈 조직도와 비교한다(첫 조직도도 D07).
- 한계: 지금 보호 검사(`scripts/guard`)의 P6 선언은 `access.json` 의 규칙만 받는다. 그래서 D07·D08 은 선언할 길이 없고 P6 에서 언제나 실패한다(닫힘). 선언을 받게 하려면 `scripts/guard` 변경과 사람의 승인이 필요하다.
- 역할 이름은 토큰이 실제로 싣는 `crm_role.role_code`(database/seeds/001_phase1_seed.sql)를 쓴다: SALES_REP, BRANCH_MANAGER, HQ_MANAGER, CRM_ADMIN. SALES_ADMIN, INTEGRATION_ADMIN 은 아직 어느 프로필에도 없어 닫혀 있다. 권역장 역할은 시드에 없다.
