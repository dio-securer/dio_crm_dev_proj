# H00 기준 대조 보고

작성일: 2026-10-22 · 기준 커밋: `9e16bc20fe28457b46a7ee68ee6489130bf9f82b`

보완 대조 기준: 원격 main `e111138dbf50c46aca41c7097e156840fcd59069`. 원 H00 기준 이후 이 커밋까지의 차이는 문서이며 업무 소스/패키지/lockfile은 동일하다. 아래 과거 실행 기록과 이번 코드 대조·재실행 결과를 분리한다. 이번 H00 보완은 지정된 문서 3개에 한정한다. 작업자 B가 보완된 H00 입력자료를 재검증해 PASS 및 H01 착수를 승인했으며, 이는 H01 구현 완료나 전체 build/test PASS를 뜻하지 않는다.

## 범위와 산출물

- [화면 대응표](H00-coverage.md): P0 `SCR-*` 34개 전부, HQ 라우트 14개, 카탈로그 외 현 진입점 `HQ_OPS` 1개를 대조했다. 목록/상세/탭/대화상자는 부모 화면과 액션으로 연결했다.
- [필드·액션·인터페이스 조사](H00-fields.md): 화면별 현 필드, 필요한 필드, 입력/조회 액션과 API, `IF-ERP-001`–`014`, `IF-HIRA-001`의 화면·결과를 대조했다. 거래처 인터페이스 25개 필드는 개별 원천·송신 필수성을 적었다.
- 중복 교육 자료는 [작업설계서 §2](../01_HQ_CRM_Mock_Work_Design.md)에 따라 `1차 ↔ 02·03`, `05 ↔ 06·07`로 묶었다. `S505`, `S506`, `S525`–`S527` 교육자료 설명은 독립 CRM 메뉴로 세지 않았다. 계약 `00058196`, `00058077`, `00045297`은 서로 다른 사례로 취급한다.

## 기준 빌드·테스트 — 기존 H00 실행 기록

아래는 원 H00 보고에 적힌 과거 실행 결과를 보존한 것이다. 원본 로그가 원격 저장소에 없어 이 표 자체로 독립 재검증을 마친 것으로 판정하지 않는다.

| 명령 | 결과 | 한계 |
|---|---|---|
| `pnpm.cmd build` | PASS: contracts/backend/frontend 빌드 | Vite 500 kB 청크 경고. 기존 기준. |
| `pnpm.cmd test` | PASS: frontend 14 파일/59 테스트, backend 15 스위트/59 테스트 | backend `ts-jest allowJs` 경고. 기존 기준. |
| `pnpm.cmd regression:multi-market` | PASS: 85개 소스 수준 검사 | 실제 기기·배포 런타임 검증은 포함하지 않음. |

기존 보고의 로그명은 `H00-build.log`, `H00-test.log`, `H00-regression.log`였으나 이 세 파일은 원격 저장소에 업로드되어 있지 않다. 따라서 깨진 다운로드 링크를 제거했고 기존 보고가 명시한 종료코드 0은 **과거 보고값**으로만 남긴다. 누락은 실패 판정이 아니라 원문 증거 미확보 상태다.

원 H00 보고에 따르면 PowerShell의 `pnpm.ps1` 실행 정책 때문에 `pnpm.cmd`를 사용했고, `C:\Users\sklee` 접근 제한의 초기 `EPERM` 이후 권한을 받은 동일 명령으로 결과를 확보했다. 이 환경 설명과 H01 코드 변경 전 실행이라는 내용도 과거 기록이며 이번 Linux 검토환경의 결과와 혼합하지 않는다.

### 이번 검토환경의 재실행·제약

| 명령/범위 | 이번 결과 | 증거 수준·한계 |
|---|---|---|
| 의존성 설치 후 전체 `pnpm build`·`pnpm test` | 미실행 | 의존성 설치가 `registry.npmjs.org` 네트워크 정책으로 차단됨. 과거 PASS를 이번 실행 결과로 재사용하지 않음 |
| `node scripts/regression/multi-market-ui-check.mjs` | PASS, 종료코드 0, 85개 검사 | 이번 검토 담당 실행 출력으로 확인. 소스 수준 회귀이며 브라우저/HTTP/실제 기기·DB·ERP 검증이 아님 |
| H00 보완 문서 | 원본 controller/service/rules와 대조 | 코드 실행 성공·H01 구현·작업자 B 승인과 별도 |

## 현 차이와 다음 단계 소유

