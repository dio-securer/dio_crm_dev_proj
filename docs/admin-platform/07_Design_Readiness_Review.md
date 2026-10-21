# 07. 설계·작업지시서 충분성 검토 및 보완 내역

검토일: 2026-10-21 KST · 버전 1.1
기준 commit: 78949684b382769bcb96547fd9ccada712ccbb60
범위: docs/admin-platform/README 및 01~06, 연결 코드 정적 열람.
과거 중단 대화의 정확한 지적 목록은 복원되지 않아 현재 문서/코드를 기준으로 재검토했다. 아래는 이번 검토 결과다.

## 1. 판정
보완 전: 아키텍처와 단계 구성은 있으나 계약·bootstrap·MFA·경합 처리에 구현자 추정이 필요하여 문서만으로 일관된 구현을 보장하기 어려움.
보완 후: 31개 관리자 영역과 거래처/승인/ERP 목업 시연을 개발하는 착수 기준으로 사용 가능. A00 실제 연결표와 A01 계약 검증은 필수 단계다. 운영 정책, 실제 ERP payload, 실제 MFA provider, SQL 운영 적용은 후속 범위로 유지한다.

## 2. 발견사항과 반영 위치
| ID | 우선순위 | 근거/부족 내용 | 보완 | 검증 연결 |
|---|---|---|---|---|
| GAP-01 | P0 | AppModule이 SQL 의존 service를 일괄 등록, AuthService가 DB 직접 사용; repository 교체 설명만으로 무DB 기동 불충분 | 01 §7 MockAppModule/env 분리, 03 §7.3 auth/session 포트 | A01 HTTP 기동/egress 검증 |
| GAP-02 | P0 | 기존 JWT.companyId는 number, 새 설계는 UUID; /me/context 기존 필드 보존 문구와 충돌 | 01 §7 adapter, 03 §7.1 adminContext/legacy 분리 | T38 |
| GAP-03 | P0 | 기존 findUserByLogin은 회사 없는 TOP 1, 회사별 login 유일성 요구와 충돌 | homeCompanyCode 로그인, 모호성 오류 | T37 |
| GAP-04 | P0 | MFA가 README 요구 수준이고 세션 모델/엔드포인트/실패·refresh 처리가 미정 | 02 UI, 03 세션/API, 04 §9.2 결정표 | T39~T43 |
| GAP-05 | P0 | 모든 저장에 revision 요구하면서 생성 예외 없음; HTTP helper에 헤더/구조화 오류 지원 없음 | 01 HTTP 확장, 03 §7.1 생성/수정·오류·멱등성 확정 | T44/T47 |
| GAP-06 | P1 | ADM-16/17 도메인, FIELD 확장 정의가 payload 표에서 누락 | LIST_VIEW/ACTION union, extensionDefinitions/role 하위 schema | T46 |
| GAP-07 | P0 | localStorage 단일탭 규칙과 T35 다중탭 검증 간 원자성 미정 | dataset Web Lock+revision+단일 envelope, 미지원 쓰기 차단 | T45 |
| GAP-08 | P1 | 조건 AST 타입/빈값/상반조건 충돌 판정이 미정 | 03 AST/타입, 04 보수적 게시 충돌 규칙 | T48/T50 |
| GAP-09 | P1 | 관리자/일반 승인함, 샘플 업무 CRUD와 runtime 연결 경로 미정 | AccountRuntimePort, 일반 사용자 경로와 sample API 명시 | T46/T52 |
| GAP-10 | P1 | 승인 UI quorum/autoApprove와 실행 ANY/ALL 범위 불일치 | unsupported 옵션 고정, 종결·BLOCKED·사유 규칙 | T52 |
| GAP-11 | P1 | ERP attempt와 event version 충돌·정정 합계 기준 미정 | 04 §9.4 경합/정정 알고리즘 | T53/T54 |
| GAP-12 | P1 | 실행 명령을 구현 때 정하도록 남기고 MFA TC 번호·fixture 기대값 누락 | 05 명령/증거, 06 T37~55/manifest/달력 기대값 | A00~A11 |
| GAP-13 | P1 | 초안 저장 일반 규칙과 즉시 보안 변경 구분, 회사 중지·reset 경계 불명확 | 02 §9 운영/설정 분리, 04 reset/rollback | T49/T55 |
| GAP-14 | P1 | decimal/date/번호/달력 경계 처리 선택 미정 | 정밀도·입력 거부·번호 소진·DST 결정 | T50/T51 |

## 3. 문서 자체 검증
- 31개 ADM 기존 범위 및 A00~A11 유지.
- 기존 T01~T36 유지, 신규 T37~T55 추가, MFA를 A01/A03/A11과 연결.
- 식별자/생성 revision/브라우저 lock의 기존 충돌 문구를 본문에서 정정.
- 문서 상대 링크와 섹션 참조, 도메인·화면·API·단계·TC 대응을 정적 점검.
- 앱 실행·빌드·HTTP/UI 테스트는 이번 문서 보완 작업에서 수행하지 않음. 해당 테스트 결과는 구현 시 06 증거 스키마로 기록.

## 4. 남은 실제 업무 확정사항
| 항목 | 목업 개발 처리 | 운영 전 필요 |
|---|---|---|
| 법인별 승인자/필수 필드/달력 | DEMO fixture로 고정, GLOBAL 미설정은 차단 | 현업 승인된 정책 |
| 실제 ERP schema/interfaceCode | A00 기존 코드 매핑, mock profile만 바인딩 | ERP 담당자 계약/오류/재처리 검증 |
| MFA provider/본인확인 복구 | DEMO provider와 제한 세션 구현 | 실제 TOTP 또는 SSO 선정 및 보안 검증 |
| SQL 지속 저장/다중 인스턴스 | Browser/Memory adapter 계약 검증 | migration, DB transaction/lock 및 복구 검증 |
| 전체 영업 프로세스 | 거래처 수직 시연과 합성 문서 | 별도 업무별 구현 지시서 |

이 항목들은 설계 누락을 숨기기 위한 PASS가 아니라 범위를 명확히 분리한 후속 과제다.
