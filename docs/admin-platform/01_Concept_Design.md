# 01. 개념설계

## 1. 설계 목표
사용자는 동일 CRM에 로그인하되 현재 접근 법인, 역할, 데이터 범위, 표시 언어에 따라 허용된 화면과 업무 기능을 사용한다. 관리자는 공통 설정을 상속받아 법인별 차이를 편집하며 배포 전 영향을 확인한다. 국가와 법인은 별도 식별자다.

## 2. 기존 코드 확인 결과
아래 내용은 기준 커밋의 코드 열람 결과다. 실행·DB 적용·CI 통과를 새로 확인한 결과는 아니다.

| 기존 경로 | 확인한 현재 동작 | 확장 방향 |
|---|---|---|
| frontend/src/account-sandbox.ts | 거래처 seed와 localStorage 저장, ERP 요청은 REQUESTING | 기존 seed 보존 및 버전 마이그레이션, 법인별 목업 저장소로 이동 |
| frontend/src/api.ts | GET/POST/PATCH 공통 HTTP 함수 | AdminClient HTTP 구현에서 재사용 |
| frontend/src/market/field-profiles/types.ts | account 전용 필드/섹션, visible/required/readonly | 엔티티 등록부 기반 공통 메타데이터로 확장 |
| frontend/src/app/screen-registry.tsx | HQ/GLOBAL 화면을 등록 키로 선택 | 등록부 유지, 법인 설정의 screenKey를 검증하여 연결 |
| frontend/src/market/globalization-context.tsx | 서버 문맥 없을 때 KR fallback, queryKey me-context | 인증 모드 오류를 명시, 법인/버전별 캐시 키로 분리 |
| backend/src/globalization/profile-resolver.ts | country → template 정적 매핑 | 회사별 override와 버전 해석 계층 추가 |
| backend/src/security/security.ts | JWT permissions와 scope 검사 | 활성 법인 membership, 권한 버전, 데이터/필드 접근 검사 추가 |
| backend/src/modules/platform/platform.service.ts | 사용자·조직·코드·알림·로그 조회 | 관리 CRUD와 범위 검증 추가; commonCodes의 법인 조건 보완 |
| backend/src/modules/activity/approval-route.service.ts | ACTIVITY_REPORT/DIRECT_WORK 지점·부서 승인자 | 기존 경로 adapter와 일반 승인 정의/인스턴스 분리 |
| backend/src/globalization/workflow-profile.ts | KR 2단계, GLOBAL 승인자 미확정 | KR 호환 유지; GLOBAL 목업 규칙은 시연용으로 구분 |
| backend/src/integration/interface.service.ts | enqueuePending, 실행 로그/재시도 | 실연계 없는 모의 transport 추가; 기존 pending 기본값 유지 |
| database/migrations/001_phase1_foundation.sql | company/org/user/role/permission/audit/interface 기초 테이블 | 기존 식별자 보존, additive 설계 |
| database/migrations/011_multi_market_foundation.sql | 회사 profile 코드, 확장 필드 테이블은 미생성 | 설정 bundle/typed extension 설계 추가 |

account-sandbox의 멕시코 주소 예시도 company_code=DIO다. 주소나 고객명으로 법인을 추정하여 이전하지 않는다. 원본 seed를 보존하고 별도 합성 데이터를 US_A/US_B/MX_A에 배정한다.
현재 role_code는 전역 UNIQUE이고 user에는 단일 company_id가 있다. 법인별 역할/membership 추가 없이 UI에서만 법인 분리를 구현하면 안 된다.

## 3. 논리 구조
~~~mermaid
flowchart TD
 A["관리자 화면"] --> B["설정 초안·검증·배포"]
 B --> C["불변 설정 버전"]
 C --> D["법인별 유효 설정 해석"]
 D --> E["화면·메뉴 렌더링"]
 D --> F["서버 권한·필드·상태 검증"]
 F --> G["목업 업무 저장소"]
 F --> H["승인·모의 ERP 처리"]
~~~

- Shared contracts: 설정 스키마, 권한 모델, 제한된 조건식, 공통 validator.
- Admin application: 관리 기능, 검증 오류, 출처/override 표시, 미리보기.
- Runtime resolver: 공통 → HQ/GLOBAL → 국가 → 법인 순서로 적용.
- Authorization: 해석한 기능 범위와 사용자 권한의 교집합을 계산. 권한은 상속 설정으로 확대하지 않는다.
- Repository: 브라우저 목업/서버 목업/향후 SQL adapter를 교체 가능한 포트로 분리.
- Integration: ERP contract를 동일하게 유지하고 transport만 MOCK으로 실행.

## 4. 두 목업 실행 모드
| 모드 | 저장 위치 | 목적 | 보안 검증 범위 |
|---|---|---|---|
| BROWSER_MOCK | 버전된 localStorage envelope | DB/API 없이 UI·설정 시연 | 권한 동작 시뮬레이션; 보안 경계로 인정하지 않음 |
| API_MOCK | NestJS 프로세스의 법인별 메모리 Repository | HTTP 직접 호출·서버 검증 | 기존 인증 Guard와 새 정책 검증 사용; 재시작 시 seed 복원 |
| 향후 SQL | SQL Server | 지속 저장·다중 서버 운영 | 이번 실행 범위 밖, 스키마/adapter 계약만 준비 |

API_MOCK에서는 DatabaseService에 의존하는 auth를 그대로 강제하지 않는다. MockIdentityRepository를 기존 auth 서비스 포트에 주입하고 해시된 합성 계정 fixture로 테스트 JWT를 발급한다. 기존 Guard는 유지한다. 운영 로그인으로 목업 사용자를 허용하지 않는다.
기본 실행 모드는 기존 동작을 유지하며 새 모드는 명시적으로 선택한다. 배포 환경이 production이면 MOCK 구동을 거부한다.

