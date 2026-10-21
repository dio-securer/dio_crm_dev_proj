# 06. 인수검증·목업 시나리오

## 1. fixture
다음은 실제 법인 정책이 아닌 합성 시연 데이터다. 원본 account seed와 분리한다.

| 회사 | 국가/템플릿 | 특성 |
|---|---|---|
| HQ_DEMO | KR/HQ | 기존 본사 필드·메뉴·2단계 승인 호환 |
| US_A | US/GLOBAL | 고객 명칭, 방문 그룹, 활동 중심, 계약 메뉴 off |
| US_B | US/GLOBAL | 병원 명칭, 다른 필수 필드, 계약 샘플 메뉴 on |
| MX_A | MX/GLOBAL | 별도 코드/모의 ERP profile, en-US 시연 |

각 회사: org 2개, 영업 사용자 2명, 팀장 1명, 법인 관리자 1명. 플랫폼 관리자 1명, 두 회사 membership 사용자 1명, 비활성 승인자 1명.
US_A/US_B는 같은 국가지만 company override 차이를 반드시 포함한다.
원본 seed 고객은 원래 DIO 회사 소속을 유지하고 새로운 fixture는 DEMO 접두어로 구분한다.
clock은 고정 기준시각과 advance 기능을 사용한다. 저장 timestamp와 dueAt 검증은 timezone 포함.

## 2. 요구사항 추적
| ADM | 구현 단계 | 대표 인수 조건 |
|---|---|---|
| 01 | A02 | 법인 생성 후 기본 초안, 같은 국가 다른 회사 구성 |
| 02 | A02 | 조직 이동 성공, 순환/타 회사 부모 거부 |
| 03 | A02/A03 | 소속 회사 전환, 중지 후 token 재사용 거부 |
| 04 | A03 | 역할 부여/회수, 명시 deny 우선 |
| 05 | A03 | SELF/ORG/SUBTREE/COMPANY 조회와 수정 범위 일치 |
| 06 | A03 | 법인 관리자의 상위 권한 부여 거부 |
| 07 | A04 | 출처 표시, override reset, locked path 거부 |
| 08 | A05 | 기능 off가 메뉴/API에 반영, 의존성 위반 게시 거부 |
| 09 | A05 | 메뉴 순서·그룹 변경, URL 직접 접근 권한 검사 |
| 10 | A05 | 등록 HQ/GLOBAL 화면 연결, 미등록 키 게시 거부 |
| 11 | A05 | 그룹 이동·숨김이 목록/상세/등록에 일관 적용 |
| 12 | A05 | 필수/읽기전용/UI/서버 검증 일치 |
| 13 | A03/A05 | 숨긴 필드가 API 응답과 검색에서 누출되지 않음 |
| 14 | A06 | 법인 용어와 ko/en 번역, 언어 변경은 회사 정책 불변 |
| 15 | A06 | 법인 코드 격리, 사용 중 코드 삭제 금지 |
| 16 | A05 | 공용 보기/필터 반영, 필드 권한 적용 |
| 17 | A05 | 등록 액션만 실행, 권한 없는 직접 POST 거부 |
| 18 | A05 | 조건부 필수 및 충돌 검출, 임의 script 거부 |
| 19 | A07 | 설정된 전이 허용, 불법 상태 이동 거부 |
| 20 | A07 | 정책 매칭, 동순위 충돌, 미설정 승인 제출 거부 |
| 21 | A07 | 순차/병렬, 유효 대결, 부재 승인자 처리 |
| 22 | A07 | 승인/반려/회수/재상신, 변경 불가 이력 |
| 23 | A08 | 개인 알림, EMAIL mock, 중복 억제 |
| 24 | A09 | 법인별 MOCK profile, LIVE 활성화 불가 |
| 25 | A09 | 성공/실패/재처리/중복/지연 응답 정확히 반영 |
| 26 | A04/A10 | 원자적 게시, 예약·복원, 진행 건 version 유지 |
| 28 | A03 | 세션/잠금/회수 및 DEMO MFA 분기 |
| 30 | A02 | 이관 preview, 범위/동시성 검증, 성공 건 재적용 없음 |
| 33 | A06 | 번호 preview 비소모, 동시 할당 유일 |
| 34 | A05 | 5종 확장 타입, 저장/검색, 비활성 시 과거 값 보존 |
| 37 | A06 | 휴일/주말/시간대 dueAt, 기존 dueAt 유지 |