| 차이 | 근거 | 소유 단계 |
|---|---|---|
| `/`는 `HQ_LEAD`이며 P0 홈 대시보드가 아니다. | `route-config.ts`, `screen-profile.ts` | H01에서 불일치 명시·키 등록, H07에서 실제 홈 화면/메뉴 연결 |
| 14개 진입점은 있으나 P0의 상세·탭·대화상자 34개가 모두 동작하지 않는다. | 대응표의 `부분`/`미구현` | H03–H07 |
| 계정 ERP 요청 버튼과 수신 API는 있으나 요청→승인→수주 가능까지 자동 목업 경로가 없다. | `AccountsPage`, 계약 컨트롤러 | H02/H03/H05 |
| Lead/전환/Account 병원현황의 안정 키 후보 일부는 현재 쓰기 API에 없다. | `customer.controller`의 schema와 `customer.service`의 실제 저장 매핑, 필드조사의 현재/목표 구분 | H01 지원 상태·API 매핑 분리, H02/H03 모델·동작 확장 |
| `cust_nm`은 ERP IN 계약이지만 현재 `accountName` 입력 및 저장이 가능하다. | `CRM_FORM_KEY`, `AccountsPage.fieldInput(field,false)`, Account POST/PATCH | H01 현 구현/목표 원천 정책 분리, H03 정책 확정 및 UI·API 일치 |
| HIRA는 현재 Lead만 갱신, 거래처 ERP 요청은 13필수 검증과 실제 10키 payload가 다르다. | `CustomerService.importHira`, `ContractService.requestErpAccount`; 필드조사 ERP/HIRA 인계 명세 | H02 어댑터·DTO, H03 Account 반영·payload 누락 테스트 |
| 직출 ERP 요청은 본부승인·활동 OUT 완료·ERP NOT_REQUESTED 세 조건 이후 로그를 기록한다. | `ActivityService.queueDirectWorkErpIfReady`; 현재 외부 송신 함수가 아님 | H02/H04 양 이벤트 순서·결과·실패 후 재처리·중복 검증 |
| 기회 협상 저장 버튼은 PIPELINE 및 단계별 70/30 확률의 고정 샘플 액션이다. | `OpportunitiesPage.saveNegotiation`; `OPP.saveNegotiation` 대응 추가 | H01 현재 액션 보존, H05 자유 협상 입력 구현 |
| 계약·주문·수금의 ERP 결과 API가 있으나 목업 정상 연속 경로와 일부 화면이 없다. | 계약/주문/분석 컨트롤러 | H02/H05/H06 |
| 관리자 5개는 조회 API 일부만 있고 관리 UI/변경/재처리 기능이 없다. | platform controller, 화면 등록부 | H07 |
| 별도 관리자 브랜치의 코드와 현재 main의 차이는 확인되지 않았다. | 현 작업 트리 조사 범위 | H07 병합 전 별도 대조 |
| 법인별 활성화 편집 UI는 이번 H01 범위가 아니다. | 작업설계서 | H07 검증용 설정본, 후속 관리자 작업 |

## 기존 기능 보존 기준

`frontend/src/market/templates/hq/HqScreens.tsx`의 14개 래퍼, `GLOBAL_SCREEN_PROFILE`의 7개 등록 화면, 기존 `APP_ROUTES`, 거래처 HQ 필드 프로필, 기존 backend CRUD·상태 API, `frontend/src/demo`의 GLOBAL 데모를 H01에서 임의 변경하지 않는다. 새 계약·등록부는 기존 화면 키와 경로를 참조하며 현재 표시 방식 변경은 별도 단계에서 검증한다.

## 구현 파일 후보

### 기준 대조로 측정한 작업량

P0 34개 중 현재 `부분` 24개, `미구현` 10개, 완전 `충족`으로 증명된 화면 0개다. 이는 브라우저/실기기 인수 검증 전의 보수적 판정이다. `HQ_OPS`는 별도 사용 진입점 1개다. 현재 HQ 진입점 14개, 거래처 ERP 인터페이스 필드 25개(송신 필수 13개), 외부 인터페이스 15개(`ERP` 14·`HIRA` 1)를 확인했다. 각 단계는 아래 화면 수를 최소 작업량으로 삼고, [필드 조사](H00-fields.md)의 미확인 속성과 액션을 추가한다.