브라우저 저장 key: dio-crm:admin:v1:{datasetId}. 단일 envelope 내부 companies[companyId]와 commonTemplates로 분리하여 dataset 단위 원자 저장한다. 데이터 export 파일은 이번 범위에 없으며 reset 전 변경 개수/범위를 보여주고 해당 dataset만 초기화한다.

## 5. 관리 주체
| 역할 | 기본 범위 |
|---|---|
| 플랫폼 관리자 | 공통 등록부·템플릿, 법인 개설, 고정 속성, 설정 게시 |
| 법인 관리자 | 위임된 자기 법인 설정·사용자·역할, 허용 범위 내 게시 |
| 보안 관리자 | 허가된 법인의 역할·접근 범위·필드 정책 |
| 승인 관리자 | 승인 정의 및 대결 관리; 승인자 본인 권한과 구분 |
| 연계 운영자 | 모의 요청 조회·응답·재처리 |
| 일반 사용자/승인자 | 설정된 업무 기능, 배정된 승인 과제 |

관리 권한도 action 단위로 나눈다. 편집 권한이 게시 권한을 포함하지 않는다. 자기 자신에게 위임 상한보다 큰 권한 부여를 금지한다.

## 6. 적용 경계
- 표준 필드의 의미, 금액 계산, ERP 매핑 코드는 코드 등록부가 소유한다.
- 관리자는 등록된 필드의 배치/표시/법인별 선택값과 허용된 검증을 설정한다.
- 확장 필드는 typed storage에 보관하며 기존 테이블 컬럼 자동 생성은 하지 않는다.
- 언어 변경은 레이블과 형식에만 영향을 주며 법인, 통화 원장 값, 프로세스는 변경하지 않는다.
- 취소/반품 등 기존 미확정 업무를 관리자 설정 기능이라는 이유로 자동 구현하지 않는다.
- 정책 변경은 신규 실행에 적용한다. 진행 중 승인/모의 ERP 요청은 생성 당시 버전을 유지한다.

## 7. v1.1 구현 연결 결정 (2026-10-21)

기준: main 78949684b382769bcb96547fd9ccada712ccbb60. 아래는 기존 코드의 구현 완료 설명이 아니라 이번 보완으로 확정하는 목업 구현 기준이다.

| 연결 지점 | 필수 변경 | 회귀 경계 |
|---|---|---|
| backend/src/app.module.ts | 기존 AppModule은 유지; API_MOCK 전용 MockAppModule과 bootstrap 분기 추가 | MockAppModule은 DatabaseService 및 SQL 의존 업무 service를 등록하지 않음 |
| backend/src/modules/auth/auth.service.ts | IdentityRepository/SessionRepository로 조회·refresh 저장 분리; SQL 구현은 기존 동작 유지 | 기존 Guard를 우회하는 mock 전용 무인증 경로 금지 |
| backend/src/security/security.ts | sessionId, tokenUse, membership/권한 버전 및 MFA 수준 검사 | legacy 숫자 companyId의 의미를 바꾸지 않음 |
| frontend/src/api.ts | 선택적 headers/signal 옵션, status/code/fieldErrors를 가진 ApiError 추가 | 기존 apiGet/Post/Patch 호출 서명은 계속 지원 |
| frontend/src/app/screen-registry.tsx | HQ_ACCOUNT/GLOBAL_ACCOUNT 재사용, effective config 전달 | 기존 registry key 이름 변경 금지 |
| frontend/src/market/field-profiles/types.ts | code↔key, readonly↔readOnly 변환 adapter | 기존 프로필 타입을 암묵적으로 바꾸지 않음 |
| frontend/src/account-sandbox.ts | 기존 저장 adapter와 새 AdminClient 사이 AccountRuntimePort 연결 | 기존 seed 회사 소속 및 원본 백업 보존 |

API_MOCK는 auth/me/admin/거래처 샘플/승인 샘플/모의 ERP만 등록한다. 나머지 기존 업무 API를 DB 없이 모두 지원한다고 표시하지 않는다. 지원하지 않는 화면은 모드 안내와 함께 비활성화하고 호출은 501 MOCK_CAPABILITY_UNAVAILABLE로 일관되게 반환한다. 기존 업무 전체의 재작성은 범위 밖이다.

사용자 거래처 화면은 AccountRuntimePort.list/get/create/update/requestErp를 통해 모드별 adapter를 사용한다. API_MOCK는 /api/admin/companies/:company/runtime/accounts에 연결하고 BROWSER_MOCK는 같은 계약의 로컬 구현을 사용한다. 기존 SQL API의 DTO는 legacy adapter 밖으로 노출하지 않는다.

런타임 모드 변수는 신규 CRM_EXECUTION_MODE=LEGACY|API_MOCK, 프런트는 VITE_CRM_EXECUTION_MODE=LEGACY|API_MOCK|BROWSER_MOCK로 고정한다. 미지정은 LEGACY. 알 수 없는 값/production mock은 bootstrap 전에 실패한다. API_MOCK 프런트는 /api/me/context의 실행 모드가 일치하지 않으면 중단하며 브라우저 목업으로 자동 전환하지 않는다. 서버 목업 전용 진입점은 SQL 환경값을 필수 검증하는 기존 env 모듈을 간접 import하지 않아야 한다. JWT 서명키는 로컬 개발 환경에서 주입하며 production 키/계정을 seed에 포함하지 않는다.