## 3. 상세 검증 시나리오
| TC | 사전조건/실행 | 기대 결과 |
|---|---|---|
| T01 | US_A 필드 그룹 변경 초안 저장; US_A/US_B 화면 조회 | 게시 전 모두 기존 구성 |
| T02 | US_A 초안 검증·게시 후 두 법인 조회 | US_A만 변경, releaseId 일치 |
| T03 | US_A 사용자 언어 ko→en 변경 | 명칭만 변경; 메뉴/회사/필수/승인 정책 불변 |
| T04 | locked tax field 삭제 시도 | 게시 거부, 오류 경로와 상위 출처 표시 |
| T05 | 메뉴 hidden 상태에서 일반 사용자 API 직접 요청 | action 권한이 없으면 403; 메뉴 숨김 자체와 권한은 별개 |
| T06 | US_A token으로 US_B record GET/PATCH | 404, 정보/변경 누출 없음 |
| T07 | read=false 필드를 응답/검색/정렬/필터로 요청 | 값 누출 없음, 허용되지 않은 조건 거부 |
| T08 | readOnly field 변조 PATCH | 422/403, 기존 값 불변 |
| T09 | 관리자 둘이 같은 revision 저장 | 한 건 성공, 다음 409와 비교 화면 |
| T10 | validation 후 초안 변경하고 게시 | 409, 재검증 필요 |
| T11 | parent template v2 게시, child pinned v1 조회 | child 변경 없음; rebase preview 필요 |
| T12 | 승인 제출 후 새 결재선 게시 | 기존 인스턴스 이전 route, 신규는 새 route |
| T13 | task approve 두 번, 동일 key/다른 key | 동일 key 기존 결과; 다른 key 409; 알림 1회 |
| T14 | parallel ALL과 ANY 각각 결정 | 04 문서의 명시된 집계 규칙 적용 |
| T15 | 승인자 중지, 기존 token 결정 시도 | 거부, BLOCKED 표시, 재배정 이력 |
| T16 | 반려→수정→재상신 | 새 instance/document revision, 이전 이력 유지 |
| T17 | GLOBAL 미확정 route로 제출 | 설정 미완료 오류; 자동 승인 없음 |
| T18 | 모의 ERP 거래처 SUCCESS | MOCK 코드/업무 승인, 외부 호출 0 |
| T19 | BUSINESS_REJECTED | transport SUCCESS, 업무 REJECTED 분리 |
| T20 | TRANSIENT_FAILURE→retry | attempt 증가, 업무 적용 1회 |
| T21 | 같은 수금 event 중복/낮은 version 수신 | 금액 중복 없음, stale 이력 |
| T22 | timeout 뒤 늦은 성공과 재시도 경합 | 유효 request만 1회 적용 |
| T23 | 다른 회사 mock request에 응답 주입 | 404, 대상 업무 불변 |
| T24 | idempotency 같고 payload 다름 | 409, 기존 처리 결과 보존 |
| T25 | rollback 이후 승인/sequence/권한 회수 조회 | 설정만 복원, 업무/번호/회수 유지 |
| T26 | US_A 전환 직후 HQ의 느린 API 응답 도착 | HQ 데이터 표시하지 않음 |
| T27 | 원본 account localStorage 버전 이전 | 원본 백업/보존, 신규 필드 및 회사 구분 정상 |
| T28 | extension text/decimal/date/bool/enum 저장·조회·필터 | 타입별 검증, 회사 분리, 과거 값 유지 |
| T29 | 이관 대상 일부 동시 수정 후 실행 | 해당 건 충돌, 성공 건만 이관, 결과 건수 일치 |
| T30 | 번호 미리보기 반복 후 동시 2건 할당 | 미리보기 미소모, 실제 번호 중복 없음 |
| T31 | 회사 달력 휴일을 포함한 승인 dueAt | 올바른 영업일 계산, 달력 변경 후 기존 dueAt 동일 |
| T32 | 두 번 동일 알림 이벤트, ko/en 수신자 | 수신자·채널별 1건, 올바른 번역 |
| T33 | 예약 게시 전 active version 변경 | 실행 시 충돌 검출, 임의 덮어쓰기 없음 |
| T34 | API_MOCK 재시작 | memory reset 안내와 결정적 seed 복원 |
| T35 | 브라우저 새로고침 및 다른 탭 동시 편집 | 저장 복구, stale 탭 충돌 표시 |
| T36 | production 설정으로 mock 모드 시작 | 시작 거부; LIVE로 자동 전환 없음 |

