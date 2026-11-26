# CI 게이트

PR 하나가 병합되기 전에 CI(`.github/workflows/ci.yml`)가 무엇을 막는지, 승인하는 사람이 무엇을 보면 되는지 적는다.
규칙 하나하나의 뜻은 `docs/framework/guard-rules.md` 에 있다.

## 승인하는 사람이 볼 것

코드를 읽지 않아도 된다. PR 의 CI 실행 화면(Actions > 해당 실행 > Summary)에 뜨는 **"가드 보호 검사 요약"** 만 본다.
같은 내용이 `guard-evidence` 첨부(artifact)의 `summary.md` 에도 있다.

1. **판정** 줄. "실패"나 "오류"면 승인하지 않는다. "오류"는 검사가 돌지 못했다는 뜻이고 통과가 아니다.
2. **예외 선언 N건 - 사람 확인 필요**. 이 PR 이 "기준선을 올린다 / legacy 목록에 파일을 넣는다 / 테스트를 지우거나 줄인다 /
   변경 ID 시작점을 바꾼다"고 스스로 선언한 목록이다. 0건이 정상이다. 1건이라도 있으면 적힌 이유가 납득될 때만 승인한다.
3. **보호 파일 변경 N건**. 가드 코드, 기준선, CI 설정처럼 "검사하는 쪽"을 바꾼 목록이다. 실패는 아니지만,
   이런 PR 은 검사 결과 자체를 바뀐 코드가 냈으므로 왜 바꿨는지 설명이 있어야 한다. 평소 기능 PR 에서는 0건이어야 한다.
4. **비교하지 못한 검사**. 기준 브랜치에 아직 파일이 없어서 건너뛴 검사다. 가드를 처음 들여오는 PR 한 번만 나와야 한다.

## 게이트 목록 (실행 순서)

| 단계 | 무엇을 막나 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 잠금 파일(pnpm-lock.yaml)과 다른 의존성이 설치되는 것. 잠금 파일을 안 고치고 의존성을 바꾸면 실패한다. |
| `run.mjs --protect origin/<기준 브랜치>` (PR 에서만) | 보호 검사 P1~P5 (아래). 요약 `.guard/summary.md` 를 만든다. |
| `run.mjs --commits origin/<기준 브랜치>..HEAD` (PR 에서만) | 변경 ID(`[REQ-숫자]`, `[F숫자-숫자]`) 없는 커밋 (G09). |
| `pnpm guard --strict` | 프레임워크 규칙 G01~G11 의 새 위반. `--strict` 는 "기준선을 내릴 수 있는데 안 내린 것"도 실패로 본다. CODEOWNERS·규칙 문서가 원본과 다른 것도 실패. |
| `pnpm guard:test` | 가드 자신의 테스트(`tests/guard/`). |
| `pnpm build`, `pnpm test` | 빌드 오류, 단위 테스트 실패. |
| `pnpm hq:check`, `pnpm hq:http` | HQ 표준 계약·HTTP 테스트. |
| `pnpm test:admin:*` 11개 | 관리자 기능의 브라우저 없는 테스트(contracts, api, security, configuration, account, master, approval, notification, integration, operations, designer-unit). |
| `pnpm hq:browser` | HQ 화면 브라우저 테스트. |
| `regression:multi-market`, `i18n:check`, `pwa:check`, `env:check`, `audit:critical` | 기존 검사 그대로. |

`pnpm i18n:hardcode` 단계는 없앴다. 같은 스크립트를 G04 가 돌리고, 기존 744건을 파일별로 묶어 "늘어나면 실패"로 본다.
관리자 브라우저 테스트(`test:admin:browser`, `*-ui` 등)는 넣지 않았다. 브라우저와 서버를 띄워야 하고 오래 걸린다.

## 보호 검사 P1~P5

기준 브랜치와의 공통 조상(merge-base)과 지금 내용을 비교한다. 종료 코드: 0 통과, 1 위반, 2 검사 불가(통과 아님).

| 검사 | 실패하는 경우 |
| --- | --- |
| P1 기준선 | `guard-baseline.json` 에서 규칙을 뺌, 파일별 숫자를 올림, 새 파일 항목을 넣음, 파일을 지움. 지우고 다시 만들어도 같은 비교를 받는다. |
| P2 legacy 목록 | `legacy-files.json` 에 기준 브랜치에 없던 파일을 넣음, 분류를 바꿈. |
| P3 테스트 | 테스트 파일을 지움, 테스트가 아닌 이름으로 바꿈, 파일 안의 테스트 수(`it`/`test`)나 묶음 수(`describe`)가 줄어듦. |
| P4 보호 파일 | 실패 없음. 바뀐 보호 파일을 요약 맨 위에 적는다. 승인 강제는 CODEOWNERS 가 한다. |
| P5 변경 ID 시작점 | `scripts/guard/commit-id-start.json` 의 값을 바꾸거나 파일을 지움. |

기준 브랜치에 해당 파일이 없으면 "건너뜀"이다(통과로 적지 않는다). 기준 브랜치를 읽지 못하면 오류(2)다.

