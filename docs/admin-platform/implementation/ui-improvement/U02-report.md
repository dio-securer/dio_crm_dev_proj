# U02 — 공통 레이아웃·필드 표

구현: 그룹 탐색, 검색·표시 필터, 안정적인 필드 key 기반 인라인 편집, 변경/상속 배지, 번역 결과와 key를 분리한 상세창. 기존 비 FIELD/SCREEN 진입은 AdvancedDesigner로 보존. 390px에서 그룹/필드/미리보기 전환과 하단 저장 접근 제공.

검증: frontend build PASS. `CHROMIUM_PATH=/tmp/ui-browser/chromium pnpm test:admin:designer-ui`에서 BROWSER_MOCK/API_MOCK 각각 10행 순서 연속 입력, 그룹 왕복 후 입력 유지, 상세창, 모바일 저장 접근 PASS. 화면 u02-grid/u02-mobile 증거. Chromium 133 로컬 패키지를 사용(Playwright 자동 다운로드가 손상됨). 한국어 폰트는 테스트 호스트에 주입.

U03 일괄 편집, U04 게시 통합, U05 시각 미리보기는 후속 단계이며 이 시점 완료로 보지 않는다.
