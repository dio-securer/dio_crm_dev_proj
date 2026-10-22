# H00 기준 대조 보고

작성일: 2026-10-22 · 기준 커밋: `9e16bc20fe28457b46a7ee68ee6489130bf9f82b`

## 범위와 산출물

- [화면 대응표](H00-coverage.md): P0 `SCR-*` 34개 전부, HQ 라우트 14개, 카탈로그 외 현 진입점 `HQ_OPS` 1개를 대조했다. 목록/상세/탭/대화상자는 부모 화면과 액션으로 연결했다.
- [필드·액션·인터페이스 조사](H00-fields.md): 화면별 현 필드, 필요한 필드, 입력/조회 액션과 API, `IF-ERP-001`–`014`, `IF-HIRA-001`의 화면·결과를 대조했다. 거래처 인터페이스 25개 필드는 개별 원천·송신 필수성을 적었다.
- 중복 교육 자료는 [작업설계서 §2](../01_HQ_CRM_Mock_Work_Design.md)에 따라 `1차 ↔ 02·03`, `05 ↔ 06·07`로 묶었다. `S505`, `S506`, `S525`–`S527` 교육자료 설명은 독립 CRM 메뉴로 세지 않았다. 계약 `00058196`, `00058077`, `00045297`은 서로 다른 사례로 취급한다.

## 기준 빌드·테스트

| 명령 | 결과 | 한계 |
|---|---|---|
| `pnpm.cmd build` | PASS: contracts/backend/frontend 빌드 | Vite 500 kB 청크 경고. 기존 기준. |
| `pnpm.cmd test` | PASS: frontend 14 파일/59 테스트, backend 15 스위트/59 테스트 | backend `ts-jest allowJs` 경고. 기존 기준. |
| `pnpm.cmd regression:multi-market` | PASS: 85개 소스 수준 검사 | 실제 기기·배포 런타임 검증은 포함하지 않음. |

재실행 원문 로그: [빌드](H00-build.log), [테스트](H00-test.log), [다중 시장 회귀](H00-regression.log). 각 명령의 종료코드는 실행 기록에서 `0`으로 확인한다.

PowerShell의 `pnpm.ps1`은 실행 정책으로 시작하지 못해 `pnpm.cmd`를 사용했다. 샌드박스의 `C:\Users\sklee` 접근 제한으로 초기 명령이 `EPERM`을 반환했고, 권한을 받은 동일 명령으로 위 결과를 확보했다. 기준 결과는 H01 코드 변경 전에 실행했다.

## 현 차이와 다음 단계 소유

| 차이 | 근거 | 소유 단계 |
|---|---|---|
| `/`는 `HQ_LEAD`이며 P0 홈 대시보드가 아니다. | `route-config.ts`, `screen-profile.ts` | H01에서 불일치 명시·키 등록, H07에서 실제 홈 화면/메뉴 연결 |
| 14개 진입점은 있으나 P0의 상세·탭·대화상자 34개가 모두 동작하지 않는다. | 대응표의 `부분`/`미구현` | H03–H07 |
| 계정 ERP 요청 버튼과 수신 API는 있으나 요청→승인→수주 가능까지 자동 목업 경로가 없다. | `AccountsPage`, 계약 컨트롤러 | H02/H03/H05 |
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

H00에서 확정되지 않은 최대 길이·정규식·역할별 권한·잠금·계산 규칙은 `H00-fields.md`에 `?`로 남겼다. 이후 단계는 기존 코드와 자료를 먼저 대조하고 실행 가능한 목업 규칙을 `설계 가정`으로 기록한다. 이 불확실성 때문에 화면 구현을 제외하지 않는다.
