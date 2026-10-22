# U01–U07 checkpoint

기준 원격 69533a0ee598fba2d67ec61063f971a8d1ef655b. 별도 브랜치 feat/admin-designer-u01-u07, 초안 PR #29(base feat/admin-platform-a00-a11). 사용자 PC main/env.ts/salesforce 미접촉.

U01–U05 구현·단계 검증·보고서·GitHub 반영 완료. U06 진행 중: 새 UI 키보드/locale/화면 폭 인수와 추가 경계 시나리오 작성. 기존 account UI 양 모드 PASS; account21/configuration8/operations10 회귀 PASS. 현재 상세창 Escape 후 포커스 복귀 검증 보완 중. U07 아직 완료 아님; 작업자 B 독립 검토와 전체 test:admin:all 및 60행 인수 결과 필요.

작업 경로 /workspace/scratch/60bbf1e11d53/crm-ui. 로컬 마지막 단계 commit 650b134(U05). GitHub connector를 통한 커밋은 SHA가 다르지만 파일 트리를 맞춘다. shell git push는 자격증명 부재로 불가; Git object API로 새 브랜치만 갱신한다.

환경: Chromium /tmp/ui-browser/chromium (npm @sparticuz/chromium 133). 자동 다운로드 zip 손상으로 패키지 압축본 해제. 한국어 테스트 폰트 /tmp/ui-font.css. 로그 /tmp/u06-*.log. 실행 명령 CHROMIUM_PATH=/tmp/ui-browser/chromium pnpm test:admin:designer-ui. 다음: 포커스 보완→추가 인수검증→U06 commit/reflection→U07 worker B 및 전체회귀. 실패나 NOT_RUN을 PASS로 쓰지 않는다.

업데이트: 검증 경로는 /workspace/scratch/60bbf1e11d53/crm-ui-verify, branch feat/admin-designer-verification. 코드4885dde에서 58 PASS/2 BLOCKED(UI29 양 모드). U06 보고서/사용 안내/인수 결과 작성. 원래 crm-ui 작업 폴더의 별도 schemas max100 변경은 보존됨. U07 독립 검토와 기존전체 test:admin:all 진행 예정. 원격 PR29는 아직 U05까지이며 U06 이후 결과를 이어 반영할 것.
