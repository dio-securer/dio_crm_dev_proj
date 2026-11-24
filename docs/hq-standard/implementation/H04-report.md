# H04 — 활동·캘린더·활동보고·직출직퇴

작성일: 2026-10-23 · 최종 검증·작업자 B 승인일: 2026-10-23 · 상태: **H04 PASS**

## 기준과 출처

- 작업지시서 §7의 `SCR-ACT-001`–`004`, `SCR-CAL-001`, `SCR-REP-001`–`003`, `SCR-DW-001`–`002` 및 설계서 HQ03을 따른다.
- 필드와 기존 동작은 H00 대응표 `H00-fields.md`, 기존 `backend/src/modules/activity/activity.service.ts`·`activity.rules.ts`, H01 등록부를 대조했다. 활동·직출직퇴 상세는 Drive 문서만으로 모든 규칙을 확정할 수 없다.
- H03 승인 기준 커밋은 `5acbe0048edade48ba7a331983234afc266ffba7`이다. 사용자 작업물인 `backend/src/config/env.ts`, `salesforce/`, `tall`은 H04 작업 범위에서 제외했다.

## 구현 연결

| 카탈로그 | 구현 | 저장·상태 계약 |
|---|---|---|
| `SCR-ACT-003`–`004` | 단건·PC 다건 계획 화면, `POST /api/activities/plans[/bulk]` | 같은 거래처·담당자·날짜 중복 차단, 다건 실패 원자성, 직출직퇴 선택 시 사유 필수 |
| `SCR-CAL-001`, `SCR-ACT-001` | 일·월 캘린더와 좌표 기반 목업 지도, calendar/map API | 조회일·좌표 검증, 담당 범위·대상 READ·지도조회 제외 적용 |
| `SCR-ACT-002` | 활동 상세, IN→상담→OUT, GPS/병원 위치 모의 입력 | 200m IN 제한, 동시 미OUT 차단, 소유자·권한·상태 검사, 이력 기록 |
| `SCR-REP-001`–`003` | 보고 준비·항목 수정·요청, 기간 목록, 승인 상세의 의견 저장·승인·반려 | OUT 미등록 요청 차단, 현재 승인자 확인, 의견 저장은 상태 유지, 반려 후 재요청 |
| `SCR-DW-001`–`002` | 직출직퇴 요청·결정·승인자 재할당·ERP 재처리 및 상세 이력 | 본부 승인과 OUT이 모두 끝나야 `IF-ERP-012` 요청. `IF-ERP-013` 정상·실패·지연·재처리 결과가 동일 데이터셋의 목록·상세·연계 로그에 반영 |

H01 기준 등록부는 조사 당시 기록으로 보존하고, 실행 가능한 H04 액션·반려 상태·재할당·ERP 재처리 계약은 `hq-runtime-standard.ts`에서 명시했다. 보고 반려·재요청, 직출직퇴 승인자 재할당은 본사 운영 규칙 근거가 확정되지 않아 **설계 가정**이다. GPS 허용 거리 200m와 미래 계획 5일 스냅샷은 기존 서비스 코드의 기본 규칙을 따른다. 지도는 좌표를 사용해 점을 배치하는 로컬 목업이며 외부 지도 공급자와 접속하지 않는다.

## 현재 검증 기록

| 검증 | 결과 |
|---|---|
| 전체 빌드 | `pnpm build` PASS: contracts, backend, frontend 타입 검사와 번들 |
| H01–H03 계약 회귀 | `pnpm hq:check` 251/251 PASS |
| 실제 HTTP | `pnpm hq:http` 13/13 PASS, 그중 H04 5/5 PASS. HQ03 연결, ERP 실패·재처리, 다건 원자성, READ 제거·원천 화면 비활성화·지도 제외·범위, 반려·재할당, 비활성 화면·액션 직접 GET 차단 |
| 다중 시장 소스 회귀 | `pnpm regression:multi-market` 85 PASS |
| 다국어 | `pnpm i18n:check` 586개 키 한·영 일치, `pnpm i18n:hardcode` PASS |
| PC·390px 실제 브라우저 | 시스템 Chrome 156, `HQ_BROWSER_CHANNEL=chrome`로 `node --experimental-strip-types scripts/hq-standard/h04-browser.mjs` 실행, 종료 코드 0. 1440×1000 PC·390×844 모바일 **10/10 PASS**, FAIL·NOT_RUN 0, 브라우저 예외·외부 요청 0. `evidence/h04-browser-report.json`과 5개 화면 캡처 참조. 시스템 Chrome 종료가 10초 넘게 지연되어 테스트 후 강제 종료한 정리 경고는 JSON에 기록됨 |
| 전체 패키지 단위 테스트 | `tinypool@2.1.2`의 누락된 로컬 설치 파일을 복구한 뒤 직접 러너 실행: backend `node node_modules/jest/bin/jest.js --runInBand` **15 스위트·59/59 PASS**, frontend `node node_modules/vitest/vitest.mjs run` **15 파일·70/70 PASS**, 각각 종료 코드 0. 이 환경의 `pnpm` 실행 파일은 사용자 홈 `lstat` 권한 오류로 시작 전 중단되어 동일 패키지 스크립트의 러너를 직접 실행함 |
| 작업자 B | 수정 코드와 부정 HTTP를 독립 검토하고 HQ 계약 **251/251**, HTTP **13/13**(H04 5/5), backend/frontend 전체 단위 테스트 **129/129**, PC·390px 브라우저 **10/10** 증거를 대조함. **H04 최종 PASS, H05 진입 가능** |

