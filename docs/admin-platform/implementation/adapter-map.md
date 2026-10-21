# A00 기존/신규 연결 상태

| 경로 | 상태/후속 |
|---|---|
| packages/contracts/src/admin/index.ts | 신규 Company/Config 기본 Zod, Row/Envelope/Repository 계약, 결정적 company seed, 실행모드 검사 함수 |
| backend/src/modules/admin/memory.repository.ts | 신규 메모리 copy-on-write rollback, 직렬 transaction; bootstrap 미연결 |
| frontend/src/admin/client/browser-repository.ts | 신규 Web Locks + 단일 envelope 저장; UI 미연결/실브라우저 미검증 |
| backend/src/app.module.ts 및 auth | 기존 그대로. mock module/SessionAuthGuard 미구현 |
| frontend/src/App.tsx 및 api.ts | 기존 그대로. admin routes/structured error/headers 미구현 |
| account-sandbox / field profiles / screen-registry | 원본 유지, runtime adapter 미구현 |
| 기존 JWT 숫자 ID ↔ 신규 UUID | 신규 COMPANY_IDS 선언만. 실 데이터 변환 adapter 미구현 |

신규 schema는 전체 domain 계약을 완성한 상태가 아니다. Config.payload는 현재 unknown record이므로 A01 후속 구현에서 domain별 strict schema로 확장해야 한다.
