# metadata — 설정 구역

화면, 객체, 필드, 목록, 권한처럼 "무엇을 보여 주고 무엇을 저장할지"를 값으로 적어 두는 곳입니다. 코드는 없습니다.

## 무엇이 들어가나

형식과 검사는 [docs/framework/metamodel.md](../docs/framework/metamodel.md) 에 있습니다. 아직 실제 개체 파일은 없습니다(채우는 일은 F1-2 이후).

## 파일 자리 (F1-1 에서 정함)

관심사 하나에 작은 파일 하나입니다. 아래에 없는 자리의 파일은 `bundleFromFiles` 가 오류(F01, F02)로 냅니다. `README.md` 와 `.gitkeep` 은 어디에 있어도 읽지 않습니다.

| 파일 | 담는 것 |
| --- | --- |
| `objects/<개체>/object.json` | 개체 정의(`ObjectDef`) 중 필드 목록을 뺀 것. `key` 는 폴더 이름과 같아야 합니다. |
| `objects/<개체>/fields.json` | `{ "fields": [...] }` 데이터 필드 정의. 너무 크면 대신 `fields/01.json`, `fields/02.json`… 로 나눕니다(둘을 같이 두면 오류). |
| `objects/<개체>/screens/<화면 키>.json` | `{ "screen": SCREEN, "fields": FIELD }`. 파일 이름은 `screenKey` 와 같아야 합니다. 화면 키가 `create` 로 시작하면 입력 화면입니다. |
| `objects/<개체>/list-views.json` | admin `LIST_VIEW` |
| `objects/<개체>/actions.json` | admin `ACTION` |
| `objects/<개체>/rules.json` | admin `RULE` |
| `objects/<개체>/workflow.json` | admin `WORKFLOW` |
| `menu.json` | admin `MENU` |
| `features.json` | admin `FEATURE` |
| `codes/<그룹 키>.json` | admin `CODE` 의 그룹 하나. 파일 이름은 그룹 `key` 와 같아야 합니다. |
| `terms/<언어>/<앞부분>.json` | `{ "문구 키": "번역" }`. 언어는 admin `TERM` 의 언어(`ko-KR`, `en-US`)만 됩니다. 문구 키는 `<앞부분>.` 으로 시작해야 하고, 점이 없는 키는 `_root.json` 에 둡니다. |
| `terms/semantic.json` | `{ "terms": [...] }` admin `TERM` 의 의미 키 연결. |
| `deprecations.json` | `{ "items": [...] }` 목록 보기·동작·메뉴의 폐기 예정 기록. |
| `overlays/<범위>/<범위 키>/<도메인>[.<개체>[.<화면 키>]].json` | `{ "overrides": [...] }` admin 덮어쓰기 연산. 범위는 `TEMPLATE`, `COUNTRY`, `COMPANY`. 범위 키의 `:` 는 `~` 로 씁니다(`HQ:KR` → `HQ~KR`). |

예: 한 법인에서 메뉴 하나를 빼려면 `overlays/COMPANY/<법인 ID>/MENU.json` 에 `{ "overrides": [{ "op": "REMOVE_ITEM", "path": [{ "property": "nodes" }, { "itemKey": "<메뉴 id>" }] }] }` 를 둡니다.
화면에서 필드를 숨기려면 `FIELD.<개체>.<화면 키>.json` 에 `SET` 으로 `visible` 을 `false` 로 둡니다. 개체의 데이터 정의는 덮어쓸 수 없습니다.

모든 파일은 키를 정렬한 2칸 들여쓰기 JSON 이고 줄바꿈으로 끝납니다(`filesFromBundle` 이 쓰는 형식). 한 파일은 300줄·15000바이트를 넘을 수 없습니다(F04).

## 누가 고치나

- 새 화면이나 필드가 필요할 때 AI 작업자가 이곳의 설정 파일을 고칩니다.
- 사람은 결과 화면을 보고 승인합니다. 이 폴더의 파일을 직접 읽을 필요는 없습니다.

## 적용되는 규칙

| 규칙 | 내용 |
| --- | --- |
| G01 | `.json` `.yaml` `.yml` `.md` 파일만 둘 수 있습니다(빈 폴더 표시용 `.gitkeep` 은 허용). 코드 파일을 두면 `pnpm guard` 가 실패합니다. |
| G03 | 설정 파일도 한 파일 300줄을 넘을 수 없습니다. 넘으면 나눕니다. |

규칙 전체 설명: [docs/framework/guard-rules.md](../docs/framework/guard-rules.md)