| 단계 | 대응 화면 실측 | 현재 상태·최소 구현량 |
|---|---|---|
| H01 | P0 34개 + `HQ_OPS` 1개, 실제 HQ route 14개 | 표준 화면·프로세스·메뉴·필드/액션 참조와 검증기; 기존 화면 구현 완료와 별개 |
| H02 | ERP 14 + HIRA 1 인터페이스 | 요청/결과 DTO·로그·목업 시드/어댑터 |
| H03 | 리드 3 + 거래처 4 = 7개 | 미구현 3, 부분 4; 리드 상세/전환·거래처 병합 포함 |
| H04 | 활동 4 + 캘린더 1 + 보고 3 + 직출 2 = 10개 | 미구현 1, 부분 9; PC 다건 계획 포함 |
| H05 | 기회 3 + 계약 2 + 수금 1 = 6개 | 부분 6; ERP 계약/수금 결과 포함 |
| H06 | 주문 2 + 원장 1 + 명세서 1 + 분석 1 = 5개 | 부분 5; ERP 품목/주문/납품·파일 결과 포함 |
| H07 | 홈 1 + 관리자 5 + `HQ_OPS` 1 = 7개 | P0 미구현 6 및 운영 화면 1; 전체 35개 인수 연결 |

| 단계 | 후보 |
|---|---|
| H01 | `packages/contracts/src/hq-standard.ts`, `packages/contracts/src/index.ts`, `frontend/src/app/hq-standard-registry.ts`, 검증 테스트 |
| H02 | `backend/src/modules/*`, `frontend/src/demo/*` 또는 격리된 HQ 목업 저장소·어댑터 |
| H03 | `LeadsPage.tsx`, `AccountsPage.tsx`, `Account360Page.tsx`, `backend/src/modules/customer/*` |
| H04 | `ActivitiesPage.tsx`, `ActivityReportsPage.tsx`, `DirectWorkPage.tsx`, `backend/src/modules/activity/*` |
| H05 | `OpportunitiesPage.tsx`, `PipelinePage.tsx`, `ContractsPage.tsx`, `backend/src/modules/opportunity/*`, `contract/*` |
| H06 | `OrdersPage.tsx`, `FulfillmentPage.tsx`, `LedgerStatementsPage.tsx`, `AnalyticsDashboardPage.tsx`, order/analytics API |
| H07 | `route-config.ts`, `screen-registry.tsx`, App shell, 관리자 화면/API, 전체 인수표 |

기존 코드에 있는 최대 길이·범위·권한·잠금·계산·업무 재요청 규칙은 `H00-fields.md`의 실행 규칙 표에 보완했다. 실제로 확인되지 않은 운영 정책·정규식·교육 요구의 상세값만 `미확인`으로 남긴다. 이후 단계의 새 목업 규칙은 `설계 가정`으로 구분하며 불확실하다는 이유로 화면 구현을 제외하지 않는다.

## 작업자 B 지적사항 보완 기록 — 재검증 PASS·H01 착수 승인

2026-10-22 작업자 B의 독립 재검증에서 원 P1 2건·P2 3건 모두 해소되어 **H00 입력자료 PASS, H01 착수 승인**을 받았다. 승인 범위는 보완 문서의 정확성·입력자료 적합성이다. H01 코드는 별도 구현 후 작업자 B 검증이 필요하며, 이번 검토환경의 전체 build/test 미실행 제약도 그대로 유지한다.

| 지적 ID | 보완 내용·근거 | 상태 |
|---|---|---|
| P1-01 | Lead/전환/Account 후보를 현재 미지원으로 표시, 안정 키→API/DB 매핑·원천 정책·소유 단계를 분리. `cust_nm` 현재 편집 가능으로 정정. customer schema·서비스 및 account-model/AccountsPage 대조 | B 재검증 PASS·해소 |
| P1-02 | 기회 이름/거래처·확률·제품수량/단가, Account 최대 길이·선택지, 계약 생성/금액/날짜, 수금행/합계/잠금·ERP_FAILED 재요청을 코드 실행 규칙으로 기록. controller/service/rules 대조 | B 재검증 PASS·해소 |
| P2-01 | 상위 화면표를 개별 S ID 표와 정렬: 전환 S10/S13, ERP 거래처 S505(교육), 제품 S47–S49/S502. 보고/기회/계약 연결도 시연·교육 맥락 구분. 원본 영상 재검증 아님을 명시 | B 재검증 PASS·해소 |
| P2-02 | `OPP.saveNegotiation`의 현재 버튼·PATCH 고정 payload·재조회·오류표시 추가, 자유 입력 목표와 구분 | B 재검증 PASS·해소 |
| P2-03 | HIRA Lead-only, ERP 거래처 13검증 필드 대 부분 payload, 직출 세 조건과 요청로그 기록을 현재 차이로 명시하고 H02/H03/H04에 인계 | B 재검증 PASS·해소 |

H00 화면/필드 요구를 삭제하지 않았고 H00 보완 작업에서는 업무 소스·DB·교육 원본을 변경하지 않았다. 위 B 승인에 따라 다음 작업은 H01 구현 후 별도 검증이다. H00 입력자료 승인과 H01 구현·실행 검증 완료를 혼동하지 않는다.
