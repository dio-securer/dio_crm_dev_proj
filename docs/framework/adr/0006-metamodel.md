# ADR 0006. 메타모델: 개체·필드 정의와 admin 화면 설정을 한 묶음으로 검사한다

## 상태

채택 (2026-11-27, F1-1). 검사 함수는 있다. 가드와 `pnpm crm` 에 연결하는 일은 F1-2 다.

## 맥락

admin 계약(ADR 0001)은 도메인마다 형식만 검사한다. 개체(entity)는 아무 글자나 되는 이름이고, 개체에 어떤 데이터 필드가 있는지 적는 곳이 없다.
그래서 목록 열에 없는 필드를 적거나, 번역 없는 문구 키를 적거나, 없는 코드 그룹을 적어도 저장된다. AI 가 지어낸 이름이 그대로 통과한다.
또 AI 작업자와 앞으로 만들 화면 편집기가 함께 고칠 파일 형식이 없다.

## 결정

1. 개체의 **데이터 정의**(`ObjectDef`, `FieldDef`)를 새로 둔다. 필드 종류, 필수 여부, 길이, 코드 그룹, 참조 개체, 폐기 예정, 별칭을 적는다.
   admin 의 `FIELD` 도메인은 화면 하나에서 필드를 어떻게 보이는지(표시)를 적는 것으로, 데이터 정의와 다르다. 둘을 섞지 않는다.
2. 화면·목록·동작·규칙·업무 흐름·메뉴·코드·용어·기능은 admin `payloadSchemas` 를 **그대로 import** 해서 쓴다. 복사하거나 바꾸지 않는다.
3. 필드 종류는 admin 확장 필드의 다섯 가지에 `integer`, `datetime`, `reference` 셋을 더한다. 각각 쓰는 곳은 `schemas.ts` 주석에 있다.
4. 범위(COMMON→TEMPLATE→COUNTRY→COMPANY)는 admin 의 덮어쓰기 연산(`SET`, `REMOVE_ITEM`)과 admin 검사(`configDocumentSchema`, `resolveOverrides`)로만 표현한다.
   데이터 정의는 덮어쓸 수 없다. 법인은 필드를 숨길 수는 있어도 데이터 필드를 지울 수 없다.
5. 파일 배치는 관심사 하나에 작은 파일 하나다(`metadata/README.md`). 정해진 자리에 없는 파일은 오류다.
6. 참조 검사의 범위: 닫힌 것은 개체, 필드, 구역·탭, 문구 키(TERM), 코드 그룹, 참조 개체, 동작, 기능(FEATURE), 권한(admin `permissionCatalog`), 업무 상태, 상위 메뉴다.
   열린 것(아직 검사하지 않음)은 메뉴의 `routeKey`, 확장 필드 `enumValues` 의 값, 승인·알림 등 이 묶음에 없는 도메인이다.
7. 미룬 것: 흐름 편집기(F4), 관리자 스크립트(F7), DB 저장, 화면 렌더러, 기존 lead-* 계약의 흡수(F1-2).

## 결과

- 좋은 점: 없는 필드·문구·코드·개체 이름은 `validateBundle` 에서 오류가 된다. 지우기와 이름 바꾸기는 `diffBundles` 가 잡는다.
- 치르는 값: 권한 목록이 admin `permissionCatalog` 로 닫혀 있어, 리드 전용 권한이 필요하면 그 목록을 먼저 늘려야 한다.
- 한계: COMPANY 범위의 덮어쓰기는 그 법인이 속한 템플릿·국가를 모르므로 기본 설정 위에만 얹어 검사한다.

## 기계 검사

- `packages/contracts/src/metadata/` 의 `validateBundle`, `diffBundles`, `bundleFromFiles` 와 `tests/metadata/*.test.cjs`(`pnpm test` 가 돌린다).
- 아직 가드 규칙은 아니다. `metadata/` 파일을 읽어 이 검사를 돌리는 가드 연결은 F1-2 에서 한다. 지금은 잘못된 설정 파일을 커밋해도 가드가 막지 않는다.
