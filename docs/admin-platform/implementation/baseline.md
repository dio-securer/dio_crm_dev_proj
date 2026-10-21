# A00 기준선 / 진행 중단 체크포인트

기준 main: d4fa1842f35eca254cff72c3e2a7d866ae20bdac (PR #27 병합).
설계 검토: 작업자 B가 최종 3cd51f6 기준 병합 가능 확인. 31 ADM/83 TC 대응 확정.

## 수행 결과
- 기존 `pnpm build`: PASS.
- 기존 루트 test script는 `--if-present`를 Jest/Vitest에 전달하여 실패. `pnpm -r --if-present test`로 수정 후 기존 frontend 57/backend 59 PASS.
- A01 공통계약/Repository 초안 추가 후 전체 build PASS, frontend 57/backend 66 = 123 tests PASS.
- 테스트 수는 설계의 T01~T83 인수검증 완료 수가 아니다. 83 TC는 아직 모두 BLOCKED/NOT_RUN.
- A00 HQ/US/MX 화면 캡처 BLOCKED: Playwright 브라우저 없음. Chromium 다운로드가 0MiB/손상 ZIP으로 반복 실패. 시스템 브라우저 없음. apt 대체 설치도 setgroups/setegid 권한 제한으로 실패.
- 따라서 A00 전체 완료 아님. A01은 공통 schema/seed/memory/browser 저장소 초안만 작성했으며 HTTP/API_MOCK/auth/controller 및 UI 연계는 미구현. A02~A11 미착수.

## 실행 환경
Node 24.19.0, 실행된 pnpm 11.25.0 (저장소 packageManager는 9.15.0). packageManager 버전은 변경하지 않았다. 실행 pnpm의 esbuild lifecycle 허용을 pnpm-workspace.yaml에 명시했다. 별도 production 실행 없음.
기존 seed 파일은 수정하지 않았고 실제 DB/ERP 호출 없음. 새 클래스는 기존 앱 route/bootstrap에 연결하지 않았으므로 기존 화면 동작은 유지한다.

## 재개
1. Chromium 실행 가능한 환경에서 의존성 설치 후 `pnpm --filter @dio-crm/web dev --host 127.0.0.1` 실행.
2. `node scripts/admin/baseline.cjs`로 HQ/US/MX baseline 캡처. 스크립트의 me/context 응답은 합성 fixture이며 실제 서버 로그인 검증이 아니다.
3. 캡처 이미지와 정상 화면 내용을 검토하고 A00 연결표/누락을 확인.
4. A01 domain별 Zod DTO, Identity/SessionRepository, mock Nest bootstrap/HTTP/auth 및 production 차단, browser reload/두 탭 검증 완성.
5. A01 인수 통과 후 A02부터 순서대로 진행. 현재 코드를 A01 완료로 간주하지 않는다.

## 미완료
A00 화면 baseline, A01 도메인 상세계약/API/인증/HTTP 및 브라우저 실동작, A02~A11 전체 구현, 31개 관리자 화면 및 83개 인수 시나리오. 구현 main 병합은 하지 않는다.
