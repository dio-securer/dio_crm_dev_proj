# H02 — 격리된 HQ 목업 실행 기반

작성일: 2026-10-22 · 상태: 완료 · 작업자 B 승인 · H03 착수 가능

## 기준과 범위

- H01 기준 커밋: `9c5bcd1c01be0fa631c191dc0260060cb63062c9` (H01 기능·Critical 0 게이트 통과).
- 실행 브랜치: `feat/hq-standard-h02-h07`. 로컬 작업 트리는 기존 H01 변경을 포함하므로 업로드 차이는 원격 기준 트리와 파일 blob을 대조한다.
- 사용자 PC의 `backend/src/config/env.ts`와 `salesforce/`는 본 산출물이 아니다.
- HQ 모드는 단일 서버 저장소를 사용한다. 기존 DB 서비스, GLOBAL localStorage 시드와 데이터를 섞지 않는다.

## 실행과 저장 수명

```powershell
pnpm install
pnpm build
pnpm hq:start
```

브라우저에서 `http://127.0.0.1:3210/?hq=1`을 연다. 전용 목업 호스트가 HQ 모드를 명시적으로 주입한다. `pnpm hq:dev`는 빌드 후 같은 호스트를 실행한다. 호스트는 loopback 주소만 허용한다.

- 업무 데이터: `backend/.hq-mock/HQ_DEMO.json`에 원자적으로 저장한다. 브라우저 새로고침과 서버 재시작 후에도 유지한다. 이 디렉터리는 Git 추적 제외다.
- 목업 로그인 세션: 서버 프로세스 수명. 서버 재시작 후 기존 토큰은 무효이며 UI가 다시 목업 로그인한다. 운영 인증이 아닌 명시적 테스트 사용자 선택이다.
- UI 토큰·모드: 탭의 sessionStorage에 HQ 전용 키로 보관한다. 기존 DB 토큰 및 GLOBAL 저장 키를 바꾸지 않는다.
- 초기화: 상단 초기화 → 영향 건수 미리보기 → 확인. 확인 토큰은 사용자 세션·데이터셋·generation·revision에 묶이며 2분 뒤 만료한다. 미리보기 이후 변경이 있으면 새 미리보기를 요구한다.
- 초기화는 현재 데이터셋만 시드로 복원하고 generation을 증가시킨다. 예전 generation의 ERP 결과는 거부한다. 현재 로그인은 유지한다.

## 구현

| 영역 | 산출물과 동작 |
|---|---|
| 저장소 | `backend/src/hq-mock/model.ts`, `seed.ts`, `repository.ts`: schemaVersion·generation·revision, 결정적 시드, 복사본 트랜잭션, 참조/법인/수치 검사, 저장 실패 롤백 |
| ERP/HIRA | `interfaces.ts`: 카탈로그 15개 인터페이스의 DTO 검증, 요청/결과 코드, 업무 키·멱등 키, 상관관계, 결과 버전, 실패·지연·타임아웃·중복·역순·재시도 |
| HTTP | `app.ts`, `scripts/hq-standard/{runtime,server}.mjs`: 서버 소유 목업 세션·권한/범위, H01 정책 실행, 등록되지 않은 API·액션 거부 |
| 외부 차단 | `egress-fence.mjs`: 전용 서버 프로세스의 fetch/http/https/TCP/TLS 송신 차단 및 시도 계수. DB/ERP/심평원/메일/지도 어댑터 미적재 |
| 화면 | HQ 부트스트랩, MOCK 표시, 테스트 사용자 전환, 성공/실패/지연 선택, 초기화 미리보기·확인, 캐시 초기화 |
| API 경계 | HQ 모드는 같은 출처 `/api/*`·전용 토큰·`X-HQ-Mock` 응답만 허용. 쿠키/redirect/외부 URL 차단. 거래처 API 실패 시 브라우저 별도 샘플로 전환하지 않음 |

거래처 요청 002→결과 003, 계약 004→005, 주문 007→008, 직출직퇴 012→013을 분리했다. 009는 실제 수금, 010은 매출, 011은 변경 수금계획, 014는 반품/교환으로 각각 별도 컬렉션과 업무 상태에 반영한다. 001 담당지역·006 품목·HIRA 병원 인입도 해당 데이터를 갱신한다. 수동 변경 필드는 HIRA 결과로 덮어쓰지 않는다.

시드는 정상/미승인 거래처, 중복 후보, 다른 담당자·법인, 승인 대기 보고, 미수 회차, 재고 0/음수·주문 불가 품목, 좌표 없음 및 독립적인 승인 차단 사례를 포함한다. 별도 교육 사례를 하나의 거래 이력으로 결합하지 않는다.

## 검증 기록

