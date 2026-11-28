# 메타모델

설정 구역(`metadata/`)에 무엇을 어떤 형식으로 두는지, 그리고 저장하기 전에 무엇을 검사하는지 한 장에 적었다. 결정의 이유는 [ADR 0006](adr/0006-metamodel.md) 에 있다.

## 한 줄 요약

개체마다 **데이터 정의**(어떤 필드가 있고 어떤 종류인지)를 두고, 화면·목록·동작 같은 **표시 설정**은 admin 계약의 형식을 그대로 쓴다.
둘을 한 묶음(`MetadataBundle`)으로 모아 서로 맞는지 검사한다. 지어낸 필드·문구 키·코드·개체 이름은 오류가 된다.

## 무엇이 어디에 있나

| admin 도메인 | 메타데이터 파일 | 주로 걸리는 검사 코드 |
| --- | --- | --- |
| (새것) 개체 정의 `ObjectDef` | `metadata/objects/<개체>/object.json` | R04, R08, R09 |
| (새것) 필드 정의 `FieldDef` | `metadata/objects/<개체>/fields.json` (크면 `fields/01.json`…) | R04, R05, R06, R08, R09, R10 |
| `SCREEN` + `FIELD` | `metadata/objects/<개체>/screens/<화면>.json` (`{screen, fields}`) | R01, R02, R03, R04, R09, R10 |
| `LIST_VIEW` | `metadata/objects/<개체>/list-views.json` | R01, R02, R04, R08, R10 |
| `ACTION` | `metadata/objects/<개체>/actions.json` | R01, R02, R04, R07, R08 |
| `RULE` | `metadata/objects/<개체>/rules.json` | R01, R02, R04, R07, R08, R10 |
| `WORKFLOW` | `metadata/objects/<개체>/workflow.json` | R01, R02, R07 |
| (새것) 행 권한 `ObjectAccess` | `metadata/objects/<개체>/access.json` | R01, R02, R07, R09, R11 |
| `MENU` | `metadata/menu.json` | R04, R07, R08 |
| `CODE` | `metadata/codes/<그룹>.json` | R04, R08 |
| `TERM` | `metadata/terms/<언어>/<앞부분>.json`, `metadata/terms/semantic.json` | R04, R08 |
| `FEATURE` | `metadata/features.json` | R07, R08 |
| (새것) 폐기 예정 기록 | `metadata/deprecations.json` | R09 |
| 덮어쓰기(SET, REMOVE_ITEM) | `metadata/overlays/<범위>/<범위 키>/<도메인>[.<개체>[.<화면>]].json` | M02, M03, 그리고 적용 뒤의 R 코드 |

파일 자리와 이름의 자세한 규칙은 [`metadata/README.md`](../../metadata/README.md) 에 있다.

## 행 권한 (F2-2)

`access.json` 은 `{ entity, rules }` 다. 규칙은 `all`, `none`, `own`(ownerField), `members`(ownerField), `unit`(unitField) 이고, `none` 외에는 `permission` 을 붙일 수 있다.
규칙은 하나라도 맞으면 보인다(OR). 파일이 없으면 아무 행도 보이지 않는다(닫힌 기본값). 엔진의 `RuntimeModel.rowAccess(개체)` 가 이 규칙을 읽어 평가기에 넘긴다. 결정의 이유는 [ADR 0007](adr/0007-row-access-in-metadata.md) 에 있다.
ownerField·unitField 는 있는 필드여야 하고(R02) 글자나 참조 필드여야 한다(R11). `none` 은 혼자만 쓴다(R11). 덮어쓰기 대상은 아직 아니다.
기준보다 더 많은 행을 보이게 하는 변경은 `diffBundles` 의 D05_ACCESS_WIDENED 오류다(P6). 좁히는 변경은 통과한다.

## 필드 종류

`text`, `decimal`, `date`, `boolean`, `enum` 은 admin 확장 필드와 같다. `integer`, `datetime`, `reference` 셋을 더했다.
`maxLength` 는 `text` 에만, `precision`·`scale` 은 `decimal` 에만, `enumCodeGroup` 은 `enum` 에만(꼭 있어야 함), `referenceObject` 는 `reference` 에만(꼭 있어야 함) 쓴다.

## 검사 함수

| 함수 | 하는 일 |
| --- | --- |
| `validateBundle(bundle)` | 묶음 하나의 참조를 검사한다. 덮어쓰기를 범위별로 적용한 결과도 검사한다. |
| `diffBundles(base, head)` | 기준과 지금을 비교한다. 지우기·이름 바꾸기·종류 바꾸기를 잡는다(ADR 0004). |
| `bundleFromFiles(files)` / `filesFromBundle(bundle)` | 파일 목록과 묶음을 서로 바꾼다. 파일을 직접 읽지 않는다. |

