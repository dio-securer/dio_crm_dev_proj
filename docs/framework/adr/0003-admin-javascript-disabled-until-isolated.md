# ADR 0003. 관리자가 쓴 코드는 격리 실행기와 침투 시험 전에는 운영에서 실행하지 않는다

## 상태

채택 (2026-11-26, F0-4). 허용 결정 문서가 어디에 있는지 적은 문장은 F0-5 에서 고쳤다.

## 맥락

관리자가 직접 쓴 코드(관리자 JavaScript)를 CRM 이 실행해도 되는지에 대해 저장소 안에 서로 다른 두 입장이 있다.

- 금지: `docs/admin-platform/README.md` 의 "범위 결정과 적용 원칙".
  "임의 SQL·JavaScript·외부 URL 실행은 제공하지 않는다." `docs/admin-platform/08_UI_Improvement_Design.md` 도 "SQL/JS 편집"을 제외 범위에 적었다.
- 허용: customization 작업.
  허용 결정 문서(customization 62번, 2026-10-30)는 저장소에 없고 소유자 PC에만 있다. 저장소에 올라오면 경로를 여기에 적는다.
  저장소에서 확인할 수 있는 것은 아래 코드다.
  - `packages/contracts/src/logic-events.ts`: "future administrator-authored logic" 을 위한 이벤트 등록부. 모든 이벤트가 `runtimeStatus: 'not-implemented'` 다.
  - `backend/src/customization/logic-draft.ts`, `frontend/src/customization/LogicDraftEditor.tsx`: 관리자가 쓴 코드 글자를 "작업본"으로 저장하는 서버와 화면.
  - `backend/src/customization/logic-execution-contract.ts`: 실행 요청·결과의 형식만 정한 계약. 주석에 "not a sandbox or an enabled execution route" 라고 적혀 있다.

코드 안에는 그 언어가 JavaScript 라고 적혀 있지 않다. 이 ADR 은 요청서의 표현을 따라 "관리자 JavaScript"라고 부른다.
지금은 코드를 저장만 하고 실행하지 않는다. 실행 계약(`LogicExecutionContract`)을 쓰는 모듈은 없다.

## 결정

1. 관리자가 쓴 코드는 운영 환경에서 실행하지 않는다. 지금의 "저장만 하고 실행하지 않음" 상태를 유지한다.
2. 실행을 켜려면 아래 둘이 모두 끝나야 하고, 그때 새 ADR 로 이 결정을 바꾼다.
   - 격리 실행기: 운영 프로세스와 분리되고, 시간·메모리 제한과 강제 종료가 있고, DB·네트워크·파일에 직접 닿지 못한다.
   - 침투 시험: 격리를 빠져나오려는 시도를 만든 쪽이 아닌 독립된 검증자가 해 보고, 그 결과가 증거로 남는다(ADR 0005).
3. 그 전에는 관리자 요구를 등록된 연산자와 조건식으로 푼다(admin 계약의 `RULE` 도메인, `conditionSchema`).
4. `docs/admin-platform/README.md` 의 금지 원칙이 운영의 기준이다. customization 의 작업본 저장 기능은 지워지지 않지만 실행 근거가 되지 않는다.

## 결과

- 좋은 점: 임의 코드 실행이라는 가장 큰 보안 위험이 운영에 없다. 두 문서의 충돌이 한 줄로 정리된다.
- 치르는 값: 조건식으로 표현할 수 없는 관리자 요구는 개발 요청(유형 C 또는 D)이 된다.
- 주의: 작업본 저장 화면이 남아 있어 관리자가 "쓰면 실행된다"고 오해할 수 있다. 화면 문구를 고치는 일은 이 ADR 의 범위가 아니다.

## 기계 검사

- G07: `frontend/`, `backend/`, `packages/`, `extensions/` 의 테스트가 아닌 코드에 `eval(…)`·`new Function(…)` 이 새로 생기면 실패한다.
  글자로 된 코드를 같은 프로세스에서 실행하는 가장 흔한 길을 막는다.
- 아직 기계 검사 없음 (추가할 단계 미정): `node:vm`, `worker_threads`, `child_process` 로 실행하는 길은 G07 이 보지 않는다.
- 아직 기계 검사 없음 (추가할 단계 미정): "운영에서 실행 경로가 꺼져 있다"를 확인하는 검사는 없다. 지금은 실행기가 아예 없다는 사실에 기대고 있다.
