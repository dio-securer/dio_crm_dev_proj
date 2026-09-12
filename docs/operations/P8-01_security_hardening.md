# P8-01 Security Hardening

## 적용된 Source Baseline
- Production 환경에서 기본 DB/JWT Secret 사용 금지
- CORS Allowlist (`CORS_ORIGINS`)
- HSTS(Production), CSP, X-Frame-Options, X-Content-Type-Options, Referrer/Permissions Policy
- `x-request-id` 생성/전파
- IP 기준 Fixed Window Rate Limit
- Backend Permission Guard를 최종 권한검증점으로 유지
- CI Critical Dependency Audit (`pnpm audit --audit-level=critical`)
- Slow request 로그에 Body/Payload를 기록하지 않음

## Production 필수값
- `CRM_DB_PASSWORD`: Secret Store에서 주입
- `JWT_ACCESS_SECRET`: 32자 이상 임의 Secret
- `JWT_REFRESH_SECRET`: 32자 이상 별도 Secret
- `CORS_ORIGINS`: 실제 CRM Web Origin만 쉼표로 등록
- `CRM_DB_ENCRYPT=true`: 운영 DB TLS 정책에 맞게 적용
- `TRUST_PROXY=true`: 신뢰할 수 있는 Reverse Proxy/App Gateway 뒤에서만 사용

## 운영 전 확인
- HTTPS Only / HTTP→HTTPS Redirect는 Reverse Proxy/WAF에서 구성
- JWT Secret Rotation 절차 확정
- 관리자 `CRM_ADMIN`, Integration 전용 계정 최소권한 확인
- Interface/Audit Payload 개인정보 마스킹 및 보존기간 결정
- Penetration Test / SAST / 외부 취약점 점검은 실제 배포환경 Gate에서 수행

## 미실행
본 Source Baseline 작성만으로 실제 WAF/Firewall/Secret Store/운영 서버 보안설정이 적용된 것으로 간주하지 않는다.