## 4. 인수 증거
각 TC에 모드, 입력 fixture, 실제 결과, PASS/FAIL/BLOCKED, 캡처/로그 위치, 실행 commit을 기록한다.
브라우저에서만 통과한 T06/T07/T08은 서버 권한 검증 PASS로 인정하지 않는다. API_MOCK HTTP 테스트를 별도로 실행한다.
네트워크 기록 또는 외부 client stub spy로 실제 ERP/이메일 호출 0건을 확인한다. 모의 성공을 실연계 검증으로 보고하지 않는다.
문서 단계의 이 표는 테스트 계획이다. 아직 어떤 TC도 실행 완료로 기재하지 않는다.

## 5. 최종 시연 순서
1. 플랫폼 관리자: US_A와 US_B를 같은 국가로 생성.
2. US_A 법인 관리자: 메뉴·그룹·필드·업무 명칭 변경, 검증·게시.
3. 두 법인의 영업 사용자: 다른 화면 확인, 언어 전환, 권한 없는 필드 쓰기 거부.
4. 승인 관리자: 샘플 결재선 게시, 영업 사용자 제출, 승인자 승인/반려.
5. 진행 건이 있는 상태에서 새 결재선 게시, 이전/신규 적용 차이 확인.
6. 거래처에서 모의 ERP 요청, 성공·반려·실패·재처리 시연.
7. 계약·주문·수금·납품 fixture의 연계 로그와 중복 처리 확인.
8. 설정 복원, 업무 이력 보존, 목업 dataset reset.

## 6. v1.1 보완 인수검증
BOTH는 BROWSER_MOCK와 API_MOCK를 각각 실행한다. API는 실제 HTTP 검증 필수이며 브라우저 결과로 대체할 수 없다.

| TC | 모드 | 입력·실행 | 기대 결과 |
|---|---|---|---|
| T37 | API | 같은 loginId를 가진 두 homeCompany fixture로 로그인 | company 누락 422 COMPANY_REQUIRED; 회사 지정 시 정확한 identity |
| T38 | API | 기존 숫자 companyId 응답과 신규 adminContext 비교 | 기존 타입 유지, admin UUID는 mapping 일치; 타 회사 변조 404 |
| T39 | BOTH | REQUIRED 미등록 영업사원 1차 로그인→업무 호출→등록/verify | 중간 access/refresh 없음, 업무 403; 성공 후만 업무 200 |
| T40 | BOTH | OFF/OPTIONAL 미등록·등록/상위 REQUIRED 조합 | 04 §9.2 각 분기; 상위 REQUIRED의 skip 403 |
| T41 | API | 오답 5회, 만료, 같은 challenge 동시 verify | 잠금 429/만료401; 동시 성공1회·다른 요청409; 동일 command 재전송은 최초 결과 |
| T42 | API | MFA reset 후 기존 access/refresh/challenge 사용 | 모두 거부, 새 1차 인증→재등록 필요 |
| T43 | API | OFF 법인→REQUIRED 법인 전환 및 세션 중 정책 강화 | 목적 context 미발급; refresh 우회 없음; MFA 이후만 허용 |
| T44 | BOTH | 같은 command key/동일 payload 반복, 다른 payload 반복, transaction 강제 실패 | 재적용0, 다른 payload409, 실패시 업무/event/receipt 모두 rollback |
| T45 | BROWSER | 두 탭이 같은 revision을 동시에 저장; Web Locks 미지원 | 성공1/충돌1, 부분 저장0; 미지원은 쓰기 차단 안내 |
| T46 | BOTH | LIST_VIEW/ACTION/확장 필드 편집→초안→게시 | 게시 전 변화0; 게시 후 US_A만 목록/버튼/필드 반영 |
| T47 | BOTH | readOnly와 write=false, unknown field, null, 누락 PATCH | 각 422/403/422/nullable 규칙; 누락값 유지, 거부 시 기존값 유지 |
| T48 | BOTH | 상반 effect 두 규칙과 hidden+required 등록 | 조건과 무관하게 상반 target+effect 게시422; 기본값 없는 필수 숨김422 |
| T49 | API | 법인 관리자가 사용자 중지, 마지막 관리자 중지, 진행건 있는 회사 중지 | 해당 membership만 중지; 마지막 관리자/진행건은409 |
| T50 | BOTH | decimal 4/5자리·0·false·잘못된 날짜, 번호 preview/동시발급 | 4자리 저장,5자리422,0/false유지,잘못된 날짜422,번호유일 |
| T51 | BOTH | 고정 달력 휴일/주말/DST gap·overlap 계산 | 04 §9.3 기대값 및 snapshot 보존; 아래 고정 예시 일치 |
| T52 | BOTH | 일반 작성자 제출, ANY 승인/반려 동시 명령, 비배정자 결정 | 정확히 한 종결 결과, 다른 결정409, 비배정자403 |
| T53 | API | timeout→retry와 늦은 성공 경합 | 업무1회 적용, 모든 attempt 이력, 대체된 요청 응답은 stale |
| T54 | API | 같은 외부 event/version 다른 payload, 높은 version 정정 | 같은 version 충돌409; 최신 교체합계, 중복 가산0 |
| T55 | BOTH | 다른 dataset 유지한 채 reset, 게시 rollback | 대상 DEMO만 초기화, 원본 보존; API 세션 폐기; rollback은 보안 회수/업무/sequence 유지 |