모든 결과는 `{ code, severity, path, message }` 목록이고, 경로·코드·문구 순으로 정렬된다. 같은 입력이면 같은 순서다.
오류(`error`)가 하나라도 있으면 저장하지 않는 것이 원칙이다. 경고(`warning`)는 알려 주기만 한다.

## 닫힌 이름과 열린 이름

- 닫힘(없는 이름이면 오류): 개체, 필드(별칭·`x_` 확장 필드 포함), 화면의 구역·탭, 문구 키(필요한 모든 언어), 코드 그룹, 참조 개체,
  동작, 기능(`features.json`), 권한(admin `permissionCatalog`, 행 권한 규칙의 `permission` 포함), 업무 상태, 상위 메뉴.
- 열림(아직 검사하지 않음): 메뉴의 `routeKey`, 확장 필드 `enumValues`, 승인·알림·번호 등 이 묶음에 없는 도메인.
- 범위 연결: 국가(`HQ:KR`) 덮어쓰기는 그 템플릿(`HQ`) 덮어쓰기 위에 얹어 검사한다. 법인 덮어쓰기는 소속을 모르므로 기본 설정 위에만 얹는다.

## 검사 코드

이 표는 `renderIssueCodeTable()` 로 만든다. 코드와 다르면 `tests/metadata/docs.test.cjs` 가 실패한다. 손으로 고치지 않는다.

<!-- issue-codes:start -->
| 코드 | 심각도 | 검사 함수 | 문구 |
| --- | --- | --- | --- |
| `D01_REMOVED_WITHOUT_DEPRECATION` | error | `diffBundles` | {kind} "{key}" 이(가) 폐기 예정 표시 없이 사라졌습니다. |
| `D02_RENAMED_WITHOUT_ALIAS` | error | `diffBundles` | {kind} "{key}" 의 이름이 "{to}" 로 바뀐 것 같지만 옛 이름(alias)이 없습니다. |
| `D03_TYPE_CHANGED` | error | `diffBundles` | 필드 "{key}" 의 형식이 {from} 에서 {to} 로 바뀌었습니다. 허용된 넓힘이 아닙니다. |
| `D04_DEPRECATED_NEW_USE` | warning | `diffBundles` | 폐기 예정 필드 "{field}" 을(를) 새로 쓰기 시작했습니다. |
| `D05_ACCESS_WIDENED` | error | `diffBundles` | 개체 "{entity}" 의 행 권한 규칙 "{rule}" 이(가) 전보다 더 많은 행을 보이게 합니다. 권한을 넓히는 변경은 따로 승인받아야 합니다. |
| `F01_UNKNOWN_FILE` | error | `bundleFromFiles` | 알 수 없는 파일입니다. 정해진 자리에 있는 파일만 읽습니다. |
| `F02_MISPLACED_FILE` | error | `bundleFromFiles` | 파일 자리와 내용이 맞지 않습니다: {detail} |
| `F03_INVALID_JSON` | error | `bundleFromFiles` | JSON 으로 읽을 수 없습니다. |
| `F04_TOO_LARGE` | error | `bundleFromFiles` | 파일이 너무 큽니다({lines}줄, {bytes}바이트). 300줄·15000바이트 안으로 나눕니다. |
| `M01_SCHEMA_INVALID` | error | `validateBundle` | 형식이 맞지 않습니다: {detail} |
| `M02_OVERLAY_INVALID` | error | `validateBundle` | 덮어쓰기(overlay)를 적용할 수 없습니다: {detail} |
| `M03_OVERLAY_TARGET_MISSING` | error | `validateBundle` | 덮어쓰기 대상 "{target}" 이(가) 기본 설정에 없습니다. |
| `R01_UNKNOWN_ENTITY` | error | `validateBundle` | 개체 "{entity}" 이(가) 정의되어 있지 않습니다. |
| `R02_UNKNOWN_FIELD` | error | `validateBundle` | 개체 "{entity}" 에 필드 "{field}" 이(가) 없습니다. |
| `R03_UNKNOWN_SECTION` | error | `validateBundle` | 화면 "{screen}" 에 구역 "{section}" 이(가) 없습니다. |
| `R03_UNKNOWN_TAB` | error | `validateBundle` | 화면 "{screen}" 에 탭 "{tab}" 이(가) 없습니다. |
| `R04_MISSING_TRANSLATION` | error | `validateBundle` | 문구 키 "{labelKey}" 의 {locale} 번역이 없습니다. |
| `R05_UNKNOWN_CODE_GROUP` | error | `validateBundle` | 코드 그룹 "{group}" 이(가) 없습니다. |
| `R06_UNKNOWN_REFERENCE_OBJECT` | error | `validateBundle` | 참조 대상 개체 "{entity}" 이(가) 없습니다. |
| `R07_UNKNOWN_ACTION` | error | `validateBundle` | 동작 "{action}" 이(가) 개체 "{entity}" 에 없습니다. |
| `R07_UNKNOWN_FEATURE` | error | `validateBundle` | 기능 "{feature}" 이(가) 기능 목록에 없습니다. |
| `R07_UNKNOWN_MENU_PARENT` | error | `validateBundle` | 상위 메뉴 "{parent}" 이(가) 없습니다. |
| `R07_UNKNOWN_PERMISSION` | error | `validateBundle` | 권한 "{permission}" 이(가) 권한 목록에 없습니다. |
| `R07_UNKNOWN_STATE` | error | `validateBundle` | 상태 "{state}" 이(가) 업무 흐름의 상태 목록에 없습니다. |
| `R08_DUPLICATE_KEY` | error | `validateBundle` | 이름 "{key}" 이(가) 두 번 쓰였습니다({kind}). |
| `R09_ALIAS_USE` | warning | `validateBundle` | "{alias}" 는 옛 이름입니다. 새 이름 "{field}" 을(를) 쓰세요. |
| `R09_DEPRECATED_REQUIRED` | error | `validateBundle` | 폐기 예정 필드 "{field}" 을(를) 화면 "{screen}" 에서 필수로 둘 수 없습니다. |
| `R09_DEPRECATED_USE` | warning | `validateBundle` | 폐기 예정 필드 "{field}" 을(를) 쓰고 있습니다. "{replacedBy}" 로 바꾸세요. |
| `R09_REPLACED_BY_DEPRECATED` | error | `validateBundle` | "{key}" 을(를) 대신할 "{replacedBy}" 도 폐기 예정입니다. |
| `R09_REPLACED_BY_MISSING` | error | `validateBundle` | "{key}" 을(를) 대신할 "{replacedBy}" 이(가) 없습니다. |
| `R10_ENUM_NEEDS_GROUP` | error | `validateBundle` | 선택형 필드 "{field}" 에 코드 그룹이 없습니다. |
| `R10_OPERATOR_TYPE` | error | `validateBundle` | 필드 "{field}"({type}) 은(는) 크기 비교("{op}")를 할 수 없습니다. |
| `R10_OPTION_NOT_ALLOWED` | error | `validateBundle` | 필드 "{field}"({type}) 에는 "{option}" 을(를) 쓸 수 없습니다. |
| `R10_REFERENCE_NEEDS_OBJECT` | error | `validateBundle` | 참조 필드 "{field}" 에 참조 대상 개체가 없습니다. |
| `R10_REQUIRED_HIDDEN` | error | `validateBundle` | 필수 필드 "{field}" 이(가) 하나뿐인 입력 화면 "{screen}" 에 보이지 않습니다. |
| `R11_ACCESS_FIELD_TYPE` | error | `validateBundle` | 행 권한 규칙의 필드 "{field}"({type}) 에는 사용자·조직 ID 를 담을 수 없습니다. 글자(text)나 참조(reference) 필드를 쓰세요. |
| `R11_ACCESS_NONE_MIXED` | error | `validateBundle` | 행 권한 규칙 "none" 은 다른 규칙과 함께 둘 수 없습니다. 규칙은 하나라도 맞으면 보이므로 "none" 은 아무 뜻이 없습니다. |
<!-- issue-codes:end -->

