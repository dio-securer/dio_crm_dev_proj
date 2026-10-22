# A11 전체 인수검증·사용 안내

상태: **완료, 작업자 B 최종 승인.** A07/A08/A09/A10은 각 단계 보고서의 구현·검증·B 승인을 완료했다.

## 구현 및 보완

- 31개 관리 route를 연결하고 workflows/policies/routes의 기본 편집 탭을 수정했다. 각 대표 폼을 모바일 390px에서 키보드 편집, 주입된409, 입력 보존, 재시도 및 실제 저장값으로 검증한다.
- 역할·데이터범위·필드·메뉴·보기·조건·승인정책의 합성 샘플 미리보기를 추가했다. 정책 우선순위는 높은 값 우선이며 동순위 충돌을 표시하고 feature OFF 메뉴는 제외한다. 실제 사용자 impersonation이나 업무 저장은 수행하지 않는다.
- 관리자 한국어 문구를 locale 리소스로 옮기고 오류 연결·포커스 처리를 보완했다. 업무 화면 ko/en 동작과 관리자 운영 폼 한국어 지원 범위를 안내에 구분했다.
- INTEGRATION 전용 읽기 역할에서 불필요한 config.read 요구를 제거했다.
- DEMO 데이터셋 reset preview/API/UI를 추가했다. 10분TTL, dataset revision, 동일 actor, 모든 회사 권한, transaction 내 재인증을 적용하며 성공 시 DEMO 세션을 폐기한다. 다른 저장 namespace와 원본 CRM은 접근하지 않는다.
- 기존 저장소 migration/backup, Web Locks 미지원, 대결 경계·자기문서·비활성 승인자, 잘못된 정책/정의, 비활성 회사 예약, 복원, 템플릿 변경 HTTP, ERP timeout 경합의 누락 증거를 추가했다.
- `test:admin:all`에 build·계약·engine·HTTP·양 모드 UI·다중시장/i18n/PWA를 등록했다. exit code 외에 비어 있지 않은 로그, Node TAP 완료 집계, 양 모드31ADM 완료 표식도 필수로 검사한다.

## 검증 자료

최종 실행 기준과 suite별 상태는 [evidence/a11-run-results.json](evidence/a11-run-results.json), TC별 모드/입력/기대/실제/commit/증거는 [acceptance-results.json](acceptance-results.json), ADM별 route/editor/client/API/DTO/repository/runtime 연결은 [coverage.md](coverage.md)에 기록한다.

- `pnpm test`: frontend57 + backend74 = 131개.
- 추가 admin engine 계약:35개. admin HTTP:87개(SQL stub LEGACY 포함).
- 31개 관리 영역 × BROWSER_MOCK/API_MOCK:62개 대표 폼 검증.
- HQ_DEMO/US_A/US_B/MX_A fixture 및 기존 KR/US/MX 회귀, locale/PWA 검사.
- 외부 ERP/EMAIL egress0, production mock 기동 거부. 실제 외부연계를 검증한 결과가 아니다.
- T13은 A07 결정/event와 A08 알림 통합, T43은 A03 fixture 및 A10 실제 SECURITY 게시, T58은 A02 CRUD/초안 및 A10 템플릿 게시 HTTP를 분리했다.

초기 실행 실패(하드코딩 검사, route 오류 복구 대기, 누락된 reset/경계 증거)는 수정 후 재검증하여 해소했다. 이전 단계 결과를 복사해 최종 PASS로 대체하지 않는다.

## 작업자 B 검토

B가 지적한 reset API 누락, reset 인증/실행 사이 정책 강화 경합, 권한 오류403, Browser 경계 증거 누락을 수정했다. B는 최신 reset HTTP1/1 및 인증 직후 REQUIRED 정책을 삽입한 독립 경합 테스트에서 reset 거부·session/preview 보존·reset audit 미생성을 확인하고 reset 구현을 승인했다. 작업자 B는 전체20 suite, engine35/HTTP87, 양 모드31ADM,83TC150행과 모든 evidence 파일을 확인하고 A11 코드·검증을 최종 승인했다. T44/T57의 로그 출처 교정도 반영했다. 이는 협업 검토자 B의 승인으로, GitHub의 별도 공식 PR review 제출을 뜻하지 않는다.

## 환경과 후속 범위

`pnpm env:check`는 실행했으며 [a11-env-check.log](evidence/a11-env-check.log)에 환경별 WARN/SKIP을 보존했다. HTTPS DEV/UAT 주소, 지도 공급자, ERP 테스트 endpoint가 제공되지 않아 해당 외부 환경 검증은 수행하지 않았다. 이는 목업 기능 실패가 아니며 운영 준비 PASS로 해석하지 않는다.

실제 OTP·SSO·EMAIL·ERP, 운영 DB 인증/마이그레이션 및 운영 배포는 후속 범위다. LEGACY는 SQL stub 회귀다. 예약 실행은 목업 수동/fake-clock 명령이며 상시 백그라운드 scheduler를 제공하지 않는다. PR #28은 draft로 유지한다.

시연 계정, 실행 명령, 저장 수명·초기화 및 업무 흐름은 [user-guide.md](user-guide.md)를 따른다.

## 검증 기준 커밋

전체 `test:admin:all` 기준은 `b32bc4fa26b008d46c7b1a321e64d6b1a80b4d8d`이다. 이후 `881c29304c96d306c7fa18ea2b250b60a723a0f7`에서 reset preview 자체의 삭제 수1개를 영향 집계에 포함하고 안내의 API 포트를3001로 정정했다. 해당 보정은 build 및 [reset HTTP](evidence/a11-reset-final.log)를 재실행했고, 작업자 B도 독립 HTTP1/1로 승인했다. 애플리케이션 기능 검증의 FAIL/BLOCKED 잔여는 없다. 외부 환경 WARN/SKIP은 앞 절의 제외 범위를 따른다.

count 보정 후 [양 모드 운영·reset UI](evidence/a11-reset-operations-final.log)도 재실행해 통과했다. 최종 보정 build는 [a11-final-build.log](evidence/a11-final-build.log)에 보존했다.

GitHub의 검증 source commit과 로컬 실행 commit은 tree hash로 동일성을 확인했다. 실행 원본 SHA는 JSON의 localCommit에 함께 보존한다.
