# 다른 PC에서 DIO CRM 작업 이어가기

## 준비

- Git 및 GitHub 저장소 접근 권한
- Node.js 22.15 이상(프로젝트의 TypeScript 실행 훅 필요)
- pnpm 9.15.0 (`package.json`의 `packageManager` 기준)
- 실제 SQL/ERP 연동이 필요한 경우 별도 네트워크·계정·환경변수

## 소스 받기

확정된 공개 소스 저장소 URL과 작업 브랜치를 사용한다. 현재 기존 작업 브랜치는
`feat/hq-standard-h02-h07`이며, 아직 커밋하지 않은 작업은 clone만으로 전달되지 않는다.

```powershell
git clone --branch codex/portable-crm-20261120 https://github.com/dio-securer/dio_crm_dev_proj.git dio_crm_dev_proj
cd dio_crm_dev_proj
git switch codex/portable-crm-20261120
npm install --global pnpm@9.15.0
pnpm install --frozen-lockfile
pnpm build
pnpm hq:start
```

HQ 목업: `http://127.0.0.1:3210/?hq=1`

이 실행 경로는 실 SQL·ERP·심평원·메일·지도에 연결하지 않으며,
초기 합성 데이터에서 시작한다. 사용자·관리자 UI 개발을 먼저 재현할 때 사용한다.

## 실제 백엔드 개발

- `backend/.env.example`을 참고하여 PC별 환경변수를 설정한다.
- 예제 비밀번호·JWT 값을 실제 운영 값으로 사용하지 않는다.
- 현재 Nest 시작 스크립트는 `.env` 자동 로드를 보장하지 않는다. PowerShell 환경변수나
  승인된 실행 환경으로 주입한 뒤 `pnpm dev:api`를 실행한다.
- 프론트 개발 서버는 다른 터미널에서 `pnpm dev:web`로 실행한다.
- DB 스키마와 기준 데이터 적용은 대상 DB를 확인하고 별도로 수행한다.
- 공개용 소스의 DB 설정은 예제값이다. 실제 접속정보는 환경변수로 주입한다.

## 별도 이전이 필요한 것

- `backend/.hq-mock/`의 로컬 목업 저장 데이터: 동일 데이터까지 필요한 경우 안전한 별도 경로로 복사
- 실제 DB: 소스와 별도의 백업/복구 또는 승인된 개발 DB 연결
- `.env`, 토큰, 인증서, API 키: Git에 넣지 않고 별도 전달
- Salesforce 로그인, 브라우저 세션, GitHub 로그인: 새 PC에서 다시 인증
- Codex 앱의 대화·플러그인·로컬 스킬: Git clone으로 자동 복원되지 않음
- 프로젝트 문서의 PC 절대경로: 새 PC의 프로젝트 경로에 맞게 확인
- PDF 한글 폰트: 목업은 `backend/assets/fonts` 사용, 실제 출력은 `DIO_CRM_PDF_FONT` 설정 확인

## 작업 상태 파악

- `docs/Codex/CRM_IMPLEMENTATION_PROGRESS.md`
- `docs/Codex/CRM_ADMIN_DEVELOPMENT_CHECKLIST.md`
- `docs/Codex/salesforce-functional-map-20261110.md`
- `docs/admin-platform/README.md`
- `docs/rollout/P8-07_cutover_runbook.md`

이 기록은 부분 구현·목업 검증을 포함하므로 운영 연동 완료로 해석하지 않는다.

## 두 PC에서 작업하기

```powershell
# 작업 시작 전
git status
git pull --ff-only

# 작업 후: 변경 목록과 비밀정보 포함 여부를 확인한 파일만 추가
git add <변경한-소스-및-문서>
git commit -m "작업 내용"
git push
```

- 기존 PC의 커밋·push 후 새 PC에서 pull한다.
- 두 PC에서 같은 파일을 동시에 수정한 경우 충돌을 확인해 해결한다.
- `node_modules`, 빌드 결과, 캐시, 로그, 브라우저 세션, 로컬 데이터는 업로드하지 않는다.

## 공개 소스 배포 범위

새 내부 설계자료·Salesforce 캡처·실데이터·로컬 목업 데이터·인증정보는 포함하지 않는다.
해당 자료는 승인된 사내 경로로 별도 이전한다.