보호 경로 목록은 `scripts/guard/protected-paths.json` 한 곳에만 있다. `.github/CODEOWNERS` 는 여기서 만든다
(`node scripts/guard/run.mjs --codeowners`). 손으로 고쳐 서로 달라지면 `pnpm guard` 가 실패한다.

## 예외를 선언하는 법

사람이 허락한 약화만 선언한다. 저장소 맨 위 `guard-raises.json` 의 `raises` 에 변경 하나당 항목 하나를 적는다.
보호 검사가 실패할 때 화면에 "그대로 선언" 할 내용이 나오므로 그것을 옮기고 `reason`, `changeId` 를 붙인다.

```json
{ "rule": "P1", "guardRule": "G03", "file": "backend/src/x.ts",
  "from": { "lines": 320, "bytes": 14000 }, "to": { "lines": 340, "bytes": 14900 },
  "reason": "REQ-12 에서 사람이 승인: 분리 작업은 REQ-15 로 예정", "changeId": "REQ-12" }
```

- `rule`: P1, P2, P3, P5 중 하나. `guardRule` 은 P1 에만 적는다. `from`/`to` 는 바뀌기 전과 후의 값 그대로(없던 것·지운 것은 `null`).
- 실제 변경과 글자 그대로 같아야 한다. 값이 다르거나, 더 넓게 잡거나, 해당 변경이 없는 선언은 그 자체로 실패다. 와일드카드는 쓸 수 없다.
- 선언은 요약의 "예외 선언 N건"에 그대로 나온다. 숨길 수 없다.
- 병합되면 그 선언은 쓸모가 없어지고, 남아 있으면 다음 PR 부터 "이미 반영된 선언"으로 실패한다. **병합 직후 선언을 지우는 PR 을 먼저 올린다.**
- 가드에 새 규칙을 넣으면서 기존 위반을 기준선에 묶는 경우도 "새 항목"이므로 항목마다 선언해야 한다(의도된 번거로움).

## 저장소 주인이 GitHub 에서 한 번 해야 하는 설정

이 설정이 없으면 CODEOWNERS 와 CI 는 "알려 주기만" 하고 막지 못한다. Settings > Branches (또는 Rules > Rulesets) 에서 `main` 에:

1. **Require a pull request before merging** (직접 push 금지).
2. 그 아래 **Require review from Code Owners** (보호 파일을 바꾼 PR 은 `@dio-securer` 승인 필요).
3. **Require status checks to pass before merging** 에 CI 작업 `build-test` 를 추가.
4. 관리자도 예외 없이 적용(**Do not allow bypassing the above settings**).

## 지금 빨간 것 (이 문서를 쓴 시점, 숨기지 않고 적는다)

CI 는 앞 단계가 실패하면 뒤 단계를 돌리지 않는다. 아래가 고쳐질 때까지 `build-test` 는 빨갛다.

- `pnpm test`: `frontend/src/hq-mock/HqOpportunityList.spec.tsx` 의 "separates pipeline currencies…" 1건.
  화면은 단계 이름을 PC용·모바일용 두 칸으로 나눠 그리는데(`<span>PROPOSAL</span><span>제안</span> · USD`),
  테스트는 붙어 있는 글자 `PROPOSAL · USD` 를 찾는다. 화면 동작의 버그가 아니라 테스트와 화면 구조가 어긋난 것이라
  이 단계에서는 고치지 않았다. 어느 쪽을 바꿀지는 사람이 정한다(테스트를 화면 구조에 맞추거나, 화면 표기를 바꾸거나).
- `pnpm hq:browser`: H02-B04 (거래처 등록 창에서 "거래처명" 입력 칸을 찾지 못함) 에서 멈춘다. H02 가 실패하면 뒤 화면은 돌지 않는데,
  H03 을 따로 돌리면 H03-B09 도 같은 종류로 실패한다. 실패하는 검사를 빼는 것은 약화이므로 단계는 그대로 둔다.

## 한계

- PR 의 CI 는 그 PR 안의 가드 코드와 워크플로로 돈다. `scripts/guard/` 나 `.github/` 를 바꾼 PR 은 검사를 스스로 무르게 만들 수 있다.
  그래서 그런 변경은 요약 맨 위(P4)에 나오고 CODEOWNERS 승인이 필요하다. 위 GitHub 설정이 꺼져 있으면 이 방어는 없다.
- P3 은 건수만 본다. 테스트 내용을 비우거나, 하나를 지우고 빈 테스트를 하나 넣는 것은 잡지 못한다.
  테스트를 실행 목록에서 빼는 것(`package.json` 스크립트, vitest/jest 설정)도 보지 않는다. 이 파일들은 보호 경로가 아니다.
- P3 은 git 의 이름 바꿈 판정(내용이 절반 이상 같으면 이름 바꿈)을 쓴다. 테스트 파일을 다른 테스트 이름으로 옮기면서 건수를 유지하면 통과한다.
- 예외 선언은 AI 도 쓸 수 있다. 막는 것은 형식이 아니라 요약을 읽는 사람이다.