| 명령/검증 | 현재 결과 |
|---|---|
| `node --experimental-strip-types --test --experimental-test-isolation=none scripts/hq-standard/h02-foundation.test.mjs` | 47 PASS / 0 FAIL |
| `node --experimental-strip-types --test --experimental-test-isolation=none scripts/hq-standard/h02-frontend.test.mjs` | 26 PASS / 0 FAIL |
| `node --experimental-strip-types --test scripts/hq-standard/h02-http.mjs` | 5 HTTP 시나리오군 PASS / 0 FAIL. 127.0.0.1 임시 포트·독립 임시 파일 사용 |
| HTTP 세부 | 401/403·담당자/법인 격리·미등록 API/액션·목업 위장 차단, 생성/편집/목록/상세/버전 충돌, 파일 유지/재시작/초기화, ERP 접수/결과/중복/충돌/실패/재시도/세대 검증 |
| 외부 송신 검사 | 별도 자식 프로세스에서 fetch/http/https/TCP/TLS 5개 시도 모두 예외 발생, 시도 계수 5 확인 |
| 전체 빌드·기존 테스트·HQ/GLOBAL 회귀·보안 | 250474d6 / CI 39789050459: build·FE70·BE59·HQ214·HTTP5·회귀85·다국어·PWA·audit PASS (Critical 0) |
| 실제 브라우저 | 실제 Chromium 151.0.7922.34: 18/18 PASS, 실패·미실행 0, pageErrors·externalRequests 0. PC 1440px / 모바일 390px 캡처 8장 |
| 작업자 B | 최종 승인. P1 4건·P2 1건 보완 독립 재검증, 원격 CI·회수 JSON·PC/모바일 캡처 일치 확인. 추가 차단 결함 없음 |

`pnpm hq:check`는 계약·기반·전송 경계 테스트를, `pnpm hq:http`는 실제 localhost HTTP 인수를 실행한다. CI는 두 명령과 기존 회귀 게이트를 실행하고 프런트 빌드/증거를 artifact로 보관한다.

## 재사용과 후속 범위

기존 Nest 업무 규칙·API 형태·HQ 화면·H01 등록부를 재사용한다. PR #26의 독립 mock/localStorage·개발 인증 우회 코드는 이식하지 않는다. 관리자 A00–A11의 재사용 범위는 H07에서 현재 main과 대조한다. H02는 공통 실행 기반이며 H03–H07의 모든 업무 버튼·메뉴가 완료됐다는 뜻이 아니다.

실제 ERP 서버·DB 접속 검증은 미실행이다. 여기의 ERP/HIRA·지도/GPS·메일 결과는 모두 MOCK이다.

## 작업자 B 1차 지적 보완

- 조직 범위 우회: 인터페이스 request/result/advance/retry 및 로그 조회에 원본 업무 엔터티의 동일 범위 검사 적용.
- 데이터셋 결과 혼입: 결과 DTO의 datasetId 필수, 요청·현재 데이터셋·generation·업무 키 일치 검사.
- 필수 계약 우회: 일반 연계 관리 경로도 H01 업무 액션/필수값 정책을 적용.
- 다른 배치 역순 수신: ERP 품목·담당지역·HIRA 대상별 원천 요청 순번/결과 버전으로 최신값 보존. 비중복 대상은 정상 수신.
- 초기 실패/지연: 별도 거래처 ID7/8과 실제 엔진이 생성한 실패/지연 로그를 시드에 포함.

보완 후 foundation 47개 및 HTTP 5개 시나리오군 통과. 작업자 B가 원격 CI와 실제 브라우저 증거까지 대조하고 최종 승인했다.

## 최종 실행 근거

- 구현 head: `250474d66f31603d8ba1731c68bfcad555f2c17f`
- CI checkout merge: `22cbf9c977aafb1aa8488bbaa9240b4856b82a49` (base `e111138`)
- [GitHub Actions 실행](https://github.com/dio-securer/dio_crm_dev_proj/actions/runs/39789050459), job `119859846719`, 결론 `success`.
- artifact `12430211870`에서 회수한 [결과 JSON](evidence/h02-browser-results.json)과 `h02-*.png` 8장.
- `pnpm-lock.yaml`은 이 실행에서 실제 pnpm이 생성한 76줄 diff를 적용해 playwright 1.62.1 해석 결과와 일치시켰다.
- 브라우저 확인: 거래처 수정/저장/새로고침, 테스트 사용자별 범위/초기화 권한, 초기화 미리보기/취소/확정, API 오류, MOCK 응답, GLOBAL 및 기존 저장값 보존.
- 실제 ERP·SQL·심평원·메일·지도 서비스 접속은 미실행이며, 이번 승인은 H02 목업 실행 기반에 대한 것이다.

다음 단계는 지시서 §6 H03이며, 이전 단계 승인 후 리드·거래처·전환 구현으로 진행한다.