### 결정적 fixture
datasetId=ADMIN_DEMO_V1, schemaVersion=1, 시작시각=2026-10-21T00:00:00Z로 고정한다. HQ_DEMO/US_A/US_B/MX_A는 화면 코드이고 API UUID가 아니다. UUID는 구현 시 고정 manifest에 선언하며 매번 무작위 생성하지 않는다. manifest는 seed/테스트/시연 안내의 단일 원본이다.
각 회사 org SALES/OPS, SALES 사용자 sales1/sales2, MANAGER manager1, COMPANY_ADMIN admin1을 둔다. 각 identity의 login homeCompanyCode를 명시한다. 플랫폼 관리자 platform1, US_A/US_B membership을 가진 shared1, 비활성 inactive1을 추가한다. 비밀번호는 DEMO 전용 테스트 fixture이며 SQL/운영 계정과 공유하지 않는다.
US_A/US_B는 GLOBAL_ACCOUNT, HQ_DEMO는 HQ_ACCOUNT를 사용한다. 02 §9 확장 필드 5종, 회사별 합성 거래처 3건, 승인 문서 DRAFT 1건/IN_PROGRESS 1건을 둔다. 원본 DIO seed는 수정하지 않는다. US_A sales1은 SELF, manager1은 SUBTREE, admin1은 관리 권한만(업무 COMPANY read 자동 부여 금지). US_B x_creditLimit은 sales1 read/write=false다.
달력 예시: Asia/Seoul, 월~금, 휴일 2026-10-22; 2026-10-21T09:00:00+09:00 +2영업일 = 2026-10-26T09:00:00+09:00. DST 전용 fixture는 America/New_York, 모든 요일 근무: 2026-03-07 02:30 +1일은 2026-03-08 03:00 EDT, 2026-10-31 01:30 +1일은 2026-11-01 01:30 EDT다.

### 증거 스키마와 집계
acceptance-results.json의 각 행:
{tcId,admIds,stage,mode,datasetId,commit,status,expected,actual,command,evidencePaths,blocker}.
status는 실행 결과 PASS/FAIL/BLOCKED. 미실행은 BLOCKED와 NOT_RUN 사유로 기록한다. 필수 모드별 행을 분리하고 캡처만으로 API PASS를 인정하지 않는다.
coverage.md는 31개 ADM 각각에 route/editor/client/API/DTO/repository/runtimeEffect/TC/evidence를 연결한다. 해당 영역의 필수 TC 중 하나라도 FAIL이면 FAIL, FAIL 없이 BLOCKED가 있으면 BLOCKED, 전부 통과했을 때만 PASS다. 문서의 설계 검토 통과와 실제 테스트 PASS는 별도 지표다.