## 하위 호환의 허용 표

종류 바꾸기는 `integer → decimal`, `date → datetime` 만 허용한다(`SAFE_TYPE_WIDENINGS`). 둘 다 저장된 값이 그대로 유효하고, 비교·정렬의 뜻이 바뀌지 않는다.
목록 보기·동작·메뉴는 admin 형식에 폐기 예정 칸이 없어서 `metadata/deprecations.json` 에 적어 둔 뒤에 지운다.

## 가드 연결 (F1-2)

- G12 `metadata-valid`: `pnpm guard`·`pnpm crm check` 가 `metadata/` 를 `bundleFromFiles` + `validateBundle` 로 검사한다. 오류(error)가 하나라도 있으면 실패, 경고(warning)는 실패로 세지 않는다. 검사기를 읽지 못하면 통과가 아니라 가드 오류(종료 코드 2)다.
- P6 `metadata-compat`: 보호 검사(`--protect`)가 기준 브랜치의 `metadata/` 와 `diffBundles` 로 비교한다. 행 권한 넓히기(D05)만 규칙 하나씩 `guard-raises.json` 에 예외로 선언할 수 있다(ADR 0007, `docs/framework/ci-gates.md`). 그 밖의 것(읽지 못함, D01~D03)은 예외로 선언할 수 없다.
- 리드 개체(`metadata/objects/lead/`)는 기존 lead-* 계약이 쓰는 열 ID 와 같은 필드만 가진다. `tests/metadata/lead.test.cjs` 가 양쪽을 맞춰 본다.

## 아직 없는 것

- 흐름 편집기(F4), 관리자 스크립트(F7), DB 저장, 화면 렌더러.
