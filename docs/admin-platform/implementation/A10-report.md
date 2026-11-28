# A10 완료 보고

설정 운영 화면의 전체 저장 초안 동시 검증·영향 미리보기·예약/취소/도래 실행·새 release 복원, template 변경 게시 및 DEMO SECURITY 활성화를 연결했다.

- 예약 생성/실행 모두 활성 release·draft revisions/hash·target parent IDs 검사. 취소는 적용0, 비활성 회사 실행 거부, 충돌은 기존 release 보존.
- 공식 publishAt 및 /releases/:id/cancel API와 내부 DEMO 실행 명령 제공. 실제 scheduler 서비스는 사용하지 않는다.
- 템플릿 변경 preview/apply는 초안만 만들고 회사 게시 때만 화면/부모 pin 변경. 대상 부모 경합 및 역rollback 검증.
- SECURITY 게시/상속/rollback마다 CONFIG 정책 read model 동기화. 상위 REQUIRED 완화422, 실제 OTP/SSO 없음. 기존 토큰은 매 요청 MFA·idle·absolute lifetime 재검사. refresh/회사전환에서도 최초 세션 시각 유지.
- 설정 rollback은 세션회수·업무·번호·승인 snapshot을 되돌리지 않는다.
- 주요 설정 편집기 및 실제 거래처 편집의 dirty 상태를 법인 전환에 연결. 모바일 저장/폐기/취소, 실패 입력 보존·포커스 복원 hook, 회사별 컴포넌트/응답세대 격리.

검증: build PASS, 전체 공통/HTTP118 PASS. A10 전용 단위7 + HTTP2 PASS. 실제 화면 BROWSER_MOCK/API_MOCK 모두 예약취소, 모바일 390px 키보드/법인전환 저장·폐기·취소·저장실패, SECURITY 초안→검증→게시→새 로그인 DEMO MFA 통과. 작업자 B 독립9 PASS 및 코드 승인.

T09/T10/T25/T55~T59 회귀는 configuration/security/organization 기존 테스트와 함께 재실행했다. T33/T43-INTEGRATION/T58-INTEGRATION/T81은 operations 테스트, 모바일 T83 대표 업무 흐름은 a10-ui.log. 31개 ADM별 최종 증거 대조는 A11에서 수행한다.