## 작업자 B 지적과 보완

| ID | 지적 | 보완·현재 상태 |
|---|---|---|
| H04-B-P1-01 | 활동 대상 READ 없이 계획·지도에서 이름·좌표 노출, 지점 범위와 지도조회 제외 무시 | 대상별 READ와 `hqCanRead`, `map_excluded_yn` 검사. 지도 병원·활동 계획 응답에 적용; 부정 HTTP·B 독립 재검증 PASS |
| H04-B-P1-02 | 의견·승인·결정·ERP 재처리 및 조회 경로가 표준 비활성 정책을 우회 | `requireAction`/`requireScreen` 적용, 비활성 화면·액션 직접 GET 및 결정 API 부정 HTTP·B 독립 재검증 PASS |
| H04-B-P2-01 | 직출직퇴 승인자 재할당 UI/API 누락 | 담당 단계·대상 역할·회사/조직·관리 권한 검사와 이력 추가. 부정 HTTP·B 독립 재검증 PASS |
| H04-B-P2-02 | 시간 초과 ERP 건의 재처리 버튼 누락 | `FAILED`·`TIMED_OUT` 모두 버튼 표시, 서버도 두 상태 허용. 코드·HTTP 및 B 독립 재검증 PASS |
| H04-B-P2-03 | 활동 상세에서 권한 없는 상담·OUT 버튼 노출 | 담당자·`ACTIVITY.WRITE`·`ACTIVITY.CHECKOUT` 조건에 맞게 표시. 코드·B 독립 재검증 PASS |
| H04-B-P1-03 | 원천 LEAD/ACCOUNT/OPPORTUNITY 화면을 꺼도 계획 생성·지도에서 원천 데이터 노출 | 원천 화면 정책을 계획 대상 확인과 지도 계획·근처 병원 필터에 적용. 화면 비활성 부정 HTTP·B 독립 재검증 PASS |

### 최종 브라우저·독립 검증 중 발견한 보완

- 승인 UI의 계정 전환 후 페이지 이동을 검사하는 브라우저 스크립트가 기본 관리자 계정만 기다리던 오류와, 직출직퇴 상세를 계획 생성자가 아닌 다른 계정에서 찾던 오류를 수정했다. B01–B10을 PC·390px 실제 브라우저에서 다시 실행했다.
- 본부장 승인에 새 의견이 없을 때 보고 이력의 `comment: undefined` 때문에 저장소가 `DATASET_NOT_SERIALIZABLE`을 반환했다. 빈 문자열로 직렬화하고 의견 없는 본부장 승인 HTTP 회귀를 추가했다.
- 작업자 B가 기존 계획의 캘린더·지도·일반 활동 목록/상세에서 원천 대상의 READ 또는 화면 접근이 사라져도 스냅샷 이름·좌표가 노출되는 경로를 발견했다. 대상별 화면·권한·회사·조직 범위를 조회와 조작에서 다시 검사하고, 보고 항목·직출직퇴 조회 및 보고 검색에서도 숨긴 대상이 노출되지 않도록 했다. 화면 비활성·ACCOUNT.READ 제거 후 활동 4개 조회 경로, 보고 항목·검색, 직출직퇴 목록·상세와 조작 경로의 부정 HTTP 검증 및 B 독립 재검증이 통과했다.
- 최종 검증 기준은 HEAD `5acbe0048edade48ba7a331983234afc266ffba7` 위의 H04 작업 트리이며, 목업 데이터셋은 `HQ_DEMO`다. `evidence/h04-browser-report.json`의 실행 시각·브라우저 버전·화면 크기·시나리오별 상태와 PNG 캡처를 함께 보존한다. 작업자 B는 최신 코드의 전체 단위 테스트와 HQ/HTTP 계약을 별도로 실행해 종료 코드 0을 확인했다.

## 단계 판정

전체 단위 테스트, PC·390px 실제 브라우저, HTTP 및 작업자 B 독립 최종 검증을 모두 완료하여 **H04 PASS**로 판정한다. H05는 아직 시작하지 않았다. 실제 ERP·SQL·지도 공급자 실접속은 본사 목업 단계의 인수 범위가 아니며, IF-ERP-012/013의 요청·결과 계약은 모의 어댑터에서 검증했다.
