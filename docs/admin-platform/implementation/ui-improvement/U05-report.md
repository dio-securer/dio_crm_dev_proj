# U05 — 합성 화면 미리보기

작업본/게시본을 별도로 선택하고 탭·그룹·순서·열 수를 시각화한다. 공유 effectiveFields/fieldDefinitions/runtimeFieldAccess/rolesFor 검증·권한 평가를 사용한다. 샘플 역할, 이름/우선순위 및 개별 샘플 값을 바꿔 조건 결과를 확인한다. 미리보기에는 업무 저장 경로가 없다. 기능 OFF와 부정합 설정은 결과를 제거하고 안내한다. 마스킹 결과에는 원문을 넣지 않는다. 기존 합성 JSON 진단을 유지한다.

검증: designer-unit 10/10(조건, 권한, 명시적인 LAST4 출력, 부정합 및 비활성 필드 포함), frontend build PASS. 두 모드 UI에서 작업본/게시본 차이, HIGH 우선순위의 상담일 필수, SALES secret 미노출, 잘못된 name 숨김 시 최신 화면 제거, 모바일 미리보기 PASS. 게시 후 실제 거래처와의 전체 비교는 U07 인수검증에서 수행한다.
