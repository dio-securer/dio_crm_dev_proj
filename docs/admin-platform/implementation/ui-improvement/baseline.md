# U01 기준 및 API 대응
2026-10-22. 기준 원격 69533a0. 별도 worktree/feat/admin-designer-u01-u07 사용. AGENTS.md 없음.
- AccountDesigner의 changes를 designer/model.ts로 추출. 식별자는 key/id.
- HttpAdminClient: GET /api/admin/config/scopes/COMPANY/{companyId}, POST /api/admin/config/drafts, PATCH /api/admin/config/drafts/{id} (If-Match revision, Idempotency-Key).
- POST /api/admin/config/validate: draftIds/revisions/expectedReleaseId.
- POST /api/admin/companies/{companyId}/releases: validationId/expectedReleaseId/reason.
- BrowserSecurityClient는 동일 request 계약과 공유 엔진 사용. config.read/edit/validate/publish 및 delegation의 서버 검사를 유지.
- published/loaded/working과 domain별 dirty 분리, partial save 상태와 같은 payload 재시도 key 유지.
- 프런트 preview의 TTL은 10분 UX 제한으로 추가하되 기존 서버 검증의 version/hash 검사를 대체하지 않음.
검증: model.test.ts 6개 PASS(false/0/빈값/삭제, atomic bulk, group/order, partial retry, late load, undo).
환경: pnpm offline 메타데이터 부족 후 정상 online install로 공급망 검사 통과. 운영 연결 없음.
